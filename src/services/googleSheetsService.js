/**
 * Google Sheets Service for Albums Collection App
 * Uses Service Account authentication for secure write access
 */

class GoogleSheetsService {
    constructor() {
        this.spreadsheetId = window.CONFIG.GOOGLE_SHEETS.SPREADSHEET_ID;
        this.sheetsAPI = 'https://sheets.googleapis.com/v4/spreadsheets';
        this.initialized = false;
        this.rateLimiter = new GoogleSheetsRateLimiter();
        this.accessToken = null;
        this.tokenExpiry = null;
        this.serviceAccountCredentials = null;
    }
    
    async initialize() {
        if (this.initialized) return;
        
        try {
            console.log('🔗 Initializing Google Sheets service with service account...');
            
            // Load service account credentials
            await this.loadServiceAccountCredentials();
            
            // Get access token using service account
            await this.getServiceAccountAccessToken();
            
            // Test connection
            await this.testConnection();
            
            this.initialized = true;
            console.log('✅ Google Sheets service initialized successfully');
        } catch (error) {
            console.error('❌ Google Sheets initialization failed:', error);
            throw error;
        }
    }
    
    /**
     * Load service account credentials from the inline configuration
     */
    async loadServiceAccountCredentials() {
        try {
            console.log('🔐 Loading service account credentials...');
            
            // Get credentials from inline configuration instead of fetching file
            if (!window.CONFIG?.GOOGLE_SHEETS?.SERVICE_ACCOUNT) {
                throw new Error('Service account credentials not found in configuration');
            }
            
            this.serviceAccountCredentials = window.CONFIG.GOOGLE_SHEETS.SERVICE_ACCOUNT;
            console.log(`✅ Loaded credentials for: ${this.serviceAccountCredentials.client_email}`);
            
        } catch (error) {
            console.error('❌ Failed to load service account credentials:', error);
            console.log('💡 Make sure SERVICE_ACCOUNT is properly configured in GOOGLE_SHEETS configuration');
            throw error;
        }
    }
    
    /**
     * Get access token using service account credentials
     * Uses Google's OAuth 2.0 for service accounts
     */
    async getServiceAccountAccessToken() {
        try {
            // Check if current token is still valid (with 5 minute buffer)
            if (this.accessToken && this.tokenExpiry && Date.now() < (this.tokenExpiry - 300000)) {
                return this.accessToken;
            }
            
            console.log('🔑 Getting service account access token...');
            
            if (!this.serviceAccountCredentials) {
                throw new Error('Service account credentials not loaded');
            }
            
            // Create JWT assertion for service account
            const assertion = await this.createJWTAssertion();
            
            // Request access token from Google
            const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    'grant_type': 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                    'assertion': assertion
                })
            });
            
            if (!tokenResponse.ok) {
                const errorText = await tokenResponse.text();
                throw new Error(`Token request failed: ${tokenResponse.status} - ${errorText}`);
            }
            
            const tokenData = await tokenResponse.json();
            
            this.accessToken = tokenData.access_token;
            this.tokenExpiry = Date.now() + (tokenData.expires_in * 1000);
            
            console.log('✅ Service account access token obtained');
            return this.accessToken;
            
        } catch (error) {
            console.error('❌ Failed to get service account access token:', error);
            throw error;
        }
    }
    
    /**
     * Create JWT assertion for service account authentication
     */
    async createJWTAssertion() {
        const header = {
            "alg": "RS256",
            "typ": "JWT"
        };
        
        const now = Math.floor(Date.now() / 1000);
        const payload = {
            "iss": this.serviceAccountCredentials.client_email,
            "scope": "https://www.googleapis.com/auth/spreadsheets",
            "aud": "https://oauth2.googleapis.com/token",
            "iat": now,
            "exp": now + 3600 // 1 hour expiry
        };
        
        // Encode header and payload
        const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
        const encodedPayload = this.base64UrlEncode(JSON.stringify(payload));
        
        // Create signature data
        const signatureData = `${encodedHeader}.${encodedPayload}`;
        
        // Sign with private key (simplified for browser environment)
        const signature = await this.signWithPrivateKey(signatureData);
        const encodedSignature = this.base64UrlEncode(signature);
        
        return `${signatureData}.${encodedSignature}`;
    }
    
    /**
     * Base64 URL encode (without padding)
     */
    base64UrlEncode(str) {
        const base64 = btoa(str);
        return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    }
    
    /**
     * Sign data with private key using Web Crypto API
     */
    async signWithPrivateKey(data) {
        try {
            // Import private key
            const privateKeyPem = this.serviceAccountCredentials.private_key;
            
            // Remove PEM headers and newlines
            const privateKeyData = privateKeyPem
                .replace(/-----BEGIN PRIVATE KEY-----/g, '')
                .replace(/-----END PRIVATE KEY-----/g, '')
                .replace(/\n/g, '');
            
            // Convert to ArrayBuffer
            const privateKeyBuffer = Uint8Array.from(atob(privateKeyData), c => c.charCodeAt(0));
            
            // Import key for signing
            const key = await crypto.subtle.importKey(
                'pkcs8',
                privateKeyBuffer,
                {
                    name: 'RSASSA-PKCS1-v1_5',
                    hash: 'SHA-256'
                },
                false,
                ['sign']
            );
            
            // Sign the data
            const signature = await crypto.subtle.sign(
                'RSASSA-PKCS1-v1_5',
                key,
                new TextEncoder().encode(data)
            );
            
            return new Uint8Array(signature);
            
        } catch (error) {
            console.error('❌ Private key signing failed:', error);
            throw new Error('Failed to sign JWT assertion with private key');
        }
    }
    
    /**
     * Make authenticated request to Google Sheets API
     */
    async makeAuthenticatedRequest(url, options = {}) {
        // Ensure we have a valid access token
        await this.getServiceAccountAccessToken();
        
        const authOptions = {
            ...options,
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json',
                ...options.headers
            }
        };
        
        const response = await fetch(url, authOptions);
        
        if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = `API request failed: ${response.status} ${response.statusText}`;
            
            if (response.status === 401) {
                errorMessage += '\n🔑 Access token expired or invalid. Will retry with fresh token.';
                // Clear token to force refresh
                this.accessToken = null;
                this.tokenExpiry = null;
                throw new Error('TOKEN_EXPIRED');
            } else if (response.status === 403) {
                errorMessage += `\n🔒 Permission denied. Details: ${errorText}`;
            }
            
            throw new Error(errorMessage);
        }
        
        return response;
    }
    
    /**
     * Test connection to Google Sheets
     */
    async testConnection() {
        try {
            console.log('🧪 Testing Google Sheets connection...');
            
            const response = await this.makeAuthenticatedRequest(
                `${this.sheetsAPI}/${this.spreadsheetId}`
            );
            
            const data = await response.json();
            console.log(`📊 Connected to spreadsheet: "${data.properties.title}"`);
            console.log(`📋 Sheets available: ${data.sheets.map(s => s.properties.title).join(', ')}`);
            
            return data;
        } catch (error) {
            if (error.message === 'TOKEN_EXPIRED') {
                // Retry with fresh token
                return this.testConnection();
            }
            throw error;
        }
    }
    
    // Core data operations
    async getAllAlbums() {
        console.log('📀 Loading albums from Google Sheets...');
        await this.rateLimiter.checkRateLimit();
        
        const data = await this.getSheetData('Albums');
        const albums = this.parseAlbumsData(data);
        
        console.log(`📀 Loaded ${albums.length} albums from Google Sheets`);
        return albums;
    }
    
    async addAlbum(albumData) {
        await this.rateLimiter.checkRateLimit();
        
        try {
            const row = this.albumToSheetRow(albumData);
            const result = await this.appendToSheet('Albums', row);
            
            console.log(`✅ Added album "${albumData.title}" to Google Sheets`);
            return { id: albumData.id, ...albumData };
        } catch (error) {
            console.error(`❌ Failed to add album "${albumData.title}":`, error);
            throw error;
        }
    }
    
    async updateAlbum(albumId, updateData) {
        await this.rateLimiter.checkRateLimit();
        
        try {
            const rowIndex = await this.findAlbumRowIndex(albumId);
            if (rowIndex === -1) {
                throw new Error(`Album with ID ${albumId} not found`);
            }
            
            const row = this.albumToSheetRow(updateData);
            const result = await this.updateSheetRow('Albums', rowIndex, row);
            
            console.log(`✅ Updated album "${updateData.title}" in Google Sheets`);
            return { id: albumId, ...updateData };
        } catch (error) {
            console.error(`❌ Failed to update album ${albumId}:`, error);
            throw error;
        }
    }
    
    async deleteAlbum(albumId) {
        await this.rateLimiter.checkRateLimit();
        
        try {
            const rowIndex = await this.findAlbumRowIndex(albumId);
            if (rowIndex === -1) {
                throw new Error(`Album with ID ${albumId} not found`);
            }
            
            await this.deleteSheetRow('Albums', rowIndex);
            console.log(`✅ Deleted album ${albumId} from Google Sheets`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to delete album ${albumId}:`, error);
            throw error;
        }
    }
    
    // Scraped history operations
    async getScrapedArtistsHistory() {
        await this.rateLimiter.checkRateLimit();
        
        const data = await this.getSheetData('Scraped_History');
        return this.parseHistoryData(data);
    }
    
    async addScrapedArtist(artistData) {
        await this.rateLimiter.checkRateLimit();
        
        const row = this.historyToSheetRow(artistData);
        return await this.appendToSheet('Scraped_History', row);
    }
    
    // Batch operations for migration
    async batchAddAlbums(albumsArray) {
        console.log(`📦 Batch adding ${albumsArray.length} albums to Google Sheets...`);
        
        const batchSize = 25; // Conservative batch size
        const results = [];
        
        for (let i = 0; i < albumsArray.length; i += batchSize) {
            const batch = albumsArray.slice(i, i + batchSize);
            const rows = batch.map(album => this.albumToSheetRow(album));
            
            await this.rateLimiter.checkRateLimit();
            
            try {
                await this.batchAppendToSheet('Albums', rows);
                results.push(...batch);
                
                const progress = Math.round(((i + batch.length) / albumsArray.length) * 100);
                console.log(`📊 Imported ${Math.min(i + batchSize, albumsArray.length)}/${albumsArray.length} albums (${progress}%)`);
                
                // Delay between batches
                await new Promise(resolve => setTimeout(resolve, 2000));
                
            } catch (error) {
                if (error.message === 'TOKEN_EXPIRED') {
                    // Retry this batch with fresh token
                    i -= batchSize; // Retry current batch
                    continue;
                }
                throw error;
            }
        }
        
        return results;
    }
    
    // Utility methods
    async getSheetData(sheetName) {
        const range = `${sheetName}!A:Z`;
        const url = `${this.sheetsAPI}/${this.spreadsheetId}/values/${range}`;
        
        try {
            const response = await this.makeAuthenticatedRequest(url);
            const result = await response.json();
            return result.values || [];
        } catch (error) {
            if (error.message === 'TOKEN_EXPIRED') {
                return this.getSheetData(sheetName); // Retry with fresh token
            }
            throw error;
        }
    }
    
    async appendToSheet(sheetName, rowData) {
        const range = `${sheetName}!A:Z`;
        const url = `${this.sheetsAPI}/${this.spreadsheetId}/values/${range}:append?valueInputOption=RAW`;
        
        try {
            const response = await this.makeAuthenticatedRequest(url, {
                method: 'POST',
                body: JSON.stringify({
                    values: [rowData]
                })
            });
            
            return response.json();
        } catch (error) {
            if (error.message === 'TOKEN_EXPIRED') {
                return this.appendToSheet(sheetName, rowData); // Retry with fresh token
            }
            throw error;
        }
    }
    
    async batchAppendToSheet(sheetName, rowsData) {
        const range = `${sheetName}!A:Z`;
        const url = `${this.sheetsAPI}/${this.spreadsheetId}/values/${range}:append?valueInputOption=RAW`;
        
        try {
            const response = await this.makeAuthenticatedRequest(url, {
                method: 'POST',
                body: JSON.stringify({
                    values: rowsData
                })
            });
            
            return response.json();
        } catch (error) {
            if (error.message === 'TOKEN_EXPIRED') {
                return this.batchAppendToSheet(sheetName, rowsData); // Retry with fresh token
            }
            throw error;
        }
    }
    
    async findAlbumRowIndex(albumId) {
        const data = await this.getSheetData('Albums');
        
        for (let i = 1; i < data.length; i++) { // Skip header row
            if (data[i][0] === albumId.toString()) {
                return i + 1; // Google Sheets uses 1-based indexing
            }
        }
        
        return -1; // Not found
    }
    
    // Data transformation methods
    albumToSheetRow(albumData) {
        return [
            albumData.id || '',
            albumData.title || '',
            albumData.year || '',
            albumData.artist || '',
            albumData.role || '',
            albumData.type || 'release',
            JSON.stringify(albumData.genres || []),
            JSON.stringify(albumData.styles || []),
            JSON.stringify(albumData.formats || []),
            JSON.stringify(albumData.images || []),
            JSON.stringify(albumData.tracklist || []),
            albumData.track_count || 0,
            JSON.stringify(albumData.credits || []),
            albumData.cover_image || '',
            albumData.formatted_year || '',
            new Date().toISOString(),
            new Date().toISOString()
        ];
    }
    
    historyToSheetRow(artistData) {
        return [
            Date.now(), // Simple ID
            artistData.artist_name || '',
            artistData.discogs_artist_id || '',
            artistData.scraped_at || new Date().toISOString(),
            artistData.album_count || 0,
            artistData.status || 'completed'
        ];
    }
    
    parseAlbumsData(sheetData) {
        if (!sheetData || sheetData.length < 2) return [];
        
        const headers = sheetData[0];
        const rows = sheetData.slice(1);
        
        return rows.map(row => {
            const album = {};
            headers.forEach((header, index) => {
                const value = row[index] || '';
                
                // Parse JSON fields
                if (['genres', 'styles', 'formats', 'images', 'tracklist', 'credits'].includes(header)) {
                    try {
                        album[header] = JSON.parse(value);
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
        });
    }
    
    parseHistoryData(sheetData) {
        if (!sheetData || sheetData.length < 2) return [];
        
        const headers = sheetData[0];
        const rows = sheetData.slice(1);
        
        return rows.map(row => {
            const entry = {};
            headers.forEach((header, index) => {
                const value = row[index] || '';
                
                if (header === 'album_count') {
                    entry[header] = parseInt(value) || 0;
                } else {
                    entry[header] = value;
                }
            });
            
            return entry;
        });
    }
}

// Rate limiter for Google Sheets API
class GoogleSheetsRateLimiter {
    constructor() {
        this.requests = 0;
        this.resetTime = Date.now() + 100000; // 100 seconds window
        this.maxRequests = 80; // Conservative limit
    }
    
    async checkRateLimit() {
        const now = Date.now();
        
        if (now > this.resetTime) {
            // Reset limit window
            this.requests = 0;
            this.resetTime = now + 100000;
        }
        
        if (this.requests >= this.maxRequests) {
            const waitTime = this.resetTime - now;
            console.log(`⏳ Rate limit reached. Waiting ${Math.round(waitTime/1000)}s...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            
            // Reset after waiting
            this.requests = 0;
            this.resetTime = Date.now() + 100000;
        }
        
        this.requests++;
    }
}

// Export for global access
window.GoogleSheetsService = GoogleSheetsService;