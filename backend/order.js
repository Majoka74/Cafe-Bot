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
