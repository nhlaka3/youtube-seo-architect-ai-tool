// js/modules/config.js
// Application configuration

const _config = {
  CLIENT_ID: '482101609629-e9t4lijfthm4rco4v8t0vbla2tg9v1tl.apps.googleusercontent.com',
  YOUTUBE_API_KEY: '',

  get API_BASE_URL() {
    return window.location.hostname === 'localhost'
      ? 'http://localhost:3000'
      : '';
  }
};

// Freeze only the getter-based properties. Mutable fields can still be set.
Object.defineProperty(_config, 'CLIENT_ID', { value: _config.CLIENT_ID, writable: false, configurable: false });

export const config = _config;

let tokenClient = null;
let accessToken = null;
let activeChannel = null;
const videoDurations = {};

export function initConfig() {
  // Load YouTube API key from localStorage
  config.YOUTUBE_API_KEY = localStorage.getItem('yt_api_key') || '';
  console.log('[config] Initialized. API base:', config.API_BASE_URL);
}

export { tokenClient, accessToken, activeChannel, videoDurations };
