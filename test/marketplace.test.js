const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { Marketplace, MarketplaceError } = require("../marketplace");

function createMarketplace() {
  let now = 1_000;
  const marketplace = new Marketplace({
    now: () => now,
    claimTtlMs: 1_000,
    seedItems: [{
      id: "book",
      title: "A book",
      description: "",
      category: "Books",
      price: 0,
      sellerName: "Seller",
      icon: "📚",
    }],
  });
  return { marketplace, advance: (milliseconds) => { now += milliseconds; } };
}

test("only the first competing claim succeeds", () => {
  const { marketplace } = createMarketplace();
  const claim = marketplace.claimItem("book", "Ari");
  assert.equal(claim.status, "reserved");
  assert.throws(
    () => marketplace.claimItem("book", "Bea"),
    (error) => error instanceof MarketplaceError && error.status === 409 && error.code === "unavailable",
  );
  assert.equal(marketplace.listItems()[0].currentClaim.buyerName, "Ari");
});

test("simultaneous HTTP claims allow exactly one winner", async (t) => {
  const { server } = require("../server");
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const { items } = await (await fetch(`${baseUrl}/api/items`)).json();
  const item = items.find((listing) => listing.status === "available");
  const responses = await Promise.all(["Ari", "Bea"].map((buyerName) => fetch(`${baseUrl}/api/items/${item.id}/claim`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ buyerName }),
  })));

  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
});

test("an unconfirmed claim expires and releases the item", () => {
  const { marketplace, advance } = createMarketplace();
  marketplace.claimItem("book", "Ari");
  advance(1_001);
  const item = marketplace.listItems()[0];
  assert.equal(item.status, "available");
  assert.equal(item.currentClaim, null);
});

test("confirming pickup closes the listing and invalidates the claim", () => {
  const { marketplace } = createMarketplace();
  const claim = marketplace.claimItem("book", "Ari");
  const completed = marketplace.confirmHandoff("book", claim.currentClaim.id);
  assert.equal(completed.status, "sold");
  assert.equal(completed.currentClaim, null);
  assert.throws(() => marketplace.claimItem("book", "Bea"), { code: "unavailable" });
});

test("seller overrides immediately close a reserved listing", () => {
  for (const action of ["markSold", "removeItem"]) {
    const { marketplace } = createMarketplace();
    marketplace.claimItem("book", "Ari");
    const closed = marketplace[action]("book");
    assert.equal(closed.status, action === "markSold" ? "sold" : "removed");
    assert.equal(closed.currentClaim, null);
    assert.throws(() => marketplace.confirmHandoff("book", "stale-claim"), { code: "claim_inactive" });
  }
});

test("invalid listing data is rejected", () => {
  const { marketplace } = createMarketplace();
  assert.throws(
    () => marketplace.createItem({ title: "x", description: "", category: "Unknown", price: -1, sellerName: "" }),
    { code: "invalid_listing" },
  );
});
