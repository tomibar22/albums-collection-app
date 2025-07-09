#!/usr/bin/env python3
"""
Simple Supabase connection test to debug the migration issue
"""

import sys

try:
    from supabase import create_client, Client
except ImportError:
    print("❌ Supabase module not found. Install with: pip3 install supabase")
    sys.exit(1)

# Test different configurations
configs = [
    {
        "name": "Original anon key",
        "url": "https://mchuwawmnyeoemgrlepp.supabase.co",
        "key": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jaHV3YXdtbnllb2VtZ3JsZXBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjA3MjIzNjcsImV4cCI6MjAzNjI5ODM2N30.t6_gOA3t7EGhPDiSS6H6WJH3qK0kpJ8n8B_wgWNR-rM"
    }
]

def test_supabase_connection(config):
    print(f"\n🔗 Testing: {config['name']}")
    print(f"   URL: {config['url']}")
    print(f"   Key: {config['key'][:50]}...")
    
    try:
        # Create client
        client = create_client(config['url'], config['key'])
        print("   ✅ Client created successfully")
        
        # Test simple query
        response = client.table('albums').select('id', count='exact').limit(1).execute()
        print(f"   ✅ Query successful - Found {response.count} albums")
        
        # Test data access
        response = client.table('albums').select('id', 'title').limit(3).execute()
        albums = response.data
        print(f"   ✅ Data access successful - Retrieved {len(albums)} sample albums")
        
        if albums:
            print(f"   📀 Sample album: {albums[0].get('title', 'Unknown')}")
        
        return True
        
    except Exception as e:
        print(f"   ❌ Connection failed: {e}")
        return False

if __name__ == "__main__":
    print("🎵 Supabase Connection Test")
    print("=" * 40)
    
    success = False
    for config in configs:
        if test_supabase_connection(config):
            success = True
            break
    
    if success:
        print("\n✅ Supabase connection working!")
        print("The migration script should work now.")
    else:
        print("\n❌ All connection attempts failed!")
        print("Please check your Supabase configuration.")
