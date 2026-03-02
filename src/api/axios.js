import axios from 'axios';

// Ensure the URL has a protocol prefix
let apiUrl = process.env.REACT_APP_API_URL || '';
if (apiUrl && !apiUrl.startsWith('http://') && !apiUrl.startsWith('https://')) {
  apiUrl = 'https://' + apiUrl;
}
console.log('[DEBUG] REACT_APP_API_URL =', process.env.REACT_APP_API_URL, '→ resolved:', apiUrl);

const api = axios.create({
  baseURL: apiUrl,
});

// Log every request and response for debugging
api.interceptors.request.use((config) => {
  console.log(`[DEBUG] REQUEST: ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
  return config;
});

api.interceptors.response.use(
  (response) => {
    console.log(`[DEBUG] RESPONSE: ${response.status} from ${response.config.url}`, {
      dataType: typeof response.data,
      isArray: Array.isArray(response.data),
      length: Array.isArray(response.data) ? response.data.length : 'N/A',
      preview: JSON.stringify(response.data)?.substring(0, 200)
    });
    return response;
  },
  (error) => {
    console.error(`[DEBUG] RESPONSE ERROR:`, {
      url: error.config?.url,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
    return Promise.reject(error);
  }
);

export default api;
