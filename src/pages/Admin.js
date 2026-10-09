import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import axios from '../api/axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaPlus, FaEdit, FaTrash, FaTimes, FaChevronDown, FaChevronRight,
  FaGripVertical, FaCopy, FaFileImport, FaInbox, FaBoxes,
  FaUpload, FaEye, FaReply, FaClock, FaCheckCircle, FaBox, FaListUl,
  FaExternalLinkAlt, FaExclamationCircle, FaCheckSquare, FaUndo, FaRedo
} from 'react-icons/fa';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import TagInput, { TagChips } from '../components/TagInput';
import { toList } from '../utils/tags';
import { getPricing, nextDiscountPrice, fillDiscountPrice, fillActualPrice } from '../utils/price';
import { formatRupees } from '../components/PriceRangeSlider';
import BulkEditModal from '../components/BulkEditModal';
import useUndoHistory from '../hooks/useUndoHistory';
import { imageUrl } from '../api/axios';
import { invalidateCatalog } from '../data/catalog';

/* ─── Helpers for optimistic updates ─── */
const TEMP_PREFIX = 'temp-';
const isTempId = (id) => String(id).startsWith(TEMP_PREFIX);
const makeTempId = () => `${TEMP_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const UNCATEGORIZED_KEY = '__uncategorized__';
const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/300';
const byDisplayOrder = (a, b) => (a.displayOrder || 0) - (b.displayOrder || 0);
// Categories in dashboard order. Never by name: the sort is stable, so ties keep their place.
const byCategoryOrder = (a, b) => (a.displayOrder || 0) - (b.displayOrder || 0);

const EMPTY_PRODUCT_FORM = {
  name: '', description: '', price: '', discountPrice: '', category: '', color: [], beadType: [],
  image: '', stock: '', featuredInCarousel: false, carouselOrder: 0, displayOrder: 0
};

const NUMERIC_FIELD_LABELS = { price: 'price', discountPrice: 'discount price', stock: 'stock' };

// Rates used by the price "Fill" buttons, remembered in this browser
const PRICE_RATES_KEY = 'sd:admin:priceRates';
const DEFAULT_PRICE_RATES = { discount: '-10', markup: '+25' };
const readPriceRates = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(PRICE_RATES_KEY) || 'null');
    return saved && typeof saved === 'object' ? { ...DEFAULT_PRICE_RATES, ...saved } : DEFAULT_PRICE_RATES;
  } catch {
    return DEFAULT_PRICE_RATES;
  }
};
// A number that passes `isValid`, else null (which disables the Fill buttons)
const parseRate = (text, isValid) => {
  if (String(text ?? '').trim() === '') return null;
  const num = Number(text);
  return Number.isFinite(num) && isValid(num) ? num : null;
};
const formatRate = (rate) => `${rate > 0 ? '+' : ''}${rate}%`;

const insertAt = (list, index, item) => {
  const next = [...list];
  next.splice(Math.min(Math.max(index, 0), next.length), 0, item);
  return next;
};

// Labels for undo/redo
const FIELD_NAMES = {
  name: 'name', description: 'description', color: 'colors', beadType: 'bead types', price: 'price',
  discountPrice: 'discount price', stock: 'stock', image: 'image', featuredInCarousel: 'featured', carouselOrder: 'carousel order'
};
const productLabel = (product) => `“${product?.name || 'Untitled product'}”`;
const describeEdit = (product, patch) => (
  `Edit ${Object.keys(patch).map(k => FIELD_NAMES[k] || k).join(' and ')} of ${productLabel(product)}`
);

// Ctrl+Z inside these keeps the browser's own text undo
const TEXT_INPUT_TYPES = new Set(['text', 'number', 'search', 'email', 'url', 'tel', 'password']);
const isTextField = (el) => Boolean(el) && (
  el.isContentEditable || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT'
  || (el.tagName === 'INPUT' && TEXT_INPUT_TYPES.has(el.type))
);

/* Double-click (desktop) or long-press (mobile) to start editing */
const useEditTrigger = (onStart, disabled) => {
  const [isLongPressing, setIsLongPressing] = useState(false);
  const touchTimerRef = useRef(null);
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const onTouchStart = () => {
    if (!isMobile || disabled) return;
    setIsLongPressing(true);
    touchTimerRef.current = setTimeout(() => {
      setIsLongPressing(false);
      onStart();
    }, 500);
  };

  const onTouchEnd = () => {
    if (!isMobile) return;
    setIsLongPressing(false);
    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
  };

  return {
    isLongPressing,
    handlers: {
      onDoubleClick: () => !isMobile && !disabled && onStart(),
      onTouchStart,
      onTouchEnd,
      title: disabled ? 'Saving…' : isMobile ? 'Long-press to edit' : 'Double-click to edit'
    }
  };
};

/* ─── Inline Editable Cell ─── */
const InlineEditCell = ({ value, onSave, type = 'text', disabled = false }) => {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef(null);
  const { isLongPressing, handlers } = useEditTrigger(() => setEditing(true), disabled);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  // Keep in sync with external changes (e.g. a rolled-back save)
  useEffect(() => {
    if (!editing) setEditValue(value);
  }, [value, editing]);

  const save = () => {
    setEditing(false);
    if (String(editValue ?? '') !== String(value ?? '')) onSave(editValue);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="inline-edit-input"
        type={type}
        value={editValue ?? ''}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setEditValue(value); setEditing(false); } }}
      />
    );
  }

  return (
    <span className={`inline-edit-cell ${isLongPressing ? 'mobile-long-press-active' : ''}`} {...handlers}>
      {value || value === 0 ? value : '-'}
    </span>
  );
};

/* ─── Inline Editable Multi-Value Cell (colors, bead types) ─── */
const InlineTagCell = ({ value, onSave, suggestions, swatches = false, label, disabled = false }) => {
  const values = toList(value);
  const [editing, setEditing] = useState(false);
  const [editValues, setEditValues] = useState(values);
  const { isLongPressing, handlers } = useEditTrigger(() => {
    setEditValues(toList(value));
    setEditing(true);
  }, disabled);

  const commit = (finalValues) => {
    setEditing(false);
    const next = toList(finalValues);
    if (next.join('\u0000') !== values.join('\u0000')) onSave(next);
  };

  if (editing) {
    return (
      <TagInput
        className="inline"
        value={editValues}
        onChange={setEditValues}
        suggestions={suggestions}
        swatches={swatches}
        label={label}
        autoFocus
        onCommit={commit}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <span className={`inline-edit-cell ${isLongPressing ? 'mobile-long-press-active' : ''}`} {...handlers}>
      {values.length > 0 ? <TagChips values={values} swatches={swatches} /> : '-'}
    </span>
  );
};

/* ─── "Fill" under a price: sets it from the toolbar rates ─── */
const FillButton = ({ value, current, hint, disabled, onFill }) => (
  <button
    type="button"
    className="btn-fill"
    disabled={disabled || value === null || value === current}
    onClick={() => onFill(value)}
    title={value === null ? 'Fix the rate at the top of the page to use Fill' : `Set to ${formatRupees(value)} (${hint})`}
  >
    Fill
  </button>
);

/* ─── Sortable category, dragged by the grip in its header ─── */
const SortableCategory = ({ id, disabled, children }) => {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  const style = {
    // Translate only: categories differ in height, and scaling would stretch them
    transform: CSS.Translate.toString(transform),
    transition,
    position: 'relative',
    zIndex: isDragging ? 20 : 'auto'
  };
  return (
    <div ref={setNodeRef} style={style} className={`category-sortable ${isDragging ? 'category-dragging' : ''}`}>
      {children({ ref: setActivatorNodeRef, ...attributes, ...listeners })}
    </div>
  );
};

/* ─── Sortable Product Row ─── */
const SortableProductRow = ({
  product, onInlineSave, onDelete, onDuplicate, onCarouselChange, onImageClick, colorSuggestions, beadSuggestions,
  selectionMode, selected, onToggleSelect, priceRates, onFill
}) => {
  const isTemp = isTempId(product._id);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: product._id, disabled: isTemp || selectionMode });
  const discount = product.discountPrice ?? product.price;
  const priceFill = priceRates.markup === null ? null : fillActualPrice(discount, priceRates.markup);
  const discountFill = priceRates.discount === null ? null : fillDiscountPrice(product.price, priceRates.discount);
  const touchTimerRef = useRef(null);
  const [isDragPressed, setIsDragPressed] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
    position: isDragging ? 'relative' : 'static',
    zIndex: isDragging ? 1000 : 'auto',
  };

  const handleDragGripTouchStart = () => {
    setIsDragPressed(true);
    touchTimerRef.current = setTimeout(() => {
      setIsDragPressed(false);
    }, 250);
  };

  const handleDragGripTouchEnd = () => {
    setIsDragPressed(false);
    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
  };

  return (
    <tr ref={setNodeRef} style={style} className={`${isDragging ? 'row-dragging' : ''} ${isTemp ? 'row-saving' : ''} ${selected ? 'row-selected' : ''}`}>
      {selectionMode ? (
        <td className="select-cell">
          <input
            type="checkbox"
            checked={selected}
            disabled={isTemp}
            onChange={() => onToggleSelect(product._id)}
            aria-label={`Select ${product.name || 'product'}`}
          />
        </td>
      ) : (
        <td {...attributes} {...listeners} onTouchStart={handleDragGripTouchStart} onTouchEnd={handleDragGripTouchEnd} style={{ cursor: isTemp ? 'default' : 'grab', textAlign: 'center' }} className={isDragPressed ? 'drag-pressed' : ''}>
          <FaGripVertical style={{ color: 'var(--text-muted)' }} />
        </td>
      )}
      <td>
        <div className="product-thumb-wrap">
          <img src={imageUrl(product.image)} alt={product.name} className="product-thumb" loading="lazy" decoding="async" onClick={() => !isTemp && onImageClick(product)} style={{ cursor: isTemp ? 'default' : 'pointer' }} title="Click to view/edit product image" />
          {isTemp && <span className="saving-pill">Saving…</span>}
        </div>
      </td>
      <td><InlineEditCell value={product.name} onSave={(v) => onInlineSave(product, 'name', v)} disabled={isTemp} /></td>
      <td><InlineTagCell value={product.color} onSave={(v) => onInlineSave(product, 'color', v)} suggestions={colorSuggestions} swatches label="Add color" disabled={isTemp} /></td>
      <td><InlineTagCell value={product.beadType} onSave={(v) => onInlineSave(product, 'beadType', v)} suggestions={beadSuggestions} label="Add bead type" disabled={isTemp} /></td>
      <td className="price-cell">
        <InlineEditCell value={product.price} onSave={(v) => onInlineSave(product, 'price', v)} type="number" disabled={isTemp} />
        <FillButton
          value={priceFill}
          current={product.price}
          hint={`discount price ${formatRate(priceRates.markup)}`}
          disabled={isTemp}
          onFill={(v) => onFill(product, 'price', v)}
        />
      </td>
      <td className={`price-cell ${getPricing(product).hasDiscount ? 'discount-active' : ''}`}>
        <InlineEditCell value={discount} onSave={(v) => onInlineSave(product, 'discountPrice', v)} type="number" disabled={isTemp} />
        <FillButton
          value={discountFill}
          current={discount}
          hint={`price ${formatRate(priceRates.discount)}`}
          disabled={isTemp}
          onFill={(v) => onFill(product, 'discountPrice', v)}
        />
      </td>
      <td><InlineEditCell value={product.stock} onSave={(v) => onInlineSave(product, 'stock', v)} type="number" disabled={isTemp} /></td>
      <td>
        <input
          type="checkbox"
          checked={product.featuredInCarousel || false}
          disabled={isTemp}
          onChange={(e) => onCarouselChange(product, { featuredInCarousel: e.target.checked }, 0)}
          style={{ cursor: 'pointer' }}
        />
      </td>
      <td>
        <input
          type="number"
          value={product.carouselOrder || 0}
          disabled={isTemp}
          onChange={(e) => onCarouselChange(product, { carouselOrder: parseInt(e.target.value, 10) || 0 }, 500)}
          style={{ width: '60px' }}
          min="0"
        />
      </td>
      <td>
        <div className="action-buttons">
          <button className="btn-icon btn-duplicate" onClick={() => onDuplicate(product)} title="Duplicate product" disabled={isTemp}>
            <FaCopy />
          </button>
          <button className="btn-icon btn-delete" onClick={() => onDelete(product)} title="Delete product" disabled={isTemp}>
            <FaTrash />
          </button>
        </div>
      </td>
    </tr>
  );
};

/* ─── Save status shown in the header ─── */
const SyncIndicator = ({ pendingCount, failed, showSaved }) => {
  if (pendingCount > 0) {
    return <span className="sync-indicator saving"><span className="sync-dot" /> Saving…</span>;
  }
  if (failed) {
    return <span className="sync-indicator failed"><FaExclamationCircle /> Some changes failed</span>;
  }
  if (showSaved) {
    return <span className="sync-indicator saved"><FaCheckCircle /> All changes saved</span>;
  }
  return null;
};

/* ─── Main Admin Component ─── */
const Admin = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('products');
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const undoHistory = useUndoHistory();
  const [historyNotice, setHistoryNotice] = useState(null);
  const historyNoticeTimerRef = useRef(null);
  const [expandedCategories, setExpandedCategories] = useState({});
  const [message, setMessage] = useState({ type: '', text: '' });

  // Product form state (for creating new products only)
  const [showProductForm, setShowProductForm] = useState(false);
  const [imagePreview, setImagePreview] = useState('');
  const [productForm, setProductForm] = useState(EMPTY_PRODUCT_FORM);

  // Image preview modal state (derived from products so it reflects optimistic updates)
  const [selectedImageProductId, setSelectedImageProductId] = useState(null);
  const imageFileInputRef = useRef(null);

  // Category form state
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' });

  // Multi-select / bulk edit state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [showBulkEdit, setShowBulkEdit] = useState(false);

  // Rates for the price "Fill" buttons (as typed; see priceRates)
  const [priceRateText, setPriceRateText] = useState(readPriceRates);

  // Bulk import state
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkStep, setBulkStep] = useState(1); // 1=upload, 2=preview
  const [bulkCategory, setBulkCategory] = useState('');
  const [bulkImages, setBulkImages] = useState([]);
  const [bulkDragActive, setBulkDragActive] = useState(false);
  const bulkFileInputRef = useRef(null);

  // Inquiries state
  const [inquiries, setInquiries] = useState([]);
  const [inquiriesLoading, setInquiriesLoading] = useState(false);
  const [selectedInquiry, setSelectedInquiry] = useState(null);
  const [adminMessages, setAdminMessages] = useState([]);
  const [adminReplyText, setAdminReplyText] = useState('');
  const adminMessagesRef = useRef(null);
  const stickToBottomRef = useRef(true);
  const lastMessagesKeyRef = useRef('');

  // Background sync state
  const queuesRef = useRef({});
  const pendingRef = useRef(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncFailed, setSyncFailed] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const prevPendingRef = useRef(0);
  const carouselTimersRef = useRef({});
  const inquiryTasksRef = useRef(0);
  const inquiryVersionRef = useRef(0);
  const pendingRepliesRef = useRef(0);
  const messagesVersionRef = useRef(0);

  const productsRef = useRef(products);
  const categoriesRef = useRef(categories);
  categoriesRef.current = categories;
  productsRef.current = products;
  const selectedInquiryRef = useRef(selectedInquiry);
  selectedInquiryRef.current = selectedInquiry;

  const authConfig = () => ({ headers: { Authorization: `Bearer ${user.token}` } });

  const showMsg = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 3000);
  };

  /* ─── Background task queue ─── */
  const changePending = useCallback((delta) => {
    if (delta > 0 && pendingRef.current === 0) setSyncFailed(false);
    pendingRef.current += delta;
    setPendingCount(pendingRef.current);
  }, []);

  // Runs `task` after any earlier task with the same key, without blocking the UI.
  // `onError` should roll back the optimistic change.
  const enqueue = useCallback((key, task, onError) => {
    changePending(1);
    const previous = queuesRef.current[key] || Promise.resolve();
    const run = previous
      .then(task)
      .catch((error) => {
        console.error(`Background save failed (${key}):`, error);
        setSyncFailed(true);
        if (onError) onError(error);
      })
      .finally(() => {
        changePending(-1);
        if (queuesRef.current[key] === run) delete queuesRef.current[key];
      });
    queuesRef.current[key] = run;
    return run;
  }, [changePending]);

  const enqueueInquiry = (id, task, onError) => {
    inquiryTasksRef.current += 1;
    inquiryVersionRef.current += 1;
    return enqueue(`inquiry-${id}`, task, onError).finally(() => { inquiryTasksRef.current -= 1; });
  };

  // "All changes saved" flash once the queue drains
  useEffect(() => {
    const hadPending = prevPendingRef.current > 0;
    prevPendingRef.current = pendingCount;
    if (!hadPending || pendingCount > 0 || syncFailed) return;
    setShowSaved(true);
    const timer = setTimeout(() => setShowSaved(false), 2500);
    return () => clearTimeout(timer);
  }, [pendingCount, syncFailed]);

  // Warn before leaving while saves are still in flight
  useEffect(() => {
    if (pendingCount === 0) return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [pendingCount]);

  useEffect(() => {
    if (!user || user.role !== 'admin') { navigate('/'); return; }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, navigate]);

  useEffect(() => {
    if (activeTab === 'inquiries' && inquiries.length === 0) fetchInquiries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const fetchData = async () => { await Promise.all([fetchProducts(), fetchCategories()]); };

  const fetchProducts = async () => {
    try {
      if (!user?.token) { showMsg('error', 'No auth token. Please login again.'); return; }
      const { data } = await axios.get('/api/admin/products', authConfig());
      setProducts(data);
    } catch (error) { showMsg('error', error.response?.data?.message || 'Failed to fetch products'); }
  };

  const fetchCategories = async () => {
    try {
      if (!user?.token) { showMsg('error', 'No auth token.'); return; }
      const { data } = await axios.get('/api/admin/categories', authConfig());
      setCategories(data);
      const expanded = {};
      data.forEach(cat => { expanded[cat._id] = false; });
      setExpandedCategories(expanded);
    } catch (error) { showMsg('error', error.response?.data?.message || 'Failed to fetch categories'); }
  };

  // Poll results are ignored while inquiry changes are in flight, so they can't undo them
  const fetchInquiries = async () => {
    const version = inquiryVersionRef.current;
    setInquiriesLoading(true);
    try {
      const { data } = await axios.get('/api/contact', authConfig());
      if (inquiryTasksRef.current > 0 || inquiryVersionRef.current !== version) return;
      setInquiries(data);
      setSelectedInquiry(prev => (prev && data.find(i => i._id === prev._id)) || prev);
    } catch (error) { showMsg('error', 'Failed to fetch inquiries'); }
    finally { setInquiriesLoading(false); }
  };

  const fetchConversationMessages = async (id) => {
    const version = messagesVersionRef.current;
    try {
      const { data } = await axios.get(`/api/contact/${id}`, authConfig());
      if (selectedInquiryRef.current?._id !== id) return;
      if (pendingRepliesRef.current > 0 || messagesVersionRef.current !== version) return;
      const next = data.messages || [];
      // Polls usually return the same thread; skip the re-render when nothing changed
      setAdminMessages(prev => (
        prev.length === next.length && prev[prev.length - 1]?._id === next[next.length - 1]?._id && !prev.some(m => m.pending)
          ? prev
          : next
      ));
    } catch (error) { console.error('Failed to fetch conversation messages'); }
  };

  // Poll inquiries and active conversation while the tab is visible
  useEffect(() => {
    if (activeTab !== 'inquiries') return;
    const poll = () => {
      if (document.visibilityState !== 'visible') return;
      fetchInquiries();
      if (selectedInquiry) fetchConversationMessages(selectedInquiry._id);
    };
    const interval = setInterval(poll, 5000);
    document.addEventListener('visibilitychange', poll);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedInquiry?._id]);

  // Storefront pages should re-read the catalog after admin edits
  useEffect(() => () => invalidateCatalog(), []);

  // Keep the chat pinned to the newest message by scrolling only the message pane
  // (scrollIntoView also scrolled the whole page every time a poll came back).
  useEffect(() => {
    const pane = adminMessagesRef.current;
    if (!pane) return;
    const conversationId = selectedInquiry?._id || '';
    const last = adminMessages[adminMessages.length - 1];
    const key = `${conversationId}:${adminMessages.length}:${last?._id || ''}`;
    if (key === lastMessagesKeyRef.current) return;

    const previousKey = lastMessagesKeyRef.current;
    // Opening a conversation (or its first load) jumps straight to the latest message
    const freshOpen = !previousKey.startsWith(`${conversationId}:`) || previousKey === `${conversationId}:0:`;
    lastMessagesKeyRef.current = key;
    if (freshOpen || last?.pending) stickToBottomRef.current = true;
    if (!stickToBottomRef.current) return;

    // Smooth scrolling doesn't run in background tabs, so jump there instead
    const animate = !freshOpen && document.visibilityState === 'visible';
    pane.scrollTo({ top: pane.scrollHeight, behavior: animate ? 'smooth' : 'auto' });
  }, [adminMessages, selectedInquiry?._id]);

  // Only auto-scroll for new messages while the admin is already reading the latest ones
  const handleMessagesScroll = (e) => {
    const pane = e.currentTarget;
    stickToBottomRef.current = pane.scrollHeight - pane.scrollTop - pane.clientHeight < 80;
  };

  const toggleCategory = (categoryId) => {
    setExpandedCategories(prev => ({ ...prev, [categoryId]: !prev[categoryId] }));
  };

  const expandCategoryByName = (name) => {
    const category = categories.find(c => c.name === name);
    const key = category ? category._id : UNCATEGORIZED_KEY;
    setExpandedCategories(prev => ({ ...prev, [key]: true }));
  };

  const categoryNames = useMemo(() => new Set(categories.map(c => c.name)), [categories]);

  const getProductsByCategory = (categoryName) => {
    return products.filter(p => p.category === categoryName).sort(byDisplayOrder);
  };

  // Products whose category is empty or no longer exists
  const uncategorizedProducts = useMemo(
    () => products.filter(p => !categoryNames.has(p.category)).sort(byDisplayOrder),
    [products, categoryNames]
  );

  const getGroupFor = (product) => (
    categoryNames.has(product.category) ? getProductsByCategory(product.category) : uncategorizedProducts
  );

  const colorSuggestions = useMemo(
    () => toList(products.flatMap(p => toList(p.color))),
    [products]
  );
  const beadSuggestions = useMemo(
    () => toList(products.flatMap(p => toList(p.beadType))),
    [products]
  );

  // Derived, so deleted products drop out of the selection on their own
  const selectedProducts = useMemo(
    () => products.filter(p => selectedIds.has(p._id) && !isTempId(p._id)),
    [products, selectedIds]
  );

  // Discount rate must be a cut (above -100%); the markup can't be negative
  const priceRates = useMemo(() => ({
    discount: parseRate(priceRateText.discount, (n) => n > -100 && n <= 0),
    markup: parseRate(priceRateText.markup, (n) => n >= 0)
  }), [priceRateText]);

  useEffect(() => {
    try {
      localStorage.setItem(PRICE_RATES_KEY, JSON.stringify(priceRateText));
    } catch {
      // Storage unavailable (e.g. private mode); the rates just won't be remembered
    }
  }, [priceRateText]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => { setImagePreview(reader.result); };
      reader.readAsDataURL(file);
    }
  };

  const readFileAsDataURL = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });

  // DnD
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  /* ─── Optimistic product operations ─── */
  // Every edit records how to undo and redo it. Those steps run later, so they call the
  // latest version of these functions through `ops` and look products up fresh by id.
  const ops = useRef({});
  const findProduct = (id) => productsRef.current.find(p => p._id === id);
  const findCategory = (id) => categoriesRef.current.find(c => c._id === id);

  const patchProductLocal = (id, patch) => {
    setProducts(prev => prev.map(p => (p._id === id ? { ...p, ...patch } : p)));
  };

  const removeProductLocal = (id) => {
    setProducts(prev => prev.filter(p => p._id !== id));
  };

  // `undoPatch` replaces the values undo restores (e.g. the stored image instead of its URL)
  const updateProduct = (product, patch, errorMessage = 'Failed to update product', { label, undoPatch, undoable = true } = {}) => {
    const previous = Object.fromEntries(Object.keys(patch).map(k => [k, product[k]]));
    const id = product._id;
    if (undoable) {
      undoHistory.record({
        label: label || describeEdit(product, patch),
        undo: () => ops.current.editProduct(id, undoPatch || previous),
        redo: () => ops.current.editProduct(id, patch)
      });
    }
    patchProductLocal(id, patch);
    enqueue(
      id,
      () => axios.put(`/api/admin/products/${id}`, patch, authConfig()),
      (error) => {
        // Only roll back fields that still hold this change (a later edit wins)
        setProducts(prev => prev.map(p => {
          if (p._id !== id) return p;
          const reverted = { ...p };
          Object.keys(patch).forEach(k => { if (p[k] === patch[k]) reverted[k] = previous[k]; });
          return reverted;
        }));
        showMsg('error', error.response?.data?.message || errorMessage);
      }
    );
  };

  // Applies a patch to the product as it is now (undo/redo)
  const editProduct = (id, patch) => {
    const product = findProduct(id);
    if (!product) return false;
    updateProduct(product, patch);
  };

  // Pass `previousOrder` (the group as it was) to make the change undoable
  const applyOrder = (orderedProducts, previousOrder) => {
    if (previousOrder) {
      const before = previousOrder.map(p => p._id);
      const after = orderedProducts.map(p => p._id);
      undoHistory.record({
        label: 'Reorder products',
        undo: () => ops.current.applyOrderIds(before),
        redo: () => ops.current.applyOrderIds(after)
      });
    }

    const orderMap = new Map(orderedProducts.map((item, index) => [item._id, index]));
    const previous = new Map(orderedProducts.map(p => [p._id, p.displayOrder]));
    setProducts(prev => prev.map(p => (orderMap.has(p._id) ? { ...p, displayOrder: orderMap.get(p._id) } : p)));

    const payload = orderedProducts
      .filter(p => !isTempId(p._id))
      .map(p => ({ id: p._id, displayOrder: orderMap.get(p._id) }));
    if (payload.length === 0) return;

    enqueue(
      'reorder',
      () => axios.put('/api/admin/products/reorder', { products: payload }, authConfig()),
      () => {
        setProducts(prev => prev.map(p => (
          orderMap.has(p._id) && p.displayOrder === orderMap.get(p._id)
            ? { ...p, displayOrder: previous.get(p._id) }
            : p
        )));
        showMsg('error', 'Failed to save the new order');
      }
    );
  };

  const applyOrderIds = (ids) => {
    const ordered = ids.map(findProduct).filter(Boolean);
    if (ordered.length === 0) return false;
    applyOrder(ordered);
  };

  const handleMoveToLast = (product) => {
    const group = getGroupFor(product);
    applyOrder([...group.filter(p => p._id !== product._id), product], group);
  };

  const handleDragEnd = (event, groupProducts) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = groupProducts.findIndex(p => p._id === active.id);
    const newIndex = groupProducts.findIndex(p => p._id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    applyOrder(arrayMove(groupProducts, oldIndex, newIndex), groupProducts);
  };

  const handleInlineSave = (product, field, rawValue) => {
    let value = rawValue;
    if (field === 'price' || field === 'discountPrice' || field === 'stock') {
      // Clearing a discount price removes the discount
      const clearsDiscount = field === 'discountPrice' && String(rawValue ?? '').trim() === '';
      value = clearsDiscount ? product.price : parseFloat(rawValue);
      if (!Number.isFinite(value) || value < 0) {
        showMsg('error', `Please enter a valid ${NUMERIC_FIELD_LABELS[field]}`);
        return;
      }
      if (field === 'discountPrice') {
        if (value > product.price) {
          showMsg('error', "Discount price can't be higher than the price");
          return;
        }
        if (value === (product.discountPrice ?? product.price)) return;
      }
    } else if (field === 'color' || field === 'beadType') {
      value = toList(rawValue);
    } else {
      value = String(rawValue ?? '').trim();
    }

    const patch = { [field]: value };
    if (field === 'price') patch.discountPrice = nextDiscountPrice(product, value);
    // Running out of stock also moves the product to the end; one undo reverts both
    undoHistory.group(describeEdit(product, patch), () => {
      updateProduct(product, patch);
      if (field === 'stock' && value === 0) handleMoveToLast(product);
    });
  };

  // Featured toggles save immediately; order edits are debounced while typing
  const handleCarouselChange = (product, patch, delay) => {
    const id = product._id;
    const before = { featuredInCarousel: product.featuredInCarousel || false, carouselOrder: product.carouselOrder || 0 };
    undoHistory.record({
      label: 'featuredInCarousel' in patch
        ? `${patch.featuredInCarousel ? 'Feature' : 'Unfeature'} ${productLabel(product)}`
        : `Edit carousel order of ${productLabel(product)}`,
      mergeKey: delay > 0 ? `carousel-order-${id}` : undefined,
      undo: () => ops.current.setCarousel(id, before),
      redo: () => ops.current.setCarousel(id, { ...before, ...patch })
    });

    const existing = carouselTimersRef.current[id];
    const previous = existing ? existing.previous : before;

    if (existing) clearTimeout(existing.timer);
    else changePending(1);

    patchProductLocal(id, patch);

    const timer = setTimeout(() => {
      delete carouselTimersRef.current[id];
      changePending(-1);
      const latest = productsRef.current.find(p => p._id === id);
      if (!latest) return;
      const body = { featuredInCarousel: latest.featuredInCarousel || false, carouselOrder: latest.carouselOrder || 0 };
      enqueue(
        id,
        () => axios.put(`/api/admin/products/${id}/carousel`, body, authConfig()),
        (error) => {
          setProducts(prev => prev.map(p => (
            p._id === id && (p.featuredInCarousel || false) === body.featuredInCarousel && (p.carouselOrder || 0) === body.carouselOrder
              ? { ...p, ...previous }
              : p
          )));
          showMsg('error', error.response?.data?.message || 'Failed to update carousel settings');
        }
      );
    }, delay);

    carouselTimersRef.current[id] = { timer, previous };
  };

  const setCarousel = (id, values) => {
    const product = findProduct(id);
    if (!product) return false;
    handleCarouselChange(product, values, 0);
  };

  /*
   * Creating, deleting and restoring products. A `ref` ({ id }) names one product across
   * undo/redo; for a product that is still being created, `ref.id` is its temporary id until
   * the server answers. Deleted products are kept (with the server's full copy, image
   * included) so the delete can be undone with the same id.
   */
  const deletedProductsRef = useRef(new Map());

  const removeProduct = (ref) => {
    const product = findProduct(ref.id);
    if (!product) return false;
    const index = productsRef.current.indexOf(product);
    if (selectedImageProductId === ref.id) setSelectedImageProductId(null);
    removeProductLocal(ref.id);

    let resolveSaved;
    const saved = new Promise(resolve => { resolveSaved = resolve; });
    deletedProductsRef.current.set(ref, { product, index, saved });
    // Keyed by the current id, so a product still being created is deleted once it exists
    enqueue(
      ref.id,
      async () => {
        if (isTempId(ref.id)) { resolveSaved(null); return; } // its creation failed
        const { data } = await axios.delete(`/api/admin/products/${ref.id}`, authConfig());
        resolveSaved(data.product || null);
      },
      (error) => {
        resolveSaved(null);
        deletedProductsRef.current.delete(ref);
        setProducts(prev => (prev.some(p => p._id === product._id) ? prev : insertAt(prev, index, product)));
        showMsg('error', error.response?.data?.message || 'Failed to delete');
      }
    );
  };

  const restoreProduct = (ref) => {
    const deleted = deletedProductsRef.current.get(ref);
    if (!deleted) return false;
    if (findProduct(ref.id)) return 'it already exists';
    deletedProductsRef.current.delete(ref);
    const restored = { ...deleted.product, _id: ref.id };
    setProducts(prev => insertAt(prev, deleted.index, restored));
    enqueue(
      ref.id,
      async () => {
        const doc = await deleted.saved;
        if (!doc) throw new Error('The deleted product could not be restored');
        const { data } = await axios.post('/api/admin/products/restore', { product: doc }, authConfig());
        setProducts(prev => prev.map(p => (p._id === restored._id ? data : p)));
      },
      (error) => {
        removeProductLocal(restored._id);
        showMsg('error', error.response?.data?.message || error.message || 'Failed to restore product');
      }
    );
  };

  // Temporary rows appear instantly; the server copy replaces them when it arrives
  const createProductInBackground = (tempProduct, request, errorMessage, label) => {
    const ref = { id: tempProduct._id };
    undoHistory.record({
      label,
      undo: () => ops.current.removeProduct(ref),
      redo: () => ops.current.restoreProduct(ref)
    });
    setProducts(prev => [tempProduct, ...prev]);
    enqueue(
      tempProduct._id,
      async () => {
        const { data } = await request();
        ref.id = data._id;
        setProducts(prev => prev.map(p => (p._id === tempProduct._id ? data : p)));
      },
      (error) => {
        removeProductLocal(tempProduct._id);
        showMsg('error', error.response?.data?.message || errorMessage);
      }
    );
  };

  const handleDeleteProduct = (product) => {
    if (!window.confirm('Delete this product?')) return;
    const ref = { id: product._id };
    undoHistory.record({
      label: `Delete ${productLabel(product)}`,
      undo: () => ops.current.restoreProduct(ref),
      redo: () => ops.current.removeProduct(ref)
    });
    removeProduct(ref);
  };

  const handleDuplicateProduct = (product) => {
    const tempProduct = {
      ...product,
      _id: makeTempId(),
      name: `${product.name} (Copy)`,
      color: toList(product.color),
      beadType: toList(product.beadType),
      featuredInCarousel: false,
      carouselOrder: 0,
      displayOrder: 0,
      likesCount: 0,
      rating: 0,
      numReviews: 0,
      reviews: []
    };
    createProductInBackground(
      tempProduct,
      () => axios.post(`/api/admin/products/${product._id}/duplicate`, {}, authConfig()),
      'Failed to duplicate',
      `Duplicate ${productLabel(product)}`
    );
  };

  // "Fill" under a row's prices: the price comes from the discount price, and vice versa
  const handleFill = (product, field, value) => {
    if (field === 'price') {
      // Send the discount too, or a product without one would have it follow the new price
      updateProduct(product, { price: value, discountPrice: product.discountPrice ?? product.price }, undefined, {
        label: `Fill price of ${productLabel(product)}`
      });
    } else {
      handleInlineSave(product, 'discountPrice', value);
    }
  };

  /* ─── Multi-select & bulk edit ─── */
  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const setGroupSelected = (groupProducts, select) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      groupProducts.forEach(p => (select ? next.add(p._id) : next.delete(p._id)));
      return next;
    });
  };

  const exitSelection = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
    setShowBulkEdit(false);
  };

  // Applies a Map of id -> patch in one request
  const updateProducts = (patchById, label) => {
    const entries = [...patchById].filter(([id]) => findProduct(id));
    if (entries.length === 0) return false;
    const patches = new Map(entries);
    const previousById = new Map(entries.map(([id, patch]) => {
      const product = findProduct(id);
      return [id, Object.fromEntries(Object.keys(patch).map(k => [k, product[k]]))];
    }));
    undoHistory.record({
      label,
      undo: () => ops.current.updateProducts(previousById, label),
      redo: () => ops.current.updateProducts(patches, label)
    });
    setProducts(prev => prev.map(p => (patches.has(p._id) ? { ...p, ...patches.get(p._id) } : p)));

    // Wait for earlier saves to these products, and make later ones wait for this one
    const ids = [...patches.keys()];
    const earlier = ids.map(id => queuesRef.current[id]).filter(Boolean);
    const run = enqueue(
      'bulk-update',
      async () => {
        await Promise.all(earlier);
        await axios.put('/api/admin/products/bulk-update', {
          updates: entries.map(([id, patch]) => ({ id, changes: patch }))
        }, authConfig());
      },
      (error) => {
        // Only roll back fields that still hold this change (a later edit wins)
        setProducts(prev => prev.map(p => {
          const patch = patches.get(p._id);
          if (!patch) return p;
          const reverted = { ...p };
          Object.keys(patch).forEach(k => { if (p[k] === patch[k]) reverted[k] = previousById.get(p._id)[k]; });
          return reverted;
        }));
        showMsg('error', error.response?.data?.message || 'Failed to update the selected products');
      }
    );
    ids.forEach(id => { queuesRef.current[id] = run; });
  };

  // `patches` come from BulkEditModal: [{ product, patch }] for products that change
  const handleBulkApply = (patches) => {
    const label = `Edit ${patches.length} product${patches.length === 1 ? '' : 's'}`;
    undoHistory.group(label, () => {
      updateProducts(new Map(patches.map(({ product, patch }) => [product._id, patch])), label);

      // Products that ran out of stock move to the end of their category, as with inline edits
      const zeroed = new Set(patches.filter(({ patch }) => patch.stock === 0).map(({ product }) => product._id));
      const groups = new Map();
      patches.forEach(({ product }) => {
        const key = categoryNames.has(product.category) ? product.category : UNCATEGORIZED_KEY;
        if (zeroed.has(product._id) && !groups.has(key)) groups.set(key, getGroupFor(product));
      });
      groups.forEach(group => applyOrder([
        ...group.filter(p => !zeroed.has(p._id)),
        ...group.filter(p => zeroed.has(p._id))
      ], group));
    });

    exitSelection();
    showMsg('success', `Updated ${patches.length} product${patches.length === 1 ? '' : 's'}`);
  };

  /* ─── Category order ─── */
  // Pass `previousIds` (the order before) to make the change undoable
  const applyCategoryOrder = (orderedCategories, previousIds) => {
    if (previousIds) {
      const after = orderedCategories.map(c => c._id);
      undoHistory.record({
        label: 'Reorder categories',
        undo: () => ops.current.applyCategoryOrderIds(previousIds),
        redo: () => ops.current.applyCategoryOrderIds(after)
      });
    }

    const previous = new Map(categoriesRef.current.map(c => [c._id, c.displayOrder]));
    const reordered = orderedCategories.map((c, index) => ({ ...c, displayOrder: index }));
    setCategories(reordered);

    const payload = reordered
      .filter(c => !isTempId(c._id))
      .map(c => ({ id: c._id, displayOrder: c.displayOrder }));
    enqueue(
      'category-reorder',
      () => axios.put('/api/admin/categories/reorder', { categories: payload }, authConfig()),
      () => {
        setCategories(prev => prev
          .map(c => (previous.has(c._id) ? { ...c, displayOrder: previous.get(c._id) } : c))
          .sort(byCategoryOrder));
        showMsg('error', 'Failed to save the category order');
      }
    );
  };

  // Categories added since the step was recorded keep their place at the end
  const applyCategoryOrderIds = (ids) => {
    const listed = ids.map(findCategory).filter(Boolean);
    if (listed.length === 0) return false;
    const rest = categoriesRef.current.filter(c => !ids.includes(c._id));
    applyCategoryOrder([...listed, ...rest]);
  };

  const handleCategoryDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const oldIndex = categories.findIndex(c => c._id === active.id);
    const newIndex = categories.findIndex(c => c._id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    applyCategoryOrder(arrayMove(categories, oldIndex, newIndex), categories.map(c => c._id));
  };

  /* ─── Product Creation Form ─── */
  const handleProductSubmit = (e) => {
    e.preventDefault();
    if (!user?.token) { showMsg('error', 'No auth token'); return; }

    // Leaving the discount price blank means no discount
    const price = Number(productForm.price) || 0;
    const discountPrice = String(productForm.discountPrice).trim() === '' ? price : Number(productForm.discountPrice);
    if (!Number.isFinite(discountPrice) || discountPrice < 0) {
      showMsg('error', 'Please enter a valid discount price');
      return;
    }
    if (discountPrice > price) {
      showMsg('error', "Discount price can't be higher than the price");
      return;
    }

    const payload = {
      ...productForm,
      discountPrice,
      name: productForm.name.trim(),
      category: productForm.category.trim(),
      beadType: toList(productForm.beadType),
      color: toList(productForm.color),
      image: imagePreview || productForm.image || undefined
    };

    const tempProduct = {
      ...payload,
      _id: makeTempId(),
      price,
      stock: Number(payload.stock) || 0,
      image: payload.image || PLACEHOLDER_IMAGE,
      displayOrder: 0,
      likesCount: 0,
      createdAt: new Date().toISOString()
    };

    createProductInBackground(
      tempProduct,
      () => axios.post('/api/admin/products', payload, authConfig()),
      'Failed to create product',
      `Add ${productLabel(tempProduct)}`
    );
    expandCategoryByName(payload.category);
    resetProductForm();
  };

  const resetProductForm = () => {
    setProductForm(EMPTY_PRODUCT_FORM);
    setImagePreview('');
    setShowProductForm(false);
  };

  /* ─── Category CRUD ─── */
  // Category refs work like product refs: `ref.id` becomes the real id once a new one is saved
  const deletedCategoriesRef = useRef(new Map());

  const createCategory = ({ name, description }) => {
    const tempId = makeTempId();
    const ref = { id: tempId };
    undoHistory.record({
      label: `Add category “${name}”`,
      undo: () => ops.current.removeCategory(ref),
      redo: () => ops.current.restoreCategory(ref)
    });
    // New categories go last, like on the server
    setCategories(prev => [
      ...prev,
      { _id: tempId, name, description, displayOrder: Math.max(-1, ...prev.map(c => c.displayOrder || 0)) + 1 }
    ].sort(byCategoryOrder));
    setExpandedCategories(prev => ({ ...prev, [tempId]: false }));
    enqueue(
      tempId,
      async () => {
        const { data } = await axios.post('/api/admin/categories', { name, description }, authConfig());
        ref.id = data._id;
        setCategories(prev => prev.map(c => (c._id === tempId ? data : c)));
        setExpandedCategories(prev => {
          const { [tempId]: wasExpanded, ...rest } = prev;
          return { ...rest, [data._id]: Boolean(wasExpanded) };
        });
      },
      (error) => {
        setCategories(prev => prev.filter(c => c._id !== tempId));
        showMsg('error', error.response?.data?.message || 'Failed to create category');
      }
    );
  };

  // Renaming moves the category's products along with it
  const editCategory = (id, { name, description }) => {
    const original = findCategory(id);
    if (!original) return false;
    if (categoriesRef.current.some(c => c.name === name && c._id !== id)) return `another category is named “${name}”`;
    undoHistory.record({
      label: `Edit category “${original.name}”`,
      undo: () => ops.current.editCategory(id, { name: original.name, description: original.description }),
      redo: () => ops.current.editCategory(id, { name, description })
    });

    const renamed = name !== original.name;
    setCategories(prev => prev.map(c => (c._id === id ? { ...c, name, description } : c)));
    if (renamed) {
      setProducts(prev => prev.map(p => (p.category === original.name ? { ...p, category: name } : p)));
    }
    enqueue(
      id,
      () => axios.put(`/api/admin/categories/${id}`, { name, description }, authConfig()),
      (error) => {
        setCategories(prev => prev.map(c => (c._id === id ? original : c)));
        if (renamed) {
          setProducts(prev => prev.map(p => (p.category === name ? { ...p, category: original.name } : p)));
        }
        showMsg('error', error.response?.data?.message || 'Failed to update category');
      }
    );
  };

  const removeCategory = (ref) => {
    const category = findCategory(ref.id);
    if (!category) return false;
    if (productsRef.current.some(p => p.category === category.name)) return 'it has products in it';
    deletedCategoriesRef.current.set(ref, category);
    setCategories(prev => prev.filter(c => c._id !== ref.id));
    enqueue(
      ref.id,
      async () => {
        if (isTempId(ref.id)) return; // its creation failed
        await axios.delete(`/api/admin/categories/${ref.id}`, authConfig());
      },
      (error) => {
        deletedCategoriesRef.current.delete(ref);
        setCategories(prev => (prev.some(c => c._id === category._id) ? prev : [...prev, category].sort(byCategoryOrder)));
        showMsg('error', error.response?.data?.message || 'Failed to delete');
      }
    );
  };

  const restoreCategory = (ref) => {
    const deleted = deletedCategoriesRef.current.get(ref);
    if (!deleted) return false;
    if (findCategory(ref.id)) return 'it already exists';
    if (categoriesRef.current.some(c => c.name === deleted.name)) return `another category is named “${deleted.name}”`;
    deletedCategoriesRef.current.delete(ref);
    const restored = { ...deleted, _id: ref.id };
    setCategories(prev => [...prev, restored].sort(byCategoryOrder));
    enqueue(
      ref.id,
      () => axios.post('/api/admin/categories/restore', {
        _id: restored._id,
        name: restored.name,
        description: restored.description,
        displayOrder: restored.displayOrder
      }, authConfig()),
      (error) => {
        setCategories(prev => prev.filter(c => c._id !== restored._id));
        showMsg('error', error.response?.data?.message || 'Failed to restore category');
      }
    );
  };

  const handleCategorySubmit = (e) => {
    e.preventDefault();
    const name = categoryForm.name.trim();
    const description = categoryForm.description;
    if (!name) { showMsg('error', 'Category name is required'); return; }
    if (categories.some(c => c.name === name && c._id !== editingCategory?._id)) {
      showMsg('error', 'Category already exists');
      return;
    }

    if (editingCategory) editCategory(editingCategory._id, { name, description });
    else createCategory({ name, description });
    resetCategoryForm();
  };

  const handleEditCategory = (category) => {
    setEditingCategory(category);
    setCategoryForm({ name: category.name, description: category.description || '' });
    setShowCategoryForm(true);
  };

  const handleDeleteCategory = (category) => {
    const inUse = products.filter(p => p.category === category.name).length;
    if (inUse > 0) {
      showMsg('error', `Cannot delete category. ${inUse} product(s) are using this category.`);
      return;
    }
    if (!window.confirm('Delete this category?')) return;
    const ref = { id: category._id };
    undoHistory.record({
      label: `Delete category “${category.name}”`,
      undo: () => ops.current.restoreCategory(ref),
      redo: () => ops.current.removeCategory(ref)
    });
    removeCategory(ref);
  };

  const resetCategoryForm = () => {
    setCategoryForm({ name: '', description: '' });
    setEditingCategory(null);
    setShowCategoryForm(false);
  };

  /* ─── Bulk Import ─── */
  const handleBulkFilesSelected = async (fileList) => {
    const files = Array.from(fileList || []).filter((file) => file.type.startsWith('image/'));
    if (!files.length) {
      showMsg('error', 'Please choose at least one image file');
      return;
    }

    try {
      const selectedImages = await Promise.all(
        files.map(async (file) => ({
          name: file.name,
          preview: await readFileAsDataURL(file)
        }))
      );
      setBulkImages(selectedImages);
      setBulkStep(2);
    } catch (error) {
      showMsg('error', 'Failed to read one or more images');
    }
  };

  const handleBulkInputChange = (e) => {
    handleBulkFilesSelected(e.target.files);
    e.target.value = '';
  };

  const handleBulkDrop = async (e) => {
    e.preventDefault();
    setBulkDragActive(false);
    await handleBulkFilesSelected(e.dataTransfer.files);
  };

  // Mirrors the server: price of the newest in-stock product in the category
  const getFallbackPrice = (category) => {
    const latest = products
      .filter(p => p.category === category && p.stock > 0 && !isTempId(p._id))
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0];
    return latest?.price ?? 0;
  };

  const handleBulkImport = () => {
    if (!bulkCategory) {
      showMsg('error', 'Please choose a category for this batch');
      return;
    }

    if (bulkImages.length === 0) {
      showMsg('error', 'Please add at least one image');
      return;
    }

    const category = bulkCategory;
    const images = bulkImages;
    const fallbackPrice = getFallbackPrice(category);
    const tempIds = images.map(() => makeTempId());
    const refs = tempIds.map(id => ({ id }));
    undoHistory.record({
      label: `Import ${images.length} product${images.length === 1 ? '' : 's'}`,
      undo: () => { refs.forEach(ref => ops.current.removeProduct(ref)); },
      redo: () => { refs.forEach(ref => ops.current.restoreProduct(ref)); }
    });
    const tempProducts = images.map((image, i) => ({
      _id: tempIds[i],
      name: '',
      description: '',
      price: fallbackPrice,
      discountPrice: fallbackPrice,
      category,
      color: [],
      beadType: [],
      image: image.preview,
      stock: 1,
      displayOrder: 0,
      featuredInCarousel: false,
      carouselOrder: 0,
      likesCount: 0
    }));

    // Server creates them in order, so the newest (last) comes first
    setProducts(prev => [...[...tempProducts].reverse(), ...prev]);
    expandCategoryByName(category);
    resetBulkImport();

    enqueue(
      'bulk-import',
      async () => {
        const { data } = await axios.post(
          '/api/admin/products/bulk',
          { category, products: images.map((image) => ({ image: image.preview, category })) },
          authConfig()
        );
        const createdByIndex = new Map((data.products || []).map(r => [r.index - 1, r.product]));
        createdByIndex.forEach((created, i) => { refs[i].id = created._id; });
        setProducts(prev => prev.flatMap(p => {
          const i = tempIds.indexOf(p._id);
          if (i === -1) return [p];
          const created = createdByIndex.get(i);
          return created ? [{ ...created, image: p.image }] : [];
        }));
        if (data.failed) {
          setSyncFailed(true);
          showMsg('error', `${data.failed} of ${images.length} products failed to import`);
        }
      },
      (error) => {
        setProducts(prev => prev.filter(p => !tempIds.includes(p._id)));
        showMsg('error', error.response?.data?.message || 'Bulk import failed');
      }
    );
  };

  const resetBulkImport = () => {
    setShowBulkImport(false);
    setBulkStep(1);
    setBulkCategory('');
    setBulkImages([]);
    setBulkDragActive(false);
  };

  /* ─── Image Preview Modal Handlers ─── */
  const selectedImageProduct = selectedImageProductId
    ? products.find(p => p._id === selectedImageProductId) || null
    : null;

  const handleImageClick = (product) => setSelectedImageProductId(product._id);

  const handleImageModalDescSave = (newDesc) => {
    if (!selectedImageProduct) return;
    updateProduct(selectedImageProduct, { description: newDesc }, 'Failed to update description');
  };

  // The image as stored on the server (a data URL, an external URL or the placeholder), so an
  // image change can be undone. null when it can't be read.
  const readStoredImage = async (product) => {
    const src = product.image;
    if (!src) return PLACEHOLDER_IMAGE;
    if (!src.startsWith('/api/')) return src;
    try {
      const response = await fetch(imageUrl(src));
      if (!response.ok) return null;
      if (response.headers.get('X-Image-Placeholder')) return PLACEHOLDER_IMAGE;
      return await readFileAsDataURL(await response.blob());
    } catch {
      return null;
    }
  };

  const handleImageModalImageUpload = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file || !selectedImageProduct) return;
    const { _id: id } = selectedImageProduct;
    try {
      const [base64Image, storedImage] = await Promise.all([
        readFileAsDataURL(file),
        readStoredImage(selectedImageProduct)
      ]);
      const product = findProduct(id);
      if (!product) return;
      updateProduct(product, { image: base64Image }, 'Failed to upload image', {
        label: `Change image of ${productLabel(product)}`,
        undoPatch: { image: storedImage },
        undoable: storedImage !== null
      });
    } catch (error) {
      showMsg('error', 'Failed to read image');
    }
  };

  const closeImageModal = () => setSelectedImageProductId(null);

  /* ─── Inquiries ─── */
  const setInquiryStatusLocal = (id, status) => {
    setInquiries(prev => prev.map(i => (i._id === id ? { ...i, status } : i)));
    setSelectedInquiry(prev => (prev?._id === id ? { ...prev, status } : prev));
  };

  const handleUpdateInquiryStatus = (id, status) => {
    const previous = (inquiries.find(i => i._id === id) || selectedInquiry)?.status;
    setInquiryStatusLocal(id, status);
    enqueueInquiry(
      id,
      () => axios.put(`/api/contact/${id}`, { status }, authConfig()),
      () => {
        if (previous) setInquiryStatusLocal(id, previous);
        showMsg('error', 'Failed to update status');
      }
    );
  };

  const handleDeleteInquiry = (id) => {
    if (!window.confirm('Delete this conversation?')) return;
    const index = inquiries.findIndex(i => i._id === id);
    const inquiry = inquiries[index];
    setInquiries(prev => prev.filter(i => i._id !== id));
    if (selectedInquiry?._id === id) { setSelectedInquiry(null); setAdminMessages([]); }
    enqueueInquiry(
      id,
      () => axios.delete(`/api/contact/${id}`, authConfig()),
      () => {
        if (inquiry) {
          setInquiries(prev => {
            const next = [...prev];
            next.splice(Math.min(Math.max(index, 0), next.length), 0, inquiry);
            return next;
          });
        }
        showMsg('error', 'Failed to delete');
      }
    );
  };

  const handleAdminReply = (e) => {
    e.preventDefault();
    const text = adminReplyText.trim();
    if (!text || !selectedInquiry) return;

    const inquiryId = selectedInquiry._id;
    const tempId = makeTempId();
    const createdAt = new Date().toISOString();

    setAdminMessages(prev => [...prev, { _id: tempId, senderRole: 'admin', text, createdAt, pending: true }]);
    setAdminReplyText('');
    setInquiries(prev => prev.map(i => (
      i._id === inquiryId
        ? { ...i, status: 'replied', lastMessageAt: createdAt, lastMessage: { text, senderRole: 'admin', createdAt }, messageCount: (i.messageCount || 0) + 1 }
        : i
    )));
    setSelectedInquiry(prev => (
      prev?._id === inquiryId ? { ...prev, status: 'replied', messageCount: (prev.messageCount || 0) + 1 } : prev
    ));

    // Hold off message polling so it can't drop the optimistic bubble
    pendingRepliesRef.current += 1;
    messagesVersionRef.current += 1;
    enqueueInquiry(
      inquiryId,
      async () => {
        const { data } = await axios.post(`/api/contact/${inquiryId}/messages`, { text }, authConfig());
        if (selectedInquiryRef.current?._id !== inquiryId) return;
        // Keep any later replies that are still sending
        setAdminMessages(prev => [...(data.messages || []), ...prev.filter(m => m.pending && m._id !== tempId)]);
      },
      () => {
        setAdminMessages(prev => prev.filter(m => m._id !== tempId));
        setAdminReplyText(current => current || text);
        showMsg('error', 'Failed to send reply');
      }
    ).finally(() => { pendingRepliesRef.current -= 1; });
  };

  const handleSelectConversation = (inq) => {
    if (selectedInquiry?._id !== inq._id) setAdminMessages([]);
    setSelectedInquiry(inq);
    selectedInquiryRef.current = inq;
    fetchConversationMessages(inq._id);
    if (inq.status === 'new') handleUpdateInquiryStatus(inq._id, 'read');
  };

  const formatAdminTime = (date) => {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'new': return <FaClock className="status-icon status-new" />;
      case 'read': return <FaEye className="status-icon status-read" />;
      case 'replied': return <FaReply className="status-icon status-replied" />;
      case 'resolved': return <FaCheckCircle className="status-icon status-resolved" />;
      default: return <FaClock className="status-icon" />;
    }
  };

  const renderProductsTable = (groupProducts) => (
    <div className="products-table-scroll-container">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event) => handleDragEnd(event, groupProducts)}>
        <table className="products-table">
          <thead>
            <tr>
              <th style={{ width: '40px' }}></th>
              <th>Image</th>
              <th>Name</th>
              <th>Colors</th>
              <th>Bead Types</th>
              <th>Price</th>
              <th>Discount Price</th>
              <th>Stock</th>
              <th>Featured</th>
              <th>Order</th>
              <th>Actions</th>
            </tr>
          </thead>
          <SortableContext items={groupProducts.map(p => p._id)} strategy={verticalListSortingStrategy}>
            <tbody>
              {groupProducts.map((product) => (
                <SortableProductRow
                  key={product._id}
                  product={product}
                  onInlineSave={handleInlineSave}
                  onDelete={handleDeleteProduct}
                  onDuplicate={handleDuplicateProduct}
                  onCarouselChange={handleCarouselChange}
                  onImageClick={handleImageClick}
                  colorSuggestions={colorSuggestions}
                  beadSuggestions={beadSuggestions}
                  selectionMode={selectionMode}
                  selected={selectedIds.has(product._id)}
                  onToggleSelect={toggleSelect}
                  priceRates={priceRates}
                  onFill={handleFill}
                />
              ))}
            </tbody>
          </SortableContext>
        </table>
      </DndContext>
    </div>
  );

  const renderCategorySection = ({ key, name, description, groupProducts, category, dragHandle }) => {
    const isExpanded = expandedCategories[key];
    const isTempCategory = category && isTempId(category._id);
    const selectable = groupProducts.filter(p => !isTempId(p._id));
    const selectedInGroup = selectable.filter(p => selectedIds.has(p._id)).length;
    const allSelected = selectable.length > 0 && selectedInGroup === selectable.length;
    return (
      <motion.div
        key={key}
        className={`category-section ${category ? '' : 'uncategorized-section'}`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="category-header">
          {dragHandle && (
            <button
              type="button"
              className="category-drag-handle"
              title="Drag to reorder categories"
              disabled={isTempCategory}
              {...dragHandle}
              aria-label={`Reorder ${name}`}
            >
              <FaGripVertical />
            </button>
          )}
          <button className="expand-btn" onClick={() => toggleCategory(key)}>
            {isExpanded ? <FaChevronDown /> : <FaChevronRight />}
          </button>
          <div className="category-info">
            <h2>{name}</h2>
            <p>{description}</p>
            <span className="product-count">
              {groupProducts.length} products
              {selectionMode && selectedInGroup > 0 && ` · ${selectedInGroup} selected`}
              {isTempCategory && <span className="saving-pill inline">Saving…</span>}
            </span>
          </div>
          <div className="category-actions">
            {selectionMode && (
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => setGroupSelected(selectable, !allSelected)}
                disabled={selectable.length === 0}
              >
                <FaCheckSquare /> {allSelected ? 'Deselect all' : 'Select all'}
              </button>
            )}
            {category && (
              <>
                <button className="btn-icon btn-edit" onClick={() => handleEditCategory(category)} title="Edit category" disabled={isTempCategory}>
                  <FaEdit />
                </button>
                <button className="btn-icon btn-delete" onClick={() => handleDeleteCategory(category)} title="Delete category" disabled={isTempCategory}>
                  <FaTrash />
                </button>
              </>
            )}
            <button className="btn btn-sm btn-primary" onClick={() => { setProductForm({ ...EMPTY_PRODUCT_FORM, category: category ? category.name : '' }); setShowProductForm(true); }}>
              <FaPlus /> Add Product
            </button>
          </div>
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              className="products-list"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {groupProducts.length === 0 ? (
                <div className="empty-message">No products in this category</div>
              ) : renderProductsTable(groupProducts)}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  /* ─── Undo / redo ─── */
  ops.current = {
    editProduct, applyOrderIds, setCarousel, removeProduct, restoreProduct, updateProducts,
    applyCategoryOrderIds, editCategory, removeCategory, restoreCategory
  };

  const runHistory = (action) => {
    const result = action === 'undo' ? undoHistory.undo() : undoHistory.redo();
    if (!result) return;
    const { step, ok, reason } = result;
    const text = ok
      ? `${action === 'undo' ? 'Undid' : 'Redid'}: ${step.label}`
      : `Couldn't ${action}: ${step.label}${reason ? ` (${reason})` : ''}`;
    clearTimeout(historyNoticeTimerRef.current);
    setHistoryNotice({ id: Date.now(), text, ok });
    historyNoticeTimerRef.current = setTimeout(() => setHistoryNotice(null), ok ? 2500 : 4000);
  };

  // Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z (Cmd on Mac) on the Products tab. Text fields keep their own
  // undo, and the shortcuts are off while a dialog is open.
  const shortcutsRef = useRef(null);
  shortcutsRef.current = { run: runHistory, enabled: activeTab === 'products' };
  useEffect(() => {
    const onKeyDown = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const key = e.key.toLowerCase();
      const isUndo = key === 'z' && !e.shiftKey;
      const isRedo = key === 'y' || (key === 'z' && e.shiftKey);
      if (!isUndo && !isRedo) return;
      if (!shortcutsRef.current.enabled || isTextField(e.target) || document.querySelector('.modal-overlay')) return;
      e.preventDefault();
      shortcutsRef.current.run(isUndo ? 'undo' : 'redo');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => () => clearTimeout(historyNoticeTimerRef.current), []);

  if (!user || user.role !== 'admin') return null;

  return (
    <motion.div
      className="admin-container"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <div className="admin-header-bar">
        <h1>Admin Dashboard</h1>
        <div className="admin-header-right">
          <SyncIndicator pendingCount={pendingCount} failed={syncFailed} showSaved={showSaved} />
          {activeTab === 'products' && (
            <div className="history-buttons">
              <button
                type="button"
                className="history-btn"
                onClick={() => runHistory('undo')}
                disabled={!undoHistory.undoLabel}
                title={undoHistory.undoLabel ? `Undo: ${undoHistory.undoLabel} (Ctrl+Z)` : 'Nothing to undo'}
                aria-label="Undo"
              >
                <FaUndo />
              </button>
              <button
                type="button"
                className="history-btn"
                onClick={() => runHistory('redo')}
                disabled={!undoHistory.redoLabel}
                title={undoHistory.redoLabel ? `Redo: ${undoHistory.redoLabel} (Ctrl+Y)` : 'Nothing to redo'}
                aria-label="Redo"
              >
                <FaRedo />
              </button>
            </div>
          )}
          <div className="admin-tabs">
            <button className={`admin-tab ${activeTab === 'products' ? 'active' : ''}`} onClick={() => setActiveTab('products')}>
              <FaBoxes /> Products
            </button>
            <button className={`admin-tab ${activeTab === 'inquiries' ? 'active' : ''}`} onClick={() => setActiveTab('inquiries')}>
              <FaInbox /> Inquiries
              {inquiries.filter(i => i.status === 'new').length > 0 && (
                <span className="tab-badge">{inquiries.filter(i => i.status === 'new').length}</span>
              )}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {message.text && (
          <motion.div
            className={`message ${message.type}`}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════ PRODUCTS TAB ═══════ */}
      {activeTab === 'products' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
          <div className="admin-toolbar">
            <button className="btn btn-primary" onClick={() => { setProductForm(EMPTY_PRODUCT_FORM); setShowProductForm(true); }}>
              <FaPlus /> Add Product
            </button>
            <button className="btn btn-secondary" onClick={() => setShowBulkImport(true)}>
              <FaFileImport /> Bulk Import
            </button>
            <button className="btn btn-secondary" onClick={() => setShowCategoryForm(true)}>
              <FaPlus /> Add Category
            </button>
            <button
              className={`btn ${selectionMode ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => (selectionMode ? exitSelection() : setSelectionMode(true))}
            >
              <FaCheckSquare /> {selectionMode ? 'Cancel Selecting' : 'Select Products'}
            </button>
            <div className="price-rate-fields" title="Used by the Fill buttons under each product's prices">
              <label className={priceRates.discount === null ? 'invalid' : ''}>
                Discount rate
                <input
                  type="text"
                  inputMode="decimal"
                  value={priceRateText.discount}
                  onChange={(e) => setPriceRateText(prev => ({ ...prev, discount: e.target.value }))}
                  aria-invalid={priceRates.discount === null}
                />
                %
              </label>
              <label className={priceRates.markup === null ? 'invalid' : ''}>
                Actual price from discount
                <input
                  type="text"
                  inputMode="decimal"
                  value={priceRateText.markup}
                  onChange={(e) => setPriceRateText(prev => ({ ...prev, markup: e.target.value }))}
                  aria-invalid={priceRates.markup === null}
                />
                %
              </label>
            </div>
          </div>

          {selectionMode && (
            <div className="selection-bar">
              <span className="selection-count"><strong>{selectedProducts.length}</strong> selected</span>
              <button className="btn btn-sm btn-primary" disabled={selectedProducts.length === 0} onClick={() => setShowBulkEdit(true)}>
                <FaEdit /> Edit selected
              </button>
              <button className="btn btn-sm btn-secondary" disabled={selectedIds.size === 0} onClick={() => setSelectedIds(new Set())}>
                Clear
              </button>
              <button className="btn btn-sm btn-secondary" onClick={exitSelection}>Cancel</button>
            </div>
          )}

          <p className="admin-hint">
            💡 Double-click Name, Colors, Bead Types, Price, Discount Price or Stock cells to edit inline. Fill sets a price from the rates above. Drag rows to reorder products, and the grip beside a category name to reorder categories. Changes save in the background.
          </p>

          <div className="tree-structure">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCategoryDragEnd}>
              <SortableContext items={categories.map(c => c._id)} strategy={verticalListSortingStrategy}>
                {categories.map((category) => (
                  <SortableCategory key={category._id} id={category._id} disabled={isTempId(category._id)}>
                    {(dragHandle) => renderCategorySection({
                      key: category._id,
                      name: category.name,
                      description: category.description,
                      groupProducts: getProductsByCategory(category.name),
                      category,
                      dragHandle
                    })}
                  </SortableCategory>
                ))}
              </SortableContext>
            </DndContext>
            {uncategorizedProducts.length > 0 && renderCategorySection({
              key: UNCATEGORIZED_KEY,
              name: 'Uncategorized',
              description: 'Products without a category. Assign one by editing the product or its category.',
              groupProducts: uncategorizedProducts,
              category: null
            })}
          </div>
        </motion.div>
      )}

      {/* ═══════ INQUIRIES TAB ═══════ */}
      {activeTab === 'inquiries' && (
        <motion.div className="inquiries-container" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
          {inquiriesLoading && inquiries.length === 0 ? (
            <div className="loading-text">Loading conversations...</div>
          ) : inquiries.length === 0 ? (
            <div className="empty-state">
              <FaInbox size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
              <h3>No Conversations Yet</h3>
              <p>Customer conversations will appear here</p>
            </div>
          ) : (
            <div className="inquiries-layout">
              <div className="inquiries-list">
                {inquiries.map((inq) => (
                  <motion.div
                    key={inq._id}
                    className={`inquiry-card ${selectedInquiry?._id === inq._id ? 'active' : ''} ${inq.status === 'new' ? 'unread' : ''}`}
                    onClick={() => handleSelectConversation(inq)}
                    whileHover={{ x: 4 }}
                  >
                    <div className="inquiry-card-header">
                      {getStatusIcon(inq.status)}
                      <strong>{inq.user?.name || 'Unknown'}</strong>
                      <span className="inquiry-date">
                        {inq.lastMessageAt ? new Date(inq.lastMessageAt).toLocaleDateString() : new Date(inq.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="inquiry-subject">{inq.subject}</div>
                    <div className="inquiry-preview">
                      {inq.lastMessage && (
                        <>{inq.lastMessage.senderRole === 'admin' ? 'You: ' : ''}{inq.lastMessage.text?.substring(0, 70)}{inq.lastMessage.text?.length > 70 ? '...' : ''}</>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="inquiry-detail">
                {selectedInquiry ? (
                  <motion.div className="admin-chat-panel" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <div className="inquiry-detail-header">
                      <h3>{selectedInquiry.subject}</h3>
                      <div className="inquiry-meta">
                        <span><strong>From:</strong> {selectedInquiry.user?.name || 'Unknown'} ({selectedInquiry.user?.email || 'N/A'})</span>
                        {selectedInquiry.user?.phone && <span><strong>Phone:</strong> {selectedInquiry.user.phone}</span>}
                        <span><strong>Started:</strong> {new Date(selectedInquiry.createdAt).toLocaleString()}</span>
                        <span><strong>Messages:</strong> {selectedInquiry.messageCount || 0}</span>
                      </div>
                      <div className="inquiry-actions" style={{ marginTop: '0.75rem' }}>
                        <select
                          value={selectedInquiry.status}
                          onChange={(e) => handleUpdateInquiryStatus(selectedInquiry._id, e.target.value)}
                          className="status-select"
                        >
                          <option value="new">New</option>
                          <option value="read">Read</option>
                          <option value="replied">Replied</option>
                          <option value="resolved">Resolved</option>
                        </select>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDeleteInquiry(selectedInquiry._id)}>
                          <FaTrash /> Delete
                        </button>
                      </div>
                    </div>

                    {/* Chat messages */}
                    <div className="admin-chat-messages" ref={adminMessagesRef} onScroll={handleMessagesScroll}>
                      {adminMessages.map((msg, idx) => (
                        <div key={msg._id || idx} className={`admin-chat-bubble ${msg.senderRole} ${msg.pending ? 'pending' : ''}`}>
                          {(msg.product || msg.playlist) && (
                            <div className="admin-chat-attachment">
                              {msg.product && (
                                <Link
                                  to={`/product/${msg.product._id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="admin-chat-ref"
                                  title="Open product page in a new tab"
                                >
                                  {msg.product.image
                                    ? <img src={imageUrl(msg.product.image)} alt={msg.product.name} loading="lazy" />
                                    : <span className="admin-chat-ref-icon"><FaBox size={12} /></span>}
                                  <span className="admin-chat-ref-text">
                                    <span className="admin-chat-ref-label">Product</span>
                                    <span className="admin-chat-ref-name">{msg.product.name || 'Untitled product'}</span>
                                  </span>
                                  <FaExternalLinkAlt size={10} className="admin-chat-ref-external" />
                                </Link>
                              )}
                              {msg.playlist && (
                                <Link
                                  to={`/playlists/${msg.playlist._id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="admin-chat-ref"
                                  title="Open collection in a new tab"
                                >
                                  <span className="admin-chat-ref-icon"><FaListUl size={12} /></span>
                                  <span className="admin-chat-ref-text">
                                    <span className="admin-chat-ref-label">Collection · {msg.playlist.items?.length || 0} items</span>
                                    <span className="admin-chat-ref-name">{msg.playlist.name}</span>
                                  </span>
                                  <FaExternalLinkAlt size={10} className="admin-chat-ref-external" />
                                </Link>
                              )}
                            </div>
                          )}
                          <div className="admin-chat-bubble-text">{msg.text}</div>
                          <div className="admin-chat-bubble-meta">
                            <span>{msg.senderRole === 'admin' ? 'You' : msg.sender?.name || 'User'}</span>
                            <span>{msg.pending ? 'Sending…' : formatAdminTime(msg.createdAt)}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Reply input */}
                    <form className="admin-chat-input" onSubmit={handleAdminReply}>
                      <input
                        type="text"
                        value={adminReplyText}
                        onChange={(e) => setAdminReplyText(e.target.value)}
                        placeholder="Type your reply..."
                      />
                      <button type="submit" className="btn btn-primary btn-sm" disabled={!adminReplyText.trim()}>
                        <FaReply /> Send
                      </button>
                    </form>
                  </motion.div>
                ) : (
                  <div className="empty-state">
                    <FaInbox size={36} style={{ color: 'var(--text-muted)' }} />
                    <p>Select a conversation to view and reply</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* ═══════ UNDO / REDO NOTICE ═══════ */}
      <div className="history-toast-wrap" aria-live="polite">
        <AnimatePresence>
          {historyNotice && (
            <motion.div
              key={historyNotice.id}
              className={`history-toast ${historyNotice.ok ? '' : 'failed'}`}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.2 }}
            >
              {historyNotice.text}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ═══════ BULK EDIT MODAL ═══════ */}
      <AnimatePresence>
        {showBulkEdit && selectedProducts.length > 0 && (
          <BulkEditModal
            key="bulk-edit"
            products={selectedProducts}
            colorSuggestions={colorSuggestions}
            beadSuggestions={beadSuggestions}
            onApply={handleBulkApply}
            onClose={() => setShowBulkEdit(false)}
          />
        )}
      </AnimatePresence>

      {/* ═══════ PRODUCT FORM MODAL ═══════ */}
      <AnimatePresence>
        {showProductForm && (
          <motion.div className="modal-overlay" onClick={resetProductForm} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="modal-content" onClick={(e) => e.stopPropagation()} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} transition={{ type: 'spring', damping: 25 }}>
              <div className="modal-header">
                <h3>Add New Product</h3>
                <button className="close-btn" onClick={resetProductForm}><FaTimes /></button>
              </div>
              <form onSubmit={handleProductSubmit}>
                <p className="form-hint">All fields are optional — fill in what you have and edit the rest later.</p>
                <div className="form-group">
                  <label>Product Name</label>
                  <input type="text" value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} rows="3" />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Price</label>
                    <input type="number" step="0.01" min="0" value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: e.target.value })} placeholder="0" />
                  </div>
                  <div className="form-group">
                    <label>Discount Price</label>
                    <input type="number" step="0.01" min="0" value={productForm.discountPrice} onChange={(e) => setProductForm({ ...productForm, discountPrice: e.target.value })} placeholder={productForm.price || '0'} title="Leave blank for no discount" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Stock</label>
                    <input type="number" min="0" value={productForm.stock} onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })} placeholder="0" />
                  </div>
                  <div className="form-group">
                    <label>Category</label>
                    <select value={productForm.category} onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}>
                      <option value="">No category</option>
                      {categories.map((cat) => (<option key={cat._id} value={cat.name}>{cat.name}</option>))}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>Colors</label>
                  <TagInput
                    value={productForm.color}
                    onChange={(colors) => setProductForm(prev => ({ ...prev, color: colors }))}
                    suggestions={colorSuggestions}
                    swatches
                    label="Add color"
                    placeholder="e.g., Blue, Gold — press Enter after each"
                  />
                </div>
                <div className="form-group">
                  <label>Bead Types</label>
                  <TagInput
                    value={productForm.beadType}
                    onChange={(beadTypes) => setProductForm(prev => ({ ...prev, beadType: beadTypes }))}
                    suggestions={beadSuggestions}
                    label="Add bead type"
                    placeholder="e.g., Glass, Crystal — press Enter after each"
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input type="checkbox" checked={productForm.featuredInCarousel} onChange={(e) => setProductForm({ ...productForm, featuredInCarousel: e.target.checked })} style={{ width: 'auto' }} />
                      Featured in Carousel
                    </label>
                  </div>
                  <div className="form-group">
                    <label>Carousel Order</label>
                    <input type="number" value={productForm.carouselOrder} onChange={(e) => setProductForm({ ...productForm, carouselOrder: parseInt(e.target.value, 10) || 0 })} min="0" />
                  </div>
                </div>
                <div className="form-group">
                  <label>Product Image</label>
                  <div className="image-upload-group">
                    <div className="image-preview">
                      {imagePreview ? <img src={imagePreview} alt="Preview" /> : <div className="image-preview-placeholder">📷</div>}
                    </div>
                    <div style={{ flex: 1 }}>
                      <input type="file" accept="image/*" onChange={handleImageChange} style={{ marginBottom: '0.5rem' }} />
                      <small style={{ color: 'var(--text-muted)' }}>Upload an image or it will use a placeholder</small>
                    </div>
                  </div>
                </div>
                <div className="form-actions">
                  <button type="button" className="btn btn-secondary" onClick={resetProductForm}>Cancel</button>
                  <button type="submit" className="btn btn-primary">Create</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════ IMAGE PREVIEW MODAL ═══════ */}
      <AnimatePresence>
        {selectedImageProduct && (
          <motion.div className="modal-overlay" onClick={closeImageModal} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="modal-content product-image-modal" onClick={(e) => e.stopPropagation()} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} transition={{ type: 'spring', damping: 25 }}>
              <div className="modal-header">
                <h3>{selectedImageProduct.name || 'Untitled product'}</h3>
                <button className="close-btn" onClick={closeImageModal}><FaTimes /></button>
              </div>
              <div className="image-modal-content">
                <div className="image-modal-main">
                  <img src={imageUrl(selectedImageProduct.image)} alt={selectedImageProduct.name} className="product-image-enlarged" onClick={() => window.open(imageUrl(selectedImageProduct.image), '_blank')} style={{ cursor: 'pointer' }} title="Click to open full size" />
                  <div className="image-modal-actions">
                    <input
                      type="file"
                      accept="image/*"
                      ref={imageFileInputRef}
                      onChange={handleImageModalImageUpload}
                      style={{ display: 'none' }}
                    />
                    <button className="btn btn-secondary btn-sm" onClick={() => imageFileInputRef.current?.click()}>
                      <FaUpload /> Change Image
                    </button>
                    <button className="btn btn-secondary btn-sm" disabled>
                      <FaPlus /> Add More Images (Coming Soon)
                    </button>
                  </div>
                </div>
                <div className="image-modal-details">
                  <div className="form-group">
                    <label>Description</label>
                    <InlineEditCell
                      value={selectedImageProduct.description || ''}
                      onSave={handleImageModalDescSave}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════ CATEGORY FORM MODAL ═══════ */}
      <AnimatePresence>
        {showCategoryForm && (
          <motion.div className="modal-overlay" onClick={resetCategoryForm} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="modal-content" onClick={(e) => e.stopPropagation()} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} transition={{ type: 'spring', damping: 25 }}>
              <div className="modal-header">
                <h3>{editingCategory ? 'Edit Category' : 'Add New Category'}</h3>
                <button className="close-btn" onClick={resetCategoryForm}><FaTimes /></button>
              </div>
              <form onSubmit={handleCategorySubmit}>
                <div className="form-group">
                  <label>Category Name *</label>
                  <input type="text" value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} required placeholder="e.g., Bead Necklace, Earrings" />
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea value={categoryForm.description} onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })} rows="3" placeholder="Optional description" />
                </div>
                <div className="form-actions">
                  <button type="button" className="btn btn-secondary" onClick={resetCategoryForm}>Cancel</button>
                  <button type="submit" className="btn btn-primary">{editingCategory ? 'Update' : 'Create'}</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════ BULK IMPORT MODAL ═══════ */}
      <AnimatePresence>
        {showBulkImport && (
          <motion.div className="modal-overlay" onClick={resetBulkImport} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="modal-content modal-wide" onClick={(e) => e.stopPropagation()} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} transition={{ type: 'spring', damping: 25 }}>
              <div className="modal-header">
                <h3><FaFileImport /> Bulk Create Products</h3>
                <button className="close-btn" onClick={resetBulkImport}><FaTimes /></button>
              </div>

              {/* Step indicators */}
              <div className="bulk-steps">
                <div className={`bulk-step ${bulkStep >= 1 ? 'active' : ''}`}>
                  <span className="step-num">1</span> Choose Images
                </div>
                <div className="step-line"></div>
                <div className={`bulk-step ${bulkStep >= 2 ? 'active' : ''}`}>
                  <span className="step-num">2</span> Preview &amp; Import
                </div>
              </div>

              {bulkStep === 1 && (
                <div className="bulk-upload-area">
                  <FaUpload size={44} style={{ color: 'var(--accent)', marginBottom: '1rem' }} />
                  <h4>Drop product images here</h4>
                  <p>One image becomes one product. Stock will default to 1 and price will follow the last in-stock product in the category.</p>

                  <div className="form-group bulk-category-group">
                    <label>Category for this batch *</label>
                    <select value={bulkCategory} onChange={(e) => setBulkCategory(e.target.value)}>
                      <option value="">Select Category</option>
                      {categories.map((cat) => (<option key={cat._id} value={cat.name}>{cat.name}</option>))}
                    </select>
                  </div>

                  <div
                    className={`bulk-drop-zone ${bulkDragActive ? 'drag-over' : ''}`}
                    onClick={() => bulkFileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setBulkDragActive(true); }}
                    onDragEnter={(e) => { e.preventDefault(); setBulkDragActive(true); }}
                    onDragLeave={() => setBulkDragActive(false)}
                    onDrop={handleBulkDrop}
                    role="button"
                    tabIndex={0}
                  >
                    <FaUpload size={36} style={{ color: 'var(--accent)', marginBottom: '0.75rem' }} />
                    <strong>Drop images here or click to browse</strong>
                    <span>PNG, JPG, JPEG, WEBP supported</span>
                    <input
                      ref={bulkFileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleBulkInputChange}
                      className="bulk-hidden-input"
                    />
                  </div>
                </div>
              )}

              {bulkStep === 2 && (
                <div className="bulk-preview">
                  <p><strong>{bulkImages.length} images</strong> ready for import.</p>
                  <div className="form-group bulk-category-group bulk-category-preview">
                    <label>Category for this batch *</label>
                    <select value={bulkCategory} onChange={(e) => setBulkCategory(e.target.value)}>
                      <option value="">Select Category</option>
                      {categories.map((cat) => (<option key={cat._id} value={cat.name}>{cat.name}</option>))}
                    </select>
                  </div>
                  <div className="bulk-image-grid">
                    {bulkImages.map((image, index) => (
                      <div className="bulk-image-card" key={`${image.name}-${index}`}>
                        <img src={image.preview} alt={image.name} />
                        <div className="bulk-image-meta">
                          <strong>Product {index + 1}</strong>
                          <span>{image.name}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="form-actions">
                    <button className="btn btn-secondary" onClick={() => { setBulkStep(1); setBulkImages([]); }}>Back</button>
                    <button className="btn btn-primary" onClick={handleBulkImport}>
                      <FaUpload /> Import {bulkImages.length} Products
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Admin;
