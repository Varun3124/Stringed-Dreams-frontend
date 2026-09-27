import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaUser, FaSun, FaMoon, FaSearch, FaListUl, FaEnvelope, FaSignOutAlt, FaUserEdit } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useFavorites } from '../context/FavoritesContext';
import { useTheme } from '../context/ThemeContext';
import { imageUrl } from '../api/axios';
import { useCatalog, refreshCatalog, isCatalogStale } from '../data/catalog';
import { toList } from '../utils/tags';

const Header = () => {
  const { user, logout } = useAuth();
  const { favorites } = useFavorites();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  // Search runs over the shared catalog; it's only fetched here once someone searches
  const { products } = useCatalog({ autoRefresh: false });

  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);
  const headerRef = useRef(null);

  const favoritesCount = favorites?.items?.length || 0;

  // Publish the header's height so sticky page elements can sit right below it
  useEffect(() => {
    const el = headerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const update = () => {
      document.documentElement.style.setProperty('--header-height', `${Math.round(el.getBoundingClientRect().height)}px`);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    setProfileOpen(false);
    navigate('/');
  };

  const query = searchQuery.trim().toLowerCase();

  useEffect(() => {
    if (query.length >= 2 && isCatalogStale()) refreshCatalog();
  }, [query]);

  const searchResults = useMemo(() => {
    if (query.length < 2) return [];
    return products.filter(p =>
      (p.name || '').toLowerCase().includes(query) ||
      (p.category || '').toLowerCase().includes(query) ||
      toList(p.color).some(c => c.toLowerCase().includes(query)) ||
      toList(p.beadType).some(b => b.toLowerCase().includes(query))
    ).slice(0, 6);
  }, [products, query]);

  const handleResultClick = (productId) => {
    navigate(`/product/${productId}`);
    setSearchQuery('');
  };

  return (
    <motion.header
      ref={headerRef}
      className="header"
      initial={{ y: -80 }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', stiffness: 100, damping: 20 }}
    >
      <div className="container">
        <nav>
          <Link to="/" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <img
              src="/logo-128.png"
              alt="Stringed Dreams Logo"
              className="header-logo-img"
              width="48"
              height="50"
              decoding="async"
              style={{ width: 'auto', filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.2))' }}
            />
            <h1>Stringed Dreams</h1>
          </Link>
          {user && user.role === 'admin' && (
            <Link to="/admin" className="admin-tag">
              <FaUser size={14} /> <span>Admin</span>
            </Link>
          )}

          {/* Center: Search Bar */}
          <div ref={searchRef} className="search-bar-container">
            <div className="search-bar">
              <input
                type="text"
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button className="search-bar-btn">
                <FaSearch />
              </button>
            </div>
            <button className="search-toggle-btn" onClick={() => setSearchOpen(!searchOpen)}>
              <FaSearch />
            </button>
            <AnimatePresence>
              {searchOpen && (
                <motion.div
                  className="search-mobile-dropdown"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  <input
                    type="text"
                    placeholder="Search products..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                  />
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence>
              {searchResults.length > 0 && (
                <motion.div 
                  className="search-results-dropdown"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  {searchResults.map(product => (
                    <div 
                      key={product._id} 
                      className="search-result-item"
                      onClick={() => handleResultClick(product._id)}
                    >
                      <img src={imageUrl(product.image)} alt={product.name} loading="lazy" decoding="async" />
                      <div className="search-result-info">
                        <h4>{product.name}</h4>
                        <p>₹{product.price}</p>
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}
              {searchQuery.trim().length >= 2 && searchResults.length === 0 && (
                <motion.div 
                  className="search-results-dropdown"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="search-no-results">No products found</div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right: Nav Links */}
          <ul className="nav-links">
            <li>
              <Link to="/playlists" className="favorites-link">
                <FaListUl size={16} /> <span>Collections</span>
                {user && favoritesCount > 0 && (
                  <motion.span 
                    className="favorites-badge"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 500 }}
                  >
                    {favoritesCount}
                  </motion.span>
                )}
              </Link>
            </li>
            <li>
              <Link to="/contact"><FaEnvelope size={16} /> <span>Contact</span></Link>
            </li>
            {user ? (
              <li ref={profileRef} style={{ position: 'relative' }}>
                <button
                  className="profile-dropdown-toggle"
                  onClick={() => setProfileOpen((prev) => !prev)}
                >
                  <FaUser size={16} /> <span>{user.name}</span>
                </button>
                <AnimatePresence>
                  {profileOpen && (
                    <motion.div
                      className="profile-dropdown"
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Link to="/profile" className="profile-dropdown-item" onClick={() => setProfileOpen(false)}>
                        <FaUserEdit size={14} /> Update Profile
                      </Link>
                      <button className="profile-dropdown-item" onClick={toggleTheme}>
                        {theme === 'light' ? <FaMoon size={14} /> : <FaSun size={14} />}
                        {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
                      </button>
                      <button className="profile-dropdown-item" onClick={handleLogout}>
                        <FaSignOutAlt size={14} /> Logout
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            ) : (
              <li><Link to="/login">Login</Link></li>
            )}
          </ul>
        </nav>
      </div>
    </motion.header>
  );
};

export default Header;
