import { useEffect, useSyncExternalStore } from 'react';
import axios from '../api/axios';

/*
 * Shared, persisted product catalog (products + categories).
 * Pages render instantly from the last saved copy and refresh in the background
 * (stale-while-revalidate), and concurrent callers share a single request.
 * Product lists don't carry image data, so the saved copy stays small.
 */
const STORAGE_KEY = 'sd:catalog:v1';
const MAX_AGE_MS = 30 * 1000;

const readStored = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!Array.isArray(parsed?.products) || !Array.isArray(parsed?.categories)) return null;
    return parsed;
  } catch {
    return null;
  }
};

const stored = readStored();

let snapshot = {
  products: stored?.products || [],
  categories: stored?.categories || [],
  loaded: Boolean(stored),
  // Always refresh once per page load, even when a saved copy exists
  fetchedAt: 0,
  error: null
};

const listeners = new Set();
const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const getSnapshot = () => snapshot;
const setSnapshot = (next) => {
  snapshot = next;
  listeners.forEach((listener) => listener());
};

let inflight = null;

export const refreshCatalog = () => {
  if (inflight) return inflight;
  inflight = Promise.all([axios.get('/api/products'), axios.get('/api/products/categories')])
    .then(([productsRes, categoriesRes]) => {
      const next = {
        products: Array.isArray(productsRes.data) ? productsRes.data : [],
        categories: Array.isArray(categoriesRes.data) ? categoriesRes.data : [],
        loaded: true,
        fetchedAt: Date.now(),
        error: null
      };
      setSnapshot(next);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          products: next.products,
          categories: next.categories,
          savedAt: next.fetchedAt
        }));
      } catch {
        // Storage full or unavailable — the in-memory copy still works
      }
    })
    .catch((error) => {
      console.error('Failed to load catalog:', error.message);
      setSnapshot({ ...snapshot, loaded: true, error });
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
};

export const isCatalogStale = () => Date.now() - snapshot.fetchedAt > MAX_AGE_MS;

// Mark the catalog as stale (e.g. after admin edits) so the next reader refreshes it
export const invalidateCatalog = () => {
  snapshot = { ...snapshot, fetchedAt: 0 };
};

export const useCatalog = ({ autoRefresh = true } = {}) => {
  const state = useSyncExternalStore(subscribe, getSnapshot);

  useEffect(() => {
    if (autoRefresh && isCatalogStale()) refreshCatalog();
  }, [autoRefresh]);

  return { ...state, loading: !state.loaded };
};
