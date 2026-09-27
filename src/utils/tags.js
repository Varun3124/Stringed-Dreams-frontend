// Products have multi-value fields (colors, bead types). Older data stored a single
// (possibly comma-separated) string, so always read them through toList.
export const toList = (value) => {
  if (value === undefined || value === null) return [];
  const raw = Array.isArray(value) ? value : [value];
  const seen = new Set();
  const items = [];
  raw
    .flatMap((item) => String(item ?? '').split(','))
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((item) => {
      const key = item.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        items.push(item);
      }
    });
  return items;
};

export const tagKey = (value) => String(value || '').trim().toLowerCase();

// Returns a CSS color for a swatch when the name is a valid CSS color, else null.
export const cssSwatch = (color) => {
  if (!color || typeof window === 'undefined' || !window.CSS?.supports) return null;
  const compact = String(color).trim().toLowerCase().replace(/\s+/g, '');
  if (window.CSS.supports('color', compact)) return compact;
  return null;
};
