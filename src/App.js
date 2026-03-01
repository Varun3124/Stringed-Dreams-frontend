import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Header from './components/Header';
import ScrollToTop from './components/ScrollToTop';
import Home from './pages/Home';
import ProductDetail from './pages/ProductDetail';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import Admin from './pages/Admin';
import CategoryPage from './pages/CategoryPage';
import Contact from './pages/Contact';
import Playlists from './pages/Playlists';

function App() {
  const location = useLocation();

  // Group sub-routes under the same key so internal navigation
  // (e.g. /playlists → /playlists/:id) doesn't cause a full remount
  const getRouteKey = (pathname) => {
    if (pathname.startsWith('/playlists')) return '/playlists';
    if (pathname.startsWith('/category')) return '/category';
    return pathname;
  };

  return (
    <div className="App">
      <Header />
      <div className="container">
        <AnimatePresence mode="wait">
          <motion.div
            key={getRouteKey(location.pathname)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Routes location={location}>
              <Route path="/" element={<Home />} />
              <Route path="/category/:categoryName" element={<CategoryPage />} />
              <Route path="/product/:id" element={<ProductDetail />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/playlists" element={<Playlists />} />
              <Route path="/playlists/:id" element={<Playlists />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </div>
      <ScrollToTop />
    </div>
  );
}

export default App;
