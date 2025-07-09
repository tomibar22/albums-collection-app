/**
 * Simple Google Sheets Reader - Test if data is accessible
 */

class SimpleGoogleSheetsReader {
    constructor() {
        this.spreadsheetId = window.CONFIG.GOOGLE_SHEETS.SPREADSHEET_ID;
        this.baseUrl = 'https://sheets.googleapis.com/v4/spreadsheets';
    }
    
    async testPublicAccess() {
        try {
            console.log('🔍 Testing public access to Google Sheets...');
            
            // Try to access without authentication (if sheet is public)
            const url = `${this.baseUrl}/${this.spreadsheetId}/values/Albums!A1:A10`;
            const response = await fetch(url);
            
            if (response.ok) {
                console.log('✅ Public access works!');
                return true;
            } else {
                console.log(`❌ Public access failed: ${response.status}`);
                return false;
            }
        } catch (error) {
            console.error('❌ Public access test failed:', error);
            return false;
        }
    }
    
    async testWithAPIKey() {
        try {
            const apiKey = window.CONFIG.GOOGLE_SHEETS.API_KEY;
            if (!apiKey) {
                console.log('❌ No API key configured');
                return false;
            }
            
            console.log('🔍 Testing API key access...');
            
            const url = `${this.baseUrl}/${this.spreadsheetId}/values/Albums!A1:A10?key=${apiKey}`;
            const response = await fetch(url);
            
            if (response.ok) {
                console.log('✅ API key access works!');
                return true;
            } else {
                console.log(`❌ API key access failed: ${response.status}`);
                const errorData = await response.json().catch(() => ({}));
                console.log('Error details:', errorData);
                return false;
            }
        } catch (error) {
            console.error('❌ API key test failed:', error);
            return false;
        }
    }
    
    async runAllTests() {
        console.log('🧪 Running Google Sheets access tests...');
        
        const publicAccess = await this.testPublicAccess();
        const apiKeyAccess = await this.testWithAPIKey();
        
        return {
            publicAccess,
            apiKeyAccess,
            recommendation: this.getRecommendation(publicAccess, apiKeyAccess)
        };
    }
    
    getRecommendation(publicAccess, apiKeyAccess) {
        if (publicAccess) {
            return 'READY: Can use public access to read data';
        } else if (apiKeyAccess) {
            return 'READY: Can use API key to read data';
        } else {
            return 'SETUP_NEEDED: Need to configure API key or make sheet public';
        }
    }
}

// Add to window for debugging
window.SimpleGoogleSheetsReader = SimpleGoogleSheetsReader;

// Auto-test function for debugging
window.testGoogleSheetsAccess = async function() {
    const reader = new SimpleGoogleSheetsReader();
    const results = await reader.runAllTests();
    console.log('📊 Test Results:', results);
    return results;
};
