/**
 * Supabase to Google Sheets Migration Utility
 * Handles exporting all albums from Supabase and importing to Google Sheets
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
    
    // Export all albums from Supabase
    async exportFromSupabase() {
        console.log('📥 Starting Supabase export...');
        this.migration.currentStep = 'Exporting from Supabase';
        
        try {
            // Ensure app is initialized
            if (!window.albumApp || !window.albumApp.supabaseService || !window.albumApp.supabaseService.initialized) {
                throw new Error('App not initialized. Please wait for app to load completely.');
            }
            
            const supabaseClient = window.albumApp.supabaseService.client;
            
            // Get total count first
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
                console.log(`📀 Exporting batch ${Math.floor(offset/batchSize) + 1}/${Math.ceil(this.migration.totalAlbums/batchSize)}...`);
                
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
    
    // Import albums to Google Sheets
    async importToGoogleSheets(albums) {
        console.log(`📤 Starting Google Sheets import of ${albums.length} albums...`);
        this.migration.currentStep = 'Importing to Google Sheets';
        
        try {
            // Create Google Sheets service
            const sheetsService = new GoogleSheetsService();
            await sheetsService.initialize();
            
            // Import in batches (Google Sheets API limit: 100 rows per request)
            const batchSize = 100;
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
                
                // Rate limiting delay
                await new Promise(resolve => setTimeout(resolve, 1500));
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
            const sheetsAlbums = await sheetsService.getAllAlbums();
            const sheetsCount = sheetsAlbums.length;
            
            console.log(`📊 Verification Results:`);
            console.log(`   Supabase: ${this.migration.totalAlbums} albums`);
            console.log(`   Google Sheets: ${sheetsCount} albums`);
            
            if (sheetsCount === this.migration.totalAlbums) {
                console.log('✅ Migration verification PASSED!');
                return {
                    success: true,
                    supabaseCount: this.migration.totalAlbums,
                    sheetsCount: sheetsCount,
                    message: 'All albums successfully migrated!'
                };
            } else {
                console.log('❌ Migration verification FAILED!');
                return {
                    success: false,
                    supabaseCount: this.migration.totalAlbums,
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
    
    // Main migration function
    async runFullMigration() {
        if (this.migration.inProgress) {
            alert('Migration already in progress!');
            return;
        }
        
        // Check if app is ready
        if (!window.albumApp) {
            alert('❌ App not ready!\n\nPlease wait for the app to fully load before starting migration.');
            return;
        }
        
        if (!window.albumApp.supabaseService || !window.albumApp.supabaseService.initialized) {
            alert('❌ Supabase not ready!\n\nPlease wait for the app to connect to the database before starting migration.');
            return;
        }
        
        // Check Google Sheets credentials
        if (!window.SecureConfig.hasGoogleSheetsCredentials()) {
            alert('❌ Google Sheets not configured!\n\nPlease set your Google Sheets credentials first using the "🔑 Set Google Sheets Credentials" button.');
            return;
        }
        
        // Final confirmation
        const confirm = window.confirm(
            `🚀 Ready to migrate your music collection?\n\n` +
            `This will copy all ${this.migration.totalAlbums || 'your'} albums from Supabase to Google Sheets.\n\n` +
            `⏱️ Expected time: 20-25 minutes\n` +
            `⚠️ Keep this browser window open during migration\n\n` +
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
                alert(`✅ Migration Successful!\n\n${verification.message}\n\nSupabase: ${verification.supabaseCount} albums\nGoogle Sheets: ${verification.sheetsCount} albums`);
            } else {
                alert(`❌ Migration Issues Detected!\n\n${verification.message}\n\nPlease check the console for details.`);
            }
            
            return verification;
            
        } catch (error) {
            console.error('❌ Migration failed:', error);
            this.migration.inProgress = false;
            this.migration.errors.push(`Migration error: ${error.message}`);
            this.updateMigrationStatus();
            
            alert(`❌ Migration Failed!\n\nError: ${error.message}\n\nCheck console for details.`);
            return { success: false, message: error.message };
        }
    },
    
    // Update migration status display
    updateMigrationStatus() {
        const statusDiv = document.getElementById('migration-status');
        if (statusDiv) {
            statusDiv.innerHTML = `
                <div class="migration-status">
                    <h4>📊 Migration Status</h4>
                    <p><strong>Step:</strong> ${this.migration.currentStep}</p>
                    <p><strong>Total Albums:</strong> ${this.migration.totalAlbums}</p>
                    <p><strong>Exported:</strong> ${this.migration.exportedAlbums}</p>
                    <p><strong>Imported:</strong> ${this.migration.importedAlbums}</p>
                    ${this.migration.errors.length > 0 ? `<p><strong>Errors:</strong> ${this.migration.errors.length}</p>` : ''}
                    <div class="migration-progress">
                        <div class="progress-bar" style="width: ${this.migration.totalAlbums > 0 ? (this.migration.importedAlbums / this.migration.totalAlbums * 100) : 0}%"></div>
                    </div>
                </div>
            `;
        }
    },
    
    // Check if migration is ready to run
    checkMigrationReadiness() {
        console.log('⚡ Checking migration readiness...');
        
        let status = '📋 Migration Readiness Check:\n\n';
        let allReady = true;
        
        // Check app initialization
        if (window.albumApp) {
            status += '✅ App: Initialized\n';
        } else {
            status += '❌ App: Not initialized\n';
            allReady = false;
        }
        
        // Check Supabase
        if (window.albumApp?.supabaseService?.initialized) {
            status += '✅ Supabase: Connected\n';
        } else {
            status += '❌ Supabase: Not connected\n';
            allReady = false;
        }
        
        // Check Google Sheets credentials
        if (window.SecureConfig?.hasGoogleSheetsCredentials()) {
            status += '✅ Google Sheets: Credentials configured\n';
        } else {
            status += '❌ Google Sheets: Credentials missing\n';
            allReady = false;
        }
        
        // Check if collection is loaded
        if (window.albumApp?.collection?.albums?.length > 0) {
            status += `✅ Collection: ${window.albumApp.collection.albums.length} albums loaded\n`;
        } else {
            status += '❌ Collection: No albums loaded\n';
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

// Add migration UI to scraper view
window.addEventListener('load', function() {
    const scraperView = document.getElementById('scraper-view');
    if (scraperView) {
        // Create migration section
        const migrationSection = document.createElement('div');
        migrationSection.className = 'scraper-section';
        migrationSection.innerHTML = `
            <h3>🔄 Data Migration Tool</h3>
            <p>Migrate your complete music collection from Supabase to Google Sheets</p>
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
        
        // Add migration section to scraper view
        const scraperContent = scraperView.querySelector('.scraper-content');
        if (scraperContent) {
            scraperContent.insertBefore(migrationSection, scraperContent.firstChild);
        }
    }
});