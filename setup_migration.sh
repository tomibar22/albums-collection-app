#!/bin/bash

# Albums Collection App - Migration Setup Script
# ===============================================

echo "🎵 Albums Collection App - Supabase to Google Sheets Migration Setup"
echo "====================================================================="
echo ""

# Check if Python 3 is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed or not in PATH"
    echo "Please install Python 3.7+ and try again"
    exit 1
fi

echo "✅ Python 3 found: $(python3 --version)"

# Check if pip is available
if ! command -v pip3 &> /dev/null; then
    echo "❌ pip3 is not installed or not in PATH"
    echo "Please install pip3 and try again"
    exit 1
fi

echo "✅ pip3 found"

# Install required packages
echo ""
echo "📦 Installing required Python packages..."
pip3 install -r requirements.txt

if [ $? -eq 0 ]; then
    echo "✅ All packages installed successfully"
else
    echo "❌ Package installation failed"
    echo "You may need to run: pip3 install --user -r requirements.txt"
    echo "Or try: python3 -m pip install -r requirements.txt"
    exit 1
fi

# Check if service account file exists
SERVICE_ACCOUNT_FILE="tommy-891@albums-collection-465406.iam.gserviceaccount.com.json"

if [ ! -f "$SERVICE_ACCOUNT_FILE" ]; then
    echo ""
    echo "⚠️  Service account file not found: $SERVICE_ACCOUNT_FILE"
    echo "Please ensure you have the Google service account JSON file in this directory"
    echo ""
    echo "If you don't have it, you can:"
    echo "1. Go to Google Cloud Console"
    echo "2. Navigate to IAM & Admin > Service Accounts"
    echo "3. Find the tommy-891@albums-collection-465406 service account"
    echo "4. Generate and download a new JSON key"
    echo "5. Save it as: $SERVICE_ACCOUNT_FILE"
    echo ""
else
    echo "✅ Service account file found"
fi

echo ""
echo "🚀 Setup complete! Ready to run migration."
echo ""
echo "To start the migration, run:"
echo "    python3 migrate_to_sheets.py"
echo ""
echo "This will migrate your albums and scraped history from Supabase to Google Sheets."
echo "The process may take 1-2 hours depending on your collection size."
