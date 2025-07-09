/**
 * Google Sheets Service for Albums Collection App
 * Handles all interactions with Google Sheets API for data storage
 */

class GoogleSheetsService {
    constructor() {
        this.spreadsheetId = window.CONFIG.GOOGLE_SHEETS.SPREADSHEET_ID;
        this.apiKey = window.CONFIG.GOOGLE_SHEETS.API_KEY;
        this.sheetsAPI = 'https://sheets.googleapis.com/v4/spreadsheets';
        this.initialized = false;
        this.rateLimiter = new GoogleSheetsRateLimiter();
    }
    
    async initialize() {
        if (this.initialized) return;
        
        try {
            console.log('🔗 Initializing Google Sheets service...');
            await this.testConnection();
            this.initialized = true;
            console.log('✅ Google Sheets service initialized successfully');
        } catch (error) {
            console.error('❌ Google Sheets initialization failed:', error);
            throw error;
        }
    }
    
    async testConnection() {
        try {
            const response = await fetch(
                `${this.sheetsAPI}/${this.spreadsheetId}?key=${this.apiKey}`
            );
            
            if (!response.ok) {
                throw new Error(`Google Sheets API error: ${response.status} - ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log(`📊 Connected to spreadsheet: "${data.properties.title}"`);
            return data;
        } catch (error) {
            console.error('❌ Google Sheets connection test failed:', error);
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
        
        const batchSize = 100; // Google Sheets API batch limit
        const results = [];
        
        for (let i = 0; i < albumsArray.length; i += batchSize) {
            const batch = albumsArray.slice(i, i + batchSize);
            const rows = batch.map(album => this.albumToSheetRow(album));
            
            await this.rateLimiter.checkRateLimit();
            await this.batchAppendToSheet('Albums', rows);
            
            results.push(...batch);
            console.log(`📊 Imported ${Math.min(i + batchSize, albumsArray.length)}/${albumsArray.length} albums`);
            
            // Additional delay for batch operations
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        return results;
    }
    
    // Utility methods
    async getSheetData(sheetName) {
        const range = `${sheetName}!A:Z`; // Get all data
        const response = await fetch(
            `${this.sheetsAPI}/${this.spreadsheetId}/values/${range}?key=${this.apiKey}`
        );
        
        if (!response.ok) {
            throw new Error(`Failed to fetch ${sheetName} data: ${response.status}`);
        }
        
        const result = await response.json();
        return result.values || [];
    }
    
    async appendToSheet(sheetName, rowData) {
        const range = `${sheetName}!A:Z`;
        const response = await fetch(
            `${this.sheetsAPI}/${this.spreadsheetId}/values/${range}:append?valueInputOption=RAW&key=${this.apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    values: [rowData]
                })
            }
        );
        
        if (!response.ok) {
            throw new Error(`Failed to append to ${sheetName}: ${response.status}`);
        }
        
        return response.json();
    }
    
    async batchAppendToSheet(sheetName, rowsData) {
        const range = `${sheetName}!A:Z`;
        const response = await fetch(
            `${this.sheetsAPI}/${this.spreadsheetId}/values/${range}:append?valueInputOption=RAW&key=${this.apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    values: rowsData
                })
            }
        );
        
        if (!response.ok) {
            throw new Error(`Failed to batch append to ${sheetName}: ${response.status}`);
        }
        
        return response.json();
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
            albumData.id,
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
        this.maxRequests = 90; // Conservative limit (API allows 100)
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