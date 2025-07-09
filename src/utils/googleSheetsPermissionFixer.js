/**
 * Google Sheets Write Permission Helper
 * Handles API write permission issues
 */

window.GoogleSheetsPermissionFixer = {
    
    // Test if we have write permissions
    async testWritePermissions() {
        console.log('🧪 Testing Google Sheets write permissions...');
        
        try {
            const sheetsService = new GoogleSheetsService();
            await sheetsService.initialize();
            
            // Try to write a test row
            console.log('📝 Testing write access with test data...');
            const testRow = ['TEST', 'Write Permission Test', new Date().toISOString()];
            
            const response = await sheetsService.appendToSheet('Albums', testRow);
            
            if (response) {
                console.log('✅ Write permissions working!');
                
                // Clean up test data
                alert('✅ Write permissions working!\n\nTest data was added to verify permissions. You may want to delete the test row from your spreadsheet.');
                return true;
            }
            
        } catch (error) {
            console.error('❌ Write permission test failed:', error);
            
            if (error.message.includes('401')) {
                this.show401PermissionHelp();
            } else {
                alert(`❌ Write Permission Test Failed!\n\nError: ${error.message}`);
            }
            
            return false;
        }
    },
    
    // Show help for 401 permission errors
    show401PermissionHelp() {
        const helpText = `
❌ Google Sheets Write Permission Error (401)

🔧 SOLUTION - Choose one:

OPTION 1: Make Spreadsheet Public (Easier)
1. Open your spreadsheet: https://docs.google.com/spreadsheets/d/1yCd_gxOKN3EH4AFyGH61cEti-Ehduxxh_egx_yZkJhg/edit
2. Click "Share" → "Anyone with the link" → "Editor"
3. Click "Done"

OPTION 2: Use Service Account (More Secure)
1. Google Cloud Console → Create Service Account
2. Download JSON key file
3. Share spreadsheet with service account email
4. Update app to use service account authentication

OPTION 3: Enable API Write Access
1. Google Cloud Console → APIs & Services → Library
2. Search "Google Sheets API" → Manage
3. Check write permissions are enabled

Try OPTION 1 first for quick testing!
        `;
        
        alert(helpText);
    },
    
    // Alternative: Use Google Apps Script for writing
    async useAppsScriptWrite(albums) {
        console.log('🔄 Attempting Apps Script write method...');
        
        // This would require deploying a Google Apps Script
        // For now, just show instructions
        
        const instructions = `
🔄 Alternative: Google Apps Script Method

This method uses Google Apps Script to write data, which has full permissions:

1. Go to script.google.com
2. Create new project
3. Add this code:
   function addAlbums(albumsData) {
     const sheet = SpreadsheetApp.openById('1yCd_gxOKN3EH4AFyGH61cEti-Ehduxxh_egx_yZkJhg');
     const albumsSheet = sheet.getSheetByName('Albums');
     albumsSheet.getRange(albumsSheet.getLastRow() + 1, 1, albumsData.length, albumsData[0].length).setValues(albumsData);
   }
4. Deploy as web app
5. Use web app URL for writing data

For now, try the spreadsheet sharing method first!
        `;
        
        alert(instructions);
    }
};

// Add permission test button
window.addEventListener('load', function() {
    const scraperView = document.getElementById('scraper-view');
    if (scraperView) {
        const migrationSection = scraperView.querySelector('.scraper-section');
        if (migrationSection) {
            const controls = migrationSection.querySelector('.migration-controls');
            if (controls) {
                const permissionBtn = document.createElement('button');
                permissionBtn.innerHTML = '🔑 Test Write Permissions';
                permissionBtn.className = 'secondary-btn';
                permissionBtn.onclick = () => window.GoogleSheetsPermissionFixer.testWritePermissions();
                permissionBtn.style.margin = '10px';
                
                controls.appendChild(permissionBtn);
            }
        }
    }
});