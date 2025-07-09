/**
 * Google Sheets Service V2 - Simplified for Personal Use
 * Uses Google's JavaScript client library with proper authentication
 */

class GoogleSheetsServiceV2 {
    constructor() {
        this.spreadsheetId = window.CONFIG.GOOGLE_SHEETS.SPREADSHEET_ID;
        this.initialized = false;
        this.gapi = null;
        
        // API Discovery
        this.discoveryDocs = ['https://sheets.googleapis.com/$discovery/rest?version=v4'];
        this.scopes = 'https://www.googleapis.com/auth/spreadsheets';
    }
    
    async initialize() {
        if (this.initialized) return;
        
        try {
            console.log('🔄 Initializing Google Sheets API...');
            
            // Use simple API key approach (much simpler than service account)
            await this.initializeWithAPIKey();
            
            // Test connection
            await this.testConnection();
            
            this.initialized = true;
            console.log('✅ Google Sheets service initialized with API key');
        } catch (error) {
            console.error('❌ Google Sheets initialization failed:', error);
            throw error;
        }
    }
    
    async loadGoogleAPI() {
        return new Promise((resolve, reject) => {
            if (window.gapi) {
                resolve(window.gapi);
                return;
            }
            
            // Load Google API script
            const script = document.createElement('script');
            script.src = 'https://apis.google.com/js/api.js';
            script.onload = () => {
                window.gapi.load('client', resolve);
            };
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
    
    async initializeWithServiceAccount() {
        try {
            // Load service account credentials
            const credentials = await this.loadServiceAccountKey();
            
            // Get access token using service account
            const accessToken = await this.getServiceAccountToken(credentials);
            
            // Initialize gapi client with access token
            await window.gapi.client.init({
                discoveryDocs: this.discoveryDocs
            });
            
            // Set access token
            window.gapi.client.setToken({
                access_token: accessToken
            });
            
            console.log('✅ Authenticated with service account');
        } catch (error) {
            console.error('❌ Service account authentication failed:', error);
            throw error;
        }
    }
    
    async loadServiceAccountKey() {
        try {
            const keyPath = window.CONFIG.GOOGLE_SHEETS.SERVICE_ACCOUNT_KEY_PATH;
            const response = await fetch(keyPath);
            
            if (!response.ok) {
                throw new Error(`Failed to load service account key: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('❌ Failed to load service account key:', error);
            throw error;
        }
    }
    
    async getServiceAccountToken(credentials) {
        try {
            // Create JWT assertion
            const jwt = await this.createJWTAssertion(credentials);
            
            // Exchange JWT for access token
            const response = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                    assertion: jwt
                })
            });
            
            if (!response.ok) {
                throw new Error(`Token request failed: ${response.status}`);
            }
            
            const tokenData = await response.json();
            return tokenData.access_token;
        } catch (error) {
            console.error('❌ Failed to get access token:', error);
            throw error;
        }
    }
    
    async createJWTAssertion(credentials) {
        // For security reasons, JWT creation with private keys should be done server-side
        // For now, we'll use a fallback approach
        throw new Error('JWT creation requires server-side implementation for security');
    }
    
    // Simple API key approach (read-only access)
    async initializeWithAPIKey() {
        const apiKey = window.CONFIG.GOOGLE_SHEETS.API_KEY;
        if (!apiKey) {
            throw new Error('Google Sheets API key not configured in CONFIG.GOOGLE_SHEETS.API_KEY');
        }
        
        this.apiKey = apiKey;
        console.log('✅ Initialized with API key (read-only mode)');
    }
    
    // Simple fetch-based approach for API calls
    async makeAPIRequest(url) {
        const fullUrl = `${url}${url.includes('?') ? '&' : '?'}key=${this.apiKey}`;
        
        const response = await fetch(fullUrl);
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Google Sheets API error (${response.status}): ${errorText}`);
        }
        
        return await response.json();
    }
    
    // Data operations
    async getAllAlbums() {
        try {
            console.log('📊 Loading albums from Google Sheets...');
            
            const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/Albums!A:Q`;
            const response = await this.makeAPIRequest(url);
            
            const values = response.values;
            if (!values || values.length < 2) {
                console.log('📊 No album data found in Google Sheets');
                return [];
            }
            
            // Parse data
            const albums = this.parseAlbumsData(values);
            console.log(`📊 Loaded ${albums.length} albums from Google Sheets`);
            
            return albums;
        } catch (error) {
            console.error('❌ Failed to load albums from Google Sheets:', error);
            throw error;
        }
    }
    
    parseAlbumsData(sheetData) {
        const headers = sheetData[0];
        const rows = sheetData.slice(1);
        
        return rows.map(row => {
            const album = {};
            
            headers.forEach((header, index) => {
                const value = row[index] || '';
                
                // Parse JSON fields
                if (['genres', 'styles', 'formats', 'images', 'tracklist', 'credits'].includes(header)) {
                    try {
                        album[header] = value ? JSON.parse(value) : [];
                    } catch {
                        album[header] = [];
                    }
                } else if (header === 'track_count') {
                    album[header] = parseInt(value) || 0;
                } else if (header === 'year') {
                    album[header] = parseInt(value) || null;
                } else {
                    album[header] = value;
                }
            });
            
            return album;
        }).filter(album => album.id); // Filter out empty rows
    }
    
    async testConnection() {
        try {
            console.log('🔍 Testing Google Sheets connection...');
            
            const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}`;
            const response = await this.makeAPIRequest(url);
            
            console.log(`✅ Connected to spreadsheet: "${response.properties.title}"`);
            
            return true;
        } catch (error) {
            console.error('❌ Google Sheets connection test failed:', error);
            throw error;
        }
    }
    
    // Placeholder methods for future write operations
    async addAlbum(albumData) {
        throw new Error('Write operations not yet implemented - requires proper authentication');
    }
    
    async updateAlbum(albumId, updateData) {
        throw new Error('Write operations not yet implemented - requires proper authentication');
    }
    
    async deleteAlbum(albumId) {
        throw new Error('Write operations not yet implemented - requires proper authentication');
    }
    
    async getScrapedArtistsHistory() {
        try {
            const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/Scraped_History!A:F`;
            const response = await this.makeAPIRequest(url);
            
            const values = response.values;
            if (!values || values.length < 2) return [];
            
            return this.parseHistoryData(values);
        } catch (error) {
            console.error('❌ Failed to load scraped history:', error);
            return [];
        }
    }
    
    parseHistoryData(sheetData) {
        const headers = sheetData[0];
        const rows = sheetData.slice(1);
        
        return rows.map(row => {
            const history = {};
            headers.forEach((header, index) => {
                history[header] = row[index] || '';
            });
            return history;
        }).filter(item => item.id);
    }
}

// Rate limiter for Google Sheets API
class GoogleSheetsRateLimiterV2 {
    constructor() {
        this.requests = 0;
        this.resetTime = Date.now() + 100000; // 100 seconds window
        this.maxRequests = 100; // Google Sheets API limit
    }
    
    async checkRateLimit() {
        const now = Date.now();
        
        if (now > this.resetTime) {
            this.requests = 0;
            this.resetTime = now + 100000;
        }
        
        if (this.requests >= this.maxRequests) {
            const waitTime = this.resetTime - now;
            console.log(`⏳ Rate limit reached. Waiting ${Math.round(waitTime/1000)}s...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            this.requests = 0;
            this.resetTime = Date.now() + 100000;
        }
        
        this.requests++;
    }
}

// Export for use
window.GoogleSheetsServiceV2 = GoogleSheetsServiceV2;
