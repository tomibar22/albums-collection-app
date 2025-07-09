/**
 * Google Sheets Setup Script
 * Creates the proper headers and structure for the Albums Collection App
 */

class GoogleSheetsSetup {
    constructor() {
        this.spreadsheetId = '1yCd_gxOKN3EH4AFyGH61cEti-Ehduxxh_egx_yZkJhg';
        this.apiKey = ''; // This will be loaded from service account
    }

    async setupSpreadsheetStructure() {
        console.log('📊 Setting up Google Sheets structure...');
        
        try {
            // Load credentials
            const credentialLoader = new SecureCredentialLoader();
            await credentialLoader.loadServiceAccountCredentials();
            
            // Set up Albums sheet headers
            await this.setupAlbumsSheet();
            
            // Set up Scraped History sheet headers
            await this.setupScrapedHistorySheet();
            
            console.log('✅ Google Sheets setup complete!');
            
        } catch (error) {
            console.error('❌ Failed to setup Google Sheets:', error);
            throw error;
        }
    }

    async setupAlbumsSheet() {
        console.log('📀 Setting up Albums sheet...');
        
        const albumsHeaders = [
            'id',           // Discogs release ID
            'title',        // Album title
            'year',         // Release year
            'artist',       // Primary artist name
            'role',         // Artist role on album
            'type',         // Type: release, master, etc.
            'genres',       // Genre tags (JSON array)
            'styles',       // Style tags (JSON array)
            'formats',      // Format information (JSON array)
            'images',       // Image URLs (JSON array)
            'tracklist',    // Complete tracklist (JSON array)
            'track_count',  // Number of tracks
            'credits',      // Raw extraartists from Discogs (JSON array)
            'cover_image',  // Primary cover image URL
            'formatted_year', // Display-friendly year
            'created_at',   // Creation timestamp
            'updated_at'    // Last update timestamp
        ];

        // Check if headers already exist
        const existingData = await this.getSheetData('Albums');
        
        if (existingData.length === 0 || !this.headersMatch(existingData[0], albumsHeaders)) {
            console.log('📝 Adding Albums sheet headers...');
            await this.setSheetHeaders('Albums', albumsHeaders);
        } else {
            console.log('✅ Albums sheet headers already correct');
        }
    }

    async setupScrapedHistorySheet() {
        console.log('📜 Setting up Scraped History sheet...');
        
        const historyHeaders = [
            'id',               // Simple ID
            'artist_name',      // Name of scraped artist
            'discogs_artist_id', // Discogs artist ID
            'scraped_at',       // Timestamp of scraping
            'album_count',      // Number of albums scraped
            'status'            // Scraping status
        ];

        // Check if headers already exist
        const existingData = await this.getSheetData('Scraped_History');
        
        if (existingData.length === 0 || !this.headersMatch(existingData[0], historyHeaders)) {
            console.log('📝 Adding Scraped History sheet headers...');
            await this.setSheetHeaders('Scraped_History', historyHeaders);
        } else {
            console.log('✅ Scraped History sheet headers already correct');
        }
    }

    async getSheetData(sheetName) {
        // This is a simplified version - in practice, you'd need the full API implementation
        // For now, we'll assume we can check via the Google Sheets service
        
        if (window.GoogleSheetsService) {
            const service = new GoogleSheetsService();
            await service.initialize();
            return await service.getSheetData(sheetName);
        }
        
        return [];
    }

    async setSheetHeaders(sheetName, headers) {
        console.log(`📋 Setting headers for ${sheetName} sheet...`);
        
        if (window.GoogleSheetsService) {
            const service = new GoogleSheetsService();
            await service.initialize();
            
            // Clear the sheet first (optional)
            // await service.clearSheet(sheetName);
            
            // Add headers as the first row
            await service.appendToSheet(sheetName, headers);
            
            console.log(`✅ Headers set for ${sheetName}`);
        } else {
            throw new Error('GoogleSheetsService not available');
        }
    }

    headersMatch(existingHeaders, expectedHeaders) {
        if (!existingHeaders || existingHeaders.length !== expectedHeaders.length) {
            return false;
        }
        
        return expectedHeaders.every((header, index) => 
            existingHeaders[index] === header
        );
    }

    // Helper method to create sheets if they don't exist
    async createSheetsIfNeeded() {
        console.log('🔍 Checking if sheets exist...');
        
        // This would require the Google Sheets API v4 with write permissions
        // For now, we'll assume the sheets exist and just set up headers
        
        console.log('💡 Make sure your spreadsheet has two sheets:');
        console.log('   1. "Albums" - for your music collection');
        console.log('   2. "Scraped_History" - for tracking scraping history');
    }
}

// Test function that can be called from the browser console
async function setupGoogleSheets() {
    try {
        const setup = new GoogleSheetsSetup();
        await setup.setupSpreadsheetStructure();
    } catch (error) {
        console.error('Setup failed:', error);
    }
}

// Make it available globally
window.GoogleSheetsSetup = GoogleSheetsSetup;
window.setupGoogleSheets = setupGoogleSheets;
