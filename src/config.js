// Configuration for the Albums Collection App
window.CONFIG = {
    // Discogs API Configuration
    DISCOGS: {
        API_KEY: 'WqpYrXczbaWXtmKNncCeRysLaXNQFJQWXPetKSPR', // From the prototype
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

    GOOGLE_SHEETS: {
        API_KEY: 'AIzaSyBxQdVUs_YzdA4bcg8cD1jzCCtDT4ScmIw',
        SPREADSHEET_ID: '1yCd_gxOKN3EH4AFyGH61cEti-Ehduxxh_egx_yZkJhg',
        
        SHEETS: {
            ALBUMS: 'Albums',
            SCRAPED_HISTORY: 'Scraped_History'
        },
        
        API: {
            BASE_URL: 'https://sheets.googleapis.com/v4/spreadsheets',
            RATE_LIMIT: {
                MAX_REQUESTS: 90, // Conservative limit (API allows 100)
                TIME_WINDOW: 100000, // 100 seconds
                BATCH_SIZE: 25,
                DELAY_BETWEEN_BATCHES: 2000
            }
        }
    },

    // Backend Selection (switch between 'supabase' and 'sheets')
    DATA_BACKEND: 'supabase', // Temporarily back to Supabase while fixing Google Sheets auth

    // Spotify API Configuration (for Spotify Sync scraper)
    SPOTIFY: {
        CLIENT_ID: 'b3a586bcc7fb494b80e1281032233eea', // Get from https://developer.spotify.com/dashboard
        REDIRECT_URI: '' // Leave empty to auto-detect
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
        // TODO: Fill in your Supabase project details
        URL: 'https://mchuwawmnyeoemgrlepp.supabase.co',                        // Your Supabase project URL: https://your-project.supabase.co
        ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jaHV3YXdtbnllb2VtZ3JsZXBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyNjQ1MTYsImV4cCI6MjA2Njg0MDUxNn0.1APvxfCAof_0V_EFZnAaucrayTdhE3dMHLb67LySnrc',                   // Your Supabase anon/public key
        
        // Optional: Service Role Key (for admin operations, keep secure)
        SERVICE_ROLE_KEY: '',           // Only if needed for admin functions
        
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

    // User Management Configuration (Dedicated Supabase Project)
    USER_MANAGEMENT: {
        // Dedicated Supabase project for user authentication and credential storage
        URL: 'https://cznrjflfqjjpsqhtmatz.supabase.co',
        ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6bnJqZmxmcWpqcHNxaHRtYXR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE3OTUxMTgsImV4cCI6MjA2NzM3MTExOH0.EAGv_Cww4M3qd3rzHV6ytiovBBgoYuB0dQ-4G2B9oT0', // Album Collection Users Supabase Project Anon Key
        
        // Table Names for User Management
        TABLES: {
            USERS: 'users',
            USER_CREDENTIALS: 'user_credentials',
            USER_SESSIONS: 'user_sessions'
        },
        
        // Authentication Settings
        AUTH: {
            SESSION_TIMEOUT: 7200000,      // 2 hours in milliseconds
            REMEMBER_ME_DURATION: 604800,  // 7 days in seconds
            PASSWORD_MIN_LENGTH: 8,
            REQUIRE_EMAIL_VERIFICATION: false // Set to true for production
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

// Export config to global scope
window.CONFIG = CONFIG;

// Debug: Log config loading for deployment troubleshooting
console.log('🔧 CONFIG: Configuration loaded successfully', {
    hasUserManagement: !!(CONFIG?.USER_MANAGEMENT),
    hasUrl: !!(CONFIG?.USER_MANAGEMENT?.URL),
    hasAnonKey: !!(CONFIG?.USER_MANAGEMENT?.ANON_KEY),
    anonKeyLength: CONFIG?.USER_MANAGEMENT?.ANON_KEY?.length || 0,
    timestamp: new Date().toISOString()
});