import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FaHeart, FaTrash } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useFavorites } from '../context/FavoritesContext';

const Favorites = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { favorites, removeFromFavorites } = useFavorites();

  if (!user) {
    return (
      <motion.div className="empty-state" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
        <FaHeart size={80} color="var(--text-muted)" />
        <h2>Please login to view your favorites</h2>
        <button className="btn btn-primary" onClick={() => navigate('/login')}>Login</button>
      </motion.div>
    );
  }

  const handleRemove = async (itemId) => {
    await removeFromFavorites(itemId);
  };

  if (!favorites.items || favorites.items.length === 0) {
    return (
      <motion.div className="empty-state" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
        <FaHeart size={80} color="var(--text-muted)" />
        <h2>Your favorites collection is empty</h2>
        <p>Explore our gallery and save your favorite items</p>
        <button className="btn btn-primary" onClick={() => navigate('/')}>Explore Gallery</button>
      </motion.div>
    );
  }

  return (
    <motion.div 
      style={{ padding: '2rem 0' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="page-title">
        <h1><FaHeart style={{ color: 'var(--danger)' }} /> My Favorites</h1>
        <p>{favorites.items.length} {favorites.items.length === 1 ? 'item' : 'items'} you love</p>
      </div>

      <div className="favorites-grid">
        <AnimatePresence>
          {favorites.items.map((item, idx) => (
            <motion.div 
              key={item._id} 
              className="favorite-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ delay: idx * 0.05 }}
              layout
            >
              <div className="favorite-image-wrapper">
                <img 
                  src={item.image} 
                  alt={item.name} 
                  onClick={() => navigate(`/product/${item.product._id || item.product}`)}
                />
                <motion.button
                  className="remove-favorite-btn"
                  onClick={() => handleRemove(item._id)}
                  title="Remove from favorites"
                  whileTap={{ scale: 0.8 }}
                  whileHover={{ scale: 1.1 }}
                >
                  <FaTrash />
                </motion.button>
              </div>
              <div className="favorite-info">
                <h3 
                  onClick={() => navigate(`/product/${item.product._id || item.product}`)}
                  style={{ cursor: 'pointer' }}
                >
                  {item.name}
                </h3>
                <p className="favorite-category">{item.category}</p>
                <p className="favorite-price">₹{item.price.toFixed(2)}</p>
                <small style={{ color: 'var(--text-muted)' }}>
                  Added {new Date(item.addedAt).toLocaleDateString()}
                </small>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default Favorites;
