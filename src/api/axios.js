import axios from 'axios';

// Ensure the URL has a protocol prefix
let apiUrl = process.env.REACT_APP_API_URL || '';
if (apiUrl && !apiUrl.startsWith('http://') && !apiUrl.startsWith('https://')) {
  apiUrl = 'https://' + apiUrl;
}

export const API_BASE_URL = apiUrl.replace(/\/+$/, '');

// Product images are served by the API (e.g. /api/products/:id/image?v=…), which may live
// on a different origin than the site. Data URLs and absolute URLs pass through unchanged.
export const imageUrl = (src) => (
  typeof src === 'string' && src.startsWith('/api/') ? `${API_BASE_URL}${src}` : src
);

const api = axios.create({
  baseURL: apiUrl,
});

export default api;
