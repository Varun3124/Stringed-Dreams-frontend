import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FaPlus, FaTrash, FaEdit, FaArrowLeft, FaListUl, FaEnvelope, FaHeart } from 'react-icons/fa';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { usePlaylists } from '../context/PlaylistContext';
import { useFavorites } from '../context/FavoritesContext';
import ProductCard from '../components/ProductCard';

const FavoritesDetail = ({ onBack }) => {
  const { favorites } = useFavorites();
  const navigate = useNavigate();
  const items = favorites.items || [];

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
    >
      <button className="back-btn" onClick={onBack}>
        <FaArrowLeft /> Back to Collections
      </button>

      <div className="playlist-detail-header">
        <div>
          <h1><FaHeart style={{ color: 'var(--danger)' }} /> Favorites</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            {items.length} {items.length === 1 ? 'item' : 'items'} you love
          </p>
        </div>
        <div className="playlist-actions">
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/')}>
            <FaPlus /> Browse & Add Products
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="empty-state">
          <FaHeart size={60} color="var(--text-muted)" />
          <h2>Your favorites collection is empty</h2>
          <p>Explore our gallery and tap the heart on items you love.</p>
          <button className="btn btn-primary" onClick={() => navigate('/')}>
            Explore Gallery
          </button>
        </div>
      ) : (
        <div className="products-grid">
          {items.map((item, idx) => {
            const product = item.product && typeof item.product === 'object' ? item.product : null;
            if (!product) return null;
            return (
              <ProductCard
                key={item._id || product._id}
                product={product}
                index={idx}
              />
            );
          })}
        </div>
      )}
    </motion.div>
  );
};

const PlaylistDetail = ({ playlist, onBack }) => {
  const { deletePlaylist, removeFromPlaylist, updatePlaylist } = usePlaylists();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(playlist.name);
  const navigate = useNavigate();

  const handleSaveName = async () => {
    if (name.trim() && name !== playlist.name) {
      await updatePlaylist(playlist._id, { name: name.trim() });
    }
    setEditing(false);
  };

  const handleDelete = async () => {
    if (window.confirm('Delete this collection?')) {
      await deletePlaylist(playlist._id);
      onBack();
    }
  };

  const handleRemoveItem = async (productId) => {
    await removeFromPlaylist(playlist._id, productId);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
    >
      <button className="back-btn" onClick={onBack}>
        <FaArrowLeft /> Back to Collections
      </button>

      <div className="playlist-detail-header">
        <div>
          {editing ? (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="inline-edit-input"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                onBlur={handleSaveName}
                style={{ fontSize: '1.2rem', maxWidth: '100%' }}
              />
            </div>
          ) : (
            <h1 style={{ cursor: 'pointer' }} onClick={() => setEditing(true)}>
              {playlist.name} <FaEdit size={16} style={{ color: 'var(--text-muted)', marginLeft: '0.5rem' }} />
            </h1>
          )}
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            {playlist.items?.length || 0} items
          </p>
        </div>
        <div className="playlist-actions">
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/')}>
            <FaPlus /> Browse & Add Products
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => navigate(`/contact?collection=${playlist._id}&collectionName=${encodeURIComponent(playlist.name)}&collectionItems=${playlist.items?.length || 0}`)}
          >
            <FaEnvelope /> Ask About This Collection
          </button>
          <button className="btn btn-danger btn-sm" onClick={handleDelete}>
            <FaTrash /> Delete
          </button>
        </div>
      </div>

      {(!playlist.items || playlist.items.length === 0) ? (
        <div className="empty-state">
          <FaListUl size={60} color="var(--text-muted)" />
          <h2>This collection is empty</h2>
          <p>Browse our gallery and add items using the + button on product cards.</p>
          <button className="btn btn-primary" onClick={() => navigate('/')}>
            Explore Gallery
          </button>
        </div>
      ) : (
        <div className="products-grid">
          {playlist.items.map((item, idx) => {
            const product = item.product;
            if (!product) return null;
            return (
              <ProductCard
                key={item._id || product._id}
                product={product}
                index={idx}
                collectionId={playlist._id}
                onRemoveFromCollection={handleRemoveItem}
              />
            );
          })}
        </div>
      )}
    </motion.div>
  );
};

const Playlists = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const { playlists, createPlaylist } = usePlaylists();
  const { favorites } = useFavorites();
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [showFavorites, setShowFavorites] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    if (id === 'favorites') {
      setShowFavorites(true);
      setSelectedPlaylist(null);
    } else if (id && playlists.length > 0) {
      const found = playlists.find(p => p._id === id);
      if (found) {
        setSelectedPlaylist(found);
        setShowFavorites(false);
      }
    }
  }, [id, playlists]);

  // Update selected playlist when playlists data changes
  useEffect(() => {
    if (selectedPlaylist) {
      const updated = playlists.find(p => p._id === selectedPlaylist._id);
      if (updated) setSelectedPlaylist(updated);
    }
  }, [playlists]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) {
    return (
      <div className="empty-state">
        <FaListUl size={80} color="var(--text-muted)" />
        <h2>Please login to view your collections</h2>
        <button className="btn btn-primary" onClick={() => navigate('/login')}>Login</button>
      </div>
    );
  }

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const result = await createPlaylist(newName.trim());
    if (result.success) {
      setNewName('');
      setShowCreate(false);
    }
  };

  if (showFavorites) {
    return (
      <motion.div
        className="playlists-page"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
        <FavoritesDetail
          onBack={() => { setShowFavorites(false); navigate('/playlists'); }}
        />
      </motion.div>
    );
  }

  if (selectedPlaylist) {
    return (
      <motion.div
        className="playlists-page"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
        <PlaylistDetail
          playlist={selectedPlaylist}
          onBack={() => { setSelectedPlaylist(null); setShowFavorites(false); navigate('/playlists'); }}
        />
      </motion.div>
    );
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <motion.div 
      className="playlists-page"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div className="playlists-header" variants={cardVariants}>
        <h1><FaListUl style={{ color: 'var(--accent)' }} /> My Collections</h1>
        <p>Organize your favorite pieces into curated collections.</p>
      </motion.div>

      {playlists.length === 0 ? (
        <div className="playlists-grid">
          {/* Favorites card — always first */}
          <motion.div
            className="playlist-card"
            variants={cardVariants}
            whileHover={{ y: -6 }}
            onClick={() => { setShowFavorites(true); navigate('/playlists/favorites'); }}
          >
            <div className="playlist-cover">
              <div className="playlist-cover-empty"><FaHeart size={32} color="var(--danger)" /></div>
            </div>
            <div className="playlist-card-info">
              <h3>Favorites</h3>
              <span className="playlist-item-count">{favorites.items?.length || 0} items</span>
            </div>
          </motion.div>

          <motion.div
            className="playlist-card create-collection-card"
            variants={cardVariants}
            whileHover={{ y: -6 }}
            onClick={() => setShowCreate(true)}
          >
            {showCreate ? (
              <div className="create-collection-form" onClick={(e) => e.stopPropagation()}>
                <input
                  type="text"
                  placeholder="e.g. Pink Jodi, Gift Collection..."
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowCreate(false); }}
                  autoFocus
                  style={{ width: '100%', padding: '0.75rem', border: '1.5px solid var(--accent)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.95rem', textAlign: 'center' }}
                />
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                  <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={handleCreate}>Create</button>
                  <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => setShowCreate(false)}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div className="playlist-cover">
                  <div className="playlist-cover-empty" style={{ background: 'var(--bg-secondary)' }}>
                    <FaPlus size={32} color="var(--accent)" />
                  </div>
                </div>
                <div className="playlist-card-info">
                  <h3>New Collection</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Pink Jodi, Gift Collection...</p>
                </div>
              </>
            )}
          </motion.div>
        </div>
      ) : (
        <div className="playlists-grid">
          {/* Favorites card — always first */}
          <motion.div
            className="playlist-card"
            variants={cardVariants}
            whileHover={{ y: -6 }}
            onClick={() => { setShowFavorites(true); navigate('/playlists/favorites'); }}
          >
            <div className="playlist-cover">
              <div className="playlist-cover-empty"><FaHeart size={70} color="var(--danger)" /></div>
            </div>
            <div className="playlist-card-info">
              <h3>Favorites</h3>
              <span className="playlist-item-count">{favorites.items?.length || 0} items</span>
            </div>
          </motion.div>

          {playlists.map((playlist, idx) => {
            const coverImg = playlist.items?.[0]?.product?.image;
            return (
              <motion.div
                key={playlist._id}
                className="playlist-card"
                variants={cardVariants}
                whileHover={{ y: -6 }}
                onClick={() => { setSelectedPlaylist(playlist); navigate(`/playlists/${playlist._id}`); }}
              >
                <div className="playlist-cover">
                  {coverImg ? (
                    <img src={coverImg} alt={playlist.name} />
                  ) : (
                    <div className="playlist-cover-empty"><FaListUl /></div>
                  )}
                </div>
                <div className="playlist-card-info">
                  <h3>{playlist.name}</h3>
                  {playlist.description && <p>{playlist.description}</p>}
                  <span className="playlist-item-count">{playlist.items?.length || 0} items</span>
                </div>
              </motion.div>
            );
          })}

          {/* Add Collection Card */}
          <motion.div
            className="playlist-card create-collection-card"
            variants={cardVariants}
            whileHover={{ y: -6 }}
            onClick={() => setShowCreate(true)}
          >
            {showCreate ? (
              <div className="create-collection-form" onClick={(e) => e.stopPropagation()}>
                <input
                  type="text"
                  placeholder="e.g. Pink Jodi, Gift Collection..."
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowCreate(false); }}
                  autoFocus
                  style={{ width: '100%', padding: '0.75rem', border: '1.5px solid var(--accent)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.95rem', textAlign: 'center' }}
                />
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                  <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={handleCreate}>Create</button>
                  <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => setShowCreate(false)}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div className="playlist-cover">
                  <div className="playlist-cover-empty" style={{ background: 'var(--bg-secondary)' }}>
                    <FaPlus size={32} color="var(--accent)" />
                  </div>
                </div>
                <div className="playlist-card-info">
                  <h3>New Collection</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Pink Jodi, Gift Collection...</p>
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}
    </motion.div>
  );
};

export default Playlists;
