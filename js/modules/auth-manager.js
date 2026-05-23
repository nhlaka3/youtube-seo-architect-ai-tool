// YouTube OAuth Logic Extraction
export let tokenClient;
window.tokenClient = tokenClient;
export let accessToken = null;
export let activeChannel = null;
const CLIENT_ID = '482101609629-e9t4lijfthm4rco4v8t0vbla2tg9v1tl.apps.googleusercontent.com';
window.CLIENT_ID = CLIENT_ID;

function initiateOAuth() {
  if (!tokenClient) {
    initOAuth();
  }
  setTimeout(() => {
    if (tokenClient) tokenClient.requestAccessToken();
    else alert('Google script still loading.');
  }, 100);
}

function initOAuth() {
  if (window.google) {
    console.log("✅ Google GIS Loaded");
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/youtube.force-ssl https://www.googleapis.com/auth/yt-analytics.readonly https://www.googleapis.com/auth/youtube.readonly',
      callback: (tokenResponse) => {
        if (tokenResponse && tokenResponse.access_token) {
          accessToken = tokenResponse.access_token;
          localStorage.setItem('ytseo_access_token', accessToken);
          if (typeof window.handleChannelAuth === 'function') {
            window.handleChannelAuth();
          } else {
            console.error('window.handleChannelAuth not found');
          }
        }
      },
    });
    window.tokenClient = tokenClient;
  } else {
    setTimeout(initOAuth, 1000);
  }
}

// Permission-Aware: Check if token has write permissions
let hasFullWriteAccess = false;
window.hasFullWriteAccess = hasFullWriteAccess;
async function verifyWritePermissions() {
  if (!accessToken) return false;
  try {
    const channelId = localStorage.getItem('ytseo_channel_id') || 'anonymous';
    const res = await fetch(`/api/youtube/channels?part=brandingSettings&accessToken=${accessToken}&channelId=${channelId}`);
    hasFullWriteAccess = res.ok;
    window.hasFullWriteAccess = hasFullWriteAccess;
    return res.ok;
  } catch (e) {
    hasFullWriteAccess = false;
    window.hasFullWriteAccess = hasFullWriteAccess;
    return false;
  }
}

// Session checks (checkAuthStatus equivalent)
function checkSavedConnection() {
  const isConnected = localStorage.getItem('ytseo_channel_connected') === 'true';
  const channelName = localStorage.getItem('ytseo_channel_name');
  const channelId = localStorage.getItem('ytseo_channel_id');
  const savedToken = localStorage.getItem('ytseo_access_token');
  
  if (isConnected && savedToken && channelName) {
    // Restore access token
    accessToken = savedToken;
    activeChannel = { 
      id: channelId, 
      snippet: { title: channelName } 
    };
    
    return true;
  }
  return false;
}

async function validateToken() {
  if (!accessToken) return false;
  try {
    const channelId = localStorage.getItem('ytseo_channel_id') || 'anonymous';
    const response = await fetch(`/api/youtube/channels?part=id&accessToken=${accessToken}&channelId=${channelId}`);
    
    if (response.status === 401) {
      // Token expired - show reconnect button
      return false;
    }
    return response.ok;
  } catch (error) {
    console.log('Token validation failed:', error);
    return false;
  }
}

// Route guard: if on /dashboard without token, redirect to /
function routeGuard() {
  const currentPath = window.location.pathname;
  if (currentPath === '/dashboard' && !accessToken) {
    window.location.href = '/';
  }
}

// Initialize OAuth on load
initOAuth();

// Export functions
export { initiateOAuth, checkSavedConnection, validateToken, verifyWritePermissions, routeGuard };