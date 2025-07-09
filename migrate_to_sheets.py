#!/usr/bin/env python3
"""
Albums Collection App - Supabase to Google Sheets Migration Script
================================================================

This script migrates your complete music collection from Supabase to Google Sheets.

Requirements:
- Python 3.7+
- pip install supabase google-api-python-client google-auth-oauthlib google-auth-httplib2

Usage:
    python3 migrate_to_sheets.py

Configuration:
- Update the SUPABASE_* and GOOGLE_SHEETS_* constants below
- Ensure service account JSON file is in the correct location
"""

import json
import time
import sys
from datetime import datetime
from typing import List, Dict, Any, Optional

# Required imports (install with pip)
try:
    from supabase import create_client, Client
    from googleapiclient.discovery import build
    from google.oauth2 import service_account
except ImportError as e:
    print(f"❌ Missing required packages. Install with:")
    print(f"pip install supabase google-api-python-client google-auth-oauthlib google-auth-httplib2")
    print(f"Error: {e}")
    sys.exit(1)

# =============================================================================
# CONFIGURATION - UPDATE THESE VALUES
# =============================================================================

# Supabase Configuration
SUPABASE_URL = "https://mchuwawmnyeoemgrlepp.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jaHV3YXdtbnllb2VtZ3JsZXBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTk2NjcwNzAsImV4cCI6MjAzNTI0MzA3MH0.PHlOj7_Wq5d3-Vx9XVsXqPBgTKqJ9_JoKr7ShqPn_gI"  # Your current anon key

# Google Sheets Configuration
GOOGLE_SHEETS_SPREADSHEET_ID = "1yCd_gxOKN3EH4AFyGH61cEti-Ehduxxh_egx_yZkJhg"
SERVICE_ACCOUNT_FILE = "/Volumes/Tomer Bar/My Apps/album-collection/tommy-891@albums-collection-465406.iam.gserviceaccount.com.json"

# Google Sheets API Configuration
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

# Rate Limiting
BATCH_SIZE = 50  # Albums per batch for Google Sheets
RATE_LIMIT_DELAY = 2  # Seconds between batches

# =============================================================================
# MIGRATION CLASSES
# =============================================================================

class SupabaseExporter:
    """Handles exporting data from Supabase"""
    
    def __init__(self):
        self.client: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
        self.albums = []
        self.scraped_history = []
    
    def test_connection(self) -> bool:
        """Test Supabase connection"""
        try:
            # Test with a simple count query
            response = self.client.table('albums').select('id', count='exact').limit(1).execute()
            print(f"✅ Supabase connected - Found {response.count} albums")
            return True
        except Exception as e:
            print(f"❌ Supabase connection failed: {e}")
            return False
    
    def export_albums_in_batches(self) -> List[Dict[str, Any]]:
        """Export all albums from Supabase in batches"""
        print("📀 Exporting albums from Supabase...")
        
        all_albums = []
        batch_size = 1000
        offset = 0
        
        while True:
            try:
                print(f"  📥 Fetching batch {offset//batch_size + 1} (albums {offset + 1}-{offset + batch_size})...")
                
                response = self.client.table('albums')\
                    .select('*')\
                    .range(offset, offset + batch_size - 1)\
                    .execute()
                
                batch = response.data
                if not batch:
                    print(f"  ✅ Export complete - fetched {len(all_albums)} albums total")
                    break
                
                all_albums.extend(batch)
                offset += batch_size
                
                print(f"  📊 Running total: {len(all_albums)} albums")
                
                # Small delay to be nice to Supabase
                time.sleep(0.5)
                
            except Exception as e:
                print(f"  ❌ Error fetching batch at offset {offset}: {e}")
                break
        
        self.albums = all_albums
        return all_albums
    
    def export_scraped_history(self) -> List[Dict[str, Any]]:
        """Export scraped artists history"""
        print("📋 Exporting scraped history from Supabase...")
        
        try:
            response = self.client.table('scraped_artists_history').select('*').execute()
            history = response.data or []
            print(f"  ✅ Exported {len(history)} scraped history records")
            self.scraped_history = history
            return history
        except Exception as e:
            print(f"  ❌ Error exporting scraped history: {e}")
            return []


class GoogleSheetsImporter:
    """Handles importing data to Google Sheets"""
    
    def __init__(self):
        self.service = None
        self.spreadsheet_id = GOOGLE_SHEETS_SPREADSHEET_ID
    
    def authenticate(self) -> bool:
        """Authenticate with Google Sheets API"""
        try:
            credentials = service_account.Credentials.from_service_account_file(
                SERVICE_ACCOUNT_FILE, scopes=SCOPES
            )
            self.service = build('sheets', 'v4', credentials=credentials)
            print("✅ Google Sheets API authenticated")
            return True
        except Exception as e:
            print(f"❌ Google Sheets authentication failed: {e}")
            return False
    
    def test_connection(self) -> bool:
        """Test Google Sheets connection"""
        try:
            # Get spreadsheet metadata
            result = self.service.spreadsheets().get(
                spreadsheetId=self.spreadsheet_id
            ).execute()
            
            title = result.get('properties', {}).get('title', 'Unknown')
            print(f"✅ Google Sheets connected - Spreadsheet: '{title}'")
            return True
        except Exception as e:
            print(f"❌ Google Sheets connection failed: {e}")
            return False
    
    def setup_albums_sheet(self):
        """Setup Albums sheet with headers"""
        print("📊 Setting up Albums sheet...")
        
        headers = [
            'id', 'title', 'year', 'artist', 'role', 'type',
            'genres', 'styles', 'formats', 'images', 'tracklist',
            'track_count', 'credits', 'cover_image', 'formatted_year',
            'created_at', 'updated_at'
        ]
        
        try:
            # Clear existing content
            self.service.spreadsheets().values().clear(
                spreadsheetId=self.spreadsheet_id,
                range='Albums!A:Z'
            ).execute()
            
            # Add headers
            self.service.spreadsheets().values().update(
                spreadsheetId=self.spreadsheet_id,
                range='Albums!A1:Q1',
                valueInputOption='RAW',
                body={'values': [headers]}
            ).execute()
            
            print("  ✅ Albums sheet headers created")
            
        except Exception as e:
            print(f"  ❌ Error setting up Albums sheet: {e}")
            raise
    
    def setup_scraped_history_sheet(self):
        """Setup Scraped_History sheet with headers"""
        print("📋 Setting up Scraped_History sheet...")
        
        headers = [
            'id', 'artist_name', 'discogs_artist_id', 'scraped_at',
            'album_count', 'status'
        ]
        
        try:
            # Clear existing content
            self.service.spreadsheets().values().clear(
                spreadsheetId=self.spreadsheet_id,
                range='Scraped_History!A:Z'
            ).execute()
            
            # Add headers
            self.service.spreadsheets().values().update(
                spreadsheetId=self.spreadsheet_id,
                range='Scraped_History!A1:F1',
                valueInputOption='RAW',
                body={'values': [headers]}
            ).execute()
            
            print("  ✅ Scraped_History sheet headers created")
            
        except Exception as e:
            print(f"  ❌ Error setting up Scraped_History sheet: {e}")
            raise
    
    def album_to_row(self, album: Dict[str, Any]) -> List[str]:
        """Convert album dict to Google Sheets row"""
        def safe_json(obj):
            """Safely convert object to JSON string"""
            if obj is None:
                return ''
            try:
                return json.dumps(obj)
            except:
                return str(obj)
        
        return [
            str(album.get('id', '')),
            str(album.get('title', '')),
            str(album.get('year', '')),
            str(album.get('artist', '')),
            str(album.get('role', '')),
            str(album.get('type', 'release')),
            safe_json(album.get('genres')),
            safe_json(album.get('styles')),
            safe_json(album.get('formats')),
            safe_json(album.get('images')),
            safe_json(album.get('tracklist')),
            str(album.get('track_count', 0)),
            safe_json(album.get('credits')),
            str(album.get('cover_image', '')),
            str(album.get('formatted_year', '')),
            str(album.get('created_at', '')),
            str(album.get('updated_at', ''))
        ]
    
    def history_to_row(self, history: Dict[str, Any]) -> List[str]:
        """Convert scraped history dict to Google Sheets row"""
        return [
            str(history.get('id', '')),
            str(history.get('artist_name', '')),
            str(history.get('discogs_artist_id', '')),
            str(history.get('scraped_at', '')),
            str(history.get('album_count', 0)),
            str(history.get('status', ''))
        ]
    
    def import_albums_in_batches(self, albums: List[Dict[str, Any]]):
        """Import albums to Google Sheets in batches"""
        print(f"📊 Importing {len(albums)} albums to Google Sheets...")
        
        total_albums = len(albums)
        imported_count = 0
        
        for i in range(0, total_albums, BATCH_SIZE):
            batch_end = min(i + BATCH_SIZE, total_albums)
            batch = albums[i:batch_end]
            batch_num = i // BATCH_SIZE + 1
            total_batches = (total_albums + BATCH_SIZE - 1) // BATCH_SIZE
            
            print(f"  📤 Importing batch {batch_num}/{total_batches} (albums {i+1}-{batch_end})...")
            
            try:
                # Convert albums to rows
                rows = [self.album_to_row(album) for album in batch]
                
                # Calculate range for this batch
                start_row = i + 2  # +2 because row 1 is headers and Google Sheets is 1-indexed
                end_row = start_row + len(rows) - 1
                range_name = f'Albums!A{start_row}:Q{end_row}'
                
                # Import batch
                self.service.spreadsheets().values().update(
                    spreadsheetId=self.spreadsheet_id,
                    range=range_name,
                    valueInputOption='RAW',
                    body={'values': rows}
                ).execute()
                
                imported_count += len(batch)
                progress = (imported_count / total_albums) * 100
                
                print(f"  ✅ Batch {batch_num} complete - {imported_count}/{total_albums} albums ({progress:.1f}%)")
                
                # Rate limiting
                if i + BATCH_SIZE < total_albums:  # Don't delay after last batch
                    print(f"  ⏳ Waiting {RATE_LIMIT_DELAY}s for rate limiting...")
                    time.sleep(RATE_LIMIT_DELAY)
                
            except Exception as e:
                print(f"  ❌ Error importing batch {batch_num}: {e}")
                print(f"  🔄 Retrying batch {batch_num} in 5 seconds...")
                time.sleep(5)
                
                try:
                    # Retry the batch
                    self.service.spreadsheets().values().update(
                        spreadsheetId=self.spreadsheet_id,
                        range=range_name,
                        valueInputOption='RAW',
                        body={'values': rows}
                    ).execute()
                    
                    imported_count += len(batch)
                    print(f"  ✅ Batch {batch_num} retry successful")
                    
                except Exception as retry_error:
                    print(f"  ❌ Batch {batch_num} retry failed: {retry_error}")
                    print(f"  ⚠️  Continuing with next batch...")
        
        print(f"✅ Albums import complete - {imported_count}/{total_albums} albums imported")
    
    def import_scraped_history(self, history: List[Dict[str, Any]]):
        """Import scraped history to Google Sheets"""
        if not history:
            print("📋 No scraped history to import")
            return
        
        print(f"📋 Importing {len(history)} scraped history records...")
        
        try:
            rows = [self.history_to_row(record) for record in history]
            
            # Import all history at once (usually small dataset)
            range_name = f'Scraped_History!A2:F{len(rows) + 1}'
            
            self.service.spreadsheets().values().update(
                spreadsheetId=self.spreadsheet_id,
                range=range_name,
                valueInputOption='RAW',
                body={'values': rows}
            ).execute()
            
            print(f"✅ Scraped history import complete - {len(history)} records imported")
            
        except Exception as e:
            print(f"❌ Error importing scraped history: {e}")


class MigrationValidator:
    """Validates the migration was successful"""
    
    def __init__(self, exporter: SupabaseExporter, importer: GoogleSheetsImporter):
        self.exporter = exporter
        self.importer = importer
    
    def validate_albums_count(self) -> bool:
        """Validate album counts match"""
        print("🔍 Validating albums count...")
        
        try:
            # Get count from Google Sheets
            result = self.importer.service.spreadsheets().values().get(
                spreadsheetId=self.importer.spreadsheet_id,
                range='Albums!A:A'
            ).execute()
            
            values = result.get('values', [])
            sheets_count = len(values) - 1  # -1 for header row
            supabase_count = len(self.exporter.albums)
            
            print(f"  📊 Supabase albums: {supabase_count}")
            print(f"  📊 Google Sheets albums: {sheets_count}")
            
            if supabase_count == sheets_count:
                print("  ✅ Album counts match!")
                return True
            else:
                print(f"  ❌ Count mismatch: {sheets_count}/{supabase_count} migrated")
                return False
                
        except Exception as e:
            print(f"  ❌ Error validating album count: {e}")
            return False
    
    def validate_sample_data(self, sample_size: int = 5) -> bool:
        """Validate sample data integrity"""
        print(f"🔍 Validating sample data ({sample_size} albums)...")
        
        try:
            # Get first few rows from Google Sheets
            result = self.importer.service.spreadsheets().values().get(
                spreadsheetId=self.importer.spreadsheet_id,
                range=f'Albums!A2:Q{sample_size + 1}'  # +1 for header offset
            ).execute()
            
            sheets_rows = result.get('values', [])
            
            for i, row in enumerate(sheets_rows[:sample_size]):
                if i < len(self.exporter.albums):
                    original = self.exporter.albums[i]
                    
                    # Check key fields
                    if row[0] != str(original.get('id', '')):
                        print(f"  ❌ ID mismatch in row {i+1}")
                        return False
                    
                    if row[1] != str(original.get('title', '')):
                        print(f"  ❌ Title mismatch in row {i+1}")
                        return False
            
            print(f"  ✅ Sample data validation passed")
            return True
            
        except Exception as e:
            print(f"  ❌ Error validating sample data: {e}")
            return False


# =============================================================================
# MAIN MIGRATION FUNCTION
# =============================================================================

def run_migration():
    """Execute the complete migration process"""
    print("🎵 Albums Collection App - Supabase to Google Sheets Migration")
    print("=" * 65)
    print(f"📅 Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    # Initialize components
    exporter = SupabaseExporter()
    importer = GoogleSheetsImporter()
    
    try:
        # Step 1: Test connections
        print("🔗 Step 1: Testing connections...")
        if not exporter.test_connection():
            print("❌ Migration aborted - Supabase connection failed")
            return False
        
        if not importer.authenticate():
            print("❌ Migration aborted - Google Sheets authentication failed")
            return False
        
        if not importer.test_connection():
            print("❌ Migration aborted - Google Sheets connection failed")
            return False
        
        print("✅ All connections successful")
        print()
        
        # Step 2: Export data from Supabase
        print("📥 Step 2: Exporting data from Supabase...")
        albums = exporter.export_albums_in_batches()
        history = exporter.export_scraped_history()
        
        if not albums:
            print("❌ Migration aborted - No albums found in Supabase")
            return False
        
        print(f"✅ Export complete: {len(albums)} albums, {len(history)} history records")
        print()
        
        # Step 3: Setup Google Sheets
        print("📊 Step 3: Setting up Google Sheets...")
        importer.setup_albums_sheet()
        importer.setup_scraped_history_sheet()
        print("✅ Google Sheets setup complete")
        print()
        
        # Step 4: Import data to Google Sheets
        print("📤 Step 4: Importing data to Google Sheets...")
        importer.import_albums_in_batches(albums)
        importer.import_scraped_history(history)
        print("✅ Import complete")
        print()
        
        # Step 5: Validate migration
        print("🔍 Step 5: Validating migration...")
        validator = MigrationValidator(exporter, importer)
        
        count_valid = validator.validate_albums_count()
        sample_valid = validator.validate_sample_data()
        
        if count_valid and sample_valid:
            print("✅ Migration validation passed")
            print()
            print("🎉 MIGRATION SUCCESSFUL!")
            print(f"📊 Successfully migrated {len(albums)} albums and {len(history)} history records")
            print(f"📅 Completed: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            print()
            print("Next steps:")
            print("1. Update your app config: DATA_BACKEND: 'sheets'")
            print("2. Test app functionality with Google Sheets backend")
            print("3. Consider removing Supabase dependency once satisfied")
            return True
        else:
            print("❌ Migration validation failed")
            return False
            
    except Exception as e:
        print(f"❌ Migration failed with error: {e}")
        return False


if __name__ == "__main__":
    print("🚀 Starting migration process...")
    print()
    
    # Check service account file exists
    import os
    if not os.path.exists(SERVICE_ACCOUNT_FILE):
        print(f"❌ Service account file not found: {SERVICE_ACCOUNT_FILE}")
        print("Please ensure the Google service account JSON file is in the correct location.")
        sys.exit(1)
    
    success = run_migration()
    
    if success:
        print("✅ Migration completed successfully!")
        sys.exit(0)
    else:
        print("❌ Migration failed!")
        sys.exit(1)
