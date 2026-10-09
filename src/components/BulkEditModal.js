import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FaTimes } from 'react-icons/fa';
import TagInput from './TagInput';
import { toList, tagKey } from '../utils/tags';
import { nextDiscountPrice } from '../utils/price';

// Values every product has (case-insensitive), in the first product's order and spelling
const sharedTags = (products, field) => {
  const [first = [], ...rest] = products.map((p) => toList(p[field]));
  const restKeys = rest.map((list) => new Set(list.map(tagKey)));
  return first.filter((value) => restKeys.every((keys) => keys.has(tagKey(value))));
};

const sharedValue = (values) => (values.every((v) => v === values[0]) ? values[0] : undefined);
const sharedNumber = (values) => {
  const value = sharedValue(values);
  return value === undefined ? '' : String(value);
};

const sameList = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

// Shared values the form no longer has are removed from every product; new ones are added
const tagEdit = (initial, final) => {
  const finalKeys = new Set(final.map(tagKey));
  const initialKeys = new Set(initial.map(tagKey));
  return {
    removed: new Set(initial.map(tagKey).filter((key) => !finalKeys.has(key))),
    added: final.filter((value) => !initialKeys.has(tagKey(value)))
  };
};
const applyTagEdit = (list, { removed, added }) => toList([
  ...toList(list).filter((value) => !removed.has(tagKey(value))),
  ...added
]);

const readInitial = (products) => ({
  color: sharedTags(products, 'color'),
  beadType: sharedTags(products, 'beadType'),
  price: sharedNumber(products.map((p) => p.price)),
  discountPrice: sharedNumber(products.map((p) => p.discountPrice ?? p.price)),
  stock: sharedNumber(products.map((p) => p.stock)),
  // null = mixed
  featured: sharedValue(products.map((p) => Boolean(p.featuredInCarousel))) ?? null
});

/*
 * Edits many products at once. Fields start with the values all selected products share;
 * only fields that are changed are applied. Calls `onApply([{ product, patch }])` with a
 * patch for every product that actually changes.
 */
const BulkEditModal = ({ products, colorSuggestions, beadSuggestions, onApply, onClose }) => {
  const [initial] = useState(() => readInitial(products));
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const featuredRef = useRef(null);

  useEffect(() => {
    if (featuredRef.current) featuredRef.current.indeterminate = form.featured === null;
  }, [form.featured]);

  const setField = (field) => (value) => {
    setError('');
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // undefined = leave unchanged (untouched, or cleared — a price can't be blanked)
  const readAmount = (field, label) => {
    const text = String(form[field]).trim();
    if (text === '' || text === initial[field]) return undefined;
    const num = Number(text);
    if (!Number.isFinite(num) || num < 0) throw new Error(`Please enter a valid ${label}`);
    return num;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    let price, discountPrice, stock;
    try {
      price = readAmount('price', 'price');
      discountPrice = readAmount('discountPrice', 'discount price');
      stock = readAmount('stock', 'stock');
    } catch (err) {
      setError(err.message);
      return;
    }

    if (discountPrice !== undefined) {
      const conflicts = products.filter((p) => discountPrice > (price ?? p.price)).length;
      if (conflicts > 0) {
        setError(price !== undefined
          ? "Discount price can't be higher than the price"
          : `Discount price is higher than the price of ${conflicts} selected product${conflicts === 1 ? '' : 's'}`);
        return;
      }
    }

    const colorEdit = tagEdit(initial.color, toList(form.color));
    const beadEdit = tagEdit(initial.beadType, toList(form.beadType));
    const featured = form.featured !== initial.featured ? form.featured : null;

    const patches = products.map((product) => {
      const patch = {};
      const currentColors = toList(product.color);
      const nextColors = applyTagEdit(currentColors, colorEdit);
      if (!sameList(nextColors, currentColors)) patch.color = nextColors;
      const currentBeads = toList(product.beadType);
      const nextBeads = applyTagEdit(currentBeads, beadEdit);
      if (!sameList(nextBeads, currentBeads)) patch.beadType = nextBeads;

      const currentDiscount = product.discountPrice ?? product.price;
      if (price !== undefined && price !== product.price) {
        patch.price = price;
        patch.discountPrice = discountPrice ?? nextDiscountPrice(product, price);
      } else if (discountPrice !== undefined && discountPrice !== currentDiscount) {
        patch.discountPrice = discountPrice;
      }

      if (stock !== undefined && stock !== product.stock) patch.stock = stock;
      if (featured !== null && featured !== Boolean(product.featuredInCarousel)) {
        patch.featuredInCarousel = featured;
      }
      return { product, patch };
    }).filter(({ patch }) => Object.keys(patch).length > 0);

    if (patches.length === 0) {
      setError('Nothing to change — edit a field first');
      return;
    }
    onApply(patches);
  };

  const mixed = 'Mixed';

  return (
    <motion.div className="modal-overlay" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="modal-content" onClick={(e) => e.stopPropagation()} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} transition={{ type: 'spring', damping: 25 }}>
        <div className="modal-header">
          <h3>Edit {products.length} Product{products.length === 1 ? '' : 's'}</h3>
          <button className="close-btn" onClick={onClose}><FaTimes /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <p className="form-hint">
            Fields show what all selected products share; blank and unchanged fields are left as
            they are. Removing a color or bead type removes it from every selected product.
          </p>
          {error && <div className="message error">{error}</div>}
          <div className="form-group">
            <label>Colors</label>
            <TagInput
              value={form.color}
              onChange={setField('color')}
              suggestions={colorSuggestions}
              swatches
              label="Add color"
              placeholder="Add colors to all selected products"
            />
          </div>
          <div className="form-group">
            <label>Bead Types</label>
            <TagInput
              value={form.beadType}
              onChange={setField('beadType')}
              suggestions={beadSuggestions}
              label="Add bead type"
              placeholder="Add bead types to all selected products"
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Price</label>
              <input type="number" step="0.01" min="0" value={form.price} onChange={(e) => setField('price')(e.target.value)} placeholder={mixed} />
            </div>
            <div className="form-group">
              <label>Discount Price</label>
              <input type="number" step="0.01" min="0" value={form.discountPrice} onChange={(e) => setField('discountPrice')(e.target.value)} placeholder={mixed} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Stock</label>
              <input type="number" min="0" value={form.stock} onChange={(e) => setField('stock')(e.target.value)} placeholder={mixed} />
            </div>
            <div className="form-group">
              <label>Featured</label>
              <label className="bulk-featured-toggle">
                <input ref={featuredRef} type="checkbox" checked={form.featured === true} onChange={(e) => setField('featured')(e.target.checked)} />
                {form.featured === null ? 'Mixed — click to set for all' : 'Show in the homepage carousel'}
              </label>
            </div>
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Apply to {products.length} product{products.length === 1 ? '' : 's'}</button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

export default BulkEditModal;
