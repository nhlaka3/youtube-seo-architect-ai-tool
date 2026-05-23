# YouTube SEO Master Pro - Installation Guide

## Prerequisites

- Node.js 18 or higher installed
- Google Cloud Console account (for YouTube API)
- Groq account (free at groq.com)

---

## Step 1: Get YouTube API Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable "YouTube Data API v3"
4. Create credentials (API Key)
5. Create OAuth 2.0 Client ID (for upload features)

---

## Step 2: Get Groq API Key

1. Go to [groq.com](https://groq.com)
2. Sign up for free
3. Copy your API key from the dashboard

---

## Step 3: Install the Tool

```bash
# Extract the ZIP file
cd youtube-seo-tool

# Install dependencies
npm install
```

---

## Step 4: Configure Environment

Edit the `.env` file:

```env
GROQ_API_KEY=your_groq_api_key_here
ELEVENLABS_API_KEY=your_elevenlabs_key_here
PEXELS_API_KEY=your_pexels_key_here
PORT=3001
```

---

## Step 5: Run the Tool

```bash
npm start
```

The tool will open at: **http://localhost:3001**

---

## First-Time Setup

1. Open the tool in your browser
2. Click "Connect YouTube Account"
3. Complete OAuth authorization
4. You're ready to start!

---

## Troubleshooting

**Port already in use?**
Change PORT in .env to 3002 or another number.

**API errors?**
Verify your API keys are correct and have required permissions.

**Database errors?**
Delete db.sqlite and restart - it will recreate automatically.

---

## Support

Email: support@yourdomain.com