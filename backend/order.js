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
  return `${lines.join("; ")}. Total: $${total.toFixed(2)}.`;
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
