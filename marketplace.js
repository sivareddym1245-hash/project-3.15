const { randomUUID } = require("node:crypto");

const SEED_ITEMS = [
  {
    id: "textbook-biology",
    title: "Biology: The Essentials",
    description: "Good condition, a few highlighted pages. Great for the intro course.",
    category: "Books",
    price: 18,
    sellerName: "Maya",
    icon: "📚",
  },
  {
    id: "desk-lamp",
    title: "Adjustable desk lamp",
    description: "Works perfectly. Warm and cool light settings; bulb included.",
    category: "Furniture",
    price: 0,
    sellerName: "Jordan",
    icon: "💡",
  },
  {
    id: "mini-fridge",
    title: "Compact mini fridge",
    description: "Clean, quiet, and ready for pickup near the north dorm lobby.",
    category: "Appliances",
    price: 35,
    sellerName: "Alex",
    icon: "🧊",
  },
  {
    id: "mechanical-keyboard",
    title: "Mechanical keyboard",
    description: "Tenkeyless layout with tactile switches. Includes USB cable.",
    category: "Electronics",
    price: 25,
    sellerName: "Sam",
    icon: "⌨️",
  },
  {
    id: "bike-lock",
    title: "Bike U-lock",
    description: "Sturdy lock with two keys. Free to a student who needs it.",
    category: "Other",
    price: 0,
    sellerName: "Riley",
    icon: "🚲",
  },
];

const CATEGORY_ICONS = {
  Books: "📚",
  Furniture: "🪑",
  Appliances: "🧊",
  Electronics: "⌨️",
  Other: "✦",
};

class MarketplaceError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

class Marketplace {
  constructor({ claimTtlMs = 60_000, now = Date.now, seedItems = SEED_ITEMS } = {}) {
    this.claimTtlMs = claimTtlMs;
    this.now = now;
    this.items = new Map(
      seedItems.map((item, index) => [
        item.id,
        {
          ...item,
          status: "available",
          createdAt: this.now() - (seedItems.length - index) * 60_000,
          currentClaim: null,
        },
      ]),
    );
  }

  listItems() {
    this.expireClaims();
    return [...this.items.values()]
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((item) => this.publicItem(item));
  }

  createItem({ title, description, category, price, sellerName }) {
    if (
      typeof title !== "string" ||
      title.trim().length < 2 ||
      title.trim().length > 80 ||
      typeof sellerName !== "string" ||
      sellerName.trim().length < 1 ||
      sellerName.trim().length > 40 ||
      typeof description !== "string" ||
      description.trim().length > 300 ||
      !Object.hasOwn(CATEGORY_ICONS, category) ||
      !Number.isFinite(price) ||
      price < 0 ||
      price > 100_000
    ) {
      throw new MarketplaceError(400, "invalid_listing", "Check the listing details and try again.");
    }

    const item = {
      id: randomUUID(),
      title: title.trim(),
      description: description.trim(),
      category,
      price,
      sellerName: sellerName.trim(),
      icon: CATEGORY_ICONS[category],
      status: "available",
      createdAt: this.now(),
      currentClaim: null,
    };
    this.items.set(item.id, item);
    return this.publicItem(item);
  }

  claimItem(id, buyerName) {
    this.expireClaims();
    const item = this.getItem(id);
    if (item.status !== "available") {
      throw new MarketplaceError(409, "unavailable", "This item is no longer available.");
    }
    if (typeof buyerName !== "string" || buyerName.trim().length < 1 || buyerName.trim().length > 40) {
      throw new MarketplaceError(400, "invalid_buyer", "Enter a name (up to 40 characters) to claim this item.");
    }

    const claim = {
      id: randomUUID(),
      buyerName: buyerName.trim(),
      expiresAt: this.now() + this.claimTtlMs,
    };
    item.status = "reserved";
    item.currentClaim = claim;
    return this.publicItem(item);
  }

  confirmHandoff(id, claimId) {
    this.expireClaims();
    const item = this.getItem(id);
    this.assertActiveClaim(item, claimId);
    item.status = "sold";
    item.currentClaim = null;
    return this.publicItem(item);
  }

  markSold(id) {
    this.expireClaims();
    const item = this.getItem(id);
    if (item.status === "sold" || item.status === "removed") {
      throw new MarketplaceError(409, "unavailable", "This listing is already closed.");
    }
    item.status = "sold";
    item.currentClaim = null;
    return this.publicItem(item);
  }

  removeItem(id) {
    this.expireClaims();
    const item = this.getItem(id);
    if (item.status === "sold" || item.status === "removed") {
      throw new MarketplaceError(409, "unavailable", "This listing is already closed.");
    }
    item.status = "removed";
    item.currentClaim = null;
    return this.publicItem(item);
  }

  expireClaims() {
    const now = this.now();
    for (const item of this.items.values()) {
      if (item.status === "reserved" && item.currentClaim.expiresAt <= now) {
        item.status = "available";
        item.currentClaim = null;
      }
    }
  }

  getItem(id) {
    const item = this.items.get(id);
    if (!item) {
      throw new MarketplaceError(404, "not_found", "This listing could not be found.");
    }
    return item;
  }

  assertActiveClaim(item, claimId) {
    if (
      item.status !== "reserved" ||
      !item.currentClaim ||
      typeof claimId !== "string" ||
      item.currentClaim.id !== claimId
    ) {
      throw new MarketplaceError(409, "claim_inactive", "This claim is no longer active.");
    }
  }

  publicItem(item) {
    return {
      ...item,
      currentClaim: item.currentClaim ? { ...item.currentClaim } : null,
    };
  }
}

module.exports = { Marketplace, MarketplaceError };
