#!/usr/bin/env python3
"""
Supabase to Google Sheets Migration Tool
Exports all albums data from Supabase and imports to Google Sheets
"""

import os
import json
import csv
import time
from datetime import datetime
from supabase import create_client, Client
import gspread
from google.oauth2.service_account import Credentials

# Configuration
SUPABASE_URL = "https://mchuwawmnyeoemgrlepp.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jaHV3YXdtbnllb2VtZ3JsZXBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjAwNzE4NTcsImV4cCI6MjAzNTY0Nzg1N30.V8asL5upGbEgTpGLzBHxR6xR2-3bWFUYE6WbdIVKcKg"
GOOGLE_SHEETS_ID = "1yCd_gxOKN3EH4AFyGH61cEti-Ehduxxh_egx_yZkJhg"
SERVICE_ACCOUNT_FILE = "service-account-key.json"

class SupabaseToSheetsImporter:
    def __init__(self):
        self.supabase: Client = None
        self.sheets_client = None
        self.spreadsheet = None
        
    def setup_connections(self):
        """Initialize Supabase and Google Sheets connections"""
        print("🔗 Setting up connections...")
        
        # Supabase connection
        try:
            self.supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
            # Test connection
            test_result = self.supabase.table('albums').select('id').limit(1).execute()
            print("✅ Supabase connected successfully")
        except Exception as e:
            print(f"❌ Supabase connection failed: {e}")
            return False
            
        # Google Sheets connection
        try:
            scope = [
                'https://www.googleapis.com/auth/spreadsheets',
                'https://www.googleapis.com/auth/drive'
            ]
            
            if not os.path.exists(SERVICE_ACCOUNT_FILE):
                print(f"❌ Service account file not found: {SERVICE_ACCOUNT_FILE}")
                print("📝 Please download your service account key and save it as 'service-account-key.json'")
                return False
                
            creds = Credentials.from_service_account_file(SERVICE_ACCOUNT_FILE, scopes=scope)
            self.sheets_client = gspread.authorize(creds)
            self.spreadsheet = self.sheets_client.open_by_key(GOOGLE_SHEETS_ID)
            print("✅ Google Sheets connected successfully")
        except Exception as e:
            print(f"❌ Google Sheets connection failed: {e}")
            print("🔧 Make sure the spreadsheet is shared with the service account email")
            return False
            
        return True
    
    def get_total_count(self):
        """Get total count of albums"""
        try:
            result = self.supabase.table('albums').select('id', count='exact').execute()
            return result.count
        except Exception as e:
            print(f"❌ Failed to get album count: {e}")
            return 0
    
    def export_albums_batch(self, offset, batch_size):
        """Export a batch of albums from Supabase"""
        try:
            result = self.supabase.table('albums').select(
                'id, title, year, artist, role, type, genres, styles, '
                'formats, images, tracklist, track_count, credits, '
                'cover_image, formatted_year, created_at, updated_at'
            ).range(offset, offset + batch_size - 1).order('id').execute()
            
            return result.data
        except Exception as e:
            print(f"❌ Failed to export batch at offset {offset}: {e}")
            return []
    
    def process_album_for_sheets(self, album):
        """Process album data for Google Sheets"""
        processed = {}
        
        # Basic fields
        processed['id'] = str(album.get('id', ''))
        processed['title'] = album.get('title', '')
        processed['year'] = album.get('year', '')
        processed['artist'] = album.get('artist', '')
        processed['role'] = album.get('role', '')
        processed['type'] = album.get('type', '')
        
        # Array fields - convert to pipe-separated strings
        genres = album.get('genres', [])
        if isinstance(genres, list):
            processed['genres'] = '|'.join(genres) if genres else ''
        else:
            processed['genres'] = str(genres) if genres else ''
            
        styles = album.get('styles', [])
        if isinstance(styles, list):
            processed['styles'] = '|'.join(styles) if styles else ''
        else:
            processed['styles'] = str(styles) if styles else ''
        
        # JSON fields - convert to JSON strings
        for field in ['formats', 'images', 'tracklist', 'credits']:
            value = album.get(field)
            if value:
                if isinstance(value, (dict, list)):
                    processed[field] = json.dumps(value)
                else:
                    processed[field] = str(value)
            else:
                processed[field] = ''
        
        # Other fields
        processed['track_count'] = album.get('track_count', 0)
        processed['cover_image'] = album.get('cover_image', '')
        processed['formatted_year'] = album.get('formatted_year', '')
        processed['created_at'] = album.get('created_at', '')
        processed['updated_at'] = album.get('updated_at', '')
        
        return processed
    
    def export_scraped_history(self):
        """Export scraped artists history"""
        print("📥 Exporting scraped artists history...")
        
        try:
            result = self.supabase.table('scraped_artists_history').select('*').execute()
            return result.data
        except Exception as e:
            print(f"❌ Scraped history export failed: {e}")
            return []
    
    def setup_google_sheets(self):
        """Setup Google Sheets with proper headers"""
        print("📊 Setting up Google Sheets...")
        
        try:
            # Clear existing sheets if they exist
            worksheets = self.spreadsheet.worksheets()
            for ws in worksheets:
                if ws.title in ['Albums', 'Scraped_History']:
                    self.spreadsheet.del_worksheet(ws)
                    print(f"🗑️  Deleted existing {ws.title} sheet")
            
            # Create Albums sheet
            albums_sheet = self.spreadsheet.add_worksheet(title="Albums", rows=7000, cols=20)
            print("📋 Created Albums sheet")
            
            # Set albums headers
            albums_headers = [
                'id', 'title', 'year', 'artist', 'role', 'type', 'genres', 'styles',
                'formats', 'images', 'tracklist', 'track_count', 'credits',
                'cover_image', 'formatted_year', 'created_at', 'updated_at'
            ]
            albums_sheet.update('A1:Q1', [albums_headers])
            
            # Format headers
            albums_sheet.format('A1:Q1', {
                'backgroundColor': {'red': 0.2, 'green': 0.2, 'blue': 0.2},
                'textFormat': {'foregroundColor': {'red': 1, 'green': 1, 'blue': 1}, 'bold': True}
            })
            
            # Create Scraped History sheet
            history_sheet = self.spreadsheet.add_worksheet(title="Scraped_History", rows=100, cols=15)
            print("📋 Created Scraped_History sheet")
            
            # Set history headers
            history_headers = [
                'id', 'artist_name', 'discogs_id', 'search_query', 'scraped_at',
                'albums_found', 'albums_added', 'success', 'notes', 'created_at', 'updated_at'
            ]
            history_sheet.update('A1:K1', [history_headers])
            
            # Format headers
            history_sheet.format('A1:K1', {
                'backgroundColor': {'red': 0.2, 'green': 0.2, 'blue': 0.2},
                'textFormat': {'foregroundColor': {'red': 1, 'green': 1, 'blue': 1}, 'bold': True}
            })
            
            print("✅ Google Sheets setup complete")
            return albums_sheet, history_sheet
            
        except Exception as e:
            print(f"❌ Google Sheets setup failed: {e}")
            return None, None
    
    def import_albums_to_sheets(self, albums_sheet, total_albums):
        """Import albums to Google Sheets in batches"""
        print(f"📤 Importing {total_albums} albums to Google Sheets...")
        
        batch_size = 300  # Smaller batches for better reliability
        sheets_batch_size = 100  # Google Sheets update batch size
        imported_count = 0
        
        for offset in range(0, total_albums, batch_size):
            # Export batch from Supabase
            batch_albums = self.export_albums_batch(offset, batch_size)
            if not batch_albums:
                continue
                
            print(f"📦 Processing batch: albums {offset + 1}-{min(offset + len(batch_albums), total_albums)}")
            
            # Process albums for sheets
            processed_albums = []
            for album in batch_albums:
                processed = self.process_album_for_sheets(album)
                row = [
                    processed['id'], processed['title'], processed['year'], 
                    processed['artist'], processed['role'], processed['type'],
                    processed['genres'], processed['styles'], processed['formats'],
                    processed['images'], processed['tracklist'], processed['track_count'],
                    processed['credits'], processed['cover_image'], processed['formatted_year'],
                    processed['created_at'], processed['updated_at']
                ]
                processed_albums.append(row)
            
            # Import to Google Sheets in smaller chunks
            for i in range(0, len(processed_albums), sheets_batch_size):
                chunk = processed_albums[i:i + sheets_batch_size]
                start_row = imported_count + 2  # +2 for header row and 1-indexing
                end_row = start_row + len(chunk) - 1
                
                range_name = f"A{start_row}:Q{end_row}"
                albums_sheet.update(range_name, chunk)
                
                imported_count += len(chunk)
                print(f"📊 Imported {imported_count}/{total_albums} albums ({(imported_count/total_albums)*100:.1f}%)")
                
                # Rate limiting
                time.sleep(1)
            
            # Longer pause between major batches
            time.sleep(2)
        
        print(f"✅ Successfully imported {imported_count} albums!")
        return imported_count
    
    def import_history_to_sheets(self, history_sheet, history_data):
        """Import scraped history to Google Sheets"""
        if not history_data:
            print("📊 No scraped history to import")
            return 0
            
        print(f"📤 Importing {len(history_data)} scraped history records...")
        
        history_rows = []
        for record in history_data:
            row = [
                str(record.get('id', '')),
                record.get('artist_name', ''),
                str(record.get('discogs_id', '')),
                record.get('search_query', ''),
                record.get('scraped_at', ''),
                record.get('albums_found', ''),
                record.get('albums_added', ''),
                record.get('success', ''),
                record.get('notes', ''),
                record.get('created_at', ''),
                record.get('updated_at', '')
            ]
            history_rows.append(row)
        
        if history_rows:
            range_name = f"A2:K{len(history_rows) + 1}"
            history_sheet.update(range_name, history_rows)
            print(f"✅ Imported {len(history_rows)} scraped history records")
        
        return len(history_rows)
    
    def verify_import(self, albums_sheet, history_sheet, expected_albums, expected_history):
        """Verify the import was successful"""
        print("🔍 Verifying import...")
        
        try:
            # Check albums count
            all_values = albums_sheet.get_all_values()
            actual_albums = len(all_values) - 1  # Subtract header row
            
            print(f"📊 Albums: Expected {expected_albums}, Found {actual_albums}")
            albums_match = actual_albums == expected_albums
            
            # Check history count
            history_values = history_sheet.get_all_values()
            actual_history = len(history_values) - 1  # Subtract header row
            
            print(f"📊 History: Expected {expected_history}, Found {actual_history}")
            history_match = actual_history == expected_history
            
            if albums_match and history_match:
                print("✅ Verification passed! All data imported successfully.")
                return True
            else:
                print("⚠️  Verification found discrepancies. Please check the data.")
                return False
                
        except Exception as e:
            print(f"❌ Verification failed: {e}")
            return False
    
    def run_migration(self):
        """Run the complete migration process"""
        print("🚀 Starting Supabase to Google Sheets migration...")
        print(f"📊 Target spreadsheet: {GOOGLE_SHEETS_ID}")
        print("=" * 60)
        
        # Setup connections
        if not self.setup_connections():
            print("❌ Migration aborted - connection setup failed")
            return False
        
        # Get data counts
        total_albums = self.get_total_count()
        print(f"📊 Found {total_albums} albums in Supabase")
        
        history_data = self.export_scraped_history()
        print(f"📊 Found {len(history_data)} scraped history records")
        
        # Setup Google Sheets
        albums_sheet, history_sheet = self.setup_google_sheets()
        if not albums_sheet or not history_sheet:
            print("❌ Migration aborted - Google Sheets setup failed")
            return False
        
        # Import data
        try:
            print("\n🔄 Starting data import...")
            
            # Import albums
            imported_albums = self.import_albums_to_sheets(albums_sheet, total_albums)
            
            # Import history
            imported_history = self.import_history_to_sheets(history_sheet, history_data)
            
            # Verify import
            if self.verify_import(albums_sheet, history_sheet, total_albums, len(history_data)):
                print("\n🎉 Migration completed successfully!")
                print(f"📊 Migrated {imported_albums} albums and {imported_history} history records")
                print(f"🔗 View your data: https://docs.google.com/spreadsheets/d/{GOOGLE_SHEETS_ID}")
                return True
            else:
                print("\n⚠️  Migration completed with issues. Please verify your data.")
                return False
                
        except Exception as e:
            print(f"\n❌ Migration failed: {e}")
            return False

def main():
    print("🎵 Albums Collection App - Supabase to Google Sheets Migration")
    print("=" * 60)
    
    # Check dependencies
    missing_deps = []
    try:
        import supabase
    except ImportError:
        missing_deps.append("supabase")
    
    try:
        import gspread
    except ImportError:
        missing_deps.append("gspread")
    
    try:
        from google.oauth2.service_account import Credentials
    except ImportError:
        missing_deps.append("google-auth")
    
    if missing_deps:
        print(f"❌ Missing required packages: {', '.join(missing_deps)}")
        print("📦 Install with: pip install supabase gspread google-auth")
        return False
    
    print("✅ All required packages available")
    
    # Check service account file
    if not os.path.exists(SERVICE_ACCOUNT_FILE):
        print(f"❌ Service account file not found: {SERVICE_ACCOUNT_FILE}")
        print("📝 Please place your service account key file in the same directory as this script")
        print("📝 Name it 'service-account-key.json'")
        return False
    
    # Run migration
    importer = SupabaseToSheetsImporter()
    success = importer.run_migration()
    
    if success:
        print("\n✅ Migration completed successfully!")
        print("🎵 Your entire music collection is now in Google Sheets!")
    else:
        print("\n❌ Migration failed. Check the errors above and try again.")
    
    return success

if __name__ == "__main__":
    main()
