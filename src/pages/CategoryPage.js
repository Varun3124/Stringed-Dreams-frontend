import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import ProductCard from '../components/ProductCard';

const CategoryPage = () => {
  const { categoryName } = useParams();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryInfo, setCategoryInfo] = useState(null);

  useEffect(() => {
    fetchCategoryProducts();
  }, [categoryName]);

  const fetchCategoryProducts = async () => {
    try {
      setLoading(true);
      
      // Fetch category info
      const { data: categories } = await axios.get('/api/products/categories');
      const category = categories.find(cat => cat.name.toLowerCase() === categoryName.toLowerCase());
      setCategoryInfo(category);

      // Fetch products for this category
      const { data: allProducts } = await axios.get('/api/products');
      const filteredProducts = allProducts
        .filter(product => product.category.toLowerCase() === categoryName.toLowerCase())
        .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
      setProducts(filteredProducts);
    } catch (error) {
      console.error('Error fetching category products:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading {categoryName}...</div>;
  }

  return (
    <div className="category-page">
      <div className="category-header">
        <Link to="/" className="back-link">← Back to Home</Link>
        <h1>{categoryName}</h1>
        {categoryInfo?.description && (
          <p className="category-description">{categoryInfo.description}</p>
        )}
        <p className="products-count">{products.length} {products.length === 1 ? 'item' : 'items'} available</p>
      </div>

      {products.length === 0 ? (
        <div className="empty-state">
          <h2>No products found</h2>
          <p>Check back later for new items in this category.</p>
          <Link to="/" className="btn btn-primary">Browse All Categories</Link>
        </div>
      ) : (
        <div className="products-grid">
          {products.map((product) => (
            <ProductCard key={product._id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
};

export default CategoryPage;
