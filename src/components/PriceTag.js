import React from 'react';
import { getPricing } from '../utils/price';

const defaultFormat = (amount) => `₹${amount}`;

/*
 * A product's price. When it has a discount, the original price is struck through
 * (with a slanted line, see .price-original in index.css) and the discount price follows it.
 */
const PriceTag = ({ product, format = defaultFormat }) => {
  const { price, hasDiscount, finalPrice } = getPricing(product);

  if (!hasDiscount) return <span className="price-tag">{format(price)}</span>;

  return (
    <span className="price-tag has-discount">
      <del className="price-original">
        <span className="visually-hidden">Original price </span>
        {format(price)}
      </del>
      <ins className="price-current">
        <span className="visually-hidden">Discounted price </span>
        {format(finalPrice)}
      </ins>
    </span>
  );
};

export default PriceTag;
