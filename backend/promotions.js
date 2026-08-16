function isWithinHours(now, { start, end }) {
  const pad = (n) => String(n).padStart(2, "0");
  const current = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return current >= start && current <= end;
}

function isWithinDates(now, { start, end }) {
  const today = now.toISOString().slice(0, 10);
  return today >= start && today <= end;
}

export function getApplicablePromotions(order, menuData, promotions, now = new Date()) {
  const categoryById = new Map(menuData.items.map((item) => [item.id, item.category]));
  const orderSubtotal = order.reduce((sum, line) => sum + line.lineTotal, 0);

  const applicable = [];

  for (const promo of promotions) {
    if (!promo.active) continue;
    const elig = promo.eligibility ?? {};

    if (elig.min_order_total && orderSubtotal < elig.min_order_total) continue;
    if (elig.valid_hours && !isWithinHours(now, elig.valid_hours)) continue;
    if (elig.valid_dates && !isWithinDates(now, elig.valid_dates)) continue;
    if (
      elig.requires_item_from_categories &&
      !order.some((line) =>
        elig.requires_item_from_categories.includes(categoryById.get(line.itemId))
      )
    ) {
      continue;
    }

    const matchingLines = order.filter((line) => {
      if (elig.item_ids && elig.item_ids.includes(line.itemId)) return true;
      if (elig.categories && elig.categories.includes(categoryById.get(line.itemId))) return true;
      return false;
    });

    if (matchingLines.length === 0) continue;

    const appliesTo = matchingLines.map((line) => {
      const amount =
        promo.discount.type === "percentage"
          ? Number((line.lineTotal * (promo.discount.value / 100)).toFixed(2))
          : Number((promo.discount.value * line.quantity).toFixed(2));
      return { itemId: line.itemId, name: line.name, discount_amount: amount };
    });

    const totalDiscount = Number(
      appliesTo.reduce((sum, line) => sum + line.discount_amount, 0).toFixed(2)
    );

    applicable.push({
      id: promo.id,
      name: promo.name,
      rule: promo.rule,
      applies_to: appliesTo,
      total_discount: totalDiscount,
    });
  }

  return applicable;
}
