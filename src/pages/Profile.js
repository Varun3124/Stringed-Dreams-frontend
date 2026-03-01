import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { FaUser, FaEnvelope, FaPhone, FaLock, FaShieldAlt } from 'react-icons/fa';

const Profile = () => {
  const navigate = useNavigate();
  const { user, updateProfile } = useAuth();
  
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    password: '',
    confirmPassword: ''
  });
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);

  if (!user) {
    navigate('/login');
    return null;
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    if (formData.password && formData.password !== formData.confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      setLoading(false);
      return;
    }

    const updateData = {
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
    };

    if (formData.password) {
      updateData.password = formData.password;
    }

    const result = await updateProfile(updateData);

    if (result.success) {
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
      setFormData({ ...formData, password: '', confirmPassword: '' });
    } else {
      setMessage({ type: 'error', text: result.message });
    }
    setLoading(false);
  };

  return (
    <motion.div
      className="auth-page"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
    >
      <div className="form-container">
        <motion.div
          className="auth-header"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          <div className="auth-icon profile-icon">
            <FaUser />
          </div>
          <h2>My Profile</h2>
          <p className="auth-subtitle">{user.email}</p>
        </motion.div>

        {message.text && (
          <motion.div
            className={`message ${message.type}`}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            {message.text}
          </motion.div>
        )}

        <form onSubmit={handleSubmit}>
          <motion.div className="form-group" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
            <label><FaUser style={{ marginRight: '0.5rem' }} />Name</label>
            <input type="text" name="name" value={formData.name} onChange={handleChange} required />
          </motion.div>

          <motion.div className="form-group" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 }}>
            <label><FaEnvelope style={{ marginRight: '0.5rem' }} />Email</label>
            <input type="email" name="email" value={formData.email} onChange={handleChange} required />
          </motion.div>

          <motion.div className="form-group" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}>
            <label><FaPhone style={{ marginRight: '0.5rem' }} />Phone</label>
            <input type="tel" name="phone" value={formData.phone} onChange={handleChange} placeholder="Your phone number" />
          </motion.div>
          
          <motion.div
            className="profile-password-section"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <h3><FaShieldAlt style={{ marginRight: '0.5rem' }} />Change Password</h3>
            <div className="form-group">
              <label><FaLock style={{ marginRight: '0.5rem' }} />New Password</label>
              <input type="password" name="password" value={formData.password} onChange={handleChange} minLength="6" placeholder="Leave blank to keep current" />
            </div>
            <div className="form-group">
              <label><FaLock style={{ marginRight: '0.5rem' }} />Confirm New Password</label>
              <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} placeholder="Re-enter new password" />
            </div>
          </motion.div>

          <motion.button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            {loading ? 'Updating...' : 'Update Profile'}
          </motion.button>
        </form>
      </div>
    </motion.div>
  );
};

export default Profile;
