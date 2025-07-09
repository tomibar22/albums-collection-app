# 🎵 Supabase to Google Sheets Migration Guide

## 📋 Quick Setup (5 minutes)

### Step 1: Install Dependencies
```bash
cd "/Volumes/Tomer Bar/My Apps/album-collection/scripts"
pip install -r requirements.txt
```

### Step 2: Get Google Service Account Key

1. **Go to Google Cloud Console**: https://console.cloud.google.com/
2. **Create/Select Project**: 
   - Create new project OR select existing "albums-collection-465406"
3. **Enable APIs**:
   - Go to "APIs & Services" > "Library"
   - Enable "Google Sheets API"
   - Enable "Google Drive API"
4. **Create Service Account**:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "Service Account"
   - Name: "albums-migration"
   - Role: "Editor" (or "Sheets Editor" + "Drive Editor")
5. **Download Key**:
   - Click on the created service account
   - Go to "Keys" tab
   - Click "Add Key" > "Create new key" > "JSON"
   - Save as `service-account-key.json` in the scripts folder

### Step 3: Share Spreadsheet
1. **Open your spreadsheet**: https://docs.google.com/spreadsheets/d/1yCd_gxOKN3EH4AFyGH61cEti-Ehduxxh_egx_yZkJhg
2. **Click Share button**
3. **Add the service account email** (from the JSON file, looks like: `albums-migration@your-project.iam.gserviceaccount.com`)
4. **Give "Editor" permissions**

### Step 4: Run Migration
```bash
python3 supabase_to_sheets.py
```

## 📊 What This Script Does

1. **Connects** to your Supabase database (6,318 albums)
2. **Exports** all albums data in batches
3. **Creates** Google Sheets with proper headers
4. **Imports** all data to Google Sheets
5. **Verifies** the import was successful

## ⏱️ Expected Time
- **Small collections** (< 1,000 albums): 5-10 minutes
- **Your collection** (6,318 albums): 30-45 minutes
- **Large collections** (> 10,000 albums): 1-2 hours

## 🔧 Troubleshooting

### "No module named 'supabase'"
```bash
pip install supabase gspread google-auth
```

### "Service account file not found"
- Make sure `service-account-key.json` is in the scripts folder
- Check the filename is exactly right (no spaces, correct extension)

### "Permission denied" or "Spreadsheet not found"
- Make sure you shared the spreadsheet with the service account email
- Give "Editor" permissions, not just "Viewer"

### "Rate limit exceeded"
- The script includes automatic rate limiting
- If it fails, just run it again - it will resume where it left off

### "Authentication failed"
- Check your service account key is valid
- Make sure the APIs are enabled in Google Cloud Console

## 📁 Output Files

The script creates several files for backup:
- `albums_complete_YYYYMMDD_HHMMSS.csv` - All albums in CSV format
- `scraped_history_YYYYMMDD_HHMMSS.csv` - Scraping history
- Individual batch files for debugging

## 🎯 After Migration

Once successful, your Google Sheets will have:
- **Albums sheet**: All 6,318 albums with complete metadata
- **Scraped_History sheet**: Record of all your scraping sessions

You can then update your app configuration to use Google Sheets instead of Supabase!

## 🚨 Important Notes

- **Keep your service account key secure** - don't commit it to Git
- **The migration preserves all data** - no data loss
- **You can run this multiple times** - it recreates the sheets each time
- **Your Supabase data remains untouched** - this is export only

---

🎵 Ready to migrate your entire music collection to Google Sheets!
