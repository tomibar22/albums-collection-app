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
            // Get total count first
            const countResult = await window.albumApp.supabaseService.supabase
                .from('albums')
                .select('*', { count: 'exact', head: true });
            
            this.migration.totalAlbums = countResult.count;
            console.log(`📊 Found ${this.migration.totalAlbums} albums to export`);
            
            // Export in batches to handle large datasets
            const batchSize = 1000;
            let allAlbums = [];
            let offset = 0;
            
            while (offset < this.migration.totalAlbums) {
                console.log(`📀 Exporting batch ${Math.floor(offset/batchSize) + 1}/${Math.ceil(this.migration.totalAlbums/batchSize)}...`);
                
                const { data: batch, error } = await window.albumApp.supabaseService.supabase
                    .from('albums')
                    .select('*')
                    .range(offset, offset + batchSize - 1);
                
                if (error) {
                    throw new Error(`Supabase export error: ${error.message}`);
                }
                
                allAlbums = allAlbums.concat(batch);
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