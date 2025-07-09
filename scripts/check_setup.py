#!/usr/bin/env python3
"""
Check if everything is ready for the migration
"""

import os
import sys

def check_dependencies():
    """Check if all required packages are installed"""
    print("🔍 Checking Python dependencies...")
    
    missing = []
    
    try:
        import supabase
        print("✅ supabase package found")
    except ImportError:
        missing.append("supabase")
        
    try:
        import gspread
        print("✅ gspread package found")
    except ImportError:
        missing.append("gspread")
        
    try:
        from google.oauth2.service_account import Credentials
        print("✅ google-auth package found")
    except ImportError:
        missing.append("google-auth")
    
    if missing:
        print(f"\n❌ Missing packages: {', '.join(missing)}")
        print("📦 Install with: pip install -r requirements.txt")
        return False
    
    print("✅ All dependencies installed!")
    return True

def check_service_account():
    """Check if service account key file exists"""
    print("\n🔍 Checking service account key...")
    
    if os.path.exists("service-account-key.json"):
        print("✅ Service account key file found")
        
        # Try to load and validate
        try:
            import json
            with open("service-account-key.json", 'r') as f:
                key_data = json.load(f)
            
            required_fields = ['type', 'project_id', 'private_key_id', 'private_key', 'client_email']
            missing_fields = [field for field in required_fields if field not in key_data]
            
            if missing_fields:
                print(f"⚠️  Service account key missing fields: {', '.join(missing_fields)}")
                return False
            
            print(f"✅ Service account email: {key_data['client_email']}")
            print(f"✅ Project ID: {key_data['project_id']}")
            return True
            
        except Exception as e:
            print(f"❌ Error reading service account key: {e}")
            return False
    else:
        print("❌ Service account key file not found")
        print("📝 Please save your Google service account key as 'service-account-key.json'")
        return False

def check_spreadsheet_access():
    """Test Google Sheets access"""
    print("\n🔍 Testing Google Sheets access...")
    
    try:
        import gspread
        from google.oauth2.service_account import Credentials
        
        scope = [
            'https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/drive'
        ]
        
        creds = Credentials.from_service_account_file("service-account-key.json", scopes=scope)
        client = gspread.authorize(creds)
        
        # Try to open the spreadsheet
        spreadsheet_id = "1yCd_gxOKN3EH4AFyGH61cEti-Ehduxxh_egx_yZkJhg"
        spreadsheet = client.open_by_key(spreadsheet_id)
        
        print(f"✅ Successfully accessed spreadsheet: {spreadsheet.title}")
        print(f"✅ Spreadsheet URL: https://docs.google.com/spreadsheets/d/{spreadsheet_id}")
        return True
        
    except Exception as e:
        print(f"❌ Google Sheets access failed: {e}")
        print("🔧 Make sure:")
        print("   - The spreadsheet is shared with the service account email")
        print("   - The service account has 'Editor' permissions")
        print("   - Google Sheets API and Drive API are enabled")
        return False

def check_supabase_access():
    """Test Supabase connection"""
    print("\n🔍 Testing Supabase connection...")
    
    try:
        from supabase import create_client
        
        url = "https://mchuwawmnyeoemgrlepp.supabase.co"
        key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jaHV3YXdtbnllb2VtZ3JsZXBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyNjQ1MTYsImV4cCI6MjA2Njg0MDUxNn0.1APvxfCAof_0V_EFZnAaucrayTdhE3dMHLb67LySnrc"
        
        supabase = create_client(url, key)
        
        # Test connection with a simple query
        result = supabase.table('albums').select('id', count='exact').limit(1).execute()
        total_albums = result.count
        
        print(f"✅ Supabase connection successful")
        print(f"✅ Found {total_albums} albums ready for migration")
        return True
        
    except Exception as e:
        print(f"❌ Supabase connection failed: {e}")
        return False

def main():
    print("🎵 Albums Collection Migration - Readiness Check")
    print("=" * 55)
    
    all_good = True
    
    # Check each component
    if not check_dependencies():
        all_good = False
    
    if not check_service_account():
        all_good = False
    else:
        if not check_spreadsheet_access():
            all_good = False
    
    if not check_supabase_access():
        all_good = False
    
    print("\n" + "=" * 55)
    
    if all_good:
        print("🎉 Everything looks good! Ready to run migration.")
        print("🚀 Run: python3 supabase_to_sheets.py")
    else:
        print("❌ Some issues found. Please fix them and run this check again.")
        print("📖 See README.md for detailed setup instructions")
    
    return all_good

if __name__ == "__main__":
    main()
