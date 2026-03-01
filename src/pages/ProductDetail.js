import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FaHeart, FaRegHeart, FaArrowLeft, FaEnvelope, FaPlus, FaListUl } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import axios from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useFavorites } from '../context/FavoritesContext';
import { usePlaylists } from '../context/PlaylistContext';

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toggleFavorite, isFavorite: checkIsFavorite } = useFavorites();
  const { playlists, addToPlaylist, createPlaylist } = usePlaylists();
  
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [review, setReview] = useState({ rating: 5, comment: '' });
  const [isFavorited, setIsFavorited] = useState(false);
  const [showCollectionDropdown, setShowCollectionDropdown] = useState(false);
  const collectionDropdownRef = useRef(null);
  const collectionBtnRef = useRef(null);

  useEffect(() => {
    if (!showCollectionDropdown) return;
    const handleClickOutside = (e) => {
      if (
        collectionDropdownRef.current && !collectionDropdownRef.current.contains(e.target) &&
        collectionBtnRef.current && !collectionBtnRef.current.contains(e.target)
      ) {
        setShowCollectionDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showCollectionDropdown]);

  const fetchProduct = useCallback(async () => {
    try {
      const { data } = await axios.get(`/api/products/${id}`);
      setProduct(data);
      setLoading(false);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to load product' });
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchProduct();
  }, [fetchProduct]);

  useEffect(() => {
    if (product && user) {
      setIsFavorited(checkIsFavorite(product._id));
    }
  }, [product, user, checkIsFavorite]);

  const handleToggleFavorite = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    // Optimistic update
    const willBeFavorited = !isFavorited;
    setIsFavorited(willBeFavorited);
    setProduct(prev => ({
      ...prev,
      likesCount: willBeFavorited ? (prev.likesCount || 0) + 1 : Math.max(0, (prev.likesCount || 0) - 1)
    }));

    const result = await toggleFavorite(product._id);
    if (result.success) {
      setMessage({ type: 'success', text: result.message });
      setTimeout(() => setMessage({ type: '', text: '' }), 2000);
    } else {
      // Revert on failure
      setIsFavorited(!willBeFavorited);
      setProduct(prev => ({
        ...prev,
        likesCount: willBeFavorited ? Math.max(0, (prev.likesCount || 0) - 1) : (prev.likesCount || 0) + 1
      }));
      setMessage({ type: 'error', text: result.message });
    }
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      navigate('/login');
      return;
    }

    try {
      const config = {
        headers: {
          Authorization: `Bearer ${user.token}`
        }
      };
      await axios.post(`/api/products/${id}/reviews`, review, config);
      setMessage({ type: 'success', text: 'Review added successfully!' });
      setReview({ rating: 5, comment: '' });
      fetchProduct();
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.message || 'Failed to add review' 
      });
    }
  };

  if (loading) return (
    <div style={{ padding: '2rem 0' }}>
      <div className="skeleton-card" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem', padding: '1.25rem', borderRadius: 'var(--radius-lg)' }}>
        <div className="skeleton" style={{ height: '250px', borderRadius: 'var(--radius-md)' }} />
        <div>
          <div className="skeleton skeleton-text" style={{ width: '40%', height: '20px' }} />
          <div className="skeleton skeleton-text" style={{ width: '70%', height: '28px', marginTop: '1rem' }} />
          <div className="skeleton skeleton-text price" style={{ marginTop: '1rem' }} />
          <div className="skeleton skeleton-text" style={{ marginTop: '1rem', height: '80px' }} />
        </div>
      </div>
    </div>
  );
  if (!product) return <div className="message error">Product not found</div>;

  return (
    <motion.div 
      className="product-detail-container"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {message.text && (
        <div className={`message ${message.type}`}>{message.text}</div>
      )}
      
      <button 
        className="back-btn" 
        onClick={() => navigate(-1)}
      >
        <FaArrowLeft /> Back to Gallery
      </button>

      <div className="product-detail-card">
        <div className="product-detail-image">
          <img src={product.image} alt={product.name} />
        </div>
        <div className="product-detail-info">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <div>
              <span className="product-badge">{product.category}</span>
              <h1 style={{ margin: '1rem 0' }}>{product.name}</h1>
            </div>
          </div>

          <div className="product-rating">
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <FaHeart size={16} style={{ color: 'var(--accent)' }} />
              <span style={{ fontWeight: 600 }}>{product.likesCount || 0}</span>
              <span style={{ color: '#888' }}>
                {product.likesCount === 1 ? 'person likes' : 'people like'} this product
              </span>
            </span>
          </div>

          <p className="product-detail-price">₹{product.price.toFixed(2)}</p>
          
          <p className="product-description">{product.description}</p>
          
          <div className="product-stock-info">
            {product.stock > 0 ? (
              <span className="in-stock">✓ In Stock ({product.stock} available)</span>
            ) : (
              <span className="out-of-stock">✗ Out of Stock</span>
            )}
          </div>

          <div className="product-detail-actions">
            <button
              className={`favorite-icon-btn ${isFavorited ? 'favorited' : ''}`}
              onClick={handleToggleFavorite}
              title={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
            >
              {isFavorited ? <FaHeart size={28} /> : <FaRegHeart size={28} />}
            </button>
            <div style={{ position: 'relative' }}>
              <button
                ref={collectionBtnRef}
                className="btn btn-secondary"
                onClick={() => {
                  if (!user) { navigate('/login'); return; }
                  setShowCollectionDropdown(!showCollectionDropdown);
                }}
                title="Add to collection"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <FaPlus /> Add to Collection
              </button>
              <AnimatePresence>
                {showCollectionDropdown && (
                  <motion.div
                    ref={collectionDropdownRef}
                    className="playlist-dropdown"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    style={{ position: 'absolute', top: '100%', left: 0, marginTop: '0.5rem', minWidth: '200px', zIndex: 100 }}
                  >
                    {playlists.length > 0 ? (
                      playlists.map(pl => (
                        <button
                          key={pl._id}
                          className="playlist-dropdown-item"
                          onClick={async () => {
                            await addToPlaylist(pl._id, product._id);
                            setShowCollectionDropdown(false);
                            setMessage({ type: 'success', text: `Added to "${pl.name}"` });
                            setTimeout(() => setMessage({ type: '', text: '' }), 2000);
                          }}
                        >
                          <FaListUl size={12} /> {pl.name} ({pl.items?.length || 0})
                        </button>
                      ))
                    ) : (
                      <div className="playlist-dropdown-item" style={{ color: 'var(--text-muted)', cursor: 'default' }}>
                        No collections yet
                      </div>
                    )}
                    <button
                      className="playlist-dropdown-item playlist-dropdown-create"
                      onClick={async () => {
                        const name = prompt('New collection name:');
                        if (name) {
                          const result = await createPlaylist(name);
                          if (result.success) {
                            await addToPlaylist(result.playlist._id, product._id);
                            setMessage({ type: 'success', text: `Added to "${name}"` });
                            setTimeout(() => setMessage({ type: '', text: '' }), 2000);
                          }
                        }
                        setShowCollectionDropdown(false);
                      }}
                    >
                      <FaPlus size={12} /> Create New
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <button
              className="contact-product-btn"
              onClick={() => navigate(`/contact?product=${product._id}&name=${encodeURIComponent(product.name)}&price=${product.price}&image=${encodeURIComponent(product.image)}`)}
            >
              <FaEnvelope /> Ask About This Product
            </button>
          </div>
        </div>
      </div>

      {/* Reviews Section */}
      <div className="reviews-section">
        <h2>Customer Reviews</h2>
        {product.reviews.length === 0 && (
          <p style={{ color: '#888', textAlign: 'center', padding: '2rem' }}>
            No reviews yet. Be the first to review!
          </p>
        )}
        <div className="reviews-grid">
          {product.reviews.map((review) => (
            <div key={review._id} className="review-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <strong>{review.name}</strong>
                <span className="review-rating">{'⭐'.repeat(review.rating)}</span>
              </div>
              <p style={{ color: '#666', marginBottom: '0.5rem' }}>{review.comment}</p>
              <small style={{ color: '#aaa' }}>
                {new Date(review.createdAt).toLocaleDateString()}
              </small>
            </div>
          ))}
        </div>

        {user && (
          <div className="review-form">
            <h3>Write a Review</h3>
            <form onSubmit={handleReviewSubmit}>
              <div className="form-group">
                <label>Rating</label>
                <select
                  value={review.rating}
                  onChange={(e) => setReview({ ...review, rating: e.target.value })}
                >
                  <option value="1">1 - Poor</option>
                  <option value="2">2 - Fair</option>
                  <option value="3">3 - Good</option>
                  <option value="4">4 - Very Good</option>
                  <option value="5">5 - Excellent</option>
                </select>
              </div>
              <div className="form-group">
                <label>Comment</label>
                <textarea
                  rows="4"
                  value={review.comment}
                  onChange={(e) => setReview({ ...review, comment: e.target.value })}
                  required
                  placeholder="Share your thoughts about this product..."
                />
              </div>
              <button type="submit" className="btn btn-primary">
                Submit Review
              </button>
            </form>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default ProductDetail;
