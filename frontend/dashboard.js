const API_URL = "http://localhost:3000/api/orders";

const ordersArea = document.getElementById("ordersArea");
const refreshButton = document.getElementById("refreshButton");

const STATUSES = ["confirmed", "preparing", "ready", "completed", "cancelled"];

function formatCurrency(amount) {
  return `$${Number(amount ?? 0).toFixed(2)}`;
}

function formatTime(isoString) {
  const date = new Date(isoString);
  return Number.isNaN(date.getTime()) ? isoString : date.toLocaleString();
}

function itemLine(item) {
  const details = [];
  if (item.size) details.push(item.size);
  if (item.customizations) {
    for (const [name, value] of Object.entries(item.customizations)) {
      details.push(`${name}: ${value}`);
    }
  }
  const detailText = details.length > 0 ? ` (${details.join(", ")})` : "";
  return `${item.quantity}x ${item.name}${detailText} — ${formatCurrency(item.line_total)}`;
}

function customerInfo(fulfillment) {
  if (fulfillment?.type === "delivery") {
    const addressLine = fulfillment.apartment
      ? `${fulfillment.address}, ${fulfillment.apartment}`
      : fulfillment.address;
    const instructions = fulfillment.instructions
      ? ` — Note: ${fulfillment.instructions}`
      : "";
    return `${fulfillment.name} · ${fulfillment.phone} · ${addressLine}${instructions}`;
  }
  if (fulfillment?.type === "pickup") {
    return fulfillment.time
      ? `${fulfillment.name} · Pickup at ${fulfillment.time}`
      : `${fulfillment.name} · Pickup`;
  }
  return "No customer info on file.";
}

function statusOptions(selected) {
  return STATUSES.map(
    (status) =>
      `<option value="${status}" ${status === selected ? "selected" : ""}>${status}</option>`
  ).join("");
}

function renderOrder(order) {
  const card = document.createElement("div");
  card.className = "order-card";
  card.innerHTML = `
    <div class="order-card-header">
      <span class="order-id">#${order.id.slice(0, 8)}</span>
      <span class="order-time">${formatTime(order.placed_at)}</span>
      <span class="status-badge ${order.status}">${order.status}</span>
    </div>
    <ul class="order-items">
      ${order.items.map((item) => `<li>${itemLine(item)}</li>`).join("")}
    </ul>
    <div class="order-section">
      <span class="order-section-label">Fulfillment:</span> ${order.fulfillment?.type ?? "unknown"}
    </div>
    <div class="order-section">
      <span class="order-section-label">Customer:</span> ${customerInfo(order.fulfillment)}
    </div>
    <div class="order-total">Total: ${formatCurrency(order.totals?.total)}</div>
    <div class="status-control">
      <label for="status-${order.id}">Status:</label>
      <select id="status-${order.id}">
        ${statusOptions(order.status)}
      </select>
    </div>
  `;

  const select = card.querySelector("select");
  select.addEventListener("change", async () => {
    const newStatus = select.value;
    select.disabled = true;
    try {
      await updateStatus(order.id, newStatus);
      await loadOrders();
    } catch (err) {
      console.error("Failed to update status:", err.message);
      select.disabled = false;
      select.value = order.status;
    }
  });

  return card;
}

async function updateStatus(id, status) {
  const response = await fetch(`${API_URL}/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
}

async function loadOrders() {
  try {
    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }

    const data = await response.json();
    const orders = data.orders ?? [];

    ordersArea.innerHTML = "";
    if (orders.length === 0) {
      ordersArea.innerHTML = '<p class="empty-state">No orders yet.</p>';
      return;
    }

    for (const order of [...orders].reverse()) {
      ordersArea.appendChild(renderOrder(order));
    }
  } catch (err) {
    console.error("Failed to load orders:", err.message);
    ordersArea.innerHTML = '<p class="empty-state">Couldn\'t load orders. Please try again.</p>';
  }
}

refreshButton.addEventListener("click", loadOrders);
loadOrders();
