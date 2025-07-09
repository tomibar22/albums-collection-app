/**
 * Enhanced Supabase to Google Sheets Migration Utility
 * Updated to work with DataService architecture
 */

window.DataMigrationTool = {
    // Migration state
    migration: {
        inProgress: false,
        currentStep: '',
        totalAlbums: 0,
        exportedAlbums: 0,
        importedAlbums: 0,
        errors: []
    },
    
    // Export all albums from Supabase (using direct Supabase service)
    async exportFromSupabase() {
        console.log('📥 Starting Supabase export...');
        this.migration.currentStep = 'Exporting from Supabase';
        
        try {
            // Create a direct Supabase service for export (regardless of current backend)
            const supabaseService = new SupabaseService();
            await supabaseService.initialize();
            
            if (!supabaseService.initialized) {
                throw new Error('Failed to initialize Supabase service for export');
            }
            
            const supabaseClient = supabaseService.client;
            
            // Get total count first
            console.log('📊 Counting albums in Supabase...');
            const countResult = await supabaseClient
                .from('albums')
                .select('*', { count: 'exact', head: true });
            
            if (countResult.error) {
                throw new Error(`Failed to get album count: ${countResult.error.message}`);
            }
            
            this.migration.totalAlbums = countResult.count;
            console.log(`📊 Found ${this.migration.totalAlbums} albums to export`);
            
            // Export in batches to handle large datasets
            const batchSize = 1000;
            let allAlbums = [];
            let offset = 0;
            
            while (offset < this.migration.totalAlbums) {
                const batchNumber = Math.floor(offset/batchSize) + 1;
                const totalBatches = Math.ceil(this.migration.totalAlbums/batchSize);
                console.log(`📀 Exporting batch ${batchNumber}/${totalBatches}...`);
                
                const { data: batch, error } = await supabaseClient
                    .from('albums')
                    .select('*')
                    .range(offset, offset + batchSize - 1);
                
                if (error) {
                    throw new Error(`Supabase export error: ${error.message}`);
                }
                
                allAlbums = allAlbums.concat(batch || []);
                offset += batchSize;
                this.migration.exportedAlbums = allAlbums.length;
                
                this.updateMigrationStatus();
            }
            
            console.log(`✅ Successfully exported ${allAlbums.length} albums from Supabase`);
            return allAlbums;
            
        } catch (error) {
            console.error('❌ Supabase export failed:', error);
            this.migration.errors.push(`Export error: ${error.message}`);
            throw error;
        }
    },
    
    // Set up Google Sheets with proper headers
    async setupGoogleSheetsHeaders() {
        console.log('📋 Setting up Google Sheets headers...');
        
        try {
            const sheetsService = new GoogleSheetsService();
            await sheetsService.initialize();
            
            // Check if Albums sheet exists and has headers
            const existingData = await sheetsService.getSheetData('Albums');
            
            if (existingData.length === 0) {
                console.log('📝 Adding Albums sheet headers...');
                const albumsHeaders = [
                    'id', 'title', 'year', 'artist', 'role', 'type',
                    'genres', 'styles', 'formats', 'images', 'tracklist',
                    'track_count', 'credits', 'cover_image', 'formatted_year',
                    'created_at', 'updated_at'
                ];
                
                await sheetsService.appendToSheet('Albums', albumsHeaders);
                console.log('✅ Headers added to Albums sheet');
            } else {
                console.log('✅ Albums sheet headers already exist');
            }
            
            return true;
        } catch (error) {
            console.error('❌ Failed to setup Google Sheets headers:', error);
            throw error;
        }
    },
    
    // Import albums to Google Sheets
    async importToGoogleSheets(albums) {
        console.log(`📤 Starting Google Sheets import of ${albums.length} albums...`);
        this.migration.currentStep = 'Importing to Google Sheets';
        
        try {
            // Set up headers first
            await this.setupGoogleSheetsHeaders();
            
            // Create Google Sheets service
            const sheetsService = new GoogleSheetsService();
            await sheetsService.initialize();
            
            // Import in batches (Google Sheets API limit: 100 rows per request)
            const batchSize = 50; // Conservative batch size for reliability
            let importedCount = 0;
            
            for (let i = 0; i < albums.length; i += batchSize) {
                const batch = albums.slice(i, i + batchSize);
                const batchNumber = Math.floor(i / batchSize) + 1;
                const totalBatches = Math.ceil(albums.length / batchSize);
                
                console.log(`📊 Importing batch ${batchNumber}/${totalBatches} (${batch.length} albums)...`);
                
                // Convert albums to sheet rows
                const rows = batch.map(album => sheetsService.albumToSheetRow(album));
                
                // Import batch
                await sheetsService.batchAppendToSheet('Albums', rows);
                
                importedCount += batch.length;
                this.migration.importedAlbums = importedCount;
                this.updateMigrationStatus();
                
                // Rate limiting delay (Google Sheets API: 100 requests per 100 seconds)
                await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
                
                console.log(`✅ Batch ${batchNumber} complete (${importedCount}/${albums.length} total)`);
            }
            
            console.log(`✅ Successfully imported ${importedCount} albums to Google Sheets`);
            return importedCount;
            
        } catch (error) {
            console.error('❌ Google Sheets import failed:', error);
            this.migration.errors.push(`Import error: ${error.message}`);
            throw error;
        }
    },
    
    // Verify migration success
    async verifyMigration() {
        console.log('🔍 Verifying migration...');
        this.migration.currentStep = 'Verifying migration';
        
        try {
            // Check Google Sheets count
            const sheetsService = new GoogleSheetsService();
            await sheetsService.initialize();
            const sheetsAlbums = await sheetsService.getAllAlbums();
            const sheetsCount = sheetsAlbums.length;
            
            console.log(`📊 Verification Results:`);
            console.log(`   Expected: ${this.migration.totalAlbums} albums`);
            console.log(`   Google Sheets: ${sheetsCount} albums`);
            
            if (sheetsCount === this.migration.totalAlbums) {
                console.log('✅ Migration verification PASSED!');
                return {
                    success: true,
                    expectedCount: this.migration.totalAlbums,
                    sheetsCount: sheetsCount,
                    message: 'All albums successfully migrated!'
                };
            } else {
                console.log('❌ Migration verification FAILED!');
                return {
                    success: false,
                    expectedCount: this.migration.totalAlbums,
                    sheetsCount: sheetsCount,
                    message: `Count mismatch: ${sheetsCount}/${this.migration.totalAlbums} albums migrated`
                };
            }
            
        } catch (error) {
            console.error('❌ Migration verification failed:', error);
            return {
                success: false,
                message: `Verification error: ${error.message}`
            };
        }
    },
    
    // Check if credentials are available
    hasGoogleSheetsCredentials() {
        try {
            // Check if we have the service account file
            const hasSpreadsheetId = window.CONFIG?.GOOGLE_SHEETS?.SPREADSHEET_ID;
            const hasCredentials = window.SecureCredentialLoader || window.CONFIG?.GOOGLE_SHEETS?.SERVICE_ACCOUNT_CREDENTIALS;
            
            return hasSpreadsheetId && hasCredentials;
        } catch (error) {
            console.error('Error checking credentials:', error);
            return false;
        }
    },
    
    // Main migration function
    async runFullMigration() {
        if (this.migration.inProgress) {
            alert('Migration already in progress!');
            return;
        }
        
        // Check if Google Sheets credentials are available
        if (!this.hasGoogleSheetsCredentials()) {
            alert('❌ Google Sheets not configured!\n\n' +
                  'Please make sure:\n' +
                  '1. Your spreadsheet ID is set in the configuration\n' +
                  '2. The service account JSON file is in the root directory\n' +
                  '3. You have shared the spreadsheet with your service account email');
            return;
        }
        
        // Test Google Sheets connection first
        try {
            console.log('🔌 Testing Google Sheets connection...');
            const sheetsService = new GoogleSheetsService();
            await sheetsService.initialize();
            console.log('✅ Google Sheets connection successful');
        } catch (error) {
            alert(`❌ Google Sheets Connection Failed!\n\nError: ${error.message}\n\n` +
                  'Please check:\n' +
                  '1. Spreadsheet permissions\n' +
                  '2. Service account credentials\n' +
                  '3. Internet connection');
            return;
        }
        
        // Get estimated album count
        let estimatedCount = 0;
        try {
            const supabaseService = new SupabaseService();
            await supabaseService.initialize();
            const countResult = await supabaseService.client
                .from('albums')
                .select('*', { count: 'exact', head: true });
            estimatedCount = countResult.count || 0;
        } catch (error) {
            console.log('Could not get exact count, proceeding anyway...');
        }
        
        // Final confirmation
        const confirm = window.confirm(
            `🚀 Ready to migrate your music collection?\n\n` +
            `This will copy ${estimatedCount > 0 ? estimatedCount : 'all your'} albums from Supabase to Google Sheets.\n\n` +
            `⏱️ Expected time: ${Math.ceil(estimatedCount / 50)} minutes\n` +
            `⚠️ Keep this browser window open during migration\n` +
            `📊 Progress will be shown below\n\n` +
            `Continue with migration?`
        );
        
        if (!confirm) {
            console.log('🚫 Migration cancelled by user');
            return;
        }
        
        // Reset migration state
        this.migration = {
            inProgress: true,
            currentStep: 'Starting migration',
            totalAlbums: 0,
            exportedAlbums: 0,
            importedAlbums: 0,
            errors: []
        };
        
        // Disable migration button
        const migrationBtn = document.getElementById('start-migration-btn');
        if (migrationBtn) {
            migrationBtn.disabled = true;
            migrationBtn.textContent = '🔄 Migration in Progress...';
        }
        
        try {
            console.log('🚀 Starting full migration: Supabase → Google Sheets');
            
            // Show initial status
            this.updateMigrationStatus();
            
            // Step 1: Export from Supabase
            const albums = await this.exportFromSupabase();
            
            // Step 2: Import to Google Sheets
            await this.importToGoogleSheets(albums);
            
            // Step 3: Verify migration
            const verification = await this.verifyMigration();
            
            // Show final results
            this.migration.inProgress = false;
            this.migration.currentStep = 'Migration complete';
            this.updateMigrationStatus();
            
            if (verification.success) {
                alert(`✅ Migration Successful!\n\n${verification.message}\n\n` +
                      `Expected: ${verification.expectedCount} albums\n` +
                      `Google Sheets: ${verification.sheetsCount} albums\n\n` +
                      `🎉 Your collection is now in Google Sheets!`);
            } else {
                alert(`⚠️ Migration Completed with Issues!\n\n${verification.message}\n\n` +
                      `Please check the console for details.`);
            }
            
            return verification;
            
        } catch (error) {
            console.error('❌ Migration failed:', error);
            this.migration.inProgress = false;
            this.migration.errors.push(`Migration error: ${error.message}`);
            this.updateMigrationStatus();
            
            alert(`❌ Migration Failed!\n\nError: ${error.message}\n\nCheck console for details.`);
            return { success: false, message: error.message };
        } finally {
            // Re-enable migration button
            if (migrationBtn) {
                migrationBtn.disabled = false;
                migrationBtn.textContent = '🚀 Start Migration (Supabase → Google Sheets)';
            }
        }
    },
    
    // Update migration status display
    updateMigrationStatus() {
        const statusDiv = document.getElementById('migration-status');
        if (statusDiv) {
            const progressPercentage = this.migration.totalAlbums > 0 ? 
                Math.round((this.migration.importedAlbums / this.migration.totalAlbums) * 100) : 0;
            
            statusDiv.innerHTML = `
                <div class="migration-status">
                    <h4>📊 Migration Progress</h4>
                    <p><strong>Current Step:</strong> ${this.migration.currentStep}</p>
                    <p><strong>Total Albums:</strong> ${this.migration.totalAlbums.toLocaleString()}</p>
                    <p><strong>Exported:</strong> ${this.migration.exportedAlbums.toLocaleString()}</p>
                    <p><strong>Imported:</strong> ${this.migration.importedAlbums.toLocaleString()}</p>
                    ${this.migration.errors.length > 0 ? `<p style="color: #ff6b6b;"><strong>Errors:</strong> ${this.migration.errors.length}</p>` : ''}
                    <div class="migration-progress">
                        <div class="progress-bar" style="width: ${progressPercentage}%"></div>
                    </div>
                    <p style="text-align: center; margin-top: 10px; font-weight: bold;">${progressPercentage}% Complete</p>
                </div>
            `;
        }
    },
    
    // Check if migration is ready to run
    async checkMigrationReadiness() {
        console.log('⚡ Checking migration readiness...');
        
        let status = '📋 Migration Readiness Check:\n\n';
        let allReady = true;
        
        // Check Supabase connection
        try {
            const supabaseService = new SupabaseService();
            await supabaseService.initialize();
            if (supabaseService.initialized) {
                const countResult = await supabaseService.client
                    .from('albums')
                    .select('*', { count: 'exact', head: true });
                status += `✅ Supabase: Connected (${countResult.count || 0} albums)\n`;
            } else {
                status += '❌ Supabase: Connection failed\n';
                allReady = false;
            }
        } catch (error) {
            status += `❌ Supabase: Error - ${error.message}\n`;
            allReady = false;
        }
        
        // Check Google Sheets credentials and connection
        try {
            if (this.hasGoogleSheetsCredentials()) {
                // Test connection
                const sheetsService = new GoogleSheetsService();
                await sheetsService.initialize();
                status += '✅ Google Sheets: Credentials configured and connection successful\n';
            } else {
                status += '❌ Google Sheets: Credentials missing\n';
                allReady = false;
            }
        } catch (error) {
            status += `❌ Google Sheets: Connection error - ${error.message}\n`;
            allReady = false;
        }
        
        if (allReady) {
            status += '\n🚀 Ready for migration!';
        } else {
            status += '\n⚠️ Migration not ready. Please resolve the issues above.';
        }
        
        alert(status);
        return allReady;
    }
};

// Enhanced migration UI with better styling
window.addEventListener('DOMContentLoaded', function() {
    // Wait a bit for the app to fully load
    setTimeout(() => {
        const scraperView = document.getElementById('scraper-view');
        if (scraperView) {
            // Check if migration section already exists
            if (document.querySelector('.migration-section')) {
                return; // Already added
            }
            
            // Create migration section
            const migrationSection = document.createElement('div');
            migrationSection.className = 'scraper-section migration-section';
            migrationSection.innerHTML = `
                <h3>🔄 Data Migration Tool</h3>
                <p>Transfer your complete music collection from Supabase to Google Sheets</p>
                <div class="migration-controls">
                    <button id="start-migration-btn" class="primary-btn" onclick="window.DataMigrationTool.runFullMigration()">
                        🚀 Start Migration (Supabase → Google Sheets)
                    </button>
                    <button id="verify-migration-btn" class="secondary-btn" onclick="window.DataMigrationTool.verifyMigration().then(r => alert(r.message))">
                        🔍 Verify Migration
                    </button>
                    <button id="check-status-btn" class="secondary-btn" onclick="window.DataMigrationTool.checkMigrationReadiness()">
                        ⚡ Check Migration Readiness
                    </button>
                </div>
                <div id="migration-status"></div>
            `;
            
            // Add migration section to the top of scraper view
            const viewContent = scraperView.querySelector('.view-content') || scraperView;
            viewContent.insertBefore(migrationSection, viewContent.firstChild);
            
            console.log('✅ Migration tool UI added to scraper page');
        }
    }, 1000); // Wait 1 second for app to load
});
