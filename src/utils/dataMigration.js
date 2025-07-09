/**
 * Supabase to Google Sheets Migration Utility
 * Handles exporting all albums from Supabase and importing to Google Sheets
 *
 * This version focuses on improved architecture, UI feedback, and error handling.
 */
(function() { // Start of IIFE for scope encapsulation

    // Internal state for the migration process
    const migrationState = {
        inProgress: false,
        currentStep: '',
        totalAlbums: 0,
        exportedAlbums: 0,
        importedAlbums: 0,
        errors: [],
        startTime: null,
        endTime: null,
    };

    // Reference to the Google Sheets Service (will be initialized later)
    let sheetsServiceInstance = null;

    /**
     * Updates the migration status display in the UI.
     * @private
     */
    function updateMigrationStatusUI() {
        const statusDiv = document.getElementById('migration-status');
        if (!statusDiv) return; // Exit if status div not found

        const progress = migrationState.totalAlbums > 0 ?
            (migrationState.importedAlbums / migrationState.totalAlbums * 100) : 0;

        let timeElapsed = '';
        if (migrationState.startTime) {
            const now = migrationState.inProgress ? new Date() : migrationState.endTime || new Date();
            const elapsedMilliseconds = now.getTime() - migrationState.startTime.getTime();
            const minutes = Math.floor(elapsedMilliseconds / 60000);
            const seconds = Math.floor((elapsedMilliseconds % 60000) / 1000);
            timeElapsed = `⏱️ Time: ${minutes}m ${seconds}s`;
        }

        let errorDisplay = '';
        if (migrationState.errors.length > 0) {
            errorDisplay = `
                <p class="error-summary">
                    <strong>🚨 Errors:</strong> ${migrationState.errors.length} detected.
                    <span class="view-errors-toggle" onclick="this.nextElementSibling.classList.toggle('hidden')">View Details</span>
                    <ul class="error-list hidden">
                        ${migrationState.errors.map(err => `<li>${err}</li>`).join('')}
                    </ul>
                </p>
            `;
        }

        statusDiv.innerHTML = `
            <div class="migration-status-container">
                <h4>📊 Migration Status</h4>
                <p><strong>Step:</strong> ${migrationState.currentStep}</p>
                <p><strong>Total Albums:</strong> ${migrationState.totalAlbums || 'Estimating...'}</p>
                <p><strong>Exported:</strong> ${migrationState.exportedAlbums}</p>
                <p><strong>Imported:</strong> ${migrationState.importedAlbums}</p>
                ${timeElapsed ? `<p>${timeElapsed}</p>` : ''}
                ${errorDisplay}
                <div class="migration-progress-bar-wrapper">
                    <div class="migration-progress-bar" style="width: ${progress}%"></div>
                    <span class="progress-text">${progress.toFixed(1)}%</span>
                </div>
            </div>
        `;
    }

    /**
     * Initializes the GoogleSheetsService instance if not already initialized.
     * @private
     * @returns {Promise<GoogleSheetsService>} The initialized GoogleSheetsService instance.
     * @throws {Error} If Google Sheets credentials are not configured or service fails to initialize.
     */
    async function getInitializedGoogleSheetsService() {
        if (!window.SecureConfig || !window.SecureConfig.hasGoogleSheetsCredentials()) {
            throw new Error('Google Sheets credentials are not configured. Please set them using the "🔑 Set Google Sheets Credentials" button.');
        }

        if (!sheetsServiceInstance) {
            try {
                sheetsServiceInstance = new GoogleSheetsService();
                await sheetsServiceInstance.initialize();
                console.log('✅ GoogleSheetsService initialized.');
            } catch (error) {
                sheetsServiceInstance = null; // Reset on failure
                throw new Error(`Failed to initialize Google Sheets Service: ${error.message}`);
            }
        }
        return sheetsServiceInstance;
    }

    // The main migration utility object
    window.DataMigrationTool = {

        /**
         * Exports all albums from Supabase in batches.
         * @returns {Promise<Array<Object>>} A promise that resolves with an array of exported albums.
         */
        async exportFromSupabase() {
            console.log('📥 Starting Supabase export...');
            migrationState.currentStep = 'Exporting from Supabase';
            updateMigrationStatusUI();

            try {
                // Ensure app is initialized
                if (!window.albumApp || !window.albumApp.supabaseService || !window.albumApp.supabaseService.initialized) {
                    throw new Error('App or Supabase service not initialized. Please wait for app to load completely.');
                }

                const supabaseClient = window.albumApp.supabaseService.client;

                // Get total count first
                const { count, error: countError } = await supabaseClient
                    .from('albums')
                    .select('*', { count: 'exact', head: true });

                if (countError) {
                    throw new Error(`Failed to get album count: ${countError.message}`);
                }

                migrationState.totalAlbums = count;
                console.log(`📊 Found ${migrationState.totalAlbums} albums to export`);
                updateMigrationStatusUI();

                // Export in batches to handle large datasets
                const batchSize = 1000; // Supabase default limit is 1000
                let allAlbums = [];
                let offset = 0;

                while (offset < migrationState.totalAlbums) {
                    const currentBatchNum = Math.floor(offset / batchSize) + 1;
                    const totalBatches = Math.ceil(migrationState.totalAlbums / batchSize);
                    console.log(`📀 Exporting batch ${currentBatchNum}/${totalBatches}...`);

                    const { data: batch, error } = await supabaseClient
                        .from('albums')
                        .select('*')
                        .range(offset, offset + batchSize - 1);

                    if (error) {
                        throw new Error(`Supabase export error (batch ${currentBatchNum}): ${error.message}`);
                    }

                    allAlbums = allAlbums.concat(batch || []);
                    offset += batchSize;
                    migrationState.exportedAlbums = allAlbums.length;

                    updateMigrationStatusUI();
                }

                console.log(`✅ Successfully exported ${allAlbums.length} albums from Supabase`);
                return allAlbums;

            } catch (error) {
                console.error('❌ Supabase export failed:', error);
                migrationState.errors.push(`Export error: ${error.message}`);
                updateMigrationStatusUI();
                throw error; // Re-throw to propagate to runFullMigration
            }
        },

        /**
         * Imports albums to Google Sheets in batches.
         * @param {Array<Object>} albums - Array of album data to import.
         * @returns {Promise<number>} A promise that resolves with the number of imported albums.
         */
        async importToGoogleSheets(albums) {
            console.log(`📤 Starting Google Sheets import of ${albums.length} albums...`);
            migrationState.currentStep = 'Importing to Google Sheets';
            updateMigrationStatusUI();

            try {
                const sheetsService = await getInitializedGoogleSheetsService();

                // Import in batches (Google Sheets API best practice: around 100-500 rows per request)
                const batchSize = 100; // Keep at 100 for safety, can be increased if API allows
                let importedCount = 0;

                for (let i = 0; i < albums.length; i += batchSize) {
                    const batch = albums.slice(i, i + batchSize);
                    const batchNumber = Math.floor(i / batchSize) + 1;
                    const totalBatches = Math.ceil(albums.length / batchSize);

                    console.log(`📊 Importing batch ${batchNumber}/${totalBatches} (${batch.length} albums)...`);

                    // Convert albums to sheet rows
                    // Assumes sheetsService.albumToSheetRow exists and correctly maps album object to an array of values
                    const rows = batch.map(album => sheetsService.albumToSheetRow(album));

                    // Import batch
                    await sheetsService.batchAppendToSheet('Albums', rows); // Assumes 'Albums' is the sheet name

                    importedCount += batch.length;
                    migrationState.importedAlbums = importedCount;
                    updateMigrationStatusUI();

                    // Rate limiting delay: Respect Google Sheets API quotas (approx. 100 requests/100 seconds per user, or higher with project quota)
                    // A small delay between batches is good practice for large imports.
                    await new Promise(resolve => setTimeout(resolve, 1500));
                }

                console.log(`✅ Successfully imported ${importedCount} albums to Google Sheets`);
                return importedCount;

            } catch (error) {
                console.error('❌ Google Sheets import failed:', error);
                migrationState.errors.push(`Import error: ${error.message}`);
                updateMigrationStatusUI();
                throw error; // Re-throw to propagate to runFullMigration
            }
        },

        /**
         * Verifies the migration by comparing Supabase count with Google Sheets count.
         * @returns {Promise<Object>} A promise that resolves with verification results.
         */
        async verifyMigration() {
            console.log('🔍 Verifying migration...');
            migrationState.currentStep = 'Verifying migration';
            updateMigrationStatusUI();

            try {
                const sheetsService = await getInitializedGoogleSheetsService();

                // Get Google Sheets count
                // Assumes sheetsService.getAllAlbums fetches all records from the sheet.
                const sheetsAlbums = await sheetsService.getAllAlbums('Albums'); // Pass sheet name
                const sheetsCount = sheetsAlbums.length;

                console.log(`📊 Verification Results:`);
                console.log(`   Supabase: ${migrationState.totalAlbums} albums`);
                console.log(`   Google Sheets: ${sheetsCount} albums`);

                let success = false;
                let message = '';

                if (sheetsCount === migrationState.totalAlbums) {
                    success = true;
                    message = 'All albums successfully migrated and counts match!';
                    console.log('✅ Migration verification PASSED!');
                } else {
                    success = false;
                    message = `Count mismatch: Expected ${migrationState.totalAlbums}, found ${sheetsCount} albums in Google Sheets.`;
                    console.log('❌ Migration verification FAILED!');
                }

                return {
                    success: success,
                    supabaseCount: migrationState.totalAlbums,
                    sheetsCount: sheetsCount,
                    message: message
                };

            } catch (error) {
                console.error('❌ Migration verification failed:', error);
                migrationState.errors.push(`Verification error: ${error.message}`);
                updateMigrationStatusUI();
                return {
                    success: false,
                    message: `Verification error: ${error.message}`,
                    supabaseCount: migrationState.totalAlbums,
                    sheetsCount: 0 // Unknown count due to error
                };
            }
        },

        /**
         * Runs the full migration process from Supabase to Google Sheets.
         */
        async runFullMigration() {
            if (migrationState.inProgress) {
                console.warn('Migration already in progress, aborting new request.');
                return;
            }

            // Perform a readiness check and abort if not ready
            const readiness = this.checkMigrationReadiness(true); // true to show alert
            if (!readiness.ready) {
                return; // User has been alerted by checkMigrationReadiness
            }

            // Reset migration state
            Object.assign(migrationState, {
                inProgress: true,
                currentStep: 'Starting migration...',
                totalAlbums: 0,
                exportedAlbums: 0,
                importedAlbums: 0,
                errors: [],
                startTime: new Date(),
                endTime: null,
            });
            updateMigrationStatusUI(); // Show initial status

            const initialConfirm = window.confirm(
                `🚀 Ready to migrate your music collection?\n\n` +
                `This will copy all your albums from Supabase to Google Sheets.\n\n` +
                `⏱️ Estimated time: Varies based on collection size (e.g., 20-25 minutes for thousands).\n` +
                `⚠️ Keep this browser window open during migration.\n` +
                `🚫 Do NOT close the browser or navigate away until complete.\n\n` +
                `Continue with migration?`
            );

            if (!initialConfirm) {
                console.log('🚫 Migration cancelled by user before start.');
                migrationState.inProgress = false;
                migrationState.currentStep = 'Migration cancelled';
                migrationState.endTime = new Date();
                updateMigrationStatusUI();
                return;
            }

            try {
                console.log('🚀 Starting full migration: Supabase → Google Sheets');

                // Step 1: Export from Supabase
                const albums = await this.exportFromSupabase();

                // Step 2: Import to Google Sheets
                await this.importToGoogleSheets(albums);

                // Step 3: Verify migration
                const verification = await this.verifyMigration();

                // Finalize state
                migrationState.inProgress = false;
                migrationState.endTime = new Date();
                migrationState.currentStep = 'Migration complete';
                updateMigrationStatusUI();

                // Provide a final summary to the user
                const finalMessage = `✅ Migration Complete!\n\n` +
                                     `${verification.message}\n` +
                                     `Supabase: ${verification.supabaseCount} albums\n` +
                                     `Google Sheets: ${verification.sheetsCount} albums\n\n` +
                                     `Check the status panel for full details and any errors.`;
                alert(finalMessage);
                console.log(finalMessage); // Also log for developers

                return verification;

            } catch (error) {
                console.error('❌ Full migration failed:', error);
                migrationState.inProgress = false;
                migrationState.endTime = new Date();
                migrationState.currentStep = 'Migration failed';
                migrationState.errors.push(`Full migration error: ${error.message}`);
                updateMigrationStatusUI(); // Ensure final error is displayed

                alert(`❌ Migration Failed!\n\nError: ${error.message}\n\nPlease check the console and the migration status panel for details.`);
                return { success: false, message: error.message };
            }
        },

        /**
         * Checks if the migration tool is ready to run.
         * @param {boolean} showAlert - Whether to show an alert with the readiness status.
         * @returns {Object} An object indicating readiness and a status message.
         */
        checkMigrationReadiness(showAlert = false) {
            console.log('⚡ Checking migration readiness...');

            let statusMessages = [];
            let allReady = true;

            // Check app initialization
            if (window.albumApp) {
                statusMessages.push('✅ App: Initialized');
            } else {
                statusMessages.push('❌ App: Not initialized');
                allReady = false;
            }

            // Check Supabase
            if (window.albumApp?.supabaseService?.initialized) {
                statusMessages.push('✅ Supabase: Connected');
            } else {
                statusMessages.push('❌ Supabase: Not connected');
                allReady = false;
            }

            // Check Google Sheets credentials
            // CRITICAL SECURITY NOTE: Ensure SecureConfig retrieves/manages credentials securely (e.g., via backend, not exposed client-side).
            // For production, never expose sensitive API keys or service account credentials directly in client-side code.
            if (window.SecureConfig?.hasGoogleSheetsCredentials()) {
                statusMessages.push('✅ Google Sheets: Credentials configured');
            } else {
                statusMessages.push('❌ Google Sheets: Credentials missing or invalid');
                allReady = false;
            }

            // Check if collection is loaded (optional, but good for user expectation)
            if (window.albumApp?.collection?.albums?.length > 0) {
                statusMessages.push(`✅ Collection: ${window.albumApp.collection.albums.length} albums loaded`);
            } else {
                statusMessages.push('⚠️ Collection: No albums loaded or empty. Migration will export what Supabase has.');
            }

            let finalStatus;
            if (allReady) {
                finalStatus = '\n🚀 Ready for migration!';
            } else {
                finalStatus = '\n⚠️ Migration not ready. Please resolve the issues above.';
            }

            const fullStatus = `📋 Migration Readiness Check:\n\n${statusMessages.join('\n')}${finalStatus}`;
            console.log(fullStatus);

            if (showAlert) {
                alert(fullStatus);
            }

            return { ready: allReady, message: fullStatus };
        }
    };

    // Add migration UI to scraper view when the window loads
    window.addEventListener('load', function() {
        const scraperView = document.getElementById('scraper-view');
        if (scraperView) {
            // Create migration section
            const migrationSection = document.createElement('div');
            migrationSection.className = 'scraper-section';
            migrationSection.innerHTML = `
                <h3>🔄 Data Migration Tool</h3>
                <p>Migrate your complete music collection from Supabase to Google Sheets.</p>
                <div class="migration-controls">
                    <button id="start-migration-btn" class="primary-btn" onclick="window.DataMigrationTool.runFullMigration()">
                        🚀 Start Migration (Supabase → Google Sheets)
                    </button>
                    <button id="verify-migration-btn" class="secondary-btn" onclick="window.DataMigrationTool.verifyMigration().then(res => { alert(res.message); console.log(res); })">
                        🔍 Verify Migration
                    </button>
                    <button id="check-status-btn" class="secondary-btn" onclick="window.DataMigrationTool.checkMigrationReadiness(true)">
                        ⚡ Check Migration Readiness
                    </button>
                </div>
                <div id="migration-status"></div>
                <style>
                    /* Basic CSS for the status display */
                    .migration-status-container {
                        margin-top: 20px;
                        padding: 15px;
                        border: 1px solid #ddd;
                        border-radius: 5px;
                        background-color: #f9f9f9;
                    }
                    .migration-status-container h4 {
                        margin-top: 0;
                        color: #333;
                    }
                    .migration-status-container p {
                        margin-bottom: 5px;
                        line-height: 1.4;
                    }
                    .migration-progress-bar-wrapper {
                        width: 100%;
                        background-color: #e0e0e0;
                        border-radius: 3px;
                        overflow: hidden;
                        margin-top: 10px;
                        height: 20px;
                        position: relative;
                    }
                    .migration-progress-bar {
                        height: 100%;
                        background-color: #4CAF50; /* Green */
                        width: 0%;
                        border-radius: 3px;
                        transition: width 0.3s ease-in-out;
                        position: absolute;
                        top: 0;
                        left: 0;
                    }
                    .progress-text {
                        position: absolute;
                        width: 100%;
                        text-align: center;
                        line-height: 20px;
                        color: #333; /* Darker text for contrast */
                        font-weight: bold;
                        font-size: 0.9em;
                    }
                    .error-summary {
                        color: #d9534f; /* Red for errors */
                        font-weight: bold;
                    }
                    .error-list {
                        margin-top: 5px;
                        padding-left: 20px;
                        color: #d9534f;
                        font-size: 0.9em;
                    }
                    .error-list.hidden {
                        display: none;
                    }
                    .view-errors-toggle {
                        cursor: pointer;
                        text-decoration: underline;
                        color: #007bff; /* Blue for clickable link */
                        font-weight: normal;
                        margin-left: 10px;
                    }
                </style>
            `;

            // Add migration section to scraper view
            const scraperContent = scraperView.querySelector('.scraper-content');
            if (scraperContent) {
                scraperContent.insertBefore(migrationSection, scraperContent.firstChild);
            }

            // Initial UI update when the section is added
            updateMigrationStatusUI();
        }
    });

})(); // End of IIFE