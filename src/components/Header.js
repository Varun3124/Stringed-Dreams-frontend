import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaUser, FaSun, FaMoon, FaSearch, FaListUl, FaEnvelope, FaSignOutAlt, FaUserEdit } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useFavorites } from '../context/FavoritesContext';
import { useTheme } from '../context/ThemeContext';
import axios from '../api/axios';

const Header = () => {
  const { user, logout } = useAuth();
  const { favorites } = useFavorites();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const searchRef = useRef(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);

  const favoritesCount = favorites?.items?.length || 0;

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchOpen(false);
        setSearchQuery('');
        setSearchResults([]);
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

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const { data } = await axios.get('/api/products');
        const filtered = data.filter(p =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (p.color && p.color.toLowerCase().includes(searchQuery.toLowerCase()))
        ).slice(0, 6);
        setSearchResults(filtered);
      } catch (err) {
        console.error('Search error:', err);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleResultClick = (productId) => {
    navigate(`/product/${productId}`);
    setSearchQuery('');
    setSearchResults([]);
  };

  return (
    <motion.header 
      className="header"
      initial={{ y: -80 }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', stiffness: 100, damping: 20 }}
    >
      <div className="container">
        <nav>
          <Link to="/" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <img 
              src="/logo.png" 
              alt="Stringed Dreams Logo" 
              className="header-logo-img"
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
                      <img src={product.image} alt={product.name} />
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
