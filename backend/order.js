import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export function findMenuItem(menuData, itemName) {
  if (typeof itemName !== "string") return undefined;
  const normalized = itemName.trim().toLowerCase();
  return menuData.items.find((item) => item.name.toLowerCase() === normalized);
}

export function addItemToOrder(order, menuData, { item_name, size, quantity } = {}) {
  const item = findMenuItem(menuData, item_name);
  if (!item) {
    return { ok: false, error: `"${item_name}" isn't on the menu.` };
  }
  if (!item.available) {
    return { ok: false, error: `${item.name} is currently unavailable.` };
  }

  const qty = Number.isInteger(quantity) && quantity > 0 ? quantity : 1;

  let unitPrice = item.price;
  let sizeName = null;
  if (item.sizes && item.sizes.length > 0) {
    if (!size) {
      const options = item.sizes.map((s) => s.name).join(", ");
      return {
        ok: false,
        error: `What size would you like for ${item.name}? Options: ${options}.`,
        missing: "size",
      };
    }
    const matchedSize = item.sizes.find(
      (s) => s.name.toLowerCase() === size.trim().toLowerCase()
    );
    if (!matchedSize) {
      const options = item.sizes.map((s) => s.name).join(", ");
      return {
        ok: false,
        error: `"${size}" isn't a valid size for ${item.name}. Options: ${options}.`,
        missing: "size",
      };
    }
    sizeName = matchedSize.name;
    unitPrice = matchedSize.price;
  }

  const line = {
    itemId: item.id,
    name: item.name,
    size: sizeName,
    quantity: qty,
    unitPrice,
    lineTotal: Number((unitPrice * qty).toFixed(2)),
  };

  return { ok: true, order: [...order, line], added: line };
}

function validateCustomizations(item, customizations) {
  const allowed = item.customizations ?? [];
  const entries = Object.entries(customizations);

  if (allowed.length === 0 && entries.length > 0) {
    return { ok: false, error: `${item.name} doesn't have any customization options.` };
  }

  const result = {};
  for (const [name, value] of entries) {
    const group = allowed.find((c) => c.name.toLowerCase() === String(name).trim().toLowerCase());
    if (!group) {
      const options = allowed.map((c) => c.name).join(", ");
      return { ok: false, error: `"${name}" isn't a customization option for ${item.name}. Options: ${options}.` };
    }
    const matchedOption = group.options.find(
      (o) => o.toLowerCase() === String(value).trim().toLowerCase()
    );
    if (!matchedOption) {
      return {
        ok: false,
        error: `"${value}" isn't a valid ${group.name} option for ${item.name}. Options: ${group.options.join(", ")}.`,
      };
    }
    result[group.name] = matchedOption;
  }

  return { ok: true, customizations: result };
}

export function updateOrderItem(
  order,
  menuData,
  { item_name, current_size, size, quantity, customizations } = {}
) {
  const item = findMenuItem(menuData, item_name);
  if (!item) {
    return { ok: false, error: `"${item_name}" isn't on the menu.` };
  }

  const matches = order.filter((line) => {
    if (line.itemId !== item.id) return false;
    if (current_size && line.size?.toLowerCase() !== current_size.trim().toLowerCase()) {
      return false;
    }
    return true;
  });

  if (matches.length === 0) {
    return { ok: false, error: `${item.name} isn't in your order yet.` };
  }
  if (matches.length > 1) {
    return {
      ok: false,
      error: `You have more than one ${item.name} in your order. Please say which size to update.`,
      missing: "current_size",
    };
  }

  const line = matches[0];
  let sizeName = line.size;
  let unitPrice = line.unitPrice;

  if (size !== undefined) {
    if (!item.sizes || item.sizes.length === 0) {
      return { ok: false, error: `${item.name} doesn't come in different sizes.` };
    }
    const matchedSize = item.sizes.find(
      (s) => s.name.toLowerCase() === size.trim().toLowerCase()
    );
    if (!matchedSize) {
      const options = item.sizes.map((s) => s.name).join(", ");
      return {
        ok: false,
        error: `"${size}" isn't a valid size for ${item.name}. Options: ${options}.`,
        missing: "size",
      };
    }
    sizeName = matchedSize.name;
    unitPrice = matchedSize.price;
  }

  let qty = line.quantity;
  if (quantity !== undefined) {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return { ok: false, error: "Quantity must be a positive whole number." };
    }
    qty = quantity;
  }

  let lineCustomizations = line.customizations ?? null;
  if (customizations !== undefined) {
    if (customizations === null) {
      lineCustomizations = null;
    } else {
      if (typeof customizations !== "object" || Array.isArray(customizations)) {
        return { ok: false, error: "Customizations must be a set of option name/value pairs." };
      }
      const result = validateCustomizations(item, customizations);
      if (!result.ok) return result;
      lineCustomizations = result.customizations;
    }
  }

  const updatedLine = {
    ...line,
    size: sizeName,
    quantity: qty,
    unitPrice,
    customizations: lineCustomizations,
    lineTotal: Number((unitPrice * qty).toFixed(2)),
  };

  const updatedOrder = order.map((l) => (l === line ? updatedLine : l));
  return { ok: true, order: updatedOrder, updated: updatedLine };
}

export function summarizeOrder(order) {
  if (!order || order.length === 0) {
    return "The order is currently empty.";
  }

  const lines = order.map((line) => {
    const details = [];
    if (line.size) details.push(line.size);
    if (line.customizations) {
      for (const [name, value] of Object.entries(line.customizations)) {
        details.push(`${name}: ${value}`);
      }
    }
    const detailText = details.length > 0 ? ` (${details.join(", ")})` : "";
    return `${line.quantity}x ${line.name}${detailText} — $${line.lineTotal.toFixed(2)}`;
  });

  const total = order.reduce((sum, line) => sum + line.lineTotal, 0);
  return `${lines.join("; ")}. Subtotal: $${total.toFixed(2)}.`;
}

export function calculateOrderTotal(
  order,
  applicablePromotions,
  { taxRate = 0, deliveryFee = 0, isDelivery = false } = {}
) {
  const subtotal = Number(order.reduce((sum, line) => sum + line.lineTotal, 0).toFixed(2));
  const discount = Number(
    applicablePromotions.reduce((sum, promo) => sum + promo.total_discount, 0).toFixed(2)
  );
  const discountedSubtotal = Number((subtotal - discount).toFixed(2));
  const tax = Number((discountedSubtotal * taxRate).toFixed(2));
  const appliedDeliveryFee = isDelivery ? deliveryFee : 0;
  const total = Number((discountedSubtotal + tax + appliedDeliveryFee).toFixed(2));

  return { subtotal, discount, tax, delivery_fee: appliedDeliveryFee, total };
}

export function summarizeOrderTotal(totals) {
  if (totals.subtotal === 0) {
    return "The order is currently empty, so there's no total yet.";
  }

  const parts = [`Subtotal: $${totals.subtotal.toFixed(2)}`];
  if (totals.discount > 0) parts.push(`Discount: -$${totals.discount.toFixed(2)}`);
  if (totals.tax > 0) parts.push(`Tax: $${totals.tax.toFixed(2)}`);
  if (totals.delivery_fee > 0) parts.push(`Delivery fee: $${totals.delivery_fee.toFixed(2)}`);
  parts.push(`Total: $${totals.total.toFixed(2)}`);
  return `${parts.join(", ")}.`;
}

const MAX_PICKUP_NAME_LENGTH = 100;
const MAX_PICKUP_TIME_LENGTH = 50;

export function setPickupInfo(pickup, { name, pickup_time } = {}) {
  const updated = { ...(pickup ?? {}) };

  if (name !== undefined) {
    if (typeof name !== "string" || !name.trim()) {
      return { ok: false, error: "Please provide a valid name for the pickup order." };
    }
    if (name.trim().length > MAX_PICKUP_NAME_LENGTH) {
      return { ok: false, error: "That name is too long." };
    }
    updated.name = name.trim();
  }

  if (pickup_time !== undefined) {
    if (typeof pickup_time !== "string" || !pickup_time.trim()) {
      return { ok: false, error: "Please provide a valid pickup time." };
    }
    if (pickup_time.trim().length > MAX_PICKUP_TIME_LENGTH) {
      return { ok: false, error: "That pickup time is too long." };
    }
    updated.time = pickup_time.trim();
  }

  return { ok: true, pickup: updated };
}

export function summarizePickup(pickup) {
  if (!pickup?.name) {
    return "No pickup name on file yet.";
  }
  return pickup.time
    ? `Pickup for ${pickup.name} at ${pickup.time}.`
    : `Pickup for ${pickup.name} (no specific time requested).`;
}

const MAX_DELIVERY_NAME_LENGTH = 100;
const MAX_DELIVERY_PHONE_LENGTH = 20;
const MAX_DELIVERY_ADDRESS_LENGTH = 200;
const MAX_DELIVERY_APARTMENT_LENGTH = 50;
const MAX_DELIVERY_INSTRUCTIONS_LENGTH = 300;

export function setDeliveryInfo(
  delivery,
  { name, phone, address, apartment, instructions } = {}
) {
  const updated = { ...(delivery ?? {}) };

  if (name !== undefined) {
    if (typeof name !== "string" || !name.trim()) {
      return { ok: false, error: "Please provide a valid name for the delivery order." };
    }
    if (name.trim().length > MAX_DELIVERY_NAME_LENGTH) {
      return { ok: false, error: "That name is too long." };
    }
    updated.name = name.trim();
  }

  if (phone !== undefined) {
    if (typeof phone !== "string" || !phone.trim()) {
      return { ok: false, error: "Please provide a valid phone number for the delivery order." };
    }
    if (phone.trim().length > MAX_DELIVERY_PHONE_LENGTH) {
      return { ok: false, error: "That phone number is too long." };
    }
    updated.phone = phone.trim();
  }

  if (address !== undefined) {
    if (typeof address !== "string" || !address.trim()) {
      return { ok: false, error: "Please provide a valid delivery address." };
    }
    if (address.trim().length > MAX_DELIVERY_ADDRESS_LENGTH) {
      return { ok: false, error: "That delivery address is too long." };
    }
    updated.address = address.trim();
  }

  if (apartment !== undefined) {
    if (typeof apartment !== "string" || !apartment.trim()) {
      return { ok: false, error: "Please provide a valid apartment/unit." };
    }
    if (apartment.trim().length > MAX_DELIVERY_APARTMENT_LENGTH) {
      return { ok: false, error: "That apartment/unit is too long." };
    }
    updated.apartment = apartment.trim();
  }

  if (instructions !== undefined) {
    if (typeof instructions !== "string" || !instructions.trim()) {
      return { ok: false, error: "Please provide valid delivery instructions." };
    }
    if (instructions.trim().length > MAX_DELIVERY_INSTRUCTIONS_LENGTH) {
      return { ok: false, error: "Those delivery instructions are too long." };
    }
    updated.instructions = instructions.trim();
  }

  return { ok: true, delivery: updated };
}

export function summarizeDelivery(delivery) {
  if (!delivery?.name && !delivery?.phone && !delivery?.address) {
    return "No delivery info on file yet.";
  }

  const missing = [];
  if (!delivery?.name) missing.push("name");
  if (!delivery?.phone) missing.push("phone number");
  if (!delivery?.address) missing.push("delivery address");
  if (missing.length > 0) {
    return `Delivery info so far is incomplete. Still needed: ${missing.join(", ")}.`;
  }

  const addressLine = delivery.apartment
    ? `${delivery.address}, ${delivery.apartment}`
    : delivery.address;
  const instructionsText = delivery.instructions
    ? ` Delivery instructions: ${delivery.instructions}.`
    : "";
  return `Deliver to ${delivery.name} (${delivery.phone}) at ${addressLine}.${instructionsText}`;
}

export function buildOrderSummary(order, { pickup = {}, delivery = {}, promotions = [], totals } = {}) {
  const items = order.map((line) => ({
    name: line.name,
    size: line.size,
    quantity: line.quantity,
    customizations: line.customizations ?? null,
    unit_price: line.unitPrice,
    line_total: line.lineTotal,
  }));

  let fulfillment;
  if (delivery?.address) {
    fulfillment = {
      type: "delivery",
      name: delivery.name ?? null,
      phone: delivery.phone ?? null,
      address: delivery.address,
      apartment: delivery.apartment ?? null,
      instructions: delivery.instructions ?? null,
    };
  } else if (pickup?.name) {
    fulfillment = {
      type: "pickup",
      name: pickup.name,
      time: pickup.time ?? null,
    };
  } else {
    fulfillment = { type: null };
  }

  return {
    items,
    fulfillment,
    promotions,
    totals,
  };
}

const CONFIRMATION_PHRASES = [
  "yes",
  "yep",
  "yup",
  "yeah",
  "confirm",
  "confirmed",
  "correct",
  "perfect",
  "go ahead",
  "place it",
  "place the order",
  "sounds good",
  "looks good",
  "that's correct",
  "thats correct",
  "that's right",
  "thats right",
];

const AMBIGUOUS_WORDS = [
  "no",
  "not",
  "wait",
  "actually",
  "maybe",
  "hold on",
  "hmm",
  "unsure",
  "cancel",
  "don't",
  "dont",
  "nah",
  "change",
  "instead",
];

function containsWord(text, word) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`).test(text);
}

export function isExplicitOrderConfirmation(message) {
  if (typeof message !== "string") return false;

  const normalized = message
    .trim()
    .toLowerCase()
    .replace(/[!.?,]+$/g, "")
    .trim();

  if (!normalized) return false;
  if (AMBIGUOUS_WORDS.some((word) => containsWord(normalized, word))) return false;

  return CONFIRMATION_PHRASES.some(
    (phrase) => normalized === phrase || normalized.startsWith(`${phrase} `) || normalized.startsWith(`${phrase}, `)
  );
}

function isFulfillmentComplete(pickup, delivery) {
  if (delivery?.address) {
    return Boolean(delivery.name && delivery.phone && delivery.address);
  }
  return Boolean(pickup?.name);
}

export function canPlaceOrder({ order, pickup, delivery, awaitingConfirmation, message }) {
  if (!order || order.length === 0) {
    return { ok: false, error: "The order is empty, so there's nothing to place." };
  }
  if (!isFulfillmentComplete(pickup, delivery)) {
    return {
      ok: false,
      error: "Fulfillment details are incomplete. Collect the required pickup or delivery info first.",
    };
  }
  if (!awaitingConfirmation) {
    return {
      ok: false,
      error:
        "The full order summary hasn't been read back to the customer yet. Call get_order_summary and read it back before asking for confirmation.",
    };
  }
  if (!isExplicitOrderConfirmation(message)) {
    return {
      ok: false,
      error:
        "That reply isn't an explicit confirmation. Ask the customer to clearly confirm (e.g. \"yes, place the order\") before finalizing — an unclear or ambiguous reply never counts as confirmation.",
    };
  }
  return { ok: true };
}

export async function saveOrder(rootDir, orderSummary) {
  const ordersPath = path.join(rootDir, "data", "orders.json");

  let orders = [];
  try {
    orders = JSON.parse(await readFile(ordersPath, "utf-8"));
  } catch {
    orders = [];
  }

  const record = {
    id: randomUUID(),
    placed_at: new Date().toISOString(),
    status: "confirmed",
    ...orderSummary,
  };

  orders.push(record);
  await writeFile(ordersPath, JSON.stringify(orders, null, 2));
  return record;
}

export function removeItemFromOrder(order, menuData, { item_name, current_size } = {}) {
  const item = findMenuItem(menuData, item_name);
  if (!item) {
    return { ok: false, error: `"${item_name}" isn't on the menu.` };
  }

  const matches = order.filter((line) => {
    if (line.itemId !== item.id) return false;
    if (current_size && line.size?.toLowerCase() !== current_size.trim().toLowerCase()) {
      return false;
    }
    return true;
  });

  if (matches.length === 0) {
    return { ok: false, error: `${item.name} isn't in your order yet.` };
  }
  if (matches.length > 1) {
    return {
      ok: false,
      error: `You have more than one ${item.name} in your order. Please say which size to remove.`,
      missing: "current_size",
    };
  }

  const line = matches[0];
  const updatedOrder = order.filter((l) => l !== line);
  return { ok: true, order: updatedOrder, removed: line };
}
