export const requireChannelId = (req, res, next) => {
  const channelId = req.body?.channelId || req.query?.channelId || req.headers['x-channel-id'];
  if (!channelId) {
    return res.status(400).json({ error: 'YouTube channel connection required.' });
  }
  req.channelId = channelId;
  next();
};

export const checkYoutubeAuth = (apiResponse, expressResponse) => {
  if (apiResponse.status === 401) {
    expressResponse.status(401).json({ error: 'YouTube token expired or invalid. Please reconnect your channel.' });
    return true; // indicates handled
  }
  if (apiResponse.status === 403) {
    expressResponse.status(403).json({ error: 'YouTube API quota exceeded or forbidden.' });
    return true;
  }
  return false;
};

// Simple mock/wrapper if using full googleapis library, but we're mostly using fetch.
// This is used for `reorderPlaylistSchema` which expected `youtube.playlistItems.update`
export const createYouTubeClient = (accessToken) => {
  return {
    playlistItems: {
      update: async (params) => {
        const response = await fetch('https://www.googleapis.com/youtube/v3/playlistItems?part=snippet', {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(params.resource)
        });
        if (!response.ok) {
          throw new Error(`YouTube API Error: ${response.statusText}`);
        }
        return response.json();
      }
    }
  };
};
