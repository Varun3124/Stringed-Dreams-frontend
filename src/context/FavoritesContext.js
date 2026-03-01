import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import axios from '../api/axios';
import { useAuth } from './AuthContext';

const FavoritesContext = createContext();

export const useFavorites = () => {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error('useFavorites must be used within a FavoritesProvider');
  }
  return context;
};

export const FavoritesProvider = ({ children }) => {
  const [favorites, setFavorites] = useState({ items: [] });
  const { user } = useAuth();

  const fetchFavorites = useCallback(async () => {
    try {
      const config = {
        headers: {
          Authorization: `Bearer ${user.token}`
        }
      };
      const { data } = await axios.get('/api/favorites', config);
      setFavorites(data);
    } catch (error) {
      console.error('Error fetching favorites:', error);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchFavorites();
    } else {
      setFavorites({ items: [] });
    }
  }, [user, fetchFavorites]);

  const toggleFavorite = async (productId) => {
    // Optimistic update
    const wasAlreadyFavorite = isFavorite(productId);
    const previousFavorites = { ...favorites, items: [...favorites.items] };

    if (wasAlreadyFavorite) {
      setFavorites(prev => ({
        ...prev,
        items: prev.items.filter(item => {
          const pid = item.product?._id || item.product;
          return pid !== productId;
        })
      }));
    } else {
      setFavorites(prev => ({
        ...prev,
        items: [...prev.items, { product: productId }]
      }));
    }

    try {
      const config = {
        headers: {
          Authorization: `Bearer ${user.token}`
        }
      };
      const { data } = await axios.post('/api/favorites/toggle', { productId }, config);
      setFavorites(data.favorites);
      return { success: true, isFavorite: data.isFavorite, message: data.message };
    } catch (error) {
      // Revert on failure
      setFavorites(previousFavorites);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to update favorites'
      };
    }
  };

  const removeFromFavorites = async (itemId) => {
    try {
      const config = {
        headers: {
          Authorization: `Bearer ${user.token}`
        }
      };
      const { data } = await axios.delete(`/api/favorites/${itemId}`, config);
      setFavorites(data);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to remove from favorites'
      };
    }
  };

  const isFavorite = (productId) => {
    return favorites.items?.some(item => item.product._id === productId || item.product === productId);
  };

  const value = {
    favorites,
    fetchFavorites,
    toggleFavorite,
    removeFromFavorites,
    isFavorite
  };

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
};
