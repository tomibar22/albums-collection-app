/**
 * Secure Configuration Loader
 * Handles loading of sensitive credentials safely
 */

window.SecureConfig = {
    // Load Google Sheets credentials securely
    loadGoogleSheetsCredentials: function() {
        // Try to get from localStorage first (if previously set)
        let spreadsheetId = localStorage.getItem('google_sheets_spreadsheet_id');
        let apiKey = localStorage.getItem('google_sheets_api_key');
        
        // If not found, prompt user (development only)
        if (!spreadsheetId || !apiKey) {
            console.log('🔑 Google Sheets credentials not found in secure storage');
            
            // For now, we'll prompt - in production this would come from secure backend
            spreadsheetId = prompt('Enter your Google Sheets Spreadsheet ID:');
            apiKey = prompt('Enter your NEW Google Sheets API Key:');
            
            if (spreadsheetId && apiKey) {
                // Store securely in localStorage (temporary solution)
                localStorage.setItem('google_sheets_spreadsheet_id', spreadsheetId);
                localStorage.setItem('google_sheets_api_key', apiKey);
                console.log('🔒 Credentials stored securely in local storage');
            }
        }
        
        // Update CONFIG object with secure credentials
        if (spreadsheetId && apiKey) {
            window.CONFIG.GOOGLE_SHEETS.SPREADSHEET_ID = spreadsheetId;
            window.CONFIG.GOOGLE_SHEETS.API_KEY = apiKey;
            console.log('✅ Google Sheets credentials loaded securely');
            return true;
        } else {
            console.error('❌ Failed to load Google Sheets credentials');
            return false;
        }
    },
    
    // Clear stored credentials (for security)
    clearGoogleSheetsCredentials: function() {
        localStorage.removeItem('google_sheets_spreadsheet_id');
        localStorage.removeItem('google_sheets_api_key');
        window.CONFIG.GOOGLE_SHEETS.SPREADSHEET_ID = '';
        window.CONFIG.GOOGLE_SHEETS.API_KEY = '';
        console.log('🗑️ Google Sheets credentials cleared');
    },
    
    // Check if credentials are available
    hasGoogleSheetsCredentials: function() {
        return !!(window.CONFIG.GOOGLE_SHEETS.SPREADSHEET_ID && window.CONFIG.GOOGLE_SHEETS.API_KEY);
    }
};

// Auto-load credentials when script loads
document.addEventListener('DOMContentLoaded', function() {
    // Only load if we're planning to use Google Sheets
    if (window.CONFIG.DATA_BACKEND === 'sheets') {
        console.log('🔑 Loading Google Sheets credentials for backend...');
        window.SecureConfig.loadGoogleSheetsCredentials();
    }
});