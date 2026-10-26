import {
  getPricing,
  nextDiscountPrice,
  roundToTen,
  fillDiscountPrice,
  fillActualPrice
} from './price';

describe('getPricing', () => {
  test('uses the discount price when it is lower', () => {
    expect(getPricing({ price: 500, discountPrice: 450 })).toEqual({
      price: 500, hasDiscount: true, finalPrice: 450
    });
  });

  test('falls back to the price when there is no discount price', () => {
    expect(getPricing({ price: 500 })).toEqual({ price: 500, hasDiscount: false, finalPrice: 500 });
    expect(getPricing({ price: 500, discountPrice: '' }).finalPrice).toBe(500);
  });

  test('ignores a "discount" that is not below the price', () => {
    expect(getPricing({ price: 500, discountPrice: 600 }).hasDiscount).toBe(false);
  });

  test('handles a missing product', () => {
    expect(getPricing(undefined)).toEqual({ price: 0, hasDiscount: false, finalPrice: 0 });
  });
});

describe('nextDiscountPrice', () => {
  test('a product without a discount follows the new price', () => {
    expect(nextDiscountPrice({ price: 500, discountPrice: 500 }, 700)).toBe(700);
  });

  test('an existing discount is kept when the new price stays above it', () => {
    expect(nextDiscountPrice({ price: 500, discountPrice: 400 }, 600)).toBe(400);
  });

  test('the discount is dropped when the new price falls below it', () => {
    expect(nextDiscountPrice({ price: 500, discountPrice: 400 }, 300)).toBe(300);
  });
});

describe('Fill helpers', () => {
  test('roundToTen rounds to the nearest 10, but never to zero', () => {
    expect(roundToTen(444)).toBe(440);
    expect(roundToTen(445)).toBe(450);
    expect(roundToTen(4)).toBe(4);
  });

  test('fillDiscountPrice applies a negative rate', () => {
    expect(fillDiscountPrice(1000, -10)).toBe(900);
  });

  test('fillDiscountPrice never rounds back up to the full price', () => {
    // 10% off 50 = 45, rounding to 10 gives 50 (no discount), so it keeps whole rupees
    expect(fillDiscountPrice(50, -10)).toBe(45);
  });

  test('fillActualPrice applies a positive markup', () => {
    expect(fillActualPrice(800, 25)).toBe(1000);
  });

  test('fillActualPrice never goes below the discount price', () => {
    expect(fillActualPrice(52, 1)).toBeGreaterThanOrEqual(52);
  });
});
