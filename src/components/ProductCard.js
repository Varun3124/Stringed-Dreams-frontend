import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaHeart, FaRegHeart, FaPlus, FaCheck, FaMinus, FaTrash } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useFavorites } from '../context/FavoritesContext';
import { usePlaylists } from '../context/PlaylistContext';

const ProductCard = ({ product, index = 0, collectionId, onRemoveFromCollection }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toggleFavorite, isFavorite } = useFavorites();
  const { playlists, addToPlaylist, removeFromPlaylist, createPlaylist } = usePlaylists();
  const [showPlaylistDropdown, setShowPlaylistDropdown] = useState(false);
  const [heartAnimating, setHeartAnimating] = useState(false);
  const [localLikesCount, setLocalLikesCount] = useState(product.likesCount || 0);
  const dropdownRef = useRef(null);
  const plusBtnRef = useRef(null);

  useEffect(() => {
    if (!showPlaylistDropdown) return;
    const handleClickOutside = (e) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target) &&
        plusBtnRef.current && !plusBtnRef.current.contains(e.target)
      ) {
        setShowPlaylistDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPlaylistDropdown]);

  const favorited = user ? isFavorite(product._id) : false;

  const handleHeartClick = async (e) => {
    e.stopPropagation();
    if (!user) {
      navigate('/login');
      return;
    }
    setHeartAnimating(true);
    // Optimistic likes count update
    const willBeFavorited = !favorited;
    setLocalLikesCount(prev => willBeFavorited ? prev + 1 : Math.max(0, prev - 1));
    const result = await toggleFavorite(product._id);
    if (!result.success) {
      // Revert on failure
      setLocalLikesCount(prev => willBeFavorited ? Math.max(0, prev - 1) : prev + 1);
    }
    setTimeout(() => setHeartAnimating(false), 400);
  };

  const handlePlaylistClick = (e) => {
    e.stopPropagation();
    if (!user) {
      navigate('/login');
      return;
    }
    setShowPlaylistDropdown(!showPlaylistDropdown);
  };

  const isInPlaylist = (playlist) => {
    return playlist.items?.some(item => {
      const pid = item.product?._id || item.product;
      return pid === product._id;
    });
  };

  const handleTogglePlaylist = async (e, playlist) => {
    e.stopPropagation();
    if (isInPlaylist(playlist)) {
      await removeFromPlaylist(playlist._id, product._id);
    } else {
      await addToPlaylist(playlist._id, product._id);
    }
  };

  const handleQuickCreate = async (e) => {
    e.stopPropagation();
    const name = prompt('New collection name:');
    if (name) {
      const result = await createPlaylist(name);
      if (result.success) {
        await addToPlaylist(result.playlist._id, product._id);
      }
    }
    setShowPlaylistDropdown(false);
  };

  return (
    <motion.div 
      className="product-card" 
      onClick={() => navigate(`/product/${product._id}`)}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
    >
      <div className="product-image-wrapper">
        <img src={product.image} alt={product.name} className="product-image" />
        
        {/* Heart Overlay */}
        <motion.button
          className={`heart-overlay ${favorited ? 'favorited' : ''}`}
          onClick={handleHeartClick}
          whileTap={{ scale: 0.8 }}
          animate={heartAnimating ? { scale: [1, 1.3, 1] } : {}}
          title={favorited ? 'Remove from favorites' : 'Add to favorites'}
        >
          {favorited ? <FaHeart size={18} /> : <FaRegHeart size={18} />}
        </motion.button>

        {/* Playlist Overlay / Remove from Collection */}
        {collectionId ? (
          <motion.button
            className="playlist-add-overlay remove-from-collection"
            onClick={(e) => { e.stopPropagation(); onRemoveFromCollection && onRemoveFromCollection(product._id); }}
            whileTap={{ scale: 0.8 }}
            title="Remove from collection"
          >
            <FaTrash size={14} />
          </motion.button>
        ) : (
          <motion.button
            ref={plusBtnRef}
            className="playlist-add-overlay"
            onClick={handlePlaylistClick}
            whileTap={{ scale: 0.8 }}
            title="Add to collection"
          >
            <FaPlus size={16} />
          </motion.button>
        )}
      </div>

      {/* Playlist Dropdown — outside image wrapper so overflow:hidden doesn't clip it */}
      <AnimatePresence>
        {showPlaylistDropdown && (
          <motion.div 
            ref={dropdownRef}
            className="playlist-dropdown"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            onClick={(e) => e.stopPropagation()}
          >
            {playlists.length > 0 ? (
              playlists.map(pl => {
                const inPlaylist = isInPlaylist(pl);
                return (
                  <button 
                    key={pl._id} 
                    className={`playlist-dropdown-item ${inPlaylist ? 'in-playlist' : ''}`}
                    onClick={(e) => handleTogglePlaylist(e, pl)}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 1 }}>
                      {inPlaylist ? <FaCheck size={11} /> : null}
                      {pl.name} ({pl.items?.length || 0})
                    </span>
                    {inPlaylist && <FaMinus size={11} title="Remove from collection" style={{ color: 'var(--danger, #e74c3c)', flexShrink: 0 }} />}
                  </button>
                );
              })
            ) : (
              <div className="playlist-dropdown-item" style={{ color: 'var(--text-muted)', cursor: 'default' }}>
                No collections yet
              </div>
            )}
            <button 
              className="playlist-dropdown-item playlist-dropdown-create"
              onClick={handleQuickCreate}
            >
              <FaPlus size={12} /> Create New
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="product-info">
        <h3 className="product-name">{product.name}</h3>
        <p className="product-category">{product.category}</p>
        <div className="product-meta">
          <span className="product-likes-mini">
            <FaHeart size={12} style={{ color: 'var(--accent)' }} /> {localLikesCount} <span className="likes-text">{localLikesCount === 1 ? 'like' : 'likes'}</span>
          </span>
          <span className={`product-stock-label ${product.stock > 0 ? 'in-stock' : 'out-of-stock'}`}>
            {product.stock > 0 ? (<><FaCheck size={10} className="stock-icon" /><span className="stock-text">In Stock</span></>) : 'Out of Stock'}
          </span>
        </div>
      </div>
    </motion.div>
  );
};

export default ProductCard;
