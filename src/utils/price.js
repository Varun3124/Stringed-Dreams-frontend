/*
 * A product's `discountPrice` is what customers pay; it equals `price` unless a discount is
 * set. Older products (or a stale saved catalog) may not carry the field yet, so it falls
 * back to the price.
 */
export const getPricing = (product) => {
  const price = Number(product?.price) || 0;
  const rawDiscount = product?.discountPrice;
  const discount = rawDiscount === undefined || rawDiscount === null || rawDiscount === '' ? price : Number(rawDiscount);
  const hasDiscount = Number.isFinite(discount) && discount < price;
  return {
    price,
    hasDiscount,
    // The amount actually charged, for sorting and filtering
    finalPrice: hasDiscount ? discount : price
  };
};

// When only the price changes (mirrors the server): a product without a discount follows its
// price, and an existing discount stays unless the new price drops below it
export const nextDiscountPrice = (product, price) => {
  const discount = product.discountPrice ?? product.price;
  const hadDiscount = discount < product.price;
  return hadDiscount && discount <= price ? discount : price;
};

// Admin "Fill" helpers. Results round to the nearest ₹10, falling back to the nearest rupee
// when that would round a cheap item down to nothing.
export const roundToTen = (amount) => {
  const rounded = Math.round(amount / 10) * 10;
  return rounded > 0 ? rounded : Math.max(0, Math.round(amount));
};

// `ratePercent` is negative, e.g. -10 for 10% off. Never above the price; on cheap items where
// rounding to ₹10 would cancel the discount, rounds to whole rupees instead.
export const fillDiscountPrice = (price, ratePercent) => {
  const raw = price * (1 + ratePercent / 100);
  const rounded = roundToTen(raw);
  return rounded < price ? rounded : Math.min(price, Math.round(raw));
};

// `ratePercent` is positive, e.g. 25 to mark the discount price up by 25%. Never below the
// discount price, with the same whole-rupee fallback.
export const fillActualPrice = (discountPrice, ratePercent) => {
  const raw = discountPrice * (1 + ratePercent / 100);
  const rounded = roundToTen(raw);
  return rounded > discountPrice ? rounded : Math.max(discountPrice, Math.round(raw));
};
