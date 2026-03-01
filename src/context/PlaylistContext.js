import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';

const PlaylistContext = createContext();

export const usePlaylists = () => {
  const context = useContext(PlaylistContext);
  if (!context) {
    throw new Error('usePlaylists must be used within a PlaylistProvider');
  }
  return context;
};

export const PlaylistProvider = ({ children }) => {
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const getConfig = useCallback(() => ({
    headers: { Authorization: `Bearer ${user?.token}` }
  }), [user]);

  const fetchPlaylists = useCallback(async () => {
    if (!user) {
      setPlaylists([]);
      return;
    }
    try {
      setLoading(true);
      const { data } = await axios.get('/api/playlists', getConfig());
      setPlaylists(data);
    } catch (error) {
      console.error('Error fetching playlists:', error);
    } finally {
      setLoading(false);
    }
  }, [user, getConfig]);

  useEffect(() => {
    fetchPlaylists();
  }, [fetchPlaylists]);

  const createPlaylist = async (name, description = '') => {
    try {
      const { data } = await axios.post('/api/playlists', { name, description }, getConfig());
      setPlaylists(prev => [data, ...prev]);
      return { success: true, playlist: data };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || 'Failed to create playlist' };
    }
  };

  const addToPlaylist = async (playlistId, productId) => {
    try {
      const { data } = await axios.post(`/api/playlists/${playlistId}/items`, { productId }, getConfig());
      setPlaylists(prev => prev.map(p => p._id === playlistId ? data : p));
      return { success: true };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || 'Failed to add to playlist' };
    }
  };

  const removeFromPlaylist = async (playlistId, productId) => {
    try {
      const { data } = await axios.delete(`/api/playlists/${playlistId}/items/${productId}`, getConfig());
      setPlaylists(prev => prev.map(p => p._id === playlistId ? data : p));
      return { success: true };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || 'Failed to remove from playlist' };
    }
  };

  const deletePlaylist = async (playlistId) => {
    try {
      await axios.delete(`/api/playlists/${playlistId}`, getConfig());
      setPlaylists(prev => prev.filter(p => p._id !== playlistId));
      return { success: true };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || 'Failed to delete playlist' };
    }
  };

  const updatePlaylist = async (playlistId, updates) => {
    try {
      const { data } = await axios.put(`/api/playlists/${playlistId}`, updates, getConfig());
      setPlaylists(prev => prev.map(p => p._id === playlistId ? data : p));
      return { success: true };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || 'Failed to update playlist' };
    }
  };

  return (
    <PlaylistContext.Provider value={{
      playlists,
      loading,
      fetchPlaylists,
      createPlaylist,
      addToPlaylist,
      removeFromPlaylist,
      deletePlaylist,
      updatePlaylist
    }}>
      {children}
    </PlaylistContext.Provider>
  );
};
