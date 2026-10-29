const nameInput = document.querySelector("#student-name");
const grid = document.querySelector("#listing-grid");
const emptyState = document.querySelector("#empty-state");
const searchInput = document.querySelector("#search-input");
const listingDialog = document.querySelector("#listing-dialog");
const listingForm = document.querySelector("#listing-form");
const formError = document.querySelector("#form-error");
const toast = document.querySelector("#toast");

let items = [];
let selectedCategory = "All";
let toastTimer;
let refreshInProgress = false;

nameInput.value = localStorage.getItem("commonroom-student-name") || "";
nameInput.addEventListener("input", () => localStorage.setItem("commonroom-student-name", nameInput.value.trim()));

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(payload.message || "Something went wrong.");
    error.status = response.status;
    error.code = payload.error;
    throw error;
  }
  return payload;
}

function showToast(message, isError = false) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.toggle("error", isError);
  toast.classList.add("visible");
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 3200);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function priceLabel(price) {
  if (price === 0) return '<span class="item-price free">Free</span>';
  return `<span class="item-price">$${Number(price).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>`;
}

function statusLabel(status) {
  if (status === "reserved") return '<span class="status-pill reserved">◷ Claimed</span>';
  if (status === "sold") return '<span class="status-pill sold">✓ Sold</span>';
  return '<span class="status-pill removed">Removed</span>';
}

function cardMarkup(item) {
  const title = escapeHtml(item.title);
  const seller = escapeHtml(item.sellerName);
  const category = escapeHtml(item.category);
  const description = escapeHtml(item.description || "A campus find, ready for a new home.");
  let action = "";

  if (item.status === "available") {
    action = `<div class="claim-box"><button class="claim-button" data-action="claim" data-id="${item.id}" type="button">Claim item <span aria-hidden="true">↗</span></button></div>
      <div class="seller-tools"><button class="text-action" data-action="sold" data-id="${item.id}" type="button">Mark sold elsewhere</button><button class="text-action" data-action="remove" data-id="${item.id}" type="button">Remove</button></div>`;
  } else if (item.status === "reserved") {
    const secondsLeft = Math.max(0, Math.ceil((item.currentClaim.expiresAt - Date.now()) / 1000));
    const claimDetails = `<div class="claim-detail">Held for <strong>${escapeHtml(item.currentClaim.buyerName)}</strong><span class="countdown" data-expiry="${item.currentClaim.expiresAt}">${formatTime(secondsLeft)}</span>`;
    const handoff = item.currentClaim.buyerName.toLowerCase() === nameInput.value.trim().toLowerCase()
      ? `<button class="handoff-button" data-action="handoff" data-id="${item.id}" data-claim="${item.currentClaim.id}" type="button">Confirm in-person pickup</button>`
      : "";
    action = `${statusLabel(item.status)}${claimDetails}${handoff}</div>
      <div class="seller-tools"><button class="text-action" data-action="sold" data-id="${item.id}" type="button">Mark sold elsewhere</button><button class="text-action" data-action="remove" data-id="${item.id}" type="button">Force remove</button></div>`;
  } else {
    action = statusLabel(item.status);
  }

  return `<article class="listing-card">
    <div class="card-top"><span class="item-art" aria-hidden="true">${escapeHtml(item.icon || "✦")}</span><span class="category-label">${category}</span></div>
    <h3 class="item-title" title="${title}">${title}</h3>
    <p class="item-description">${description}</p>
    <div class="card-meta"><span class="seller"><span class="seller-avatar">${seller.slice(0, 1).toUpperCase()}</span> From ${seller}</span>${priceLabel(item.price)}</div>
    <div class="card-actions">${action}</div>
  </article>`;
}

function formatTime(seconds) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function render() {
  const query = searchInput.value.trim().toLowerCase();
  const filtered = items.filter((item) => {
    const matchesCategory = selectedCategory === "All" || item.category === selectedCategory;
    const matchesSearch = `${item.title} ${item.description} ${item.category} ${item.sellerName}`.toLowerCase().includes(query);
    return matchesCategory && matchesSearch && item.status !== "removed";
  });
  grid.innerHTML = filtered.map(cardMarkup).join("");
  emptyState.hidden = filtered.length !== 0;
  document.querySelector("#available-count").textContent = items.filter((item) => item.status === "available").length;
  document.querySelector("#reserved-count").textContent = items.filter((item) => item.status === "reserved").length;
}

async function refreshItems() {
  if (refreshInProgress) return;
  refreshInProgress = true;
  try {
    const result = await api("/api/items");
    items = result.items;
    render();
  } catch (error) {
    showToast(error.message, true);
  } finally {
    refreshInProgress = false;
  }
}

document.querySelector("#category-list").addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  selectedCategory = button.dataset.category;
  document.querySelectorAll(".category-chip").forEach((chip) => chip.classList.toggle("active", chip === button));
  render();
});

searchInput.addEventListener("input", render);

document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    searchInput.focus();
  }
});

function openListingDialog() {
  formError.textContent = "";
  const sellerField = listingForm.elements.sellerName;
  if (sellerField) sellerField.value = nameInput.value.trim();
  listingDialog.showModal();
}

document.querySelector("#open-listing").addEventListener("click", openListingDialog);
document.querySelector("#empty-listing").addEventListener("click", openListingDialog);
document.querySelector("[data-close-dialog]").addEventListener("click", () => listingDialog.close());
listingDialog.addEventListener("click", (event) => {
  if (event.target === listingDialog) listingDialog.close();
});

listingForm.insertAdjacentHTML("afterbegin", '<label class="form-label">Your name<input name="sellerName" maxlength="40" required placeholder="Name shown on listing"></label>');
listingForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  formError.textContent = "";
  const submitButton = listingForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  const formData = new FormData(listingForm);
  try {
    await api("/api/items", {
      method: "POST",
      body: JSON.stringify({
        title: formData.get("title"),
        description: formData.get("description"),
        category: formData.get("category"),
        price: Number(formData.get("price")),
        sellerName: formData.get("sellerName"),
      }),
    });
    listingForm.reset();
    listingDialog.close();
    showToast("Your item is in the circle.");
    await refreshItems();
  } catch (error) {
    formError.textContent = error.message;
  } finally {
    submitButton.disabled = false;
  }
});

grid.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const { action, id, claim } = button.dataset;
  if (action === "claim" && !nameInput.value.trim()) {
    nameInput.focus();
    showToast("Add your name up top before claiming.", true);
    return;
  }

  button.disabled = true;
  try {
    if (action === "claim") {
      await api(`/api/items/${encodeURIComponent(id)}/claim`, {
        method: "POST",
        body: JSON.stringify({ buyerName: nameInput.value.trim() }),
      });
      showToast("It's yours to pick up! We'll hold it for a little while.");
    } else if (action === "handoff") {
      await api(`/api/items/${encodeURIComponent(id)}/handoff`, {
        method: "POST",
        body: JSON.stringify({ claimId: claim }),
      });
      showToast("Pickup confirmed. Thanks for keeping good things going!");
    } else if (action === "sold") {
      await api(`/api/items/${encodeURIComponent(id)}/sold`, { method: "POST" });
      showToast("Marked sold. The active claim has been cleared.");
    } else if (action === "remove") {
      await api(`/api/items/${encodeURIComponent(id)}`, { method: "DELETE" });
      showToast("Listing removed from the marketplace.");
    }
    await refreshItems();
  } catch (error) {
    showToast(error.message, true);
    await refreshItems();
  } finally {
    button.disabled = false;
  }
});

setInterval(() => {
  const now = Date.now();
  document.querySelectorAll("[data-expiry]").forEach((counter) => {
    const secondsLeft = Math.max(0, Math.ceil((Number(counter.dataset.expiry) - now) / 1000));
    counter.textContent = formatTime(secondsLeft);
    if (secondsLeft === 0) refreshItems();
  });
}, 1000);

refreshItems();
setInterval(refreshItems, 2500);
