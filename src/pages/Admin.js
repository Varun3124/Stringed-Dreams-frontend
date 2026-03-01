import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaPlus, FaEdit, FaTrash, FaTimes, FaChevronDown, FaChevronRight,
  FaGripVertical, FaCopy, FaFileImport, FaInbox, FaBoxes,
  FaUpload, FaFileExcel, FaEye, FaReply, FaClock, FaCheckCircle
} from 'react-icons/fa';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import * as XLSX from 'xlsx';

/* ─── Inline Editable Cell ─── */
const InlineEditCell = ({ value, onSave, type = 'text' }) => {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  const save = () => {
    setEditing(false);
    if (editValue !== value) onSave(editValue);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="inline-edit-input"
        type={type}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setEditValue(value); setEditing(false); } }}
      />
    );
  }

  return (
    <span
      className="inline-edit-cell"
      onDoubleClick={() => setEditing(true)}
      onTouchEnd={(e) => { e.preventDefault(); setEditing(true); }}
      title="Tap or double-click to edit"
    >
      {value || '-'}
    </span>
  );
};

/* ─── Sortable Product Row ─── */
const SortableProductRow = ({ product, user, fetchProducts, handleEditProduct, handleDeleteProduct, handleDuplicateProduct, handleMoveToLast, categories }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: product._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
    position: isDragging ? 'relative' : 'static',
    zIndex: isDragging ? 1000 : 'auto',
  };

  const handleInlineSave = async (field, val) => {
    try {
      const updateData = { [field]: (field === 'price' || field === 'stock') ? parseFloat(val) : val };
      await axios.put(
        `/api/admin/products/${product._id}`,
        updateData,
        { headers: { Authorization: `Bearer ${user.token}` } }
      );
      if (field === 'stock' && parseFloat(val) === 0) {
        await handleMoveToLast(product);
      } else {
        fetchProducts();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update');
    }
  };

  return (
    <tr ref={setNodeRef} style={style} className={isDragging ? 'row-dragging' : ''}>
      <td {...attributes} {...listeners} style={{ cursor: 'grab', textAlign: 'center' }}>
        <FaGripVertical style={{ color: 'var(--text-muted)' }} />
      </td>
      <td>
        <img src={product.image} alt={product.name} className="product-thumb" />
      </td>
      <td><InlineEditCell value={product.name} onSave={(v) => handleInlineSave('name', v)} /></td>
      <td><InlineEditCell value={product.color || ''} onSave={(v) => handleInlineSave('color', v)} /></td>
      <td><InlineEditCell value={product.beadType || ''} onSave={(v) => handleInlineSave('beadType', v)} /></td>
      <td className="price-cell">
        <InlineEditCell value={product.price} onSave={(v) => handleInlineSave('price', v)} type="number" />
      </td>
      <td><InlineEditCell value={product.stock} onSave={(v) => handleInlineSave('stock', v)} type="number" /></td>
      <td>
        <input
          type="checkbox"
          checked={product.featuredInCarousel || false}
          onChange={async (e) => {
            try {
              await axios.put(
                `/api/admin/products/${product._id}/carousel`,
                { featuredInCarousel: e.target.checked, carouselOrder: product.carouselOrder || 0 },
                { headers: { Authorization: `Bearer ${user.token}` } }
              );
              fetchProducts();
            } catch (err) {
              alert(err.response?.data?.message || 'Failed to update carousel status');
            }
          }}
          style={{ cursor: 'pointer' }}
        />
      </td>
      <td>
        <input
          type="number"
          value={product.carouselOrder || 0}
          onChange={async (e) => {
            try {
              await axios.put(
                `/api/admin/products/${product._id}/carousel`,
                { featuredInCarousel: product.featuredInCarousel || false, carouselOrder: parseInt(e.target.value) || 0 },
                { headers: { Authorization: `Bearer ${user.token}` } }
              );
              fetchProducts();
            } catch (err) {
              alert(err.response?.data?.message || 'Failed to update carousel order');
            }
          }}
          style={{ width: '60px' }}
          min="0"
        />
      </td>
      <td>
        <div className="action-buttons">
          <button className="btn-icon btn-edit" onClick={() => handleEditProduct(product)} title="Edit product">
            <FaEdit />
          </button>
          <button className="btn-icon btn-duplicate" onClick={() => handleDuplicateProduct(product._id)} title="Duplicate product">
            <FaCopy />
          </button>
          <button className="btn-icon btn-delete" onClick={() => handleDeleteProduct(product._id)} title="Delete product">
            <FaTrash />
          </button>
        </div>
      </td>
    </tr>
  );
};

/* ─── Main Admin Component ─── */
const Admin = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('products');
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [expandedCategories, setExpandedCategories] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Product form state
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [productForm, setProductForm] = useState({
    name: '', description: '', price: '', category: '', color: '', beadType: '',
    image: '', stock: '', featuredInCarousel: false, carouselOrder: 0, displayOrder: 0
  });

  // Category form state
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' });

  // Bulk import state
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkStep, setBulkStep] = useState(1); // 1=upload, 2=preview, 3=importing
  const [bulkData, setBulkData] = useState([]);
  const [bulkImporting, setBulkImporting] = useState(false);

  // Inquiries state
  const [inquiries, setInquiries] = useState([]);
  const [inquiriesLoading, setInquiriesLoading] = useState(false);
  const [selectedInquiry, setSelectedInquiry] = useState(null);
  const [adminMessages, setAdminMessages] = useState([]);
  const [adminReplyText, setAdminReplyText] = useState('');
  const [adminReplySending, setAdminReplySending] = useState(false);
  const adminMessagesEndRef = React.useRef(null);

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
      const { data } = await axios.get('/api/admin/products', { headers: { Authorization: `Bearer ${user.token}` } });
      setProducts(data);
    } catch (error) { showMsg('error', error.response?.data?.message || 'Failed to fetch products'); }
  };

  const fetchCategories = async () => {
    try {
      if (!user?.token) { showMsg('error', 'No auth token.'); return; }
      const { data } = await axios.get('/api/admin/categories', { headers: { Authorization: `Bearer ${user.token}` } });
      setCategories(data);
      const expanded = {};
      data.forEach(cat => { expanded[cat._id] = false; });
      setExpandedCategories(expanded);
    } catch (error) { showMsg('error', error.response?.data?.message || 'Failed to fetch categories'); }
  };

  const fetchInquiries = async () => {
    setInquiriesLoading(true);
    try {
      const { data } = await axios.get('/api/contact', { headers: { Authorization: `Bearer ${user.token}` } });
      setInquiries(data);
    } catch (error) { showMsg('error', 'Failed to fetch inquiries'); }
    finally { setInquiriesLoading(false); }
  };

  const fetchConversationMessages = async (id) => {
    try {
      const { data } = await axios.get(`/api/contact/${id}`, { headers: { Authorization: `Bearer ${user.token}` } });
      setAdminMessages(data.messages || []);
    } catch (error) { console.error('Failed to fetch conversation messages'); }
  };

  // Poll inquiries and active conversation
  useEffect(() => {
    if (activeTab !== 'inquiries') return;
    const interval = setInterval(() => {
      fetchInquiries();
      if (selectedInquiry) fetchConversationMessages(selectedInquiry._id);
    }, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedInquiry]);

  // Scroll admin messages to bottom
  useEffect(() => {
    adminMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [adminMessages]);

  const showMsg = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 3000);
  };

  const toggleCategory = (categoryId) => {
    setExpandedCategories(prev => ({ ...prev, [categoryId]: !prev[categoryId] }));
  };

  const getProductsByCategory = (categoryName) => {
    return products.filter(p => p.category === categoryName).sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => { setImagePreview(reader.result); };
      reader.readAsDataURL(file);
    }
  };

  // DnD
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleMoveToLast = async (product) => {
    const categoryProducts = getProductsByCategory(product.category);
    const reordered = categoryProducts.filter(p => p._id !== product._id);
    reordered.push(product);
    const reorderData = reordered.map((item, index) => ({ id: item._id, displayOrder: index }));
    try {
      await axios.put('/api/admin/products/reorder', { products: reorderData }, { headers: { Authorization: `Bearer ${user.token}` } });
      fetchProducts();
    } catch (error) { console.error('Failed to move product to last'); fetchProducts(); }
  };

  const handleDragEnd = async (event, categoryName) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const categoryProducts = getProductsByCategory(categoryName);
    const oldIndex = categoryProducts.findIndex(p => p._id === active.id);
    const newIndex = categoryProducts.findIndex(p => p._id === over.id);
    const reorderedProducts = arrayMove(categoryProducts, oldIndex, newIndex);
    const updatedProducts = reorderedProducts.map((item, index) => ({ id: item._id, displayOrder: index }));
    const newProducts = products.map(p => {
      const updated = updatedProducts.find(up => up.id === p._id);
      return updated ? { ...p, displayOrder: updated.displayOrder } : p;
    });
    setProducts(newProducts);
    try {
      await axios.put('/api/admin/products/reorder', { products: updatedProducts }, { headers: { Authorization: `Bearer ${user.token}` } });
      showMsg('success', 'Products reordered');
    } catch (error) { showMsg('error', 'Failed to reorder'); fetchProducts(); }
  };

  // Product CRUD
  const handleProductSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (!user?.token) { showMsg('error', 'No auth token'); return; }
      const productData = { ...productForm, image: imagePreview || productForm.image };
      if (editingProduct) {
        await axios.put(`/api/admin/products/${editingProduct._id}`, productData, { headers: { Authorization: `Bearer ${user.token}` } });
        showMsg('success', 'Product updated');
      } else {
        await axios.post('/api/admin/products', productData, { headers: { Authorization: `Bearer ${user.token}` } });
        showMsg('success', 'Product created');
      }
      resetProductForm();
      // If stock is 0, move to last in category
      if (parseInt(productData.stock) === 0 && productData.category) {
        await fetchProducts();
        const catProducts = products.filter(p => p.category === productData.category).sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
        const target = catProducts.find(p => editingProduct ? p._id === editingProduct._id : p.name === productData.name);
        if (target) await handleMoveToLast(target);
      } else {
        fetchProducts();
      }
    } catch (error) { showMsg('error', error.response?.data?.message || 'Operation failed'); }
    finally { setLoading(false); }
  };

  const handleEditProduct = (product) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name, description: product.description, price: product.price,
      category: product.category, color: product.color || '', beadType: product.beadType || '',
      image: product.image, stock: product.stock, featuredInCarousel: product.featuredInCarousel || false,
      carouselOrder: product.carouselOrder || 0, displayOrder: product.displayOrder || 0
    });
    setImagePreview(product.image);
    setImageFile(null);
    setShowProductForm(true);
  };

  const handleDeleteProduct = async (id) => {
    if (!window.confirm('Delete this product?')) return;
    try {
      await axios.delete(`/api/admin/products/${id}`, { headers: { Authorization: `Bearer ${user.token}` } });
      showMsg('success', 'Product deleted');
      fetchProducts();
    } catch (error) { showMsg('error', error.response?.data?.message || 'Failed to delete'); }
  };

  const handleDuplicateProduct = async (id) => {
    try {
      await axios.post(`/api/admin/products/${id}/duplicate`, {}, { headers: { Authorization: `Bearer ${user.token}` } });
      showMsg('success', 'Product duplicated!');
      fetchProducts();
    } catch (error) { showMsg('error', error.response?.data?.message || 'Failed to duplicate'); }
  };

  const resetProductForm = () => {
    setProductForm({
      name: '', description: '', price: '', category: '', color: '', beadType: '',
      image: '', stock: '', featuredInCarousel: false, carouselOrder: 0, displayOrder: 0
    });
    setEditingProduct(null);
    setImageFile(null);
    setImagePreview('');
    setShowProductForm(false);
  };

  // Category CRUD
  const handleCategorySubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingCategory) {
        await axios.put(`/api/admin/categories/${editingCategory._id}`, categoryForm, { headers: { Authorization: `Bearer ${user.token}` } });
        showMsg('success', 'Category updated');
      } else {
        await axios.post('/api/admin/categories', categoryForm, { headers: { Authorization: `Bearer ${user.token}` } });
        showMsg('success', 'Category created');
      }
      resetCategoryForm();
      fetchCategories();
      fetchProducts();
    } catch (error) { showMsg('error', error.response?.data?.message || 'Operation failed'); }
    finally { setLoading(false); }
  };

  const handleEditCategory = (category) => {
    setEditingCategory(category);
    setCategoryForm({ name: category.name, description: category.description || '' });
    setShowCategoryForm(true);
  };

  const handleDeleteCategory = async (id) => {
    if (!window.confirm('Delete this category? Products in it will need reassignment.')) return;
    try {
      await axios.delete(`/api/admin/categories/${id}`, { headers: { Authorization: `Bearer ${user.token}` } });
      showMsg('success', 'Category deleted');
      fetchCategories();
      fetchProducts();
    } catch (error) { showMsg('error', error.response?.data?.message || 'Failed to delete'); }
  };

  const resetCategoryForm = () => {
    setCategoryForm({ name: '', description: '' });
    setEditingCategory(null);
    setShowCategoryForm(false);
  };

  /* ─── Bulk Import ─── */
  const handleBulkFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const workbook = XLSX.read(evt.target.result, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet);

        // Map columns
        const mapped = jsonData.map(row => ({
          name: row.name || row.Name || row.PRODUCT || row.product || '',
          description: row.description || row.Description || row.desc || 'Beautiful handmade bead jewelry',
          price: parseFloat(row.price || row.Price || row.PRICE || 0),
          category: row.category || row.Category || row.CATEGORY || (categories.length > 0 ? categories[0].name : ''),
          color: row.color || row.Color || row.COLOR || '',
          beadType: row.beadType || row.bead_type || row['Bead Type'] || row.BeadType || '',
          stock: parseInt(row.stock || row.Stock || row.STOCK || 10),
          image: row.image || row.Image || row.IMAGE || row.image_url || '',
        })).filter(r => r.name);

        setBulkData(mapped);
        setBulkStep(2);
      } catch (err) {
        showMsg('error', 'Failed to parse file. Ensure it is a valid Excel/CSV.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleBulkImport = async () => {
    setBulkImporting(true);
    setBulkStep(3);
    try {
      const { data } = await axios.post('/api/admin/products/bulk', { products: bulkData }, { headers: { Authorization: `Bearer ${user.token}` } });
      showMsg('success', `${data.created?.length || bulkData.length} products imported!`);
      setShowBulkImport(false);
      setBulkStep(1);
      setBulkData([]);
      fetchProducts();
    } catch (error) {
      showMsg('error', error.response?.data?.message || 'Bulk import failed');
      setBulkStep(2);
    }
    finally { setBulkImporting(false); }
  };

  const resetBulkImport = () => {
    setShowBulkImport(false);
    setBulkStep(1);
    setBulkData([]);
  };

  /* ─── Inquiries ─── */
  const handleUpdateInquiryStatus = async (id, status) => {
    try {
      await axios.put(`/api/contact/${id}`, { status }, { headers: { Authorization: `Bearer ${user.token}` } });
      fetchInquiries();
      if (selectedInquiry?._id === id) setSelectedInquiry(prev => ({ ...prev, status }));
      showMsg('success', 'Status updated');
    } catch (error) { showMsg('error', 'Failed to update status'); }
  };

  const handleDeleteInquiry = async (id) => {
    if (!window.confirm('Delete this conversation?')) return;
    try {
      await axios.delete(`/api/contact/${id}`, { headers: { Authorization: `Bearer ${user.token}` } });
      fetchInquiries();
      if (selectedInquiry?._id === id) { setSelectedInquiry(null); setAdminMessages([]); }
      showMsg('success', 'Conversation deleted');
    } catch (error) { showMsg('error', 'Failed to delete'); }
  };

  const handleAdminReply = async (e) => {
    e.preventDefault();
    if (!adminReplyText.trim() || !selectedInquiry) return;
    setAdminReplySending(true);
    try {
      await axios.post(`/api/contact/${selectedInquiry._id}/messages`, {
        text: adminReplyText
      }, { headers: { Authorization: `Bearer ${user.token}` } });
      setAdminReplyText('');
      fetchConversationMessages(selectedInquiry._id);
      fetchInquiries();
    } catch (error) { showMsg('error', 'Failed to send reply'); }
    finally { setAdminReplySending(false); }
  };

  const handleSelectConversation = async (inq) => {
    setSelectedInquiry(inq);
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

  if (!user || user.role !== 'admin') return null;

  return (
    <motion.div
      className="admin-container"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <div className="admin-header-bar">
        <h1>Admin Dashboard</h1>
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
            <button className="btn btn-primary" onClick={() => setShowProductForm(true)}>
              <FaPlus /> Add Product
            </button>
            <button className="btn btn-secondary" onClick={() => setShowBulkImport(true)}>
              <FaFileImport /> Bulk Import
            </button>
            <button className="btn btn-secondary" onClick={() => setShowCategoryForm(true)}>
              <FaPlus /> Add Category
            </button>
          </div>

          <p className="admin-hint">
            💡 Double-click Name, Color, Bead Type, or Price cells to edit inline. Drag rows to reorder.
          </p>

          <div className="tree-structure">
            {categories.map((category) => {
              const categoryProducts = getProductsByCategory(category.name);
              const isExpanded = expandedCategories[category._id];

              return (
                <motion.div
                  key={category._id}
                  className="category-section"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="category-header">
                    <button className="expand-btn" onClick={() => toggleCategory(category._id)}>
                      {isExpanded ? <FaChevronDown /> : <FaChevronRight />}
                    </button>
                    <div className="category-info">
                      <h2>{category.name}</h2>
                      <p>{category.description}</p>
                      <span className="product-count">{categoryProducts.length} products</span>
                    </div>
                    <div className="category-actions">
                      <button className="btn-icon btn-edit" onClick={() => handleEditCategory(category)} title="Edit category">
                        <FaEdit />
                      </button>
                      <button className="btn-icon btn-delete" onClick={() => handleDeleteCategory(category._id)} title="Delete category">
                        <FaTrash />
                      </button>
                      <button className="btn btn-sm btn-primary" onClick={() => { setProductForm({ ...productForm, category: category.name }); setShowProductForm(true); }}>
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
                        {categoryProducts.length === 0 ? (
                          <div className="empty-message">No products in this category</div>
                        ) : (
                          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event) => handleDragEnd(event, category.name)}>
                            <table className="products-table">
                              <thead>
                                <tr>
                                  <th style={{ width: '40px' }}></th>
                                  <th>Image</th>
                                  <th>Name</th>
                                  <th>Color</th>
                                  <th>Bead Type</th>
                                  <th>Price</th>
                                  <th>Stock</th>
                                  <th>Featured</th>
                                  <th>Order</th>
                                  <th>Actions</th>
                                </tr>
                              </thead>
                              <SortableContext items={categoryProducts.map(p => p._id)} strategy={verticalListSortingStrategy}>
                                <tbody>
                                  {categoryProducts.map((product) => (
                                    <SortableProductRow
                                      key={product._id}
                                      product={product}
                                      user={user}
                                      fetchProducts={fetchProducts}
                                      handleEditProduct={handleEditProduct}
                                      handleDeleteProduct={handleDeleteProduct}
                                      handleDuplicateProduct={handleDuplicateProduct}
                                      handleMoveToLast={handleMoveToLast}
                                      categories={categories}
                                    />
                                  ))}
                                </tbody>
                              </SortableContext>
                            </table>
                          </DndContext>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
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
                    <div className="admin-chat-messages">
                      {adminMessages.map((msg, idx) => (
                        <div key={msg._id || idx} className={`admin-chat-bubble ${msg.senderRole}`}>
                          {(msg.product || msg.playlist) && (
                            <div className="admin-chat-attachment">
                              {msg.product && (
                                <span><strong>Product:</strong> {msg.product.name}</span>
                              )}
                              {msg.playlist && (
                                <span><strong>Collection:</strong> {msg.playlist.name}</span>
                              )}
                            </div>
                          )}
                          <div className="admin-chat-bubble-text">{msg.text}</div>
                          <div className="admin-chat-bubble-meta">
                            <span>{msg.senderRole === 'admin' ? 'You' : msg.sender?.name || 'User'}</span>
                            <span>{formatAdminTime(msg.createdAt)}</span>
                          </div>
                        </div>
                      ))}
                      <div ref={adminMessagesEndRef} />
                    </div>

                    {/* Reply input */}
                    <form className="admin-chat-input" onSubmit={handleAdminReply}>
                      <input
                        type="text"
                        value={adminReplyText}
                        onChange={(e) => setAdminReplyText(e.target.value)}
                        placeholder="Type your reply..."
                      />
                      <button type="submit" className="btn btn-primary btn-sm" disabled={adminReplySending || !adminReplyText.trim()}>
                        <FaReply /> {adminReplySending ? 'Sending...' : 'Send'}
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

      {/* ═══════ PRODUCT FORM MODAL ═══════ */}
      <AnimatePresence>
        {showProductForm && (
          <motion.div className="modal-overlay" onClick={resetProductForm} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="modal-content" onClick={(e) => e.stopPropagation()} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} transition={{ type: 'spring', damping: 25 }}>
              <div className="modal-header">
                <h3>{editingProduct ? 'Edit Product' : 'Add New Product'}</h3>
                <button className="close-btn" onClick={resetProductForm}><FaTimes /></button>
              </div>
              <form onSubmit={handleProductSubmit}>
                <div className="form-group">
                  <label>Product Name *</label>
                  <input type="text" value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Description *</label>
                  <textarea value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} required rows="3" />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Price *</label>
                    <input type="number" step="0.01" value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label>Stock *</label>
                    <input type="number" value={productForm.stock} onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })} required />
                  </div>
                </div>
                <div className="form-group">
                  <label>Category *</label>
                  <select value={productForm.category} onChange={(e) => setProductForm({ ...productForm, category: e.target.value })} required>
                    <option value="">Select Category</option>
                    {categories.map((cat) => (<option key={cat._id} value={cat.name}>{cat.name}</option>))}
                  </select>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Color</label>
                    <input type="text" value={productForm.color} onChange={(e) => setProductForm({ ...productForm, color: e.target.value })} placeholder="e.g., Blue, Multi-color" />
                  </div>
                  <div className="form-group">
                    <label>Bead Type</label>
                    <input type="text" value={productForm.beadType} onChange={(e) => setProductForm({ ...productForm, beadType: e.target.value })} placeholder="e.g., Glass, Crystal, Wood" />
                  </div>
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
                    <input type="number" value={productForm.carouselOrder} onChange={(e) => setProductForm({ ...productForm, carouselOrder: parseInt(e.target.value) || 0 })} min="0" />
                  </div>
                </div>
                <div className="form-group">
                  <label>Product Image *</label>
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
                  <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving...' : editingProduct ? 'Update' : 'Create'}</button>
                </div>
              </form>
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
                  <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving...' : editingCategory ? 'Update' : 'Create'}</button>
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
                <h3><FaFileImport /> Bulk Import Products</h3>
                <button className="close-btn" onClick={resetBulkImport}><FaTimes /></button>
              </div>

              {/* Step indicators */}
              <div className="bulk-steps">
                <div className={`bulk-step ${bulkStep >= 1 ? 'active' : ''}`}>
                  <span className="step-num">1</span> Upload File
                </div>
                <div className="step-line"></div>
                <div className={`bulk-step ${bulkStep >= 2 ? 'active' : ''}`}>
                  <span className="step-num">2</span> Preview
                </div>
                <div className="step-line"></div>
                <div className={`bulk-step ${bulkStep >= 3 ? 'active' : ''}`}>
                  <span className="step-num">3</span> Import
                </div>
              </div>

              {bulkStep === 1 && (
                <div className="bulk-upload-area">
                  <FaFileExcel size={48} style={{ color: 'var(--accent)', marginBottom: '1rem' }} />
                  <h4>Upload Excel or CSV File</h4>
                  <p>Columns: name, description, price, category, color, beadType, stock, image</p>
                  <input type="file" accept=".xlsx,.xls,.csv" onChange={handleBulkFileUpload} className="bulk-file-input" />
                  <small>Supported formats: .xlsx, .xls, .csv</small>
                </div>
              )}

              {bulkStep === 2 && (
                <div className="bulk-preview">
                  <p><strong>{bulkData.length} products</strong> found in file:</p>
                  <div className="bulk-preview-table-container">
                    <table className="products-table bulk-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Name</th>
                          <th>Category</th>
                          <th>Color</th>
                          <th>Bead Type</th>
                          <th>Price</th>
                          <th>Stock</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bulkData.map((item, i) => (
                          <tr key={i}>
                            <td>{i + 1}</td>
                            <td>{item.name}</td>
                            <td>{item.category}</td>
                            <td>{item.color || '-'}</td>
                            <td>{item.beadType || '-'}</td>
                            <td>₹{item.price}</td>
                            <td>{item.stock}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="form-actions">
                    <button className="btn btn-secondary" onClick={() => { setBulkStep(1); setBulkData([]); }}>Back</button>
                    <button className="btn btn-primary" onClick={handleBulkImport} disabled={bulkImporting}>
                      <FaUpload /> Import {bulkData.length} Products
                    </button>
                  </div>
                </div>
              )}

              {bulkStep === 3 && (
                <div className="bulk-upload-area">
                  <div className="spinner-large"></div>
                  <h4>Importing products...</h4>
                  <p>Please wait while we create your products.</p>
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
