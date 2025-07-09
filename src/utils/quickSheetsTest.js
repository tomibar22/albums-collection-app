/**
 * Simple Google Sheets API Test
 * Tests basic connectivity without the full service
 */

window.quickGoogleSheetsTest = async function() {
    console.log('🧪 Quick Google Sheets API test...');
    
    // Get credentials
    const spreadsheetId = prompt('Enter your Spreadsheet ID:') || '1yCd_gxOKN3EH4AFyGH61cEti-Ehduxxh_egx_yZkJhg';
    const apiKey = prompt('Enter your NEW API Key:');
    
    if (!apiKey) {
        alert('❌ Need API key to test!');
        return;
    }
    
    try {
        console.log('🔗 Testing basic API connectivity...');
        
        // Test 1: Get spreadsheet metadata
        const metadataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?key=${apiKey}`;
        console.log('📡 Testing URL:', metadataUrl);
        
        const response = await fetch(metadataUrl);
        
        console.log('📊 Response status:', response.status);
        console.log('📊 Response ok:', response.ok);
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ SUCCESS! Spreadsheet data:', data);
            
            alert(`✅ Google Sheets API Connected!
            
Spreadsheet: "${data.properties.title}"
Sheets: ${data.sheets.map(s => s.properties.title).join(', ')}
            
Your API setup is working!`);
            
            return true;
        } else {
            const errorText = await response.text();
            console.error('❌ API Error:', response.status, errorText);
            
            let helpMessage = '';
            if (response.status === 403) {
                helpMessage = `
🔧 Fix for 403 Error:
1. Make spreadsheet public ("Anyone with link can view")
2. Check API key restrictions in Google Cloud Console
3. Ensure Google Sheets API is enabled`;
            } else if (response.status === 400) {
                helpMessage = `
🔧 Fix for 400 Error:
1. Check if API key is correct
2. Check if spreadsheet ID is correct`;
            }
            
            alert(`❌ Google Sheets API Error ${response.status}

${helpMessage}

Error details: ${errorText}`);
            
            return false;
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        alert(`❌ Connection Test Failed!
        
Error: ${error.message}

This might be a network issue or CORS restriction.`);
        return false;
    }
};

// Add test button when page loads
window.addEventListener('load', function() {
    const scraperView = document.getElementById('scraper-view');
    if (scraperView) {
        const quickTestButton = document.createElement('button');
        quickTestButton.innerHTML = '⚡ Quick Google Sheets Test';
        quickTestButton.className = 'primary-btn';
        quickTestButton.onclick = () => window.quickGoogleSheetsTest();
        quickTestButton.style.margin = '10px';
        quickTestButton.style.backgroundColor = '#ff6b35';
        
        const viewHeader = scraperView.querySelector('.view-header .view-controls');
        if (viewHeader) {
            viewHeader.insertBefore(quickTestButton, viewHeader.firstChild);
        }
    }
});