/**
 * Google Sheets Connection Test
 * Simple test to verify Google Sheets API connectivity
 */

window.testGoogleSheetsConnection = async function() {
    console.log('🧪 Testing Google Sheets connection...');
    
    try {
        // Create Google Sheets service instance
        const sheetsService = new GoogleSheetsService();
        
        // Test connection
        console.log('🔗 Initializing Google Sheets service...');
        await sheetsService.initialize();
        
        // Test reading data (should work even with empty sheets)
        console.log('📊 Testing data read capability...');
        const albums = await sheetsService.getAllAlbums();
        console.log(`📀 Found ${albums.length} albums in Google Sheets`);
        
        // Test scraped history
        console.log('📋 Testing scraped history read...');
        const history = await sheetsService.getScrapedArtistsHistory();
        console.log(`🎭 Found ${history.length} scraped artists in history`);
        
        console.log('✅ Google Sheets connection test PASSED!');
        alert(`✅ Google Sheets Connected!\n\nSpreadsheet: ${albums.length} albums\nHistory: ${history.length} artists\n\nReady for data migration!`);
        
        return true;
        
    } catch (error) {
        console.error('❌ Google Sheets connection test FAILED:', error);
        alert(`❌ Google Sheets Connection Failed!\n\nError: ${error.message}\n\nPlease check:\n- API key is correct\n- Spreadsheet ID is correct\n- Spreadsheet has "Albums" and "Scraped_History" sheets\n- API permissions are enabled`);
        
        return false;
    }
};

// Auto-test when window loads (for development)
window.addEventListener('load', function() {
    // Add test button to scraper view for easy testing
    const scraperView = document.getElementById('scraper-view');
    if (scraperView) {
        const testButton = document.createElement('button');
        testButton.innerHTML = '🧪 Test Google Sheets Connection';
        testButton.className = 'secondary-btn';
        testButton.onclick = () => window.testGoogleSheetsConnection();
        testButton.style.margin = '10px';
        
        const viewHeader = scraperView.querySelector('.view-header .view-controls');
        if (viewHeader) {
            viewHeader.appendChild(testButton);
        }
    }
});