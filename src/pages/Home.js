import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from '../api/axios';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { motion } from 'framer-motion';
import ProductCard from '../components/ProductCard';

const CategoryCarousel = ({ category, products }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const navigate = useNavigate();
  const catTouchStartX = useRef(0);
  const catTouchEndX = useRef(0);

  // Detect mobile for native scroll mode
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Responsive items per view (desktop only)
  const getItemsPerView = () => {
    if (typeof window === 'undefined') return 4;
    const w = window.innerWidth;
    if (w <= 480) return 1;
    if (w <= 768) return 2;
    return 4;
  };
  const [itemsPerView, setItemsPerView] = useState(getItemsPerView());

  useEffect(() => {
    const handleResize = () => setItemsPerView(getItemsPerView());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const scroll = (direction) => {
    if (direction === 'left') {
      setCurrentIndex((prev) => Math.max(0, prev - 1));
    } else {
      setCurrentIndex((prev) => {
        const maxStart = Math.max(0, products.length - itemsPerView);
        return prev + 1 > maxStart ? maxStart : prev + 1;
      });
    }
  };

  const canScrollLeft = currentIndex > 0;
  const canScrollRight = currentIndex + itemsPerView < products.length;

  if (products.length === 0) return null;

  // Get visible products without duplication — just slice the array
  const visibleProducts = products.slice(currentIndex, currentIndex + itemsPerView);

  const handleCatTouchStart = (e) => { catTouchStartX.current = e.touches[0].clientX; };
  const handleCatTouchMove = (e) => { catTouchEndX.current = e.touches[0].clientX; };
  const handleCatTouchEnd = () => {
    const diff = catTouchStartX.current - catTouchEndX.current;
    if (Math.abs(diff) > 50) {
      if (diff > 0 && canScrollRight) scroll('right');
      else if (diff < 0 && canScrollLeft) scroll('left');
    }
  };

  // MOBILE: native horizontal scroll with all products as small square cards
  if (isMobile) {
    return (
      <div className="category-carousel-section">
        <div className="category-carousel-header">
          <h2>{category.name}</h2>
          <Link to={`/category/${category.name}`} className="view-all-btn">
            View All →
          </Link>
        </div>
        <div className="category-carousel-scroll">
          {products.slice(0, 10).map((product) => (
            <div
              key={product._id}
              className="category-scroll-card"
              onClick={() => navigate(`/product/${product._id}`)}
            >
              <img src={product.image} alt={product.name} />
              <div className="category-scroll-card-name">{product.name}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="category-carousel-section">
      <div className="category-carousel-header">
        <h2>{category.name}</h2>
        <Link to={`/category/${category.name}`} className="view-all-btn">
          View All →
        </Link>
      </div>
      
      <div className="category-carousel-container">
        {canScrollLeft && (
          <button 
            className="category-scroll-btn left" 
            onClick={() => scroll('left')}
          >
            <FaChevronLeft />
          </button>
        )}
        
        <div
          className="category-carousel-track"
          onTouchStart={handleCatTouchStart}
          onTouchMove={handleCatTouchMove}
          onTouchEnd={handleCatTouchEnd}
        >
          {visibleProducts.map((product, idx) => (
            <ProductCard key={product._id} product={product} index={idx} />
          ))}
        </div>
        
        {canScrollRight && (
          <button 
            className="category-scroll-btn right" 
            onClick={() => scroll('right')}
          >
            <FaChevronRight />
          </button>
        )}
      </div>
    </div>
  );
};

const Home = () => {
  const [categories, setCategories] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [centerIndex, setCenterIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionSpeed, setTransitionSpeed] = useState(600);
  const navigate = useNavigate();

  // Responsive slide offset based on screen width
  const getSlideOffset = () => {
    if (typeof window === 'undefined') return 432;
    const w = window.innerWidth;
    if (w <= 480) return 252;  // 220px item + 32px gap
    if (w <= 768) return 312;  // 280px item + 32px gap
    return 432;                // 400px item + 32px gap
  };
  const [slideOffset, setSlideOffset] = useState(getSlideOffset());

  useEffect(() => {
    const handleResize = () => setSlideOffset(getSlideOffset());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fetchCategories = async () => {
    try {
      const { data } = await axios.get('/api/products/categories');
      setCategories(data);
    } catch (error) {
      console.error('Failed to load categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTopProducts = async () => {
    try {
      const { data } = await axios.get('/api/products');
      // Get featured products sorted by carousel order
      const featuredProducts = data
        .filter(product => product.featuredInCarousel && product.stock > 0)
        .sort((a, b) => a.carouselOrder - b.carouselOrder);
      
      // If no featured products, fallback to top rated
      if (featuredProducts.length === 0) {
        const sortedProducts = data
          .filter(product => product.stock > 0)
          .sort((a, b) => b.rating - a.rating)
          .slice(0, 5);
        setTopProducts(sortedProducts);
      } else {
        setTopProducts(featuredProducts);
      }
    } catch (error) {
      console.error('Failed to load top products:', error);
    }
  };

  const fetchAllProducts = async () => {
    try {
      const { data } = await axios.get('/api/products');
      setAllProducts(data);
    } catch (error) {
      console.error('Failed to load products:', error);
    }
  };

  const getProductsByCategory = (categoryName) => {
    return allProducts
      .filter(product => product.category === categoryName && product.stock > 0)
      .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
      .slice(0, 10); // Show first 10 products in carousel
  };

  useEffect(() => {
    fetchCategories();
    fetchAllProducts();
    fetchTopProducts();
  }, []);

  useEffect(() => {
    if (topProducts.length > 0 && !isHovered && !isTransitioning) {
      const timer = setInterval(() => {
        handleNext(false);
      }, 5000);
      return () => clearInterval(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topProducts, centerIndex, isHovered, isTransitioning]);

  const handleNext = (manual = true) => {
    if (isTransitioning || topProducts.length === 0) return;
    const speed = manual ? 350 : 600;
    setTransitionSpeed(speed);
    setIsTransitioning(true);
    setCenterIndex((prev) => (prev + 1) % topProducts.length);
    setTimeout(() => setIsTransitioning(false), speed);
  };

  const handlePrev = (manual = true) => {
    if (isTransitioning || topProducts.length === 0) return;
    const speed = manual ? 350 : 600;
    setTransitionSpeed(speed);
    setIsTransitioning(true);
    setCenterIndex((prev) => (prev - 1 + topProducts.length) % topProducts.length);
    setTimeout(() => setIsTransitioning(false), speed);
  };

  const nextSlide = () => {
    handleNext();
  };

  const prevSlide = () => {
    handlePrev();
  };

  const goToSlide = (index) => {
    if (isTransitioning) return;
    setTransitionSpeed(350);
    setCenterIndex(index);
  };

  // Touch swipe for main carousel
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    setIsHovered(true);
  };
  const handleTouchMove = (e) => {
    touchEndX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = () => {
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 50) {
      if (diff > 0) handleNext();
      else handlePrev();
    }
    setIsHovered(false);
  };

  if (loading) {
    return (
      <div className="home-container" style={{ padding: '2rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem', marginTop: '2rem' }}>
          {[1,2,3,4].map(i => (
            <div key={i} className="skeleton-card">
              <div className="skeleton skeleton-image" />
              <div className="skeleton skeleton-text" style={{ marginTop: '1rem' }} />
              <div className="skeleton skeleton-text short" />
              <div className="skeleton skeleton-text price" style={{ marginBottom: '1rem' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      className="home-container"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Carousel Section */}
      {topProducts.length > 0 && (
        <div className="carousel-section">
          <div className="carousel-container">
            <button className="carousel-btn carousel-btn-prev" onClick={prevSlide}>
              <FaChevronLeft />
            </button>
            
            <div
              className="carousel-track-container"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div 
                className="carousel-track"
              >
                {topProducts.map((product, index) => {
                  // Calculate this item's position relative to center
                  let position = index - centerIndex;
                  // Wrap around for circular behavior
                  if (position < -Math.floor(topProducts.length / 2)) {
                    position += topProducts.length;
                  } else if (position > Math.floor(topProducts.length / 2)) {
                    position -= topProducts.length;
                  }
                  
                  // Only render items within visible range
                  if (position < -2 || position > 2) {
                    return null;
                  }
                  
                  // Check if item should be visible (not during extreme transition)
                  const isVisible = Math.abs(position) <= 2;
                  
                  return (
                    <div 
                      key={product._id}
                      className={`carousel-item ${position === 0 ? 'active' : ''}`}
                      style={{
                        transform: `translate(calc(-50% + ${position * slideOffset}px), -50%) scale(${position === 0 ? 1 : 0.8})`,
                        transition: `transform ${transitionSpeed / 1000}s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity ${transitionSpeed / 1000}s, border-color ${transitionSpeed / 1000}s, box-shadow ${transitionSpeed / 1000}s`,
                        opacity: isVisible && Math.abs(position) <= 2 ? (position === 0 ? 1 : 0.5) : 0,
                        pointerEvents: Math.abs(position) <= 2 ? 'auto' : 'none'
                      }}
                      onMouseEnter={() => position === 0 && setIsHovered(true)}
                      onMouseLeave={() => setIsHovered(false)}
                      onClick={() => {
                        if (position === 0) {
                          navigate(`/product/${product._id}`);
                        } else {
                          setCenterIndex(index);
                        }
                      }}
                    >
                      <img src={product.image} alt={product.name} />
                      <div className="carousel-item-overlay">
                        <h3>{product.name}</h3>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <button className="carousel-btn carousel-btn-next" onClick={nextSlide}>
              <FaChevronRight />
            </button>
          </div>

          <div className="carousel-indicators">
            {topProducts.map((_, index) => (
              <button
                key={index}
                className={`carousel-indicator ${centerIndex === index ? 'active' : ''}`}
                onClick={() => goToSlide(index)}
              />
            ))}
          </div>
        </div>
      )}

      <div className="categories-by-products">
        {categories.map((category) => (
          <CategoryCarousel
            key={category._id}
            category={category}
            products={getProductsByCategory(category.name)}
          />
        ))}
      </div>

      {categories.length === 0 && (
        <div className="empty-state">
          <h2>No categories available yet</h2>
          <p>Check back soon for our beautiful bead jewelry collections!</p>
        </div>
      )}
    </motion.div>
  );
};

export default Home;
