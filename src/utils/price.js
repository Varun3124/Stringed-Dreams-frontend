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
