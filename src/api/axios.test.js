// imageUrl() must point relative image paths at the API, and leave everything else alone
const loadWithApiUrl = (url) => {
  jest.resetModules();
  process.env.REACT_APP_API_URL = url;
  return require('./axios');
};

afterEach(() => {
  delete process.env.REACT_APP_API_URL;
});

test('prefixes API image paths with the API origin', () => {
  const { imageUrl } = loadWithApiUrl('https://api.example.com/');
  expect(imageUrl('/api/products/1/image?v=2')).toBe('https://api.example.com/api/products/1/image?v=2');
});

test('adds https:// when the protocol is missing', () => {
  const { API_BASE_URL } = loadWithApiUrl('api.example.com');
  expect(API_BASE_URL).toBe('https://api.example.com');
});

test('leaves data URLs and absolute URLs unchanged', () => {
  const { imageUrl } = loadWithApiUrl('https://api.example.com');
  expect(imageUrl('data:image/png;base64,abc')).toBe('data:image/png;base64,abc');
  expect(imageUrl('https://cdn.example.com/a.png')).toBe('https://cdn.example.com/a.png');
});

test('uses relative URLs when no API URL is set', () => {
  const { imageUrl } = loadWithApiUrl('');
  expect(imageUrl('/api/products/1/image')).toBe('/api/products/1/image');
});
