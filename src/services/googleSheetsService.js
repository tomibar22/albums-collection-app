/**
 * Google Sheets Service for Albums Collection App
 * Handles all Google Sheets API interactions with proper rate limiting and data size handling
 */

class GoogleSheetsService {
    constructor() {
        this.spreadsheetId = window.CONFIG.GOOGLE_SHEETS.SPREADSHEET_ID;
        this.sheetsAPI = 'https://sheets.googleapis.com/v4/spreadsheets';
        this.initialized = false;
        this.rateLimiter = new GoogleSheetsRateLimiter();
        this.accessToken = null;
        this.tokenExpiration = 0;
        
        // Google Sheets limitations
        this.MAX_CELL_SIZE = 45000; // Conservative limit (actual is 50,000)
        this.truncatedFields = []; // Track truncated data for logging
    }
    
    async initialize() {
        if (this.initialized) return;
        
        try {
            await this.getAccessToken();
            await this.testConnection();
            this.initialized = true;
            console.log('✅ Google Sheets service initialized');
        } catch (error) {
            console.error('❌ Google Sheets initialization failed:', error);
            throw error;
        }
    }
    
    async getAccessToken() {
        try {
            const credentials = window.CONFIG.GOOGLE_SHEETS.SERVICE_ACCOUNT;
            
            if (!credentials || !credentials.client_email || !credentials.private_key) {
                throw new Error('Service account credentials not found in configuration');
            }
            
            // Create JWT token for Google Sheets API
            const now = Math.floor(Date.now() / 1000);
            const header = {
                "alg": "RS256",
                "typ": "JWT"
            };
            
            const payload = {
                "iss": credentials.client_email,
                "scope": "https://www.googleapis.com/auth/spreadsheets",
                "aud": "https://oauth2.googleapis.com/token",
                "iat": now,
                "exp": now + 3600
            };
            
            // For production, you would use a proper JWT library
            // This is a simplified implementation
            const token = await this.createJWT(header, payload, credentials.private_key);
            
            const response = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${token}`
            });
            
            if (!response.ok) {
                throw new Error(`Failed to get access token: ${response.status}`);
            }
            
            const data = await response.json();
            this.accessToken = data.access_token;
            this.tokenExpiration = Date.now() + (data.expires_in * 1000) - 60000; // 1 minute buffer
            
            console.log('✅ Access token obtained');
        } catch (error) {
            console.error('❌ Failed to get access token:', error);
            throw error;
        }
    }
    
    async createJWT(header, payload, privateKey) {
        // Simplified JWT creation - in production use a proper library
        const base64UrlEncode = (obj) => {
            return btoa(JSON.stringify(obj))
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=/g, '');
        };
        
        const headerEncoded = base64UrlEncode(header);
        const payloadEncoded = base64UrlEncode(payload);
        const message = `${headerEncoded}.${payloadEncoded}`;
        
        // For production, use proper RSA signing
        // This is a placeholder - you'll need to implement proper JWT signing
        return `${message}.signature_placeholder`;
    }
    
    async ensureValidToken() {
        if (!this.accessToken || Date.now() >= this.tokenExpiration) {
            await this.getAccessToken();
        }
    }
    
    async makeAuthenticatedRequest(url, options = {}) {
        await this.ensureValidToken();
        
        const response = await fetch(url, {
            ...options,
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
        
        if (response.status === 401) {
            // Token expired, retry once
            await this.getAccessToken();
            return fetch(url, {
                ...options,
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });
        }
        
        return response;
    }
    
    async testConnection() {
        const response = await this.makeAuthenticatedRequest(
            `${this.sheetsAPI}/${this.spreadsheetId}`
        );
        
        if (!response.ok) {
            throw new Error(`Google Sheets API test failed: ${response.status} ${response.statusText}`);
        }
        
        return response.json();
    }
    
    // Core data operations
    async getAllAlbums() {
        const data = await this.getSheetData('Albums');
        return this.parseAlbumsData(data);
    }
    
    async addAlbum(albumData) {
        await this.rateLimiter.checkRateLimit();
        
        try {
            const row = this.albumToSheetRow(albumData);
            const result = await this.appendToSheet('Albums', row);
            console.log(`✅ Added album "${albumData.title}" to Google Sheets`);
            return result;
        } catch (error) {
            console.error(`❌ Failed to add album "${albumData.title}":`, error);
            throw error;
        }
    }
    
    async findAlbumRowIndex(albumId) {
        const data = await this.getSheetData('Albums');
        
        // Find row with matching album ID (column A)
        for (let i = 1; i < data.length; i++) {
            if (data[i][0] === albumId.toString()) {
                return i + 1; // +1 because Google Sheets is 1-indexed
            }
        }
        
        return -1; // Not found
    }
    
    async updateAlbum(albumId, updateData) {
        await this.rateLimiter.checkRateLimit();
        
        try {
            const rowIndex = await this.findAlbumRowIndex(albumId);
            if (rowIndex === -1) {
                throw new Error(`Album with ID ${albumId} not found`);
            }
            
            const row = this.albumToSheetRow(updateData);
            await this.updateSheetRow('Albums', rowIndex, row);
            console.log(`✅ Updated album ${albumId} in Google Sheets`);
            return true;
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
        let truncationCount = 0;
        
        for (let i = 0; i < albumsArray.length; i += batchSize) {
            const batch = albumsArray.slice(i, i + batchSize);
            const rows = batch.map(album => {
                const row = this.albumToSheetRow(album);
                // Count any truncations in this batch
                if (this.lastTruncated) {
                    truncationCount++;
                    this.lastTruncated = false;
                }
                return row;
            });
            
            await this.rateLimiter.checkRateLimit();
            
            try {
                await this.batchAppendToSheet('Albums', rows);
                results.push(...batch);
                
                const progress = Math.round(((i + batch.length) / albumsArray.length) * 100);
                console.log(`📊 Imported ${Math.min(i + batchSize, albumsArray.length)}/${albumsArray.length} albums (${progress}%)`);
                
                if (truncationCount > 0) {
                    console.log(`⚠️ Note: ${truncationCount} albums had data truncated due to size limits`);
                }
                
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
        
        console.log(`✅ Migration complete! ${truncationCount} albums had oversized data truncated.`);
        return results;
    }
    
    // Safe JSON stringification with size limits
    safeJsonStringify(data, maxSize = this.MAX_CELL_SIZE, fieldName = 'field') {
        if (!data) return '';
        
        const fullJson = JSON.stringify(data);
        
        if (fullJson.length <= maxSize) {
            return fullJson;
        }
        
        // Data is too large, need to truncate intelligently
        console.log(`⚠️ ${fieldName} too large (${fullJson.length} chars), truncating...`);
        this.lastTruncated = true;
        
        if (Array.isArray(data)) {
            // For arrays, keep most important items
            if (fieldName === 'tracklist') {
                // Keep first 20 tracks for tracklist
                const truncated = data.slice(0, 20);
                truncated.push({ 
                    position: '...', 
                    title: `...and ${data.length - 20} more tracks (truncated)`,
                    type_: 'note' 
                });
                return JSON.stringify(truncated);
            } else if (fieldName === 'credits') {
                // Keep first 30 credits
                const truncated = data.slice(0, 30);
                truncated.push({ 
                    name: `...and ${data.length - 30} more credits (truncated)`,
                    role: 'note' 
                });
                return JSON.stringify(truncated);
            } else if (fieldName === 'images') {
                // Keep first 3 images only
                const truncated = data.slice(0, 3);
                return JSON.stringify(truncated);
            } else {
                // Generic array truncation - keep first half
                const truncated = data.slice(0, Math.floor(data.length / 2));
                return JSON.stringify(truncated);
            }
        } else if (typeof data === 'object') {
            // For objects, try to keep essential properties
            const essential = {};
            const keys = Object.keys(data);
            
            for (const key of keys) {
                essential[key] = data[key];
                if (JSON.stringify(essential).length > maxSize * 0.8) {
                    break;
                }
            }
            
            return JSON.stringify(essential);
        } else {
            // For strings, truncate with indication
            return fullJson.substring(0, maxSize - 20) + '...(truncated)';
        }
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
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Failed to append to ${sheetName}: ${response.status} - ${errorData.error?.message || response.statusText}`);
            }
            
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
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Failed to batch append to ${sheetName}: ${response.status} - ${errorData.error?.message || response.statusText}`);
            }
            
            return response.json();
        } catch (error) {
            if (error.message === 'TOKEN_EXPIRED') {
                return this.batchAppendToSheet(sheetName, rowsData); // Retry with fresh token
            }
            throw error;
        }
    }
    
    // Data transformation methods with size protection
    albumToSheetRow(albumData) {
        this.lastTruncated = false;
        
        return [
            albumData.id || '',
            albumData.title || '',
            albumData.year || '',
            albumData.artist || '',
            albumData.role || '',
            albumData.type || 'release',
            this.safeJsonStringify(albumData.genres || [], this.MAX_CELL_SIZE, 'genres'),
            this.safeJsonStringify(albumData.styles || [], this.MAX_CELL_SIZE, 'styles'),
            this.safeJsonStringify(albumData.formats || [], this.MAX_CELL_SIZE, 'formats'),
            this.safeJsonStringify(albumData.images || [], this.MAX_CELL_SIZE, 'images'),
            this.safeJsonStringify(albumData.tracklist || [], this.MAX_CELL_SIZE, 'tracklist'),
            albumData.track_count || 0,
            this.safeJsonStringify(albumData.credits || [], this.MAX_CELL_SIZE, 'credits'),
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
            const history = {};
            headers.forEach((header, index) => {
                const value = row[index] || '';
                
                if (header === 'album_count') {
                    history[header] = parseInt(value) || 0;
                } else {
                    history[header] = value;
                }
            });
            
            return history;
        });
    }
}

/**
 * Rate Limiter for Google Sheets API
 */
class GoogleSheetsRateLimiter {
    constructor() {
        this.requests = 0;
        this.resetTime = Date.now() + 100000; // 100 seconds window
        this.maxRequests = 90; // Conservative limit (actual is 100)
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

// Make service available globally
if (typeof window !== 'undefined') {
    window.GoogleSheetsService = GoogleSheetsService;
}