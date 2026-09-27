# Stringed Dreams — Storefront & Admin (React)

React frontend for Stringed Dreams, a showcase for handcrafted bead jewelry. It covers browsing, favorites, personal collections, chatting with the creator, and an admin dashboard. The API lives in the [Stringed-Dreams-backend](https://github.com/Varun3124/Stringed-Dreams-backend) repo.

## Features

### Customers
- Home page with a featured carousel and a row per category
- **Category pages:**
  - Filters for price (a two-handle slider), color, bead type and in-stock only, in a sidebar on desktop and a bottom sheet on phones
  - Sort options, and removable filter pills
  - Filter and sort choices live in the URL, so they survive going Back and can be shared
- Product pages list colors and bead types. **Continue on WhatsApp** opens a chat with the creator, prefilled with the product link.
- Quick search in the header, over name, category, color and bead type
- Favorites and collections (create, rename, delete, add and remove items)
- Chat with the creator, with product or collection attachments
- Light and dark themes

### Admin (`/admin`)
- Changes show instantly and save in the background. A header indicator reads "Saving…", "All changes saved" or "Some changes failed", and a failed save rolls back with an error.
- **Products:**
  - Inline editing: name, price and stock as text; colors and bead types as chips
  - Drag-and-drop ordering, duplicating, and carousel settings
  - Bulk import from images
  - Every Add Product field is optional, and products without a category appear under "Uncategorized"
- **Categories:** create, rename (the products move with it), delete
- **Inquiries:** reply, change status, delete. Product and collection references open their pages in a new tab; admins see other users' collections read-only.

## Setup

```bash
npm install
npm start        # http://localhost:3000, proxies /api to http://localhost:5000
npm run build    # production build in build/
```

### Environment variables

| Variable | Notes |
|---|---|
| `REACT_APP_API_URL` | Backend origin, e.g. `https://api.example.com`. `https://` is added if it's missing. If left empty, requests use relative URLs (the dev proxy in `package.json`). |

## Performance notes
- **Images:** products arrive with image URLs (`/api/products/:id/image?v=…`), not inline base64. `imageUrl()` in `src/api/axios.js` prefixes them with the API origin, and browsers cache them indefinitely.
- **Catalog cache:** `src/data/catalog.js` keeps the product and category catalog in memory and localStorage. Pages render straight from the last saved copy on reload and refresh in the background.
- **Code splitting:** less-visited pages (admin, product, contact, collections, auth) load on demand.
- **Polling:** chat polling pauses while the tab is hidden.

## Contact details
The creator's WhatsApp number, Instagram and email are defined once in `src/config/contact.js` and used everywhere in the app.

## Deployment
- `vercel.json` rewrites every path to `index.html` for client-side routing.
- Set `REACT_APP_API_URL` to the deployed backend, and set the backend's `FRONTEND_URL` to this site's origin (for CORS).
