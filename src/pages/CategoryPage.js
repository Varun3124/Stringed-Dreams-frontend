import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { FaFilter, FaTimes, FaChevronRight } from 'react-icons/fa';
import ProductCard from '../components/ProductCard';
import PriceRangeSlider, { formatRupees } from '../components/PriceRangeSlider';
import { useCatalog } from '../data/catalog';
import { toList, tagKey, cssSwatch } from '../utils/tags';
import { getPricing } from '../utils/price';

const FILTER_PARAMS = ['color', 'bead', 'min', 'max', 'stock'];

const SORT_OPTIONS = [
  { value: 'featured', label: 'Featured' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'newest', label: 'Newest' }
];

const SORTERS = {
  featured: (a, b) => (a.displayOrder || 0) - (b.displayOrder || 0),
  'price-asc': (a, b) => getPricing(a).finalPrice - getPricing(b).finalPrice,
  'price-desc': (a, b) => getPricing(b).finalPrice - getPricing(a).finalPrice,
  newest: (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
};

const parsePrice = (value) => {
  if (value === null || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : null;
};

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

// Unique options (case-insensitive) with how many products carry each one
const buildOptions = (products, field) => {
  const options = new Map();
  products.forEach((product) => {
    toList(product[field]).forEach((value) => {
      const key = tagKey(value);
      const existing = options.get(key);
      if (existing) existing.count += 1;
      else options.set(key, { key, label: capitalize(value), count: 1 });
    });
  });
  return [...options.values()].sort((a, b) => a.label.localeCompare(b.label));
};

// A slider step that gives ~100 positions across the price range
const pickStep = (range) => {
  if (range <= 100) return 1;
  if (range <= 1000) return 10;
  if (range <= 10000) return 50;
  return 100;
};

const Swatch = ({ value }) => {
  const swatch = cssSwatch(value);
  return <span className={`color-swatch ${swatch ? '' : 'unknown'}`} style={swatch ? { background: swatch } : undefined} />;
};

// `counts` (optional) overrides each option's static count; unselected options at 0 are disabled
const FilterChips = ({ options, selected, onToggle, swatches, counts }) => (
  <div className="cat-chips">
    {options.map((option) => {
      const active = selected.includes(option.key);
      const count = counts ? (counts.get(option.key) || 0) : option.count;
      const unavailable = !active && count === 0;
      return (
        <button
          key={option.key}
          type="button"
          className={`cat-chip ${active ? 'active' : ''}`}
          aria-pressed={active}
          disabled={unavailable}
          title={unavailable ? 'No items match this together with your other filters' : undefined}
          onClick={() => onToggle(option.key)}
        >
          {swatches && <Swatch value={option.label} />}
          {option.label}
          <span className="cat-chip-count">{count}</span>
        </button>
      );
    })}
  </div>
);

const SkeletonGrid = () => (
  <div className="products-grid cat-grid" aria-hidden="true">
    {Array.from({ length: 6 }, (_, i) => (
      <div key={i} className="skeleton-card">
        <div className="skeleton skeleton-image" />
        <div className="skeleton skeleton-text" style={{ marginTop: '1rem' }} />
        <div className="skeleton skeleton-text short" style={{ marginBottom: '1rem' }} />
      </div>
    ))}
  </div>
);

const CategoryPage = () => {
  const { categoryName } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { products: allProducts, categories, loading } = useCatalog();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [priceDraft, setPriceDraft] = useState(null); // live slider value before it reaches the URL
  const priceTimerRef = useRef(null);
  const sheetCloseRef = useRef(null);
  const sheetToggleRef = useRef(null);

  const categoryKey = categoryName.toLowerCase();
  const categoryInfo = categories.find(cat => cat.name.toLowerCase() === categoryKey);
  const title = categoryInfo?.name || categoryName;

  const products = useMemo(
    () => allProducts.filter(product => (product.category || '').toLowerCase() === categoryKey),
    [allProducts, categoryKey]
  );

  /* ─── Filter options come from this category's products ─── */
  const colorOptions = useMemo(() => buildOptions(products, 'color'), [products]);
  const beadOptions = useMemo(() => buildOptions(products, 'beadType'), [products]);
  const bounds = useMemo(() => {
    if (products.length === 0) return { min: 0, max: 0, step: 1 };
    const prices = products.map(p => getPricing(p).finalPrice);
    const rawMin = Math.min(...prices);
    const rawMax = Math.max(...prices);
    const step = pickStep(rawMax - rawMin);
    return { min: Math.floor(rawMin / step) * step, max: Math.ceil(rawMax / step) * step, step };
  }, [products]);

  /* ─── Filter state lives in the URL so it survives Back and can be shared ─── */
  const selectedColors = searchParams.getAll('color');
  const selectedBeads = searchParams.getAll('bead');
  const urlMin = parsePrice(searchParams.get('min'));
  const urlMax = parsePrice(searchParams.get('max'));
  const inStockOnly = searchParams.get('stock') === '1';
  const sort = SORTERS[searchParams.get('sort')] ? searchParams.get('sort') : 'featured';

  const priceLow = priceDraft ? priceDraft[0] : Math.max(urlMin ?? bounds.min, bounds.min);
  const priceHigh = priceDraft ? priceDraft[1] : Math.min(urlMax ?? bounds.max, bounds.max);
  const priceActive = priceLow > bounds.min || priceHigh < bounds.max;

  const activeFilterCount = selectedColors.length + selectedBeads.length
    + (priceActive ? 1 : 0) + (inStockOnly ? 1 : 0);

  // Colors are exclusive: a product must have every selected color. Bead types match any.
  const visibleProducts = useMemo(() => {
    const filtered = products.filter((product) => {
      if (selectedColors.length > 0) {
        const colors = toList(product.color).map(tagKey);
        if (!selectedColors.every(c => colors.includes(c))) return false;
      }
      if (selectedBeads.length > 0) {
        const beads = toList(product.beadType).map(tagKey);
        if (!selectedBeads.some(b => beads.includes(b))) return false;
      }
      const price = getPricing(product).finalPrice;
      if (price < priceLow || price > priceHigh) return false;
      if (inStockOnly && !(product.stock > 0)) return false;
      return true;
    });
    return filtered.sort(SORTERS[sort]);
    // selectedColors/selectedBeads are derived from searchParams
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, searchParams, priceLow, priceHigh, inStockOnly, sort]);

  // How many results each color would leave, so chips that lead nowhere can be disabled
  const colorCounts = useMemo(() => {
    const counts = new Map();
    visibleProducts.forEach((product) => {
      toList(product.color).forEach((color) => {
        const key = tagKey(color);
        counts.set(key, (counts.get(key) || 0) + 1);
      });
    });
    return counts;
  }, [visibleProducts]);

  const updateParams = (mutate) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      mutate(next);
      return next;
    }, { replace: true });
  };

  const toggleParamValue = (param, value) => updateParams((next) => {
    const values = next.getAll(param);
    next.delete(param);
    const updated = values.includes(value) ? values.filter(v => v !== value) : [...values, value];
    updated.forEach(v => next.append(param, v));
  });

  const writePrice = (next, [low, high]) => {
    if (low > bounds.min) next.set('min', String(low)); else next.delete('min');
    if (high < bounds.max) next.set('max', String(high)); else next.delete('max');
  };

  // The grid follows the slider live; the URL catches up once the handle stops
  const handlePriceChange = (range) => {
    setPriceDraft(range);
    clearTimeout(priceTimerRef.current);
    priceTimerRef.current = setTimeout(() => {
      updateParams((next) => writePrice(next, range));
      setPriceDraft(null);
    }, 250);
  };

  useEffect(() => () => clearTimeout(priceTimerRef.current), []);

  const clearPrice = () => {
    clearTimeout(priceTimerRef.current);
    setPriceDraft(null);
    updateParams((next) => { next.delete('min'); next.delete('max'); });
  };

  const clearFilters = () => {
    clearTimeout(priceTimerRef.current);
    setPriceDraft(null);
    updateParams((next) => FILTER_PARAMS.forEach(p => next.delete(p)));
  };

  const setSort = (value) => updateParams((next) => {
    if (value === 'featured') next.delete('sort'); else next.set('sort', value);
  });

  /* ─── Mobile filter sheet ─── */
  useEffect(() => {
    if (!sheetOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    sheetCloseRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') setSheetOpen(false); };
    const desktop = window.matchMedia('(min-width: 1024px)');
    const onResize = () => { if (desktop.matches) setSheetOpen(false); };
    document.addEventListener('keydown', onKey);
    desktop.addEventListener('change', onResize);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
      desktop.removeEventListener('change', onResize);
    };
  }, [sheetOpen]);

  const closeSheet = () => {
    setSheetOpen(false);
    sheetToggleRef.current?.focus();
  };

  const colorLabel = (key) => colorOptions.find(o => o.key === key)?.label || capitalize(key);
  const beadLabel = (key) => beadOptions.find(o => o.key === key)?.label || capitalize(key);

  const activePills = [
    ...selectedColors.map(key => ({ id: `c-${key}`, label: colorLabel(key), onRemove: () => toggleParamValue('color', key) })),
    ...selectedBeads.map(key => ({ id: `b-${key}`, label: beadLabel(key), onRemove: () => toggleParamValue('bead', key) })),
    ...(priceActive ? [{ id: 'price', label: `${formatRupees(priceLow)} – ${formatRupees(priceHigh)}`, onRemove: clearPrice }] : []),
    ...(inStockOnly ? [{ id: 'stock', label: 'In stock', onRemove: () => updateParams(next => next.delete('stock')) }] : [])
  ];

  const showPriceFilter = bounds.max > bounds.min;
  const itemsLabel = (n) => `${n} ${n === 1 ? 'item' : 'items'}`;

  return (
    <div className="cat-page">
      <header className="cat-hero">
        <nav className="cat-breadcrumb" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <FaChevronRight size={10} aria-hidden="true" />
          <span aria-current="page">{title}</span>
        </nav>
        <h1>{title}</h1>
        {categoryInfo?.description && <p className="cat-description">{categoryInfo.description}</p>}
      </header>

      <div className="cat-layout">
        {products.length > 0 && (
          <>
            <div className={`cat-sheet-backdrop ${sheetOpen ? 'open' : ''}`} onClick={closeSheet} aria-hidden="true" />
            <aside
              className={`cat-sidebar ${sheetOpen ? 'open' : ''}`}
              aria-label="Filters"
              role={sheetOpen ? 'dialog' : undefined}
              aria-modal={sheetOpen ? 'true' : undefined}
            >
              <div className="cat-sheet-header">
                <h2>Filters</h2>
                <button ref={sheetCloseRef} type="button" className="cat-sheet-close" onClick={closeSheet} aria-label="Close filters">
                  <FaTimes />
                </button>
              </div>

              <div className="cat-sidebar-body">
                <div className="cat-sidebar-title">
                  <h2>Filters</h2>
                  {activeFilterCount > 0 && (
                    <button type="button" className="cat-clear-btn" onClick={clearFilters}>Clear all</button>
                  )}
                </div>

                {showPriceFilter && (
                  <section className="cat-filter-group">
                    <h3>Price</h3>
                    <PriceRangeSlider
                      min={bounds.min}
                      max={bounds.max}
                      step={bounds.step}
                      value={[priceLow, priceHigh]}
                      onChange={handlePriceChange}
                    />
                  </section>
                )}

                {colorOptions.length > 0 && (
                  <section className="cat-filter-group">
                    <h3>Color</h3>
                    <FilterChips
                      options={colorOptions}
                      selected={selectedColors}
                      counts={colorCounts}
                      onToggle={(key) => toggleParamValue('color', key)}
                      swatches
                    />
                    {selectedColors.length > 1 && (
                      <p className="cat-filter-hint">Showing pieces with all selected colors</p>
                    )}
                  </section>
                )}

                {beadOptions.length > 0 && (
                  <section className="cat-filter-group">
                    <h3>Bead Type</h3>
                    <FilterChips options={beadOptions} selected={selectedBeads} onToggle={(key) => toggleParamValue('bead', key)} />
                  </section>
                )}

                <section className="cat-filter-group">
                  <label className="cat-toggle">
                    <input
                      type="checkbox"
                      checked={inStockOnly}
                      onChange={(e) => updateParams(next => (e.target.checked ? next.set('stock', '1') : next.delete('stock')))}
                    />
                    <span className="cat-toggle-track" aria-hidden="true"><span className="cat-toggle-thumb" /></span>
                    In stock only
                  </label>
                </section>
              </div>

              <div className="cat-sheet-footer">
                {activeFilterCount > 0 && (
                  <button type="button" className="btn btn-secondary" onClick={clearFilters}>Clear all</button>
                )}
                <button type="button" className="btn btn-primary" onClick={closeSheet}>
                  Show {itemsLabel(visibleProducts.length)}
                </button>
              </div>
            </aside>
          </>
        )}

        <section className="cat-results" aria-label="Products">
          <div className="cat-toolbar">
            {products.length > 0 && (
              <button
                ref={sheetToggleRef}
                type="button"
                className="cat-filters-btn"
                onClick={() => setSheetOpen(true)}
                aria-expanded={sheetOpen}
              >
                <FaFilter size={12} /> Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
              </button>
            )}
            <p className="cat-count" aria-live="polite">
              {loading
                ? 'Loading…'
                : activeFilterCount > 0
                  ? `Showing ${visibleProducts.length} of ${itemsLabel(products.length)}`
                  : itemsLabel(products.length)}
            </p>
            {products.length > 1 && (
              <label className="cat-sort">
                <span>Sort</span>
                <select value={sort} onChange={(e) => setSort(e.target.value)}>
                  {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
            )}
          </div>

          {activePills.length > 0 && (
            <div className="cat-pills">
              {activePills.map(pill => (
                <button key={pill.id} type="button" className="cat-pill" onClick={pill.onRemove} aria-label={`Remove filter ${pill.label}`}>
                  {pill.label} <FaTimes size={9} aria-hidden="true" />
                </button>
              ))}
              <button type="button" className="cat-clear-btn" onClick={clearFilters}>Clear all</button>
            </div>
          )}

          {loading ? (
            <SkeletonGrid />
          ) : products.length === 0 ? (
            <div className="empty-state">
              <h2>No products found</h2>
              <p>Check back later for new items in this category.</p>
              <Link to="/" className="btn btn-primary">Browse All Categories</Link>
            </div>
          ) : visibleProducts.length === 0 ? (
            <div className="empty-state">
              <h2>No products match these filters</h2>
              <p>Try removing a filter or widening the price range.</p>
              <button type="button" className="btn btn-primary" onClick={clearFilters}>Clear filters</button>
            </div>
          ) : (
            <div className="products-grid cat-grid">
              {visibleProducts.map((product) => (
                <ProductCard key={product._id} product={product} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default CategoryPage;
