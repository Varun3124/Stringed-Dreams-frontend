import React, { Suspense, lazy } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import Header from './components/Header';
import ScrollToTop from './components/ScrollToTop';
import Home from './pages/Home';
import CategoryPage from './pages/CategoryPage';

// Less-visited pages load on demand so the first paint ships less JavaScript
const ProductDetail = lazy(() => import('./pages/ProductDetail'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Profile = lazy(() => import('./pages/Profile'));
const Admin = lazy(() => import('./pages/Admin'));
const Contact = lazy(() => import('./pages/Contact'));
const Playlists = lazy(() => import('./pages/Playlists'));

const PageFallback = () => (
  <div className="page-fallback" aria-busy="true" aria-label="Loading page">
    <div className="skeleton skeleton-text" style={{ width: '30%', height: '28px', margin: '2rem 0 1.5rem' }} />
    <div className="skeleton" style={{ height: '320px', borderRadius: 'var(--radius-lg)' }} />
  </div>
);

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
        {/* Quick fade-in only: waiting for exit animations made every navigation feel slower */}
        <motion.div
          key={getRouteKey(location.pathname)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15 }}
        >
          <Suspense fallback={<PageFallback />}>
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
          </Suspense>
        </motion.div>
      </div>
      <ScrollToTop />
    </div>
  );
}

export default App;
