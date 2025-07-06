# 🎵 Discogs API Setup Guide

## Quick Setup (2 minutes)

To use the Albums Collection App's music discovery and scraping features, you need a **free** Discogs API key.

### Step 1: Get Your API Key

1. **Visit:** [https://www.discogs.com/settings/developers](https://www.discogs.com/settings/developers)
2. **Create a Discogs account** if you don't have one (it's free)
3. **Create a new application:**
   - Application Name: `Albums Collection App` (or any name)
   - Description: `Personal music collection management`
   - Click **"Create Application"**
4. **Copy your Personal Access Token** (long string of letters/numbers)

### Step 2: Add Your Token

#### For Netlify Deployment:
Update your `index.html` file in the repository:

```javascript
DISCOGS: {
    API_KEY: 'YOUR_DISCOGS_TOKEN_HERE', // ← Paste your token here
    BASE_URL: 'https://api.discogs.com',
    // ... rest stays the same
}
```

#### For Local Development:
Update `src/config.js`:

```javascript
DISCOGS: {
    API_KEY: 'YOUR_DISCOGS_TOKEN_HERE',
    // ... rest of config
}
```

### Step 3: Deploy/Restart

- **Netlify:** Commit and push changes - deploys automatically
- **Local:** Restart your development server

## ✅ What You Get

With your Discogs API key configured:

- **Artist Discovery:** Search and scrape complete discographies
- **Album Search:** Find specific albums to add to your collection  
- **Rich Metadata:** Album covers, track listings, credits, genres
- **Smart Filtering:** Automatically excludes compilations, singles, EPs
- **Performance Credits:** Detailed musician and producer information

## 🔒 Security Note

Your Discogs API key is **personal** and should be kept secure:
- ✅ Use it for your own music collection
- ❌ Don't share it publicly or commit it to public repositories
- ✅ The API is free for personal use with generous rate limits

## 🚨 Troubleshooting

**401 "Invalid consumer token" errors:**
- Your API key is missing or incorrect
- Check that you copied the full token (usually 40+ characters)
- Make sure there are no extra spaces before/after the token

**Rate limiting (429 errors):**
- The app has built-in delays to respect Discogs' rate limits
- If you get rate limited, wait a few minutes and try again

**No search results:**
- Verify your API key is working by checking the browser console
- Try searching for popular artists like "Miles Davis" or "Beatles"

## 📞 Support

If you encounter issues:
1. Check the browser console (F12) for error messages
2. Verify your API key is correctly configured
3. Make sure you have an active internet connection

---

**Generated:** July 6, 2025  
**For:** Albums Collection App Deployment
**Discogs API:** Free personal use with 60 requests/minute limit
