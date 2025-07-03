# 🚀 Quick Setup Guide

## 1. Get Your API Keys

### Discogs API Key
1. Go to [Discogs Developer Settings](https://www.discogs.com/settings/developers)
2. Create a new application
3. Copy your Personal Access Token

### Supabase Setup (Optional but Recommended)
1. Go to [Supabase](https://supabase.com) and create a free account
2. Create a new project
3. Go to Settings → API to get your URL and anon key
4. Go to SQL Editor and run the database schema (see `docs/` folder)

## 2. Configure the App

1. Copy the example config:
   ```bash
   cp src/config.example.js src/config.js
   ```

2. Edit `src/config.js` with your credentials:
   ```javascript
   DISCOGS: {
       API_KEY: 'your_discogs_token_here'
   },
   SUPABASE: {
       URL: 'https://your-project.supabase.co',
       ANON_KEY: 'your_anon_key_here'
   }
   ```

## 3. Start the App

Start a local server (CORS requires HTTP, not file://):

```bash
# Python 3
python3 -m http.server 8000

# Node.js 
npx serve .

# PHP
php -S localhost:8000
```

Open `http://localhost:8000` in your browser.

## 4. Start Collecting Music!

1. Go to the **Scraper** tab
2. Search for your favorite artist
3. Click **Scrape Discography** 
4. Watch your collection grow!

---

**Need help?** Check the full [README.md](README.md) or open an issue on GitHub.
