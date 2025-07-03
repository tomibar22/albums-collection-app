// Configuration for the Albums Collection App
// Copy this file to config.js and fill in your actual credentials
window.CONFIG = {
    // Discogs API Configuration
    DISCOGS: {
        API_KEY: 'YOUR_DISCOGS_API_KEY_HERE', // Get from https://www.discogs.com/settings/developers
        BASE_URL: 'https://api.discogs.com',
        HEADERS: {
            'User-Agent': 'AlbumsCollectionApp/1.0'
        },
        RATE_LIMIT: {
            MAX_RETRIES: 5,
            DELAY: 2000, // 2 seconds base delay
            MAX_429_RETRIES: 15,
            MAX_DELAY: 300000, // 5 minutes
            SCRAPER_DELAY: 3000, // 3 seconds between releases
            PAGE_DELAY: 5000 // 5 seconds between pages
        }
    },

    // Filter Configuration (from prototype)
    FILTERS: {
        EXCLUDE_WORDS: [
            'compilation', 'single', 'Shellac', 'EP', 
            '10"', '7"', 'Transcription', 'reissue', 'remastered'
        ],
        ALBUM_KEYWORDS: ['album', 'lp'],
        EXCLUDE_SLASH_IN_TITLE: false,
        EXCLUDE_VARIOUS_ARTISTS: true
    },

    // UI Configuration
    UI: {
        ITEMS_PER_PAGE: 20,
        MAX_SEARCH_RESULTS: 50,
        ANIMATION_DURATION: 300,
        LOADING_DELAY: 500
    },

    // Data Models
    MODELS: {
        ALBUM: {
            REQUIRED_FIELDS: ['id', 'title', 'year', 'artist'],
            OPTIONAL_FIELDS: [
                'genres', 'styles', 'tracklist', 'credits', 
                'formats', 'images', 'role', 'type'
            ]
        },
        ARTIST: {
            REQUIRED_FIELDS: ['id', 'name'],
            OPTIONAL_FIELDS: ['image', 'albumCount']
        },
        TRACK: {
            REQUIRED_FIELDS: ['title'],
            OPTIONAL_FIELDS: ['duration', 'position', 'frequency']
        },
        ROLE: {
            REQUIRED_FIELDS: ['name'],
            OPTIONAL_FIELDS: ['frequency', 'artists']
        }
    },

    // Supabase Configuration (for data persistence)
    SUPABASE: {
        URL: 'YOUR_SUPABASE_PROJECT_URL', // Get from https://supabase.com/dashboard/project/_/settings/api
        ANON_KEY: 'YOUR_SUPABASE_ANON_KEY', // Get from Supabase project settings
        
        // Optional: Service Role Key (for admin operations, keep secure)
        SERVICE_ROLE_KEY: '', // Only if needed for admin functions
        
        // Table Names (can be customized)
        TABLES: {
            ALBUMS: 'albums',
            ARTISTS: 'artists', 
            TRACKS: 'tracks',
            ROLES: 'roles',
            ALBUM_ARTISTS: 'album_artists',
            ALBUM_TRACKS: 'album_tracks',
            ARTIST_ROLES: 'artist_roles',
            COLLECTIONS: 'collections',
            COLLECTION_ALBUMS: 'collection_albums',
            SCRAPED_ARTISTS_HISTORY: 'scraped_artists_history'
        },
        
        // Database Settings
        DATABASE: {
            BATCH_SIZE: 100,            // Number of records to insert/update at once
            MAX_RETRY_ATTEMPTS: 3,      // Retry failed operations
            TIMEOUT: 30000,             // 30 second timeout for queries
            ENABLE_REALTIME: true,      // Enable real-time subscriptions
            ENABLE_RLS: false           // Row Level Security (for multi-user)
        },
        
        // Sync Settings
        SYNC: {
            AUTO_SYNC: true,            // Automatically sync changes to Supabase
            SYNC_INTERVAL: 30000,       // Sync every 30 seconds (if auto-sync enabled)
            OFFLINE_MODE: false,        // Allow offline operation with sync when reconnected
            CONFLICT_RESOLUTION: 'server_wins' // 'server_wins', 'client_wins', or 'merge'
        }
    },

    // Development settings
    DEBUG: {
        ENABLED: true,
        LOG_API_CALLS: true,
        LOG_PERFORMANCE: true,
        LOG_SUPABASE: true,             // Log Supabase operations
        AUTO_TEST_API: false            // Auto-test Discogs API on startup (disabled for better UX)
    }
};

// Available globally as window.CONFIG
