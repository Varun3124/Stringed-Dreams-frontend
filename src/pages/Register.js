import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { FaUser, FaEnvelope, FaLock, FaUserPlus } from 'react-icons/fa';

const Register = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    if (formData.password !== formData.confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      setLoading(false);
      return;
    }

    const result = await register(formData.name, formData.email, formData.password);

    if (result.success) {
      navigate('/');
    } else {
      setMessage({ type: 'error', text: result.message });
    }
    setLoading(false);
  };

  const fields = [
    { name: 'name', type: 'text', label: 'Name', icon: <FaUser />, placeholder: 'Enter your name', required: true },
    { name: 'email', type: 'email', label: 'Email', icon: <FaEnvelope />, placeholder: 'Enter your email', required: true },
    { name: 'password', type: 'password', label: 'Password', icon: <FaLock />, placeholder: 'Min 6 characters', required: true, minLength: 6 },
    { name: 'confirmPassword', type: 'password', label: 'Confirm Password', icon: <FaLock />, placeholder: 'Re-enter password', required: true },
  ];

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
          <div className="auth-icon">
            <FaUserPlus />
          </div>
          <h2>Create Account</h2>
          <p className="auth-subtitle">Join the Stringed Dreams community</p>
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
          {fields.map((field, i) => (
            <motion.div
              className="form-group"
              key={field.name}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
            >
              <label>{field.icon}<span style={{ marginLeft: '0.5rem' }}>{field.label}</span></label>
              <input
                type={field.type}
                name={field.name}
                value={formData[field.name]}
                onChange={handleChange}
                placeholder={field.placeholder}
                required={field.required}
                minLength={field.minLength}
              />
            </motion.div>
          ))}

          <motion.button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            {loading ? 'Creating Account...' : 'Register'}
          </motion.button>
        </form>

        <motion.p
          className="auth-link"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          Already have an account? <Link to="/login">Login here</Link>
        </motion.p>
      </div>
    </motion.div>
  );
};

export default Register;
