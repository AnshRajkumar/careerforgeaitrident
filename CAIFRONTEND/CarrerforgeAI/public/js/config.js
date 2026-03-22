// ---- CareerForgeAI API Configuration ----
// Change this to your production backend URL when deploying.
// For local development: 'http://127.0.0.1:8000'
// For production: 'https://your-backend-domain.com' (no trailing slash)

const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://127.0.0.1:8000'
    : '';  // Empty string = same origin (use reverse proxy in production)

// WebSocket base for video calls
const WS_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'ws://127.0.0.1:8000'
    : `wss://${window.location.host}`;
