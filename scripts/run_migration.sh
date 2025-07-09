#!/bin/bash

echo "🎵 Albums Collection Migration Tool"
echo "=================================="

# Check if we're in the right directory
if [ ! -f "supabase_to_sheets.py" ]; then
    echo "❌ Please run this script from the scripts directory"
    echo "📁 cd '/Volumes/Tomer Bar/My Apps/album-collection/scripts'"
    exit 1
fi

# Install dependencies if needed
echo "📦 Installing dependencies..."
pip3 install -r requirements.txt

echo ""
echo "🔍 Running setup check..."
python3 check_setup.py

if [ $? -eq 0 ]; then
    echo ""
    echo "🚀 Starting migration..."
    python3 supabase_to_sheets.py
else
    echo ""
    echo "❌ Setup check failed. Please fix the issues above."
    echo "📖 Check README.md for detailed instructions"
fi
