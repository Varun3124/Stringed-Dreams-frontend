import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FaHeart } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { useFavorites } from '../context/FavoritesContext';
import ProductCard from '../components/ProductCard';

const Favourites = () => {
  const { user } = useAuth();
  const { favorites } = useFavorites();
  const navigate = useNavigate();

  if (!user) {
    return (
      <div className="empty-state">
        <FaHeart size={80} color="var(--text-muted)" />
        <h2>Please login to view your favourites</h2>
        <button className="btn btn-primary" onClick={() => navigate('/login')}>Login</button>
      </div>
    );
  }

  const products = (favorites.items || [])
    .map(item => (item.product && typeof item.product === 'object' ? item.product : null))
    .filter(Boolean);

  return (
    <div className="favourites-page">
      <div className="playlist-detail-header">
        <div>
          <h1><FaHeart style={{ color: 'var(--danger)' }} /> Favourites</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            {products.length} {products.length === 1 ? 'item' : 'items'} you love
          </p>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="empty-state">
          <FaHeart size={60} color="var(--text-muted)" />
          <h2>No favourites yet</h2>
          <p>Explore our gallery and tap the heart on items you love.</p>
          <button className="btn btn-primary" onClick={() => navigate('/')}>
            Explore Gallery
          </button>
        </div>
      ) : (
        <div className="products-grid favourites-grid">
          {products.map((product, idx) => (
            <ProductCard key={product._id} product={product} index={idx} />
          ))}
        </div>
      )}
    </div>
  );
};

export default Favourites;
