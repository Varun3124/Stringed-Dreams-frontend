import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  FaWhatsapp, FaInstagram, FaEnvelope, FaPaperPlane,
  FaListUl, FaBox, FaTimes, FaPlus,
  FaComments, FaGem, FaClock
} from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { usePlaylists } from '../context/PlaylistContext';

const Contact = () => {
  const { user } = useAuth();
  const { playlists } = usePlaylists();
  const [searchParams] = useSearchParams();
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  // Query params for pre-attaching
  const productId = searchParams.get('product');
  const productName = searchParams.get('name');
  const productPrice = searchParams.get('price');
  const productImage = searchParams.get('image');
  const collectionId = searchParams.get('collection');
  const collectionName = searchParams.get('collectionName');

  // State — single conversation per user
  const [chatId, setChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  // Attachment for message input
  const [msgAttachProduct, setMsgAttachProduct] = useState(null);
  const [msgAttachCollection, setMsgAttachCollection] = useState(null);
  const [showMsgPicker, setShowMsgPicker] = useState(false);
  const [msgPickerTab, setMsgPickerTab] = useState('products');
  const [msgProductSearch, setMsgProductSearch] = useState('');
  const [allProducts, setAllProducts] = useState([]);

  // Fetch (or create) the user's single chat
  const fetchChat = useCallback(async () => {
    if (!user?.token) return;
    try {
      const { data } = await axios.get('/api/contact/chat', {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      setChatId(data._id);
      setMessages(data.messages || []);
    } catch (error) {
      console.error('Failed to fetch chat:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Initial fetch
  useEffect(() => {
    if (user) fetchChat();
  }, [user, fetchChat]);

  // Poll every 5s
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(fetchChat, 5000);
    return () => clearInterval(interval);
  }, [user, fetchChat]);

  // Scroll to bottom only when user sends a message
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Pre-attach product/collection from query params
  useEffect(() => {
    if (productId && user) {
      setMsgAttachProduct({
        _id: productId,
        name: productName,
        price: productPrice,
        image: productImage ? decodeURIComponent(productImage) : null
      });
    } else if (collectionId && user) {
      setMsgAttachCollection({ _id: collectionId, name: collectionName });
    }
  }, [productId, productName, productPrice, productImage, collectionId, collectionName, user]);

  // Fetch products for picker
  useEffect(() => {
    if (showMsgPicker && allProducts.length === 0) {
      axios.get('/api/products')
        .then(({ data }) => setAllProducts(data))
        .catch(() => {});
    }
  }, [showMsgPicker, allProducts.length]);

  const filteredProducts = allProducts.filter(p =>
    p.name.toLowerCase().includes(msgProductSearch.toLowerCase())
  );

  // Send message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageText.trim() || !chatId) return;
    setSending(true);
    try {
      await axios.post(`/api/contact/${chatId}/messages`, {
        text: messageText,
        product: msgAttachProduct?._id || undefined,
        playlist: msgAttachCollection?._id || undefined
      }, { headers: { Authorization: `Bearer ${user.token}` } });

      setMessageText('');
      setMsgAttachProduct(null);
      setMsgAttachCollection(null);
      fetchChat();
      scrollToBottom();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const formatMessageTime = (date) => {
    const d = new Date(date);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDateLabel = (date) => {
    const d = new Date(date);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.round((today - msgDay) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'long' });
    return d.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const getDateKey = (date) => {
    const d = new Date(date);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  };

  // Attachment inline component
  const AttachmentCard = ({ product, playlist }) => {
    if (product) {
      return (
        <Link to={`/product/${product._id}`} className="chat-attachment">
          {product.image && <img src={product.image} alt={product.name} />}
          <div>
            <span className="chat-attachment-label"><FaBox size={10} /> Product</span>
            <span className="chat-attachment-name">{product.name}</span>
          </div>
        </Link>
      );
    }
    if (playlist) {
      return (
        <div className="chat-attachment collection">
          <div className="chat-attachment-icon"><FaListUl size={14} /></div>
          <div>
            <span className="chat-attachment-label"><FaListUl size={10} /> Collection</span>
            <span className="chat-attachment-name">{playlist.name}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  // Picker component
  const ReferencePicker = ({ show, onClose, tab, setTab, search, setSearch, onSelectProduct, onSelectCollection }) => {
    if (!show) return null;
    return (
      <motion.div
        className="chat-picker"
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
      >
        <div className="chat-picker-inner">
          <div className="chat-picker-tabs">
            <button type="button" className={`btn btn-sm ${tab === 'products' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('products')}><FaBox size={11} /> Products</button>
            {user && (
              <button type="button" className={`btn btn-sm ${tab === 'collections' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('collections')}><FaListUl size={11} /> Collections</button>
            )}
            <button type="button" className="btn btn-sm btn-secondary" onClick={onClose} style={{ marginLeft: 'auto' }}><FaTimes size={11} /></button>
          </div>
          {tab === 'products' && (
            <>
              <input type="text" placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} className="chat-picker-search" />
              <div className="chat-picker-list">
                {filteredProducts.length === 0 ? (
                  <p className="chat-picker-empty">{allProducts.length === 0 ? 'Loading...' : 'No products found'}</p>
                ) : filteredProducts.slice(0, 15).map(p => (
                  <div key={p._id} className="chat-picker-item" onClick={() => onSelectProduct(p)}>
                    <img src={p.image} alt={p.name} />
                    <div>
                      <div className="chat-picker-item-name">{p.name}</div>
                      <div className="chat-picker-item-meta">₹{p.price?.toFixed(2)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          {tab === 'collections' && (
            <div className="chat-picker-list">
              {playlists.length === 0 ? (
                <p className="chat-picker-empty">No collections yet</p>
              ) : playlists.map(c => (
                <div key={c._id} className="chat-picker-item" onClick={() => onSelectCollection(c)}>
                  <div className="chat-picker-collection-icon"><FaListUl size={14} color="var(--accent)" /></div>
                  <div>
                    <div className="chat-picker-item-name">{c.name}</div>
                    <div className="chat-picker-item-meta">{c.items?.length || 0} items</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  // Not logged in — show login prompt with socials
  if (!user) {
    return (
      <motion.div className="contact-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="contact-layout">
          <div className="contact-form-section" style={{ textAlign: 'center' }}>
            <FaComments size={48} style={{ color: 'var(--accent)', marginBottom: '1rem' }} />
            <h2>Sign In to Chat</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              Create an account or sign in to start a conversation with us about custom orders, products, or collections.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/login" className="btn btn-primary">Sign In</Link>
              <Link to="/register" className="btn btn-secondary">Register</Link>
            </div>
          </div>
          <div className="contact-info-section">
            <div className="contact-brand-card">
              <h2>Stringed Dreams</h2>
              <p>Handcrafted bead jewelry made with love. Every piece tells a story, every bead carries a dream.</p>
            </div>
            <div className="social-links-card">
              <h3>Connect With Us</h3>
              <a href="https://wa.me/919876543210" target="_blank" rel="noopener noreferrer" className="social-link">
                <div className="social-link-icon whatsapp"><FaWhatsapp size={20} /></div>
                <div className="social-link-text"><h4>WhatsApp</h4><p>Chat with us directly</p></div>
              </a>
              <a href="https://instagram.com/peepda_dreams" target="_blank" rel="noopener noreferrer" className="social-link">
                <div className="social-link-icon instagram"><FaInstagram size={20} /></div>
                <div className="social-link-text"><h4>Instagram</h4><p>@peepda_dreams</p></div>
              </a>
              <a href="mailto:hello@peepdadreams.com" className="social-link">
                <div className="social-link-icon email"><FaEnvelope size={20} /></div>
                <div className="social-link-text"><h4>Email</h4><p>hello@peepdadreams.com</p></div>
              </a>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div className="contact-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="chat-window">
        {loading ? (
          <div className="chat-loading">
            <FaClock size={24} />
            <p>Loading chat...</p>
          </div>
        ) : (
          <div className="chat-active">
            {/* Messages area */}
            <div className="chat-messages" ref={chatContainerRef}>
              {/* Welcome banner — always at top */}
              <div className="chat-welcome-banner">
                <div className="chat-welcome-icon">
                  <FaGem size={28} />
                </div>
                <h3>Chat with the Handcraftsman</h3>
                <p>Inquire about products, collections, custom orders, or anything else — we're here to help!</p>
                <div className="chat-welcome-socials">
                  <a href="https://wa.me/919876543210" target="_blank" rel="noopener noreferrer" title="WhatsApp"><FaWhatsapp /></a>
                  <a href="https://instagram.com/peepda_dreams" target="_blank" rel="noopener noreferrer" title="Instagram"><FaInstagram /></a>
                  <a href="mailto:hello@peepdadreams.com" title="Email"><FaEnvelope /></a>
                </div>
                <div className="chat-welcome-divider" />
              </div>

              {messages.length === 0 && (
                <div className="chat-start-hint">
                  <FaPaperPlane size={16} />
                  <span>Send a message to start the conversation!</span>
                </div>
              )}

              {messages.map((msg, idx) => {
                const showDateDivider = idx === 0 || getDateKey(msg.createdAt) !== getDateKey(messages[idx - 1].createdAt);
                return (
                  <React.Fragment key={msg._id || idx}>
                    {showDateDivider && (
                      <div className="chat-date-divider">
                        <span>{formatDateLabel(msg.createdAt)}</span>
                      </div>
                    )}
                    <div className={`chat-bubble ${msg.senderRole === 'user' ? 'user' : 'admin'}`}>
                      {(msg.product || msg.playlist) && (
                        <AttachmentCard product={msg.product} playlist={msg.playlist} />
                      )}
                      <div className="chat-bubble-text">{msg.text}</div>
                      <div className="chat-bubble-meta">
                        <span>{msg.senderRole === 'admin' ? 'Peepda Dreams' : 'You'}</span>
                        <span>{formatMessageTime(msg.createdAt)}</span>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Attachment bar + picker + input — fixed footer */}
            <div className="chat-input-footer">
            {/* Attachment bar */}
            {(msgAttachProduct || msgAttachCollection) && (
              <div className="chat-ref-bar">
                {msgAttachProduct && <><FaBox size={12} /> <span>{msgAttachProduct.name}</span><button type="button" onClick={() => setMsgAttachProduct(null)}><FaTimes size={10} /></button></>}
                {msgAttachCollection && <><FaListUl size={12} /> <span>{msgAttachCollection.name}</span><button type="button" onClick={() => setMsgAttachCollection(null)}><FaTimes size={10} /></button></>}
              </div>
            )}

            <AnimatePresence>
              <ReferencePicker
                show={showMsgPicker}
                onClose={() => setShowMsgPicker(false)}
                tab={msgPickerTab}
                setTab={setMsgPickerTab}
                search={msgProductSearch}
                setSearch={setMsgProductSearch}
                onSelectProduct={(p) => { setMsgAttachProduct(p); setMsgAttachCollection(null); setShowMsgPicker(false); }}
                onSelectCollection={(c) => { setMsgAttachCollection(c); setMsgAttachProduct(null); setShowMsgPicker(false); }}
              />
            </AnimatePresence>

            {/* Input bar */}
            <form className="chat-input-area" onSubmit={handleSendMessage}>
              <button type="button" className="chat-attach-btn" onClick={() => setShowMsgPicker(!showMsgPicker)} title="Attach product or collection">
                <FaPlus />
              </button>
              <input
                type="text"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Type a message..."
                className="chat-input"
              />
              <button type="submit" className="chat-send-btn" disabled={sending || !messageText.trim()}>
                <FaPaperPlane />
              </button>
            </form>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default Contact;
