// Main Application Entry Point
class AlbumCollectionApp {
    constructor() {
        this.currentView = 'albums';
        this.currentRolesTab = 'musical'; // Default to musical roles tab
        this.currentArtistsTab = 'musical'; // Default to musical artists tab
        this.savingInProgress = false; // Flag to prevent modal opening during save
        this.collection = {
            albums: [],
            artists: [],  
            tracks: [],
            roles: []
        };
        
        this.scrapedHistory = [];

        // Modal stack for nested modal navigation
        this.modalStack = [];
        
        // Main page scroll position preservation
        this.mainPageScrollPosition = 0;
        
        // Initialize Supabase service
        this.supabaseService = null;
        
        // Initialize Lazy Loading Manager
        this.lazyLoadingManager = new LazyLoadingManager();
        
        // Debounce mechanism to prevent double rendering
        this.lastArtistRenderTime = 0;
        this.artistRenderDebounceMs = 100; // 100ms debounce
        
        // Performance optimization flags
        this.artistsNeedRegeneration = true; // Flag to track when artists need to be regenerated
        
        // Selection mode state
        this.selectionMode = false;
        this.selectedAlbums = new Set(); // Store selected album IDs
        this.albumCardInstances = new Map(); // Store AlbumCard instances by ID
        
        // Search state tracking to fix search+sort interaction
        this.currentSearchQueries = {
            albums: '',
            artists: '',
            tracks: '',
            roles: ''
        };
        
        this.init();
    }

    async init() {
        try {
            // Show loading modal immediately with better messaging
            this.showLoadingModal('🎧 Albums Collection', 'Starting your music library...', 0);
            
            // Start Supabase initialization immediately (non-blocking)
            console.log('🔧 Initializing Supabase service...');
            this.updateLoadingProgress('🔗 Connecting to database...', 'Establishing secure connection...', 5);
            
            // Initialize Supabase and UI setup in parallel
            const supabasePromise = this.initializeSupabase();
            const uiPromise = this.initializeUIComponents();
            
            // Wait for both to complete
            await Promise.all([supabasePromise, uiPromise]);
            
            this.updateLoadingProgress('🎯 Interface ready', 'Loading your music collection...', 25);
            
            // Enhanced data loading with granular progress
            await this.loadDataFromSupabaseEnhanced();
            
            this.updateLoadingProgress('🎉 Collection loaded successfully', 'Welcome to your Albums Collection!', 100);
            
            // Hide loading modal with shorter delay for faster UX
            setTimeout(() => {
                this.hideLoadingModal();
            }, 800); // Reduced from 1500ms
            
            console.log('🎧 Albums Collection App initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize app:', error);
            
            // Enhanced error handling with recovery options
            this.updateLoadingProgress('⚠️ Connection failed', 'Starting in offline mode...', 60);
            
            // Fallback to in-memory mode
            console.log('⚠️ Falling back to offline mode');
            await this.initializeUIComponents();
            this.loadInitialView();
            
            // Hide loading modal
            setTimeout(() => {
                this.hideLoadingModal();
                this.showOfflineNotification();
            }, 1000);
        }
    }

    // Enhanced Supabase initialization with better error handling
    async initializeSupabase() {
        this.supabaseService = new SupabaseService();
        
        // Progressive wait with timeout
        const maxWaitTime = 5000; // 5 seconds max
        const startTime = Date.now();
        
        while (!this.supabaseService.initialized && (Date.now() - startTime) < maxWaitTime) {
            await new Promise(resolve => setTimeout(resolve, 50)); // Check every 50ms
        }
        
        if (!this.supabaseService.initialized) {
            throw new Error('Supabase initialization timeout');
        }
        
        console.log('✅ Supabase service initialized');
        this.updateLoadingProgress('✅ Database connected', 'Setting up interface...', 15);
    }

    // UI initialization separated for parallel loading
    async initializeUIComponents() {
        this.updateLoadingProgress('🎨 Setting up interface...', 'Initializing components...', 20);
        
        // Setup all UI components
        this.setupEventListeners();
        this.setupAlbumCardEvents();
        this.setupArtistCardEvents();
        this.setupScraperEvents();
        this.initializeSortControls();
        
        console.log('✅ UI components initialized');
    }

    // Enhanced data loading with granular progress tracking
    async loadDataFromSupabaseEnhanced() {
        try {
            console.log('📊 Loading data from Supabase...');
            this.updateLoadingProgress('📚 Loading albums...', 'Fetching album database...', 30);

            // Load data with individual progress tracking
            const albums = await this.loadAlbumsWithProgress();
            this.updateLoadingProgress('👥 Loading artists...', 'Fetching artist information...', 55);
            
            const [artists, tracks, roles, fetchedScrapedHistory] = await Promise.all([
                this.supabaseService.getArtists(),
                this.supabaseService.getTracks(), 
                this.supabaseService.getRoles(),
                this.supabaseService.getScrapedArtistsHistory()
            ]);

            this.updateLoadingProgress('🔄 Processing data...', 'Organizing your collection...', 80);

            // Update collection (faster assignment)
            this.collection.albums = albums;
            this.collection.artists = artists;
            // Don't use database tracks/roles - generate from albums for rich data
            // this.collection.tracks = tracks;  
            // this.collection.roles = roles;
            this.scrapedHistory = fetchedScrapedHistory;

            this.updateLoadingProgress('📊 Generating tracks...', 'Processing album tracklists...', 85);
            
            // Generate tracks and roles from albums with progress updates
            console.log('🔄 Generating tracks and roles from albums (rich data)...');
            this.collection.tracks = await this.generateTracksFromAlbumsAsync();
            
            this.updateLoadingProgress('🎭 Generating roles...', 'Processing album credits...', 88);
            this.collection.roles = await this.generateRolesFromAlbumsAsync();
            
            this.updateLoadingProgress('👥 Generating artists...', 'Processing artist relationships...', 92);
            // Generate and cache artists during startup for better performance
            this.collection.artists = this.generateArtistsFromAlbums();
            this.artistsNeedRegeneration = false; // Mark as freshly generated
            
            console.log(`✅ Generated ${this.collection.tracks.length} tracks, ${this.collection.roles.length} roles, and ${this.collection.artists.length} artists with full relationships`);

            this.updateLoadingProgress('🎯 Finalizing...', 'Preparing interface...', 90);

            // Generate collection statistics (moved to after loading)
            this.generateCollectionStats();
            
            // Update UI elements
            this.updatePageTitleCounts();
            this.loadInitialView();
            
            console.log(`✅ Data loaded: ${albums.length} albums, ${artists.length} artists, ${tracks.length} tracks, ${roles.length} roles`);
            
        } catch (error) {
            console.error('❌ Failed to load data from Supabase:', error);
            throw error;
        }
    }

    // Enhanced album loading with real-time progress
    async loadAlbumsWithProgress() {
        if (!this.supabaseService?.initialized) {
            throw new Error('Supabase service not initialized');
        }

        // First, get the total count to calculate expected batches
        this.updateLoadingProgress('📊 Calculating collection size...', 'Checking album count...', 32);
        
        const { count: totalCount, error: countError } = await this.supabaseService.client
            .from(window.CONFIG.SUPABASE.TABLES.ALBUMS)
            .select('*', { count: 'exact', head: true });

        if (countError) {
            console.warn('⚠️ Could not get exact count, proceeding with estimation');
        }

        const batchSize = 1000;
        const estimatedBatches = totalCount ? Math.ceil(totalCount / batchSize) : '?';
        
        console.log(`📊 Total albums: ${totalCount || 'unknown'}, Expected batches: ${estimatedBatches}`);

        let allAlbums = [];
        let start = 0;
        let hasMore = true;
        let batchCount = 0;

        while (hasMore) {
            batchCount++;
            
            // Enhanced progress with batch X/Y format
            const batchProgress = 30 + (batchCount * 15); // More conservative progress increment
            const batchText = estimatedBatches !== '?' 
                ? `📚 Loading batch ${batchCount}/${estimatedBatches}...`
                : `📚 Loading batch ${batchCount}...`;
            
            this.updateLoadingProgress(
                batchText,
                `${allAlbums.length} albums loaded so far...`,
                Math.min(batchProgress, 50)
            );

            const { data: batch, error } = await this.supabaseService.client
                .from(window.CONFIG.SUPABASE.TABLES.ALBUMS)
                .select('*')
                .order('year', { ascending: true })
                .range(start, start + batchSize - 1);

            if (error) throw error;

            if (batch && batch.length > 0) {
                allAlbums = allAlbums.concat(batch);
                start += batchSize;
                hasMore = batch.length === batchSize;
                
                const progressText = estimatedBatches !== '?' 
                    ? `📚 Loaded batch ${batchCount}/${estimatedBatches}: ${batch.length} albums (total: ${allAlbums.length})`
                    : `📚 Loaded batch ${batchCount}: ${batch.length} albums (total: ${allAlbums.length})`;
                    
                console.log(progressText);
            } else {
                hasMore = false;
            }
        }

        // Final confirmation with exact totals
        if (estimatedBatches !== '?' && batchCount !== estimatedBatches) {
            console.log(`📊 Actual batches: ${batchCount} (estimated: ${estimatedBatches})`);
        }

        return allAlbums;
    }

    // Optimized collection stats (moved out of critical loading path) 
    generateCollectionStats() {
        if (this.collection.albums.length === 0) return;

        // Basic year analysis (much faster)
        const years = this.collection.albums
            .filter(album => album.year)
            .map(album => album.year);
        
        if (years.length > 0) {
            const minYear = Math.min(...years);
            const maxYear = Math.max(...years);
            const post1994Count = years.filter(year => year > 1994).length;
            
            console.log(`📊 Collection stats: ${this.collection.albums.length} albums (${minYear}-${maxYear}), ${post1994Count} modern albums`);
        }
    }

    // Offline notification for failed connections
    showOfflineNotification() {
        const notification = document.createElement('div');
        notification.className = 'offline-notification';
        notification.innerHTML = `
            <div class="offline-content">
                <span class="offline-icon">📡</span>
                <span class="offline-text">Running in offline mode</span>
                <button class="offline-retry" onclick="location.reload()">🔄 Retry</button>
            </div>
        `;
        document.body.appendChild(notification);
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }

    // Loading Modal Control Methods
    showLoadingModal(message = 'Loading...', step = 'Please wait...', progress = 0) {
        const overlay = document.getElementById('loading-overlay');
        const loadingText = document.getElementById('loading-text');
        const progressStep = document.getElementById('progress-step');
        const progressFill = document.getElementById('progress-fill');
        
        if (overlay) {
            overlay.classList.remove('hidden');
            loadingText.textContent = message;
            progressStep.textContent = step;
            progressFill.style.width = `${progress}%`;
        }
    }

    updateLoadingProgress(message, step, progress, count = '') {
        const loadingText = document.getElementById('loading-text');
        const progressStep = document.getElementById('progress-step');
        const progressFill = document.getElementById('progress-fill');
        const progressCount = document.getElementById('progress-count');
        
        if (loadingText) loadingText.textContent = message;
        if (progressStep) progressStep.textContent = step;
        if (progressFill) progressFill.style.width = `${progress}%`;
        if (progressCount) progressCount.textContent = count;
    }

    hideLoadingModal() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.style.animation = 'fadeOut 0.5s ease-out forwards';
            setTimeout(() => {
                overlay.classList.add('hidden');
                overlay.style.animation = '';
            }, 500);
        }
    }

    initializeSortControls() {
        console.log('Initializing sort controls...');
        // Initialize shuffle button visibility based on default sort values
        const albumsSort = document.getElementById('albums-sort');
        const artistsSort = document.getElementById('artists-sort');
        const tracksSort = document.getElementById('tracks-sort');
        const rolesSort = document.getElementById('roles-sort');
        
        console.log('Albums sort element:', albumsSort);
        console.log('Artists sort element:', artistsSort);
        console.log('Tracks sort element:', tracksSort);
        console.log('Roles sort element:', rolesSort);
        
        if (albumsSort) {
            console.log('Albums sort value:', albumsSort.value);
            this.sortAlbums(albumsSort.value);
        }
        if (artistsSort) {
            console.log('Artists sort value:', artistsSort.value);
            this.sortArtists(artistsSort.value);
        }
        if (tracksSort) {
            console.log('Tracks sort value:', tracksSort.value);
            this.sortTracks(tracksSort.value);
        }
        if (rolesSort) {
            console.log('Roles sort value:', rolesSort.value);
            this.sortRoles(rolesSort.value);
        }
    }

    // Update page title counts
    updatePageTitleCounts() {
        console.log('🔢 Updating page title counts...');
        
        // Update Albums count
        const albumsCountEl = document.getElementById('albums-count');
        if (albumsCountEl) {
            albumsCountEl.textContent = `(${this.collection.albums.length})`;
        }
        
        // Update Artists count (total unique artists)
        const artistsCountEl = document.getElementById('artists-count');
        if (artistsCountEl) {
            artistsCountEl.textContent = `(${this.collection.artists.length})`;
        }
        
        // Update Tracks count
        const tracksCountEl = document.getElementById('tracks-count');
        if (tracksCountEl) {
            tracksCountEl.textContent = `(${this.collection.tracks.length})`;
        }
        
        // Update Roles count
        const rolesCountEl = document.getElementById('roles-count');
        if (rolesCountEl) {
            rolesCountEl.textContent = `(${this.collection.roles.length})`;
        }
        
        console.log(`📊 Updated counts - Albums: ${this.collection.albums.length}, Artists: ${this.collection.artists.length}, Tracks: ${this.collection.tracks.length}, Roles: ${this.collection.roles.length}`);
    }

    setupEventListeners() {
        // Navigation event listeners
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = e.target.getAttribute('data-view');
                this.switchView(view);
            });
        });

        // Modal event listeners
        const modal = document.getElementById('more-info-modal');
        const closeModal = document.getElementById('close-modal');
        
        closeModal.addEventListener('click', () => this.closeModal());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.closeModal();
        });

        // Escape key to close modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeModal();
        });

        // Sort event listeners
        const albumsSort = document.getElementById('albums-sort');
        const artistsSort = document.getElementById('artists-sort');
        
        if (albumsSort) {
            albumsSort.addEventListener('change', (e) => {
                console.log('Albums sort change event fired:', e.target.value);
                this.sortAlbums(e.target.value);
            });
        }

        if (artistsSort) {
            artistsSort.addEventListener('change', (e) => {
                console.log('Artists sort change event fired:', e.target.value);
                this.sortArtists(e.target.value);
            });
        }

        const tracksSort = document.getElementById('tracks-sort');
        const rolesSort = document.getElementById('roles-sort');
        
        if (tracksSort) {
            tracksSort.addEventListener('change', (e) => {
                console.log('Tracks sort change event fired:', e.target.value);
                this.sortTracks(e.target.value);
            });
        }

        if (rolesSort) {
            rolesSort.addEventListener('change', (e) => {
                console.log('Roles sort change event fired:', e.target.value);
                this.sortRoles(e.target.value);
            });
        }

        // Shuffle buttons
        const shuffleAlbumsBtn = document.getElementById('shuffle-albums');
        const shuffleArtistsBtn = document.getElementById('shuffle-artists');
        
        if (shuffleAlbumsBtn) {
            shuffleAlbumsBtn.addEventListener('click', () => {
                console.log('Albums shuffle button clicked');
                this.shuffleAlbums();
            });
        }

        if (shuffleArtistsBtn) {
            shuffleArtistsBtn.addEventListener('click', () => {
                console.log('Artists shuffle button clicked');
                this.shuffleArtists();
            });
        }

        // Search event listeners
        this.setupSearchEventListeners();
        
        // Selection mode event listeners
        this.setupSelectionEventListeners();
    }

    setupSelectionEventListeners() {
        // Select mode toggle button
        const selectModeToggle = document.getElementById('select-mode-toggle');
        if (selectModeToggle) {
            selectModeToggle.addEventListener('click', () => {
                this.toggleSelectionMode();
            });
        }

        // Select all button
        const selectAllBtn = document.getElementById('select-all-albums');
        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', () => {
                this.selectAllAlbums();
            });
        }

        // Delete selected button
        const deleteSelectedBtn = document.getElementById('delete-selected-albums');
        if (deleteSelectedBtn) {
            deleteSelectedBtn.addEventListener('click', () => {
                this.deleteSelectedAlbums();
            });
        }

        // Cancel selection button
        const cancelSelectionBtn = document.getElementById('cancel-selection');
        if (cancelSelectionBtn) {
            cancelSelectionBtn.addEventListener('click', () => {
                this.cancelSelection();
            });
        }
    }

    // Album Card Rendering and Management with Lazy Loading
    renderAlbumsGrid() {
        const albumsGrid = document.getElementById('albums-grid');
        
        if (this.collection.albums.length === 0) {
            this.displayEmptyState('albums');
            return;
        }
        
        // 🔍 DEBUG: Check what albums are being rendered
        const post1994Albums = this.collection.albums.filter(album => album.year > 1994);
        console.log(`🔍 DEBUG: Rendering albums grid:`);
        console.log(`   Total albums in collection: ${this.collection.albums.length}`);
        console.log(`   Albums after 1994 in collection: ${post1994Albums.length}`);
        if (post1994Albums.length > 0) {
            console.log(`   Sample post-1994 albums:`, post1994Albums.slice(0, 5).map(a => `${a.title} (${a.year})`));
        }
        
        // Clear existing card instances
        this.albumCardInstances.clear();
        
        // Add optimized grid class for performance
        albumsGrid.classList.add('optimized-grid');
        
        // Initialize lazy loading for albums grid
        const albumRenderFunction = (albumData, index) => {
            const options = {
                selectionMode: this.selectionMode,
                selected: this.selectedAlbums.has(albumData.id),
                onSelectionChange: (albumId, isSelected) => {
                    this.handleAlbumSelectionChange(albumId, isSelected);
                }
            };
            const albumCard = new AlbumCard(albumData, options);
            const cardElement = albumCard.render();
            cardElement.classList.add('grid-item');
            
            // Store the card instance for later reference
            this.albumCardInstances.set(albumData.id, albumCard);
            
            return cardElement;
        };
        
        this.lazyLoadingManager.initializeLazyGrid('albums-grid', this.collection.albums, albumRenderFunction, {
            itemsPerPage: 20,
            loadingMessage: '🎵 Loading more albums...',
            noMoreMessage: '✅ All albums loaded'
        });
        
        console.log(`🚀 Lazy loading initialized for ${this.collection.albums.length} albums`);
    }

    // ===== ALBUM SELECTION MODE METHODS =====

    /**
     * Toggle selection mode on/off
     */
    toggleSelectionMode() {
        this.selectionMode = !this.selectionMode;
        
        const selectModeToggle = document.getElementById('select-mode-toggle');
        const selectionControls = document.getElementById('selection-controls');
        
        if (this.selectionMode) {
            // Enable selection mode
            selectModeToggle.classList.add('active');
            selectModeToggle.innerHTML = '✖️ Cancel';
            selectionControls.classList.remove('hidden');
            
            // Enable selection on all visible album cards
            this.albumCardInstances.forEach((card, albumId) => {
                card.enableSelectionMode();
            });
            
            console.log('🔵 Selection mode enabled');
        } else {
            // Disable selection mode
            this.cancelSelection();
        }
        
        this.updateSelectionUI();
    }

    /**
     * Cancel selection mode and clear selections
     */
    cancelSelection() {
        this.selectionMode = false;
        this.selectedAlbums.clear();
        
        const selectModeToggle = document.getElementById('select-mode-toggle');
        const selectionControls = document.getElementById('selection-controls');
        
        selectModeToggle.classList.remove('active');
        selectModeToggle.innerHTML = '📋 Select';
        selectionControls.classList.add('hidden');
        
        // Disable selection on all album cards
        this.albumCardInstances.forEach(card => {
            card.disableSelectionMode();
        });
        
        this.updateSelectionUI();
        console.log('🔴 Selection mode cancelled');
    }

    /**
     * Handle selection change for individual albums
     */
    handleAlbumSelectionChange(albumId, isSelected) {
        if (isSelected) {
            this.selectedAlbums.add(albumId);
        } else {
            this.selectedAlbums.delete(albumId);
        }
        
        this.updateSelectionUI();
        console.log(`Album ${albumId} ${isSelected ? 'selected' : 'deselected'}. Total selected: ${this.selectedAlbums.size}`);
    }

    /**
     * Select all visible albums
     */
    selectAllAlbums() {
        // Add all album IDs to selected set
        this.collection.albums.forEach(album => {
            this.selectedAlbums.add(album.id);
        });
        
        // Update all card instances
        this.albumCardInstances.forEach((card, albumId) => {
            card.setSelected(true);
        });
        
        this.updateSelectionUI();
        console.log(`🔵 Selected all ${this.selectedAlbums.size} albums`);
    }

    /**
     * Delete selected albums
     */
    async deleteSelectedAlbums() {
        if (this.selectedAlbums.size === 0) {
            alert('No albums selected for deletion.');
            return;
        }

        const selectedCount = this.selectedAlbums.size;
        const confirmMessage = `Are you sure you want to delete ${selectedCount} selected album${selectedCount > 1 ? 's' : ''}?\n\nThis action cannot be undone.`;
        
        if (!confirm(confirmMessage)) {
            return;
        }

        try {
            // Show loading state
            this.showLoading('Deleting selected albums...');
            
            const deletedAlbums = [];
            const selectedIds = Array.from(this.selectedAlbums);
            
            // Delete from Supabase
            for (const albumId of selectedIds) {
                try {
                    await this.supabaseService.deleteAlbum(albumId);
                    deletedAlbums.push(albumId);
                } catch (error) {
                    console.error(`❌ Failed to delete album ${albumId}:`, error);
                }
            }
            
            // Update local collection
            this.collection.albums = this.collection.albums.filter(
                album => !deletedAlbums.includes(album.id)
            );
            
            // Clear selection and exit selection mode
            this.cancelSelection();
            
            // Regenerate collection data and refresh views
            await this.regenerateCollectionData();
            this.refreshCurrentView();
            
            // Hide loading overlay
            this.hideLoading();
            
            // Show success message
            const deletedCount = deletedAlbums.length;
            const failedCount = selectedCount - deletedCount;
            
            let message = `✅ Successfully deleted ${deletedCount} album${deletedCount > 1 ? 's' : ''}`;
            if (failedCount > 0) {
                message += `\n⚠️ Failed to delete ${failedCount} album${failedCount > 1 ? 's' : ''}`;
            }
            
            alert(message);
            console.log(`🗑️ Deleted ${deletedCount} albums, ${failedCount} failed`);
            
        } catch (error) {
            console.error('Error deleting selected albums:', error);
            this.hideLoading();
            alert('An error occurred while deleting albums. Please try again.');
        }
    }

    /**
     * Update selection UI components
     */
    updateSelectionUI() {
        const selectedCount = this.selectedAlbums.size;
        const selectedCountElement = document.getElementById('selected-count');
        const deleteSelectedBtn = document.getElementById('delete-selected-albums');
        
        if (selectedCountElement) {
            selectedCountElement.textContent = selectedCount;
        }
        
        if (deleteSelectedBtn) {
            deleteSelectedBtn.disabled = selectedCount === 0;
        }
    }
    
    // Artist Card Rendering and Management with Tabs
    renderArtistsGrid() {
        // Check if artists need to be regenerated
        if (!this.collection.artists || this.collection.artists.length === 0 || this.artistsNeedRegeneration) {
            console.log('🎭 Generating artists from albums (first time or flagged for regeneration)...');
            // Generate and categorize artists from current albums
            this.collection.artists = this.generateArtistsFromAlbums();
            this.artistsNeedRegeneration = false; // Reset flag
        } else {
            console.log('🎭 Using cached artists for performance');
        }
        
        if (this.collection.artists.length === 0) {
            this.displayEmptyState('artists');
            return;
        }
        
        // Use categorized artists (stored in generateArtistsFromAlbums)
        const musicalArtists = this.musicalArtists || [];
        const technicalArtists = this.technicalArtists || [];
        
        console.log(`🎵 Separated artists: ${musicalArtists.length} musical, ${technicalArtists.length} technical`);
        
        // Update tab counts
        document.getElementById('musical-artists-count').textContent = `(${musicalArtists.length})`;
        document.getElementById('technical-artists-count').textContent = `(${technicalArtists.length})`;
        
        // Store artists for tab switching
        this.musicalArtists = musicalArtists;
        this.technicalArtists = technicalArtists;
        
        // Render the active tab content
        this.renderActiveArtistsTab();
        
        // Initialize batch image loading for visible artists (disabled temporarily for debugging)
        // this.initializeArtistImageLoading();
        
        console.log(`✅ Rendered ${this.collection.artists.length} artists in tabbed interface`);
    }
    
    // Render the currently active artists tab with Lazy Loading
    renderActiveArtistsTab() {
        // Debounce mechanism to prevent double rendering
        const now = Date.now();
        if (now - this.lastArtistRenderTime < this.artistRenderDebounceMs) {
            console.log(`🎭 DEBUG: Debouncing artist render (${now - this.lastArtistRenderTime}ms since last render)`);
            return;
        }
        this.lastArtistRenderTime = now;
        
        console.log(`🎭 DEBUG: renderActiveArtistsTab called, currentArtistsTab = ${this.currentArtistsTab}`);
        
        const activeTab = this.currentArtistsTab || 'musical';
        const artists = activeTab === 'musical' ? this.musicalArtists : this.technicalArtists;
        const gridId = activeTab === 'musical' ? 'musical-artists-grid' : 'technical-artists-grid';
        const grid = document.getElementById(gridId);
        
        console.log(`🎭 DEBUG: Rendering ${activeTab} tab with ${artists ? artists.length : 0} artists, gridId = ${gridId}`);
        
        if (!grid) {
            console.error(`❌ Grid not found: ${gridId}`);
            return;
        }
        
        // Add optimized grid class for performance
        grid.classList.add('optimized-grid');
        
        if (!artists || artists.length === 0) {
            const emptyMessage = activeTab === 'musical' 
                ? 'No musical artists found' 
                : 'No technical contributors found';
            grid.innerHTML = `<div class="empty-state">${emptyMessage}</div>`;
            return;
        }
        
        // Initialize lazy loading for artists grid
        const artistRenderFunction = (artistData, index) => {
            const artistCard = new ArtistCard(artistData, activeTab, index); // Pass tab context and position for image optimization
            const cardElement = artistCard.render();
            cardElement.classList.add('grid-item');
            return cardElement;
        };
        
        const tabLabel = activeTab === 'musical' ? 'Musical Artists' : 'Technical Contributors';
        console.log(`🎭 DEBUG: About to initialize lazy grid for ${gridId} with ${artists.length} artists`);
        
        this.lazyLoadingManager.initializeLazyGrid(gridId, artists, artistRenderFunction, {
            itemsPerPage: 16,
            loadingMessage: `🎭 Loading more ${tabLabel.toLowerCase()}...`,
            noMoreMessage: `✅ All ${tabLabel.toLowerCase()} loaded`
        });
        
        console.log(`🚀 DEBUG: Lazy loading initialized for ${artists.length} ${activeTab} artist cards in ${gridId}`);
    }
    
    // Switch between artists tabs
    switchArtistsTab(tabType) {
        console.log(`🔄 Switching to ${tabType} artists tab`);
        
        // Update current tab
        this.currentArtistsTab = tabType;
        
        // Update tab buttons
        const tabs = document.querySelectorAll('.artist-tab-btn');
        tabs.forEach(tab => {
            if (tab.dataset.tab === tabType) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
        
        // Update tab content
        const musicalContent = document.getElementById('musical-artists-tab');
        const technicalContent = document.getElementById('technical-artists-tab');
        
        if (tabType === 'musical') {
            musicalContent.classList.add('active');
            technicalContent.classList.remove('active');
        } else {
            technicalContent.classList.add('active');
            musicalContent.classList.remove('active');
        }
        
        // Render the new active tab
        this.renderActiveArtistsTab();
        
        // Ensure intersection observer is set up after tab becomes visible
        // Small delay to allow CSS transitions to complete
        setTimeout(() => {
            const activeGridId = tabType === 'musical' ? 'musical-artists-grid' : 'technical-artists-grid';
            
            if (this.lazyLoadingManager) {
                // Use the new reinitializeObserver method for clean re-setup
                this.lazyLoadingManager.reinitializeObserver(activeGridId);
            }
        }, 100);
        
        // Load images for newly visible artists in the active tab
        this.loadImagesForActiveTab(tabType);
    }
    
    // Helper function to clean role names by removing brackets and filtering invalid roles
    // Only cleans brackets for musical roles; technical roles keep their brackets
    cleanRoleName(roleName, shouldCleanBrackets = null) {
        if (!roleName || typeof roleName !== 'string') return roleName;
        
        // Determine if we should clean brackets based on role category
        if (shouldCleanBrackets === null) {
            shouldCleanBrackets = this.shouldCleanRoleBrackets(roleName);
        }
        
        let cleaned = roleName;
        
        // Only remove brackets for musical roles
        if (shouldCleanBrackets) {
            cleaned = cleaned
                // Remove content in brackets like [uncredited], [Recording], etc.
                .replace(/\s*\[.*?\]/g, '')
                // Remove malformed closing brackets without opening ones
                .replace(/\s*\]$/g, '')
                // Remove malformed opening brackets without closing ones
                .replace(/^\[\s*/g, '');
        }
        
        cleaned = cleaned.trim();
        
        // Filter out company names and invalid roles
        const companyIndicators = [
            'company', 'corporation', 'corp', 'inc', 'ltd', 'llc',
            'records', 'recording', 'studios', 'studio', 'sound',
            'entertainment', 'music', 'productions'
        ];
        
        // Check if this looks like a company name rather than a role
        const lowerCleaned = cleaned.toLowerCase();
        const isCompanyName = companyIndicators.some(indicator => 
            lowerCleaned.includes(indicator) && 
            (lowerCleaned.endsWith(indicator) || lowerCleaned.includes(indicator + ' '))
        );
        
        // Filter out obvious company names
        if (isCompanyName) {
            return null; // Signal that this should be filtered out
        }
        
        // Return cleaned role
        return cleaned;
    }

    // Helper function to determine if brackets should be cleaned from a role
    shouldCleanRoleBrackets(roleName) {
        if (!roleName || typeof roleName !== 'string') return false;
        
        // Use role categorizer to determine if this is a musical or technical role
        if (window.roleCategorizer) {
            // For categorization, temporarily remove brackets to get the core role
            const coreRole = roleName.replace(/\s*\[.*?\]/g, '').trim();
            const category = window.roleCategorizer.categorizeRole(coreRole);
            
            // Only clean brackets for musical roles
            return category === 'musical';
        }
        
        // Fallback: default to cleaning brackets (preserve existing behavior)
        return true;
    }

    // Extract specific instruments from bracketed role details
    extractSpecificInstruments(roleName) {
        if (!roleName || typeof roleName !== 'string') return [];
        
        const instruments = [];
        const bracketRegex = /\[([^\]]+)\]/g;
        let match;
        
        while ((match = bracketRegex.exec(roleName)) !== null) {
            const bracketContent = match[1].trim();
            
            // Skip non-instrument brackets - enhanced filtering
            const skipWords = [
                'uncredited', 'recording', 'additional', 'overdubs', 'solo', 'backing',
                'album', 'track', 'side', 'disc', 'cd', 'lp', 'ep', 'single',
                'original', 'remaster', 'remix', 'edit', 'version', 'take',
                'bonus', 'hidden', 'instrumental', 'vocal', 'demo', 'live',
                'session', 'studio', 'concert', 'performance', 'mix', 'master'
            ];
            
            // Also skip if it's just a year (4 digits) or side indicator (single letter/number)
            if (/^\d{4}$/.test(bracketContent) || /^[a-d]$/i.test(bracketContent) || /^\d{1,2}$/.test(bracketContent)) {
                continue;
            }
            
            if (skipWords.some(word => bracketContent.toLowerCase().includes(word))) {
                continue;
            }
            
            // Extract specific instrument models and brands
            const instrumentPatterns = [
                // Synthesizers
                /\b(DX7|DX\s*7|DXIIFD|DX\s*1|DX\s*21|DX\s*27|DX\s*100)\b/i,
                /\b(Moog|Mini-?moog|Micro-?moog|Poly-?moog)\b/i,
                /\b(Prophet\s*5?|Prophet\s*V)\b/i,
                /\b(Oberheim[^,]*|Matrix\s*12|OB[X\d]+)\b/i,
                /\b(ARP\s*Odyssey|ARP\s*2600|ARP\s*String|ARP\s*Soloist)\b/i,
                /\b(Jupiter\s*8?|Juno\s*106?|JV\s*1000)\b/i,
                /\b(Fairlight\s*CM[I]+)\b/i,
                /\b(Yamaha\s*CS[-\d]+|CS[-\d]+)\b/i,
                
                // Piano types
                /\b(Fender\s*Rhodes|Rhodes\s*[^,]*|Electric\s*Piano)\b/i,
                /\b(Acoustic\s*Piano|Grand\s*Piano|Upright\s*Piano)\b/i,
                /\b(Steinway|Baldwin|Yamaha\s*Grand)\b/i,
                /\b(Clavinet|Hohner\s*D6?)\b/i,
                
                // Other instruments
                /\b(Hammond\s*B3?|Hammond\s*Organ)\b/i,
                /\b(Vocoder|Talk\s*Box)\b/i,
                /\b(Mellotron)\b/i
            ];
            
            // Check each pattern
            instrumentPatterns.forEach(pattern => {
                const matches = bracketContent.match(pattern);
                if (matches) {
                    instruments.push(matches[0].trim());
                }
            });
            
            // Also add the full bracket content if it looks like an instrument
            if (this.looksLikeInstrument(bracketContent)) {
                instruments.push(bracketContent);
            }
        }
        
        return [...new Set(instruments)]; // Remove duplicates
    }

    // Check if text looks like an instrument name
    looksLikeInstrument(text) {
        if (!text || typeof text !== 'string') return false;
        
        const lowerText = text.toLowerCase().trim();
        
        // First, filter out obvious non-instruments
        const invalidTerms = [
            // Years
            /^\d{4}$/, // Four digit years like "1994"
            /^\d{2}$/, // Two digit years like "94"
            
            // Generic music terms that are not instruments
            /^(album|track|side|disc|cd|lp|ep|single|compilation)$/,
            /^(recording|session|studio|live|concert|performance)$/,
            /^(original|remaster|remix|edit|version|take|alternate)$/,
            /^(bonus|hidden|secret|instrumental|vocal|demo)$/,
            /^(a|b|c|d|1|2|3|4|5|6|7|8|9|10)$/, // Side/track indicators
            
            // Common production terms
            /^(mix|master|overdub|dub|additional|backing|solo)$/,
            /^(uncredited|credited|featuring|with|and|or)$/,
            
            // Time/date indicators  
            /^(am|pm|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)$/,
            /^\d{1,2}:\d{2}$/, // Time formats like "12:30"
        ];
        
        // Check if text matches any invalid pattern
        if (invalidTerms.some(pattern => pattern.test(lowerText))) {
            return false;
        }
        
        // Now check for valid instrument keywords
        const instrumentKeywords = [
            'piano', 'synthesizer', 'synth', 'keyboard', 'organ', 'moog', 'rhodes',
            'clavinet', 'vocoder', 'mellotron', 'hammond', 'dx', 'prophet', 'oberheim',
            'arp', 'jupiter', 'juno', 'fairlight', 'yamaha', 'roland', 'korg',
            'acoustic', 'electric', 'fender', 'hohner', 'steinway', 'bass', 'guitar',
            'drums', 'percussion', 'saxophone', 'trumpet', 'violin', 'cello'
        ];
        
        // Must contain at least one instrument keyword and not be in invalid list
        return instrumentKeywords.some(keyword => lowerText.includes(keyword));
    }
    
    // Generate artist data from album credits instead of basic artist field
    generateArtistsFromAlbums() {
        const artistMap = new Map();
        
        console.log(`🎭 Extracting artists from credits of ${this.collection.albums.length} albums...`);
        
        // Extract artists from album credits
        this.collection.albums.forEach(album => {
            // Use comprehensive processed credits instead of raw album-level only credits
            let creditsToProcess = [];
            
            if (album.credits && Array.isArray(album.credits)) {
                // PREFERRED: Use processed comprehensive credits (includes both album-level AND track-level)
                album.credits.forEach(consolidatedCredit => {
                    // Split consolidated roles like "Piano (Track A), Guitar (Track B)" back into individual roles
                    const rolesPart = consolidatedCredit.role || '';
                    const individualRoles = this.extractIndividualRoles(rolesPart);
                    
                    individualRoles.forEach(role => {
                        creditsToProcess.push({
                            name: consolidatedCredit.name,
                            role: role,
                            id: consolidatedCredit.id
                        });
                    });
                });
                console.log(`📀 Processing comprehensive credits for "${album.title}" (${creditsToProcess.length} individual roles from album+track credits)`);
            } else if (album._rawData && album._rawData.extraartists) {
                // FALLBACK: Use raw extraartists (album-level only - may miss track-level musical roles)
                creditsToProcess = album._rawData.extraartists.map(credit => ({
                    name: credit.name,
                    role: credit.role,
                    id: credit.id
                }));
                console.log(`📀 Processing raw album-level credits for "${album.title}" (${creditsToProcess.length} raw credits - WARNING: may miss track-level roles)`);
            } else {
                console.log(`⚠️ No credits found for "${album.title}"`);
                return;
            }
            
            creditsToProcess.forEach(credit => {
                const artistName = credit.name;
                const rawRole = credit.role;
                const cleanRole = this.cleanRoleName(rawRole); // Clean role name by removing brackets
                
                // Extract specific instruments as additional roles
                const specificInstruments = this.extractSpecificInstruments(rawRole);
                
                // Create list of all roles (cleaned + specific instruments)
                const allRoles = [];
                if (cleanRole) allRoles.push(cleanRole);
                specificInstruments.forEach(instrument => {
                    if (instrument) allRoles.push(instrument);
                });
                
                // Include everyone with a name and role - no filtering!
                if (artistName && allRoles.length > 0) {
                    console.log(`   🎵 Found artist: ${artistName} (${allRoles.join(', ')})`);
                    
                    // Categorize roles on this album for this artist
                    const musicalRolesOnAlbum = allRoles.filter(role => window.roleCategorizer.categorizeRole(role) === 'musical');
                    const technicalRolesOnAlbum = allRoles.filter(role => window.roleCategorizer.categorizeRole(role) === 'technical');
                    
                    if (artistMap.has(artistName)) {
                        // Update existing artist
                        const existingArtist = artistMap.get(artistName);
                        
                        // Only increment album counts if this album isn't already counted for this artist
                        const albumAlreadyExists = existingArtist.albums.some(existingAlbum => existingAlbum.id === album.id);
                        if (!albumAlreadyExists) {
                            existingArtist.albumCount++;
                            existingArtist.albums.push(album);
                            
                            // Calculate separate counts based on role types on this album
                            if (musicalRolesOnAlbum.length > 0) {
                                existingArtist.musicalAlbumCount++;
                                existingArtist.musicalAlbums.push(album);
                            }
                            if (technicalRolesOnAlbum.length > 0) {
                                existingArtist.technicalAlbumCount++;
                                existingArtist.technicalAlbums.push(album);
                            }
                            
                            console.log(`     📈 Added new album for ${artistName} (total: ${existingArtist.albumCount}, musical: ${existingArtist.musicalAlbumCount}, technical: ${existingArtist.technicalAlbumCount})`);
                        } else {
                            console.log(`     🔄 Album "${album.title}" already counted for ${artistName}, adding only role`);
                        }
                        
                        // Track role frequency for sorting (using all roles)
                        allRoles.forEach(role => {
                            if (existingArtist.roleFrequency.has(role)) {
                                existingArtist.roleFrequency.set(role, existingArtist.roleFrequency.get(role) + 1);
                            } else {
                                existingArtist.roleFrequency.set(role, 1);
                            }
                        });
                        
                        // Rebuild sorted roles array based on frequency
                        const sortedRoles = Array.from(existingArtist.roleFrequency.entries())
                            .sort((a, b) => b[1] - a[1]) // Sort by frequency (descending)
                            .map(entry => entry[0]); // Extract role names
                        
                        existingArtist.roles = sortedRoles;
                        
                        console.log(`     🎭 Roles by frequency: ${sortedRoles.slice(0, 3).join(', ')}${sortedRoles.length > 3 ? ` (+${sortedRoles.length - 3} more)` : ''}`);
                    } else {
                        // Create new artist entry with role frequency tracking and separate album counts
                        const roleFrequency = new Map();
                        allRoles.forEach(role => {
                            roleFrequency.set(role, 1);
                        });
                        
                        // Categorize roles for separate counting
                        const musicalRolesOnAlbum = allRoles.filter(role => window.roleCategorizer.categorizeRole(role) === 'musical');
                        const technicalRolesOnAlbum = allRoles.filter(role => window.roleCategorizer.categorizeRole(role) === 'technical');
                        
                        const newArtist = {
                            id: `artist-${artistName.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')}`,
                            name: artistName,
                            albumCount: 1,
                            albums: [album],
                            // NEW: Separate counts for musical vs technical contributions
                            musicalAlbumCount: musicalRolesOnAlbum.length > 0 ? 1 : 0,
                            technicalAlbumCount: technicalRolesOnAlbum.length > 0 ? 1 : 0,
                            musicalAlbums: musicalRolesOnAlbum.length > 0 ? [album] : [],
                            technicalAlbums: technicalRolesOnAlbum.length > 0 ? [album] : [],
                            roles: allRoles, // Use all roles (cleaned + specific instruments)
                            roleFrequency: roleFrequency, // Track frequency for sorting
                            image: null,
                            discogsId: credit.id || null
                        };
                        
                        artistMap.set(artistName, newArtist);
                        console.log(`     ✨ Created new artist ${artistName} (musical: ${newArtist.musicalAlbumCount}, technical: ${newArtist.technicalAlbumCount})`);
                    }
                } else {
                    console.log(`   ⚠️ Skipping incomplete credit: ${artistName || 'No name'} (${cleanRole || 'No role'})`);
                }
            });
        });
        
        // Convert map to array and finalize role sorting by frequency
        const artists = Array.from(artistMap.values()).map(artist => {
            // Ensure roles are sorted by frequency and remove the roleFrequency map
            if (artist.roleFrequency) {
                artist.roles = Array.from(artist.roleFrequency.entries())
                    .sort((a, b) => b[1] - a[1]) // Sort by frequency (descending)
                    .map(entry => entry[0]); // Extract role names
                
                // Clean up the roleFrequency map as it's no longer needed
                delete artist.roleFrequency;
            }
            return artist;
        });
        
        console.log(`📊 Generated ${artists.length} total artists from album credits`);
        
        // Categorize artists based on their roles
        const { musicalArtists, technicalArtists } = this.categorizeArtistsByRoles(artists);
        
        console.log(`🎵 Musical artists: ${musicalArtists.length} (have at least one musical role)`);
        console.log(`🔧 Technical contributors: ${technicalArtists.length} (have at least one technical role)`);
        console.log(`👥 Note: Artists with both role types appear in both tabs`);
        
        // Store categorized artists
        this.musicalArtists = musicalArtists;
        this.technicalArtists = technicalArtists;
        
        // Create backup arrays for search functionality
        this.originalMusicalArtists = [...musicalArtists];
        this.originalTechnicalArtists = [...technicalArtists];
        
        // Return all artists for backward compatibility
        return artists;
    }

    // Initialize artist image loading with batch processing and lazy loading
    async initializeArtistImageLoading() {
        try {
            // Check if ImageService is available
            if (!window.ImageService) {
                console.warn('🖼️ ImageService not available - skipping image loading');
                return;
            }

            const imageService = new window.ImageService();
            const allArtists = [...(this.musicalArtists || []), ...(this.technicalArtists || [])];
            
            if (allArtists.length === 0) {
                console.log('🖼️ No artists to load images for');
                return;
            }

            console.log(`🖼️ Starting batch image loading for ${allArtists.length} artists`);

            // Filter artists that don't already have images
            const artistsNeedingImages = allArtists.filter(artist => !artist.image || artist.image === '');
            
            if (artistsNeedingImages.length === 0) {
                console.log('🖼️ All artists already have images');
                return;
            }

            console.log(`🖼️ Loading images for ${artistsNeedingImages.length} artists without images`);

            // Start batch loading in background (non-blocking)
            this.batchLoadArtistImages(imageService, artistsNeedingImages);

        } catch (error) {
            console.error('❌ Error initializing artist image loading:', error);
        }
    }

    // Batch load artist images in the background
    async batchLoadArtistImages(imageService, artists) {
        try {
            const startTime = Date.now();
            let successCount = 0;
            let errorCount = 0;

            // Process artists in small batches to avoid overwhelming APIs
            const batchSize = 3; // Conservative batch size to respect rate limits
            
            for (let i = 0; i < artists.length; i += batchSize) {
                const batch = artists.slice(i, i + batchSize);
                
                // Process batch with individual error handling
                const promises = batch.map(async (artist) => {
                    try {
                        // Ensure artist object and name are valid
                        if (!artist || !artist.name || typeof artist.name !== 'string') {
                            console.warn(`⚠️ Skipping invalid artist:`, artist);
                            return { artist, success: false, error: 'Invalid artist name' };
                        }

                        const imageUrl = await imageService.fetchArtistImage(artist.name);
                        
                        if (imageUrl) {
                            // Update artist data
                            artist.image = imageUrl;
                            
                            // Update the UI if the artist card is currently visible
                            this.updateArtistCardImage(artist, imageUrl);
                            
                            successCount++;
                            console.log(`✅ Loaded image for ${artist.name}`);
                        }
                        
                        return { artist, success: !!imageUrl };
                    } catch (error) {
                        errorCount++;
                        const artistName = artist?.name || 'Unknown Artist';
                        console.warn(`⚠️ Failed to load image for ${artistName}:`, error.message);
                        return { artist, success: false, error };
                    }
                });

                // Wait for batch to complete
                await Promise.all(promises);

                // Add delay between batches to respect rate limits
                if (i + batchSize < artists.length) {
                    await this.sleep(2000); // 2 second delay between batches
                }
            }

            const duration = Math.round((Date.now() - startTime) / 1000);
            console.log(`🖼️ Batch image loading completed in ${duration}s. Success: ${successCount}, Errors: ${errorCount}`);

        } catch (error) {
            console.error('❌ Error in batch image loading:', error);
        }
    }

    // Update artist card image in the UI
    updateArtistCardImage(artist, imageUrl) {
        try {
            // Validate inputs
            if (!artist || !artist.id || !imageUrl) {
                console.warn('🖼️ Invalid parameters for updateArtistCardImage:', { artist, imageUrl });
                return;
            }

            // Find artist cards in both musical and technical grids
            const grids = ['musical-artists-grid', 'technical-artists-grid'];
            
            for (const gridId of grids) {
                const grid = document.getElementById(gridId);
                if (!grid) continue;
                
                // Find artist card by data attribute
                const artistCard = grid.querySelector(`[data-artist-id="${artist.id}"]`);
                if (!artistCard) continue;
                
                const imgElement = artistCard.querySelector('.artist-photo');
                const placeholderElement = artistCard.querySelector('.artist-placeholder');
                
                if (imgElement && placeholderElement) {
                    imgElement.src = imageUrl;
                    imgElement.style.display = 'block';
                    placeholderElement.style.display = 'none';
                    
                    // Add a subtle fade-in effect
                    imgElement.style.opacity = '0';
                    imgElement.onload = () => {
                        imgElement.style.transition = 'opacity 0.3s ease-in-out';
                        imgElement.style.opacity = '1';
                    };
                    
                    console.log(`✅ Updated UI image for ${artist.name || 'Unknown Artist'}`);
                }
            }
        } catch (error) {
            const artistName = artist?.name || 'Unknown Artist';
            console.error(`❌ Error updating image for ${artistName}:`, error);
        }
    }

    // Utility sleep function for rate limiting
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Utility function to escape HTML attributes
    escapeHtmlAttribute(str) {
        if (!str || typeof str !== 'string') {
            return '';
        }
        return str
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    unescapeHtmlAttribute(str) {
        if (!str || typeof str !== 'string') {
            return '';
        }
        return str
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&');
    }

    // Load images for artists in the currently active tab
    async loadImagesForActiveTab(tabType) {
        try {
            if (!window.ImageService) return;
            
            const artists = tabType === 'musical' ? this.musicalArtists : this.technicalArtists;
            const artistsNeedingImages = artists.filter(artist => !artist.image || artist.image === '');
            
            if (artistsNeedingImages.length === 0) return;
            
            console.log(`🖼️ Loading images for ${artistsNeedingImages.length} ${tabType} artists`);
            
            const imageService = new window.ImageService();
            
            // Load images for just the first few visible artists to avoid overwhelming
            const visibleArtists = artistsNeedingImages.slice(0, 6); // Load first 6 artists
            
            for (const artist of visibleArtists) {
                try {
                    // Ensure artist has a valid name
                    if (!artist || !artist.name || typeof artist.name !== 'string') {
                        console.warn('🖼️ Skipping artist with invalid name:', artist);
                        continue;
                    }

                    const imageUrl = await imageService.fetchArtistImage(artist.name);
                    if (imageUrl) {
                        artist.image = imageUrl;
                        this.updateArtistCardImage(artist, imageUrl);
                    }
                } catch (error) {
                    console.warn(`⚠️ Failed to load image for ${artist.name}:`, error.message);
                }
                
                // Add small delay between individual loads
                await this.sleep(500);
            }
        } catch (error) {
            console.error('❌ Error loading images for active tab:', error);
        }
    }
    
    // Categorize artists based on their roles
    categorizeArtistsByRoles(artists) {
        const musicalArtists = [];
        const technicalArtists = [];
        
        artists.forEach(artist => {
            // Enhanced role analysis with debugging for specific artists
            const isPatMetheny = artist.name.toLowerCase().includes('pat metheny');
            
            if (isPatMetheny) {
                console.log(`🎸 [DEBUG] Analyzing Pat Metheny:`, artist);
                console.log(`🎭 [DEBUG] Roles:`, artist.roles);
            }
            
            // Check each role individually for better debugging
            const musicalRoles = [];
            const technicalRoles = [];
            
            artist.roles.forEach(role => {
                const category = window.roleCategorizer.categorizeRole(role);
                if (category === 'musical') {
                    musicalRoles.push(role);
                } else {
                    technicalRoles.push(role);
                }
                
                if (isPatMetheny) {
                    console.log(`  [DEBUG] ${role} → ${category}`);
                }
            });
            
            // NEW LOGIC: Artists can appear in both tabs based on their roles
            const hasMusicalRole = musicalRoles.length > 0;
            const hasTechnicalRole = technicalRoles.length > 0;
            
            if (isPatMetheny) {
                console.log(`🎵 [DEBUG] Musical roles (${musicalRoles.length}):`, musicalRoles);
                console.log(`🔧 [DEBUG] Technical roles (${technicalRoles.length}):`, technicalRoles);
                console.log(`📋 [DEBUG] Final categories: ${hasMusicalRole ? 'MUSICAL' : ''} ${hasTechnicalRole ? 'TECHNICAL' : ''}`);
            }
            
            // Add to musical tab if they have any musical roles
            if (hasMusicalRole) {
                musicalArtists.push(artist);
                console.log(`🎵 ${artist.name} → Musical tab (${musicalRoles.length} musical, ${technicalRoles.length} technical roles)`);
            }
            
            // Add to technical tab if they have any technical roles
            if (hasTechnicalRole) {
                technicalArtists.push(artist);
                console.log(`🔧 ${artist.name} → Technical tab (${technicalRoles.length} technical, ${musicalRoles.length} musical roles)`);
            }
            
            // Log cross-tab appearances for transparency
            if (hasMusicalRole && hasTechnicalRole) {
                console.log(`👥 ${artist.name} → Appears in BOTH tabs (${musicalRoles.length} musical + ${technicalRoles.length} technical roles)`);
            }
        });
        
        return { musicalArtists, technicalArtists };
    }
    
    // Helper method to extract individual roles from consolidated role strings
    extractIndividualRoles(consolidatedRole) {
        if (!consolidatedRole) return [];
        
        const allRoles = [];
        
        // Use smart splitting that respects bracket boundaries
        const roleParts = this.smartSplitRoles(consolidatedRole);
        
        roleParts.forEach(rolePart => {
            // Remove track context in parentheses to get just the role
            // "Piano (Track A, Track B)" -> "Piano"
            const baseRole = rolePart.split(' (')[0].trim();
            
            // Add the cleaned base role
            const cleanedRole = this.cleanRoleName(baseRole);
            if (cleanedRole && cleanedRole.length > 0) {
                allRoles.push(cleanedRole);
            }
            
            // Extract specific instruments from brackets
            const specificInstruments = this.extractSpecificInstruments(baseRole);
            specificInstruments.forEach(instrument => {
                if (instrument && instrument.length > 0) {
                    allRoles.push(instrument);
                }
            });
        });
        
        // Remove duplicates and return
        return [...new Set(allRoles)];
    }
    
    // Load data from Supabase
    // In AlbumCollectionApp class
    async loadDataFromSupabase() {
        try {
            console.log('📊 Loading data from Supabase...');
            this.updateLoadingProgress('Loading your collection...', 'Fetching albums from database...', 50);

            // Load all data from Supabase, INCLUDING scrapedHistory in the destructuring
            const [albums, artists, tracks, roles, fetchedScrapedHistory] = await Promise.all([ // <<< CORRECTED LINE
                this.supabaseService.getAlbums(),
                this.supabaseService.getArtists(),
                this.supabaseService.getTracks(),
                this.supabaseService.getRoles(),
                this.supabaseService.getScrapedArtistsHistory()
            ]);

            this.updateLoadingProgress('Collection data loaded', 'Processing albums and artists...', 70);

            // Update collection with core data
            this.collection.albums = albums;
            this.collection.artists = artists;
            this.scrapedHistory = fetchedScrapedHistory;

            // 🔍 DEBUG: Check year distribution in loaded albums
            const yearCounts = {};
            let post1994Count = 0;
            albums.forEach(album => {
                const year = album.year;
                if (year) {
                    yearCounts[year] = (yearCounts[year] || 0) + 1;
                    if (year > 1994) {
                        post1994Count++;
                    }
                }
            });
            
            const years = Object.keys(yearCounts).map(y => parseInt(y)).sort((a, b) => a - b);
            console.log(`🔍 DEBUG: Albums loaded from Supabase:`);
            console.log(`   Total albums: ${albums.length}`);
            console.log(`   Albums after 1994: ${post1994Count}`);
            console.log(`   Year range: ${years[0]} - ${years[years.length - 1]}`);
            console.log(`   Sample years: ${years.slice(-10).join(', ')}`);
            console.log('🔍 Year distribution (last 10 years):', Object.fromEntries(
                Object.entries(yearCounts)
                    .filter(([year]) => parseInt(year) > 1994)
                    .slice(-10)
            ));
            
            // 🚨 CRITICAL: Check if albums are being truncated
            if (albums.length !== this.collection.albums.length) {
                console.error(`🚨 ALBUMS TRUNCATED! Database: ${albums.length} → Collection: ${this.collection.albums.length}`);
            }

            this.updateLoadingProgress('Processing data relationships...', 'Organizing tracks and roles...', 80, `${albums.length} albums loaded`);

            // Normalize artist data to ensure all required properties exist
            this.collection.artists = this.collection.artists.map(artist => ({
                ...artist,
                albums: artist.albums || [],
                roles: artist.roles || [],
                albumCount: artist.albumCount || artist.album_count || 0
            }));

            // 🔧 FIX: Regenerate tracks and roles from albums to ensure proper relationships
            console.log('🔄 Regenerating tracks and roles from albums to fix relationship data...');
            this.collection.tracks = this.generateTracksFromAlbums();
            this.collection.roles = this.generateRolesFromAlbums();
            console.log(`✅ Regenerated ${this.collection.tracks.length} tracks and ${this.collection.roles.length} roles with proper relationships`);

            this.updateLoadingProgress('Finalizing interface...', 'Rendering your collection...', 90, `${albums.length} albums, ${artists.length} artists`);

            // Log the loaded data, including scraped history length
            console.log(`✅ Data loaded from Supabase: ${albums.length} albums, ${artists.length} artists`);
            console.log(`✅ Regenerated from albums: ${this.collection.tracks.length} tracks, ${this.collection.roles.length} roles`);
            console.log(`✅ Scraped history: ${this.scrapedHistory.length} items`);

            // Render the current view
            this.renderCurrentView();

            // Refresh scraped content display
            this.refreshScrapedContentDisplay();

            // Update page title counts
            this.updatePageTitleCounts();

            this.updateLoadingProgress('Collection ready!', 'Everything loaded successfully', 95);

        } catch (error) {
            console.error('❌ Failed to load data from Supabase:', error);
            this.updateLoadingProgress('Loading failed', 'Using offline mode...', 50);

            // Initialize empty collection if loading fails
            this.collection = {
                albums: [],
                artists: [],
                tracks: [],
                roles: []
            };
            // CRUCIAL: Initialize this.scrapedHistory in the catch block too!
            // It's already initialized in the constructor, but doing it here again
            // ensures consistency if this specific method fails.
            this.scrapedHistory = []; // <<< ADDED THIS LINE

            // Still render the view with empty data
            this.renderCurrentView();

            // Refresh scraped content display even with empty data
            this.refreshScrapedContentDisplay();

            // Update page title counts (will show zeros)
            this.updatePageTitleCounts();
        }
    }
    
    // Helper method to render current view after data load
    renderCurrentView() {
        // Use loadViewContent to ensure sorting is applied automatically
        this.loadViewContent(this.currentView);
    }
    
    // Handle album card events
    setupAlbumCardEvents() {
        // Listen for custom events from album cards
        document.addEventListener('album-more-info', (event) => {
            const album = event.detail.album;
            this.showAlbumModal(album);
        });
        
        document.addEventListener('album-spotify-search', (event) => {
            const { album, searchQuery } = event.detail;
            console.log(`🎵 Spotify search initiated for: ${searchQuery}`);
            // Could add analytics tracking here
        });
        
        document.addEventListener('album-youtube-search', (event) => {
            const { album, searchQuery } = event.detail;
            console.log(`📺 YouTube search initiated for: ${searchQuery}`);
            // Could add analytics tracking here
        });
    }
    
    // Handle artist card events
    setupArtistCardEvents() {
        // Listen for custom events from artist cards
        document.addEventListener('artistCardClick', (event) => {
            const artist = event.detail.artist;
            console.log(`🎤 Artist card clicked: ${artist.name}`);
            // Show artist albums when card is clicked
            this.showArtistAlbums(artist);
        });
        
        document.addEventListener('artistViewAlbums', (event) => {
            const artist = event.detail.artist;
            console.log(`📀 View albums clicked for: ${artist.name}`);
            this.showArtistAlbums(artist);
        });
    }
    
    // Show detailed album modal
    showAlbumModal(album) {
        const modalContent = this.generateAlbumModalContent(album);
        
        // Check if a modal is currently open to determine if this should be nested
        const modal = document.getElementById('more-info-modal');
        const isModalCurrentlyOpen = !modal.classList.contains('hidden');
        
        this.showModal(`${album.title} (${album.year})`, modalContent, isModalCurrentlyOpen);
    }
    
    // Show albums for a specific artist
    showArtistAlbums(artist) {
        console.log(`🎤 Showing albums for artist: ${artist.name}`);
        
        const artistAlbums = artist.albums || [];
        const modalContent = this.generateArtistAlbumsModalContent(artist, artistAlbums);
        
        // Check if a modal is currently open to determine if this should be nested
        const modal = document.getElementById('more-info-modal');
        const isModalCurrentlyOpen = !modal.classList.contains('hidden');
        
        // ALWAYS use total album count from main collection (not filtered count)
        // Find the complete artist data to get total album count across ALL roles
        let totalAlbumCount = artistAlbums.length; // fallback to current count
        
        const completeArtist = this.collection.artists.find(a => a.name === artist.name);
        if (completeArtist && completeArtist.albumCount) {
            totalAlbumCount = completeArtist.albumCount;
            console.log(`🔢 Using total album count from collection: ${totalAlbumCount} (vs filtered: ${artistAlbums.length})`);
        } else {
            console.log(`⚠️ Could not find complete artist data, using filtered count: ${totalAlbumCount}`);
        }
        
        // Include TOTAL album count in title (not filtered count)
        const artistImage = artist.image ? `<img src="${artist.image}" alt="${artist.name}" class="modal-title-image">` : '';
        const titleWithImage = `${artistImage}${artist.name} - Albums (${totalAlbumCount})`;
        
        this.showModal(titleWithImage, modalContent, isModalCurrentlyOpen);
    }
    
    // Generate album modal content with credits and tracklist
    generateAlbumModalContent(album) {
        // Safely handle artists array - fallback to artist string or default
        let artistsDisplay = 'Unknown Artist';
        if (album.artists && Array.isArray(album.artists)) {
            artistsDisplay = album.artists.map(a => a.name || a).join(', ');
        } else if (album.artist) {
            artistsDisplay = album.artist;
        }
        
        const tracklistHtml = album.tracklist && album.tracklist.length > 0 
            ? album.tracklist.map(track => `
                <div class="track-item">
                    <span class="track-position">${track.position}</span>
                    <span class="track-title">${track.title}</span>
                    ${track.duration ? `<span class="track-duration">${track.duration}</span>` : ''}
                </div>
            `).join('')
            : '<p class="no-content">No tracklist available</p>';
        
        // Separate musical and technical credits using role categorizer
        const { musicalCreditsHtml, technicalCreditsHtml } = album.credits && album.credits.length > 0
            ? this.generateSeparatedCreditsHtml(album.credits)
            : { musicalCreditsHtml: '<p class="no-content">No credits available</p>', technicalCreditsHtml: '' };
            
        // Generate genres and styles tags
        const genreStyleTags = [];
        if (album.genres && Array.isArray(album.genres)) {
            genreStyleTags.push(...album.genres);
        }
        if (album.styles && Array.isArray(album.styles)) {
            genreStyleTags.push(...album.styles);
        }
        
        const uniqueGenreStyleTags = [...new Set(genreStyleTags)];
        const genresHtml = uniqueGenreStyleTags.length > 0
            ? uniqueGenreStyleTags.map(tag => `<span class="genre-tag-modal">${tag}</span>`).join('')
            : '<span class="no-content">No genres or styles listed</span>';
        
        return `
            <div class="album-modal-content">
                <div class="album-modal-header">
                    <div class="album-modal-image">
                        ${album.images && album.images[0] ? 
                            `<img src="${album.images[0].uri}" alt="Cover art for ${album.title}" class="modal-cover-image">` :
                            `<div class="modal-placeholder-image">
                                <div class="placeholder-icon">🎵</div>
                                <div class="placeholder-text">No Cover</div>
                            </div>`
                        }
                    </div>
                    <div class="album-modal-info">
                        <div class="modal-info-main">
                            <h3 class="modal-album-title">${album.title}</h3>
                            <p class="modal-album-artist">${artistsDisplay}</p>
                            <p class="modal-album-year">${album.year || 'Unknown Year'}</p>
                            <div class="modal-album-meta">
                                <span class="modal-track-count">${album.track_count || album.trackCount || 0} tracks</span>
                                <div class="modal-genres">${genresHtml}</div>
                            </div>
                        </div>
                        <div class="modal-header-actions">
                            <button class="modal-header-btn spotify-btn" data-search-query="${artistsDisplay} ${album.title}" title="Open in Spotify">
                                🎵
                            </button>
                            <button class="modal-header-btn youtube-btn" data-search-query="${artistsDisplay} ${album.title}" title="Open in YouTube">
                                📺
                            </button>
                            <button class="modal-header-btn edit-btn" onclick="window.albumApp.openEditAlbumModal('${album.id}')" title="Edit Album">
                                ✏️
                            </button>
                            <button class="modal-header-btn delete-btn" onclick="window.albumApp.confirmDeleteAlbum('${album.id}', '${this.escapeAttributeValue(album.title)}')" title="Delete Album">
                                🗑️
                            </button>
                        </div>
                    </div>
                </div>
                
                <div class="album-modal-sections">
                    <div class="modal-section">
                        <h4>Credits</h4>
                        <div class="credits musical-credits">
                            ${musicalCreditsHtml}
                        </div>
                        ${technicalCreditsHtml ? `
                        <div class="technical-credits-section">
                            <button class="technical-credits-toggle" onclick="window.albumApp.toggleTechnicalCredits(this)">
                                <span class="toggle-icon">▶</span>
                                <span>Technical Credits</span>
                            </button>
                            <div class="technical-credits-content" style="display: none;">
                                ${technicalCreditsHtml}
                            </div>
                        </div>
                        ` : ''}
                    </div>
                    
                    <div class="modal-section">
                        <h4>Tracklist</h4>
                        <div class="tracklist">
                            ${tracklistHtml}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Generate separated musical and technical credits HTML
    generateSeparatedCreditsHtml(credits) {
        if (!credits || credits.length === 0) {
            return { 
                musicalCreditsHtml: '<p class="no-content">No credits available</p>', 
                technicalCreditsHtml: '' 
            };
        }
        
        // Group and separate credits by artist to avoid duplication
        const { musicalCredits, technicalCredits } = this.groupAndSeparateCredits(credits);
        
        console.log(`🎵 Grouped credits: ${musicalCredits.length} musical artists, ${technicalCredits.length} technical artists`);
        
        // Generate musical credits HTML
        const musicalCreditsHtml = musicalCredits.length > 0 
            ? this.generateGroupedCreditsHtml(musicalCredits, 'musical')
            : '<p class="no-content">No musical credits available</p>';
        
        // Generate technical credits HTML
        const technicalCreditsHtml = technicalCredits.length > 0 
            ? this.generateGroupedCreditsHtml(technicalCredits, 'technical')
            : '';
        
        return { musicalCreditsHtml, technicalCreditsHtml };
    }
    
    // Group credits by artist and separate into musical/technical
    groupAndSeparateCredits(credits) {
        const artistGroups = new Map(); // artist name -> { musicalRoles: [], technicalRoles: [], id: ... }
        
        credits.forEach(credit => {
            if (!credit || !credit.role || !credit.name) {
                return;
            }

            // Use smart splitting that respects bracket boundaries
            const roles = this.smartSplitRoles(credit.role);
            
            // Get or create artist group
            if (!artistGroups.has(credit.name)) {
                artistGroups.set(credit.name, {
                    name: credit.name,
                    id: credit.id,
                    musicalRoles: [],
                    technicalRoles: [],
                    albumRoles: credit.albumRoles || [],
                    trackRoles: credit.trackRoles || []
                });
            }
            
            const artistGroup = artistGroups.get(credit.name);
            
            roles.forEach(role => {
                const category = window.roleCategorizer.categorizeRole(role);
                
                if (category === 'technical') {
                    if (!artistGroup.technicalRoles.includes(role)) {
                        artistGroup.technicalRoles.push(role);
                    }
                } else {
                    if (!artistGroup.musicalRoles.includes(role)) {
                        artistGroup.musicalRoles.push(role);
                    }
                }
            });
        });
        
        // Convert to arrays, separating artists who have musical vs technical roles
        const musicalCredits = [];
        const technicalCredits = [];
        
        artistGroups.forEach(artistGroup => {
            // Find the artist in collection to get album count for sorting
            // First ensure we have up-to-date artists data with correct album counts
            let collectionArtist = this.collection.artists.find(a => a.name === artistGroup.name);
            
            // If artist not found or has zero album count (stale data), regenerate artists collection
            if (!collectionArtist || collectionArtist.albumCount === 0) {
                console.log(`🔄 Artist "${artistGroup.name}" not found or has stale data, refreshing collection...`);
                this.collection.artists = this.generateArtistsFromAlbums();
                collectionArtist = this.collection.artists.find(a => a.name === artistGroup.name);
            }
            
            const albumCount = collectionArtist ? collectionArtist.albumCount : 0;
            
            // If artist has musical roles, add to musical credits
            if (artistGroup.musicalRoles.length > 0) {
                musicalCredits.push({
                    name: artistGroup.name,
                    id: artistGroup.id,
                    roles: artistGroup.musicalRoles,
                    albumRoles: artistGroup.albumRoles,
                    trackRoles: artistGroup.trackRoles,
                    albumCount: albumCount
                });
            }
            
            // If artist has technical roles, add to technical credits  
            if (artistGroup.technicalRoles.length > 0) {
                technicalCredits.push({
                    name: artistGroup.name,
                    id: artistGroup.id,
                    roles: artistGroup.technicalRoles,
                    albumRoles: artistGroup.albumRoles,
                    trackRoles: artistGroup.trackRoles,
                    albumCount: albumCount
                });
            }
        });
        
        // Sort both arrays by album count in descending order
        musicalCredits.sort((a, b) => b.albumCount - a.albumCount);
        technicalCredits.sort((a, b) => b.albumCount - a.albumCount);
        
        console.log(`🎵 Credits sorted by album count - Musical: ${musicalCredits.length} artists, Technical: ${technicalCredits.length} artists`);
        
        return { musicalCredits, technicalCredits };
    }
    
    // Generate HTML for grouped credits (no duplication)
    generateGroupedCreditsHtml(groupedCredits, creditsType) {
        if (!groupedCredits || groupedCredits.length === 0) {
            return '<p class="no-content">No credits available</p>';
        }
        
        let html = '';
        
        groupedCredits.forEach((credit, index) => {
            const creditId = `${creditsType}-credit-${index}`;
            html += `<div class="organized-credit-item">`;
            
            // Artist name with all their roles in this category - now clickable
            html += `<div class="credit-line">`;
            html += `<span class="credit-name clickable-artist-name" data-artist-name="${this.escapeHtmlAttribute(credit.name)}" title="View ${this.escapeHtmlAttribute(credit.name)}'s albums">${credit.name}</span>`;
            html += `<span class="credit-roles-inline">`;
            
            credit.roles.forEach(role => {
                const roleClass = creditsType === 'musical' ? 'musical-role' : 'technical-role';
                html += `<span class="role-tag ${roleClass}">${role}</span>`;
            });
            
            html += `</span>`;
            html += `</div>`;
            
            // Add track-specific roles if available (from structured data)
            if (credit.trackRoles && credit.trackRoles.length > 0) {
                const relevantTrackRoles = credit.trackRoles.filter(tr => {
                    const category = window.roleCategorizer.categorizeRole(tr.role);
                    return (creditsType === 'musical' && category === 'musical') || 
                           (creditsType === 'technical' && category === 'technical');
                });
                
                if (relevantTrackRoles.length > 0) {
                    html += `<div class="track-roles-expandable">`;
                    html += `<button class="track-roles-toggle" onclick="toggleTrackRoles('${creditId}')" title="Click to expand track details">`;
                    html += `<span class="toggle-icon">▶</span>`;
                    html += `<span class="track-roles-summary">+${relevantTrackRoles.length} track-specific role${relevantTrackRoles.length > 1 ? 's' : ''}</span>`;
                    html += `</button>`;
                    
                    html += `<div class="track-roles-details" id="${creditId}-details" style="display: none;">`;
                    relevantTrackRoles.forEach(trackRole => {
                        const trackTitles = trackRole.tracks.map(t => t.title).join(', ');
                        html += `<div class="track-role-item">`;
                        html += `<span class="track-context">${trackTitles}:</span>`;
                        const roleClass = creditsType === 'musical' ? 'musical-role' : 'technical-role';
                        html += `<span class="role-tag ${roleClass}">${trackRole.role}</span>`;
                        html += `</div>`;
                    });
                    html += `</div>`;
                    html += `</div>`;
                }
            }
            
            html += `</div>`;
        });
        
        return html;
    }
    
    // Toggle technical credits visibility
    toggleTechnicalCredits(buttonElement) {
        const content = buttonElement.nextElementSibling;
        const icon = buttonElement.querySelector('.toggle-icon');
        
        if (content.style.display === 'none') {
            content.style.display = 'block';
            icon.textContent = '▼';
            buttonElement.classList.add('expanded');
        } else {
            content.style.display = 'none';
            icon.textContent = '▶';
            buttonElement.classList.remove('expanded');
        }
    }
    
    // Generate organized credits HTML with compact, expandable design
    generateOrganizedCreditsHtml(credits) {
        if (!credits || credits.length === 0) {
            return '<p class="no-content">No credits available</p>';
        }
        
        // Generate HTML using the new structured credit data
        let html = '';
        credits.forEach((credit, index) => {
            const creditId = `credit-${index}`;
            html += `<div class="organized-credit-item">`;
            
            // Check if we have structured role data (from new parser)
            if (credit.albumRoles || credit.trackRoles) {
                // New structured format - compact inline layout
                
                // Display album-level roles inline with artist name
                if (credit.albumRoles && credit.albumRoles.length > 0) {
                    html += `<div class="credit-line">`;
                    html += `<span class="credit-name clickable-artist-name" data-artist-name="${this.escapeHtmlAttribute(credit.name)}" title="View ${this.escapeHtmlAttribute(credit.name)}'s albums">${credit.name}</span>`;
                    html += `<span class="credit-roles-inline">`;
                    credit.albumRoles.forEach((role, i) => {
                        html += `<span class="role-tag general-role">${role}</span>`;
                    });
                    html += `</span>`;
                    html += `</div>`;
                } else {
                    // Just the name if no album roles
                    html += `<div class="credit-line">`;
                    html += `<span class="credit-name clickable-artist-name" data-artist-name="${this.escapeHtmlAttribute(credit.name)}" title="View ${this.escapeHtmlAttribute(credit.name)}'s albums">${credit.name}</span>`;
                    html += `</div>`;
                }
                
                // Display track-specific roles as expandable section (if any)
                if (credit.trackRoles && credit.trackRoles.length > 0) {
                    const trackRoleCount = credit.trackRoles.length;
                    const trackSummary = credit.trackRoles.map(tr => tr.role).join(', ');
                    
                    html += `<div class="track-roles-expandable">`;
                    html += `<button class="track-roles-toggle" onclick="toggleTrackRoles('${creditId}')" title="Click to expand track details">`;
                    html += `<span class="toggle-icon">▶</span>`;
                    html += `<span class="track-roles-summary">+${trackRoleCount} track role${trackRoleCount > 1 ? 's' : ''}: ${trackSummary}</span>`;
                    html += `</button>`;
                    
                    html += `<div class="track-roles-details" id="${creditId}-details" style="display: none;">`;
                    credit.trackRoles.forEach(trackRole => {
                        const trackTitles = trackRole.tracks.map(t => t.title).join(', ');
                        html += `<div class="track-role-item">`;
                        html += `<span class="track-context">${trackTitles}:</span>`;
                        html += `<span class="role-tag track-role">${trackRole.role}</span>`;
                        html += `</div>`;
                    });
                    html += `</div>`;
                    html += `</div>`;
                }
            } else {
                // Fallback to old parsing method for backwards compatibility - also use compact layout
                const parsedRoles = this.parseRoleString(credit.role || '');
                
                // Display general roles compactly inline with name
                if (parsedRoles.general.length > 0) {
                    html += `<div class="credit-line">`;
                    html += `<span class="credit-name clickable-artist-name" data-artist-name="${this.escapeHtmlAttribute(credit.name)}" title="View ${this.escapeHtmlAttribute(credit.name)}'s albums">${credit.name}</span>`;
                    html += `<span class="credit-roles-inline">`;
                    parsedRoles.general.forEach((role, i) => {
                        html += `<span class="role-tag general-role">${role}</span>`;
                    });
                    html += `</span>`;
                    html += `</div>`;
                } else {
                    // Just the name if no general roles
                    html += `<div class="credit-line">`;
                    html += `<span class="credit-name">${credit.name}</span>`;
                    html += `</div>`;
                }
                
                // Display track-specific roles as expandable
                if (parsedRoles.tracks.size > 0) {
                    const trackRoleCount = parsedRoles.tracks.size;
                    const trackSummary = Array.from(parsedRoles.tracks.values()).flat().join(', ');
                    
                    html += `<div class="track-roles-expandable">`;
                    html += `<button class="track-roles-toggle" onclick="toggleTrackRoles('${creditId}')" title="Click to expand track details">`;
                    html += `<span class="toggle-icon">▶</span>`;
                    html += `<span class="track-roles-summary">+${trackRoleCount} track role${trackRoleCount > 1 ? 's' : ''}: ${trackSummary}</span>`;
                    html += `</button>`;
                    
                    html += `<div class="track-roles-details" id="${creditId}-details" style="display: none;">`;
                    parsedRoles.tracks.forEach((roles, trackInfo) => {
                        html += `<div class="track-role-item">`;
                        html += `<span class="track-context">${trackInfo}:</span>`;
                        roles.forEach(role => {
                            html += `<span class="role-tag track-role">${role}</span>`;
                        });
                        html += `</div>`;
                    });
                    html += `</div>`;
                    html += `</div>`;
                }
            }
            
            html += `</div>`;
        });
        
        return html;
    }
    
    // Parse role string to separate general and track-specific roles
    parseRoleString(roleString) {
        const result = {
            general: [],
            tracks: new Map() // trackInfo -> roles[]
        };
        
        if (!roleString) return result;
        
        // Use smart splitting that respects bracket boundaries
        const segments = this.smartSplitRoles(roleString);
        
        segments.forEach(segment => {
            // Check if this segment has track information in parentheses
            const trackMatch = segment.match(/^(.+?)\s*\(([^)]+)\)$/);
            
            if (trackMatch) {
                // Track-specific role
                const roleWithInstrument = trackMatch[1].trim();
                const trackInfo = trackMatch[2].trim();
                
                // Validate that this is actually a role, not a track title
                if (this.isValidRole(roleWithInstrument)) {
                    // Extract base role and instrument specification
                    const instrumentMatch = roleWithInstrument.match(/^(.+?)\s*\[([^\]]+)\]$/);
                    let role, instrument;
                    
                    if (instrumentMatch) {
                        role = instrumentMatch[1].trim();
                        instrument = instrumentMatch[2].trim();
                    } else {
                        role = roleWithInstrument;
                        instrument = null;
                    }
                    
                    // Create display text for the role
                    const displayRole = instrument ? `${role} (${instrument})` : role;
                    
                    if (!result.tracks.has(trackInfo)) {
                        result.tracks.set(trackInfo, []);
                    }
                    result.tracks.get(trackInfo).push(displayRole);
                } else {
                    console.log(`🚫 Filtered out non-role in track context: "${roleWithInstrument}"`);
                }
            } else {
                // General role (no track context) - validate it's actually a role
                if (this.isValidRole(segment)) {
                    // Handle instrument specifications in brackets
                    const instrumentMatch = segment.match(/^(.+?)\s*\[([^\]]+)\]$/);
                    let role, instrument;
                    
                    if (instrumentMatch) {
                        role = instrumentMatch[1].trim();
                        instrument = instrumentMatch[2].trim();
                        if (this.isValidRole(role)) {
                            result.general.push(`${role} (${instrument})`);
                        }
                    } else {
                        result.general.push(segment);
                    }
                } else {
                    console.log(`🚫 Filtered out non-role: "${segment}"`);
                }
            }
        });
        
        return result;
    }
    
    // Validate if a string represents an actual musical/production role vs a track title
    isValidRole(roleString) {
        if (!roleString || typeof roleString !== 'string') return false;
        
        const role = roleString.trim().toLowerCase();
        
        // Common musical instruments and roles
        const validRoles = [
            // Instruments
            'guitar', 'bass', 'piano', 'keyboards', 'drums', 'percussion', 'violin', 'cello', 
            'saxophone', 'trumpet', 'trombone', 'flute', 'clarinet', 'harmonica', 'banjo',
            'mandolin', 'ukulele', 'harp', 'accordion', 'organ', 'synthesizer', 'synth',
            'electric guitar', 'acoustic guitar', 'electric bass', 'acoustic bass',
            'electric piano', 'acoustic piano', 'steel guitar', 'slide guitar',
            'lead guitar', 'rhythm guitar', 'classical guitar', 'nylon string guitar',
            'twelve-string guitar', '12-string guitar', 'baritone guitar', 'fretless guitar',
            'upright bass', 'double bass', 'bass guitar', 'fretless bass',
            'drum kit', 'drum set', 'snare drum', 'kick drum', 'hi-hat', 'cymbals',
            'congas', 'bongos', 'timpani', 'xylophone', 'vibraphone', 'marimba',
            'alto saxophone', 'tenor saxophone', 'soprano saxophone', 'baritone saxophone',
            'alto sax', 'tenor sax', 'soprano sax', 'bari sax',
            'french horn', 'tuba', 'euphonium', 'cornet', 'flugelhorn',
            'piccolo', 'oboe', 'bassoon', 'english horn',
            'tambourine', 'shaker', 'cowbell', 'woodblock', 'triangle',
            
            // Vocals
            'vocals', 'lead vocals', 'backing vocals', 'background vocals', 'harmony vocals',
            'choir', 'chorus', 'soprano', 'alto', 'tenor', 'baritone', 'voice',
            
            // Production roles
            'producer', 'co-producer', 'executive producer', 'associate producer',
            'engineer', 'recording engineer', 'mixing engineer', 'mastering engineer',
            'sound engineer', 'audio engineer', 'mix', 'mastered by', 'mixed by',
            'recorded by', 'engineered by', 'produced by',
            
            // Composition/arrangement
            'composer', 'written-by', 'written by', 'music by', 'lyrics by',
            'arranged by', 'orchestrated by', 'conductor', 'musical director',
            'composer', 'songwriter', 'lyricist', 'arranger', 'orchestrator',
            
            // Technical roles
            'programmer', 'programming', 'sequencing', 'sampling', 'editing',
            'digital editing', 'sound design', 'sound designer', 'effects',
            'reverb', 'delay', 'distortion', 'chorus', 'flanger', 'phaser',
            
            // Other creative roles
            'design', 'artwork', 'cover design', 'photography', 'photography by',
            'liner notes', 'notes', 'consultant', 'advisor', 'supervisor',
            'string arrangements', 'horn arrangements', 'vocal arrangements'
        ];
        
        // Direct match check
        if (validRoles.includes(role)) {
            return true;
        }
        
        // Partial match for compound roles (e.g., "Electric Guitar", "Background Vocals")
        const roleWords = role.split(/\s+/);
        for (const validRole of validRoles) {
            const validWords = validRole.split(/\s+/);
            
            // Check if any combination of words matches
            if (validWords.some(validWord => roleWords.includes(validWord))) {
                // Additional validation: make sure it's not just a coincidental word match
                if (validWords.length === 1 && roleWords.length > 3) {
                    continue; // Skip single-word matches in very long strings (likely track titles)
                }
                return true;
            }
        }
        
        // Pattern-based validation for roles with specifications
        const rolePatterns = [
            /\b(guitar|bass|piano|drums|vocals|keyboard|synth|horn|string|percussion)\b/i,
            /\b(produced?|engineered?|mixed?|mastered?|recorded?|arranged?|composed?)\b/i,
            /\b(written|music|lyrics|arrangement|orchestration)\b/i,
            /\b(design|photography|artwork|liner)\b/i
        ];
        
        if (rolePatterns.some(pattern => pattern.test(role))) {
            return true;
        }
        
        // Common non-role patterns (track titles often have these characteristics)
        const nonRolePatterns = [
            /^(the|a|an)\s+/i, // Articles at start (often track titles)
            /\b(day|night|morning|evening|time|world|life|love|heart|soul|mind|dream|story|song|music|way|place|home|road|street|city|town|country|river|mountain|sea|sky|sun|moon|star|light|dark|shadow|fire|water|wind|rain|snow|summer|winter|spring|fall|autumn|forever|always|never|sometimes|maybe|perhaps|today|tomorrow|yesterday|moment|minute|hour|year|decade|century|future|past|present|memory|feeling|emotion|hope|fear|joy|pain|happiness|sadness|anger|peace|war|friend|enemy|family|mother|father|brother|sister|child|baby|man|woman|boy|girl|people|person|human|god|angel|devil|heaven|hell|earth|universe|everything|nothing|something|anything|somewhere|anywhere|nowhere|everyone|anyone|someone|no one)\b/i
        ];
        
        if (nonRolePatterns.some(pattern => pattern.test(role))) {
            return false;
        }
        
        // If it's very long (>25 characters), it's probably a track title
        if (role.length > 25) {
            return false;
        }
        
        // Default: if we can't classify it, err on the side of inclusion for short strings
        return role.length <= 15;
    }
    
    // Helper method to format album artists display (same as main collection view)
    getAlbumArtistsDisplay(album) {
        // First try the artists array
        if (album.artists && Array.isArray(album.artists) && album.artists.length > 0) {
            const artistNames = album.artists.map(artist => 
                typeof artist === 'string' ? artist : artist.name || 'Unknown'
            );

            if (artistNames.length === 1) {
                return artistNames[0];
            } else if (artistNames.length === 2) {
                return `${artistNames[0]} & ${artistNames[1]}`;
            } else if (artistNames.length > 2) {
                return `${artistNames[0]} & ${artistNames.length - 1} others`;
            }
        }
        
        // Fallback to the single artist field
        if (album.artist && album.artist !== 'Unknown Artist') {
            return album.artist;
        }

        return 'Unknown Artist';
    }
    
    // Get specific roles an artist had on a particular album
    getArtistRolesOnAlbum(artistName, album) {
        if (!album.credits || !Array.isArray(album.credits)) {
            return [];
        }

        // Find all roles this specific artist had on this album
        const artistRoles = album.credits
            .filter(credit => credit.name === artistName)
            .map(credit => credit.role)
            .filter(role => role); // Remove empty roles

        // Clean roles and remove duplicates
        const cleanedRoles = [...new Set(artistRoles.map(role => 
            this.cleanRoleName(role)
        ))];

        return cleanedRoles;
    }

    // Generate artist albums modal content
    generateArtistAlbumsModalContent(artist, albums) {
        if (!albums || albums.length === 0) {
            return `
                <div class="artist-albums-modal">
                    <div class="artist-info">
                        <h3>${artist.name}</h3>
                        <p>No albums found for this artist.</p>
                    </div>
                </div>
            `;
        }

        // Sort albums by year ascending
        const sortedAlbums = [...albums].sort((a, b) => {
            const yearA = a.year || 0;
            const yearB = b.year || 0;
            return yearA - yearB;
        });

        // Separate artist roles into musical and technical using role categorizer
        const { musicalRoles, technicalRoles } = window.roleCategorizer.separateArtistRoles(artist);
        
        console.log(`🎭 Artist roles for ${artist.name}:`, {
            musical: musicalRoles,
            technical: technicalRoles,
            artistObject: artist
        });
        
        // Generate role information with tabs
        const rolesTabsHtml = this.generateArtistRoleTabsHtml(artist, musicalRoles, technicalRoles);
        
        const albumsHtml = sortedAlbums.map(album => {
            // Get formatted artists display (same as main collection view)
            const artistsDisplay = this.getAlbumArtistsDisplay(album);
            
            // Get cover image URL with fallback logic
            const coverImageUrl = album.images && album.images[0] ? album.images[0].uri : '';
            
            // Generate genre and style tags (same as main album cards)
            const tags = [];
            if (album.genres && Array.isArray(album.genres)) {
                tags.push(...album.genres);
            }
            if (album.styles && Array.isArray(album.styles)) {
                tags.push(...album.styles);
            }
            const uniqueTags = [...new Set(tags)].slice(0, 4);
            const genreStyleTagsHtml = uniqueTags.length > 0 
                ? `<div class="genre-tags-container">${uniqueTags.map(tag => 
                    `<span class="genre-tag" title="${tag}">${tag}</span>`
                ).join('')}</div>` 
                : '';
            
            return `
                <div class="album-card" data-album-id="${album.id}">
                    <div class="album-card-inner">
                        <div class="album-cover">
                            <img 
                                src="${coverImageUrl}" 
                                alt="${this.escapeAttributeValue('Cover art for ' + album.title)}"
                                class="cover-image"
                                loading="lazy"
                                onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
                            />
                            <div class="album-placeholder" style="display: none;">
                                <div class="placeholder-icon">🎵</div>
                                <div class="placeholder-text">No Cover</div>
                            </div>
                            <div class="album-overlay">
                                <div class="album-actions">
                                    <button class="overlay-circle-btn more-info-btn" data-album-id="${album.id || albumData.id}" title="More Info">
                                        ℹ️
                                    </button>
                                    <button class="overlay-circle-btn spotify-btn" data-search-query="${(artistsDisplay || albumData.artist)} ${(album.title || albumData.title)}" title="Spotify">
                                        🎵
                                    </button>
                                    <button class="overlay-circle-btn youtube-btn" data-search-query="${(artistsDisplay || albumData.artist)} ${(album.title || albumData.title)}" title="YouTube">
                                        📺
                                    </button>
                                </div>
                            </div>
                            <div class="card-edit-overlay">
                                <button class="card-edit-btn edit" onclick="window.albumApp.openEditAlbumModal('${album.id || albumData.id}'); event.stopPropagation();" title="Edit Album">
                                    ✏️
                                </button>
                                <button class="card-edit-btn delete" onclick="window.albumApp.confirmDeleteAlbum('${album.id || albumData.id}', '${this.escapeAttributeValue((album.title || albumData.title))}'); event.stopPropagation();" title="Delete Album">
                                    🗑️
                                </button>
                            </div>
                        </div>
                        <div class="album-info">
                            <h3 class="album-title" title="${album.title}">${album.title}</h3>
                            <p class="album-artist" title="${artistsDisplay}">${artistsDisplay}</p>
                            <p class="album-year">${album.year || 'Unknown Year'}</p>
                            <div class="album-meta">
                                <span class="track-count">${album.track_count || album.trackCount || 0} tracks</span>
                                ${genreStyleTagsHtml}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        return `
            <div class="artist-albums-modal">
                ${rolesTabsHtml}
                
                <div class="modal-section">
                    <div class="albums-section-header">
                        <div class="modal-search-container">
                            <input type="text" 
                                   id="artist-albums-search" 
                                   placeholder="🔍 Search by title, artist, year, genre, role, track..." 
                                   class="modal-search-input"
                                   data-artist="${artist.name}">
                            <div class="search-results-count" id="search-results-count">
                                ${sortedAlbums.length} album${sortedAlbums.length !== 1 ? 's' : ''}
                            </div>
                        </div>
                        <div class="modal-sort-controls">
                            <label>Sort by:</label>
                            <select id="artist-albums-sort" data-artist="${artist.name}">
                                <option value="year-asc" selected>Year (Ascending)</option>
                                <option value="year-desc">Year (Descending)</option>
                                <option value="title-asc">Title (A-Z)</option>
                                <option value="title-desc">Title (Z-A)</option>
                                <option value="random">Random</option>
                            </select>
                            <button class="shuffle-btn hidden" id="artist-albums-shuffle" data-artist="${artist.name}">🔀 Shuffle</button>
                        </div>
                    </div>
                        <div class="role-filter-status" id="role-filter-status" style="display: none;">
                            <span class="filter-text">Filtered by role: <strong id="current-role-filter"></strong></span>
                            <button class="clear-filter-btn" onclick="window.albumApp.clearRoleFilter('${artist.name}')">Clear Filter</button>
                        </div>
                    </div>
                    <div class="albums-grid" id="artist-albums-grid" data-artist="${artist.name}" data-all-albums='${this.escapeJsonForAttribute(sortedAlbums)}'>
                        ${albumsHtml}
                    </div>
                </div>
            </div>
        `;
    }
    
    // Generate artist role tabs HTML with musical/technical separation
    generateArtistRoleTabsHtml(artist, musicalRoles, technicalRoles) {
        // Create a JavaScript-safe ID by removing quotes and special characters
        const artistId = (artist.id || artist.name)
            .replace(/['"]/g, '') // Remove quotes
            .replace(/\s+/g, '-') // Replace spaces with dashes
            .replace(/[^a-zA-Z0-9\-_]/g, ''); // Remove other special characters
        
        // Get ALL actual roles from credits (no filtering)
        const allActualRoles = this.getAllActualRolesFromCredits(artist.name);
        
        if (allActualRoles.length === 0) {
            return '<div class="no-roles">No role information available</div>';
        }

        // Separate into musical vs technical using role categorizer
        const actualMusicalRoles = [];
        const actualTechnicalRoles = [];
        
        allActualRoles.forEach(role => {
            const category = window.roleCategorizer.categorizeRole(role);
            if (category === 'musical') {
                actualMusicalRoles.push(role);
            } else {
                actualTechnicalRoles.push(role);
            }
        });
        
        console.log(`🎭 All actual roles for ${artist.name}:`, {
            totalRoles: allActualRoles.length,
            musical: actualMusicalRoles,
            technical: actualTechnicalRoles
        });

        const musicalRolesHtml = actualMusicalRoles.length > 0 
            ? actualMusicalRoles.map(role => `<span class="role-tag musical-role clickable-role-filter" data-role="${role}" data-artist="${this.escapeHtmlAttribute(artist.name)}">${role}</span>`).join('')
            : '<p class="no-content">No musical roles found</p>';
            
        const technicalRolesHtml = actualTechnicalRoles.length > 0 
            ? actualTechnicalRoles.map(role => `<span class="role-tag technical-role clickable-role-filter" data-role="${role}" data-artist="${this.escapeHtmlAttribute(artist.name)}">${role}</span>`).join('')
            : '<p class="no-content">No technical roles found</p>';

        // Determine which tab should be active by default
        // If artist has no musical roles but has technical roles, default to technical tab
        const defaultToTechnical = actualMusicalRoles.length === 0 && actualTechnicalRoles.length > 0;
        const musicalTabActive = !defaultToTechnical;
        const technicalTabActive = defaultToTechnical;

        console.log(`🎭 Tab selection for ${artist.name}: defaultToTechnical=${defaultToTechnical}, musical=${actualMusicalRoles.length}, technical=${actualTechnicalRoles.length}`);
        
        return `
            <div class="artist-roles-section">
                <div class="artist-role-tabs">
                    <button class="role-tab-btn ${musicalTabActive ? 'active' : ''}" 
                            onclick="window.albumApp.switchArtistRoleTab('${artistId}', 'musical')">
                        Musical Roles (${actualMusicalRoles.length})
                    </button>
                    <button class="role-tab-btn ${technicalTabActive ? 'active' : ''}" 
                            onclick="window.albumApp.switchArtistRoleTab('${artistId}', 'technical')">
                        Technical Roles (${actualTechnicalRoles.length})
                    </button>
                </div>
                <div class="artist-role-content">
                    <div id="musical-roles-${artistId}" class="role-tab-content ${musicalTabActive ? 'active' : ''}">
                        ${musicalRolesHtml}
                    </div>
                    <div id="technical-roles-${artistId}" class="role-tab-content ${technicalTabActive ? 'active' : ''}">
                        ${technicalRolesHtml}
                    </div>
                </div>
            </div>
        `;
    }
    
    // Get roles that actually exist in album credits (filter out derived/inferred roles)
    getActualRolesInCredits(artistName, rolesList) {
        const actualRoles = new Set();
        const debugInfo = {
            artistName,
            originalRolesList: [...rolesList],
            creditsFound: [],
            rolesAfterCleaning: [],
            finalRoles: []
        };
        
        // Go through all albums and find roles this artist actually has in credits
        this.collection.albums.forEach(album => {
            if (album.credits && Array.isArray(album.credits)) {
                album.credits.forEach(credit => {
                    if (credit.name === artistName) {
                        const originalRole = credit.role;
                        const cleanedRole = this.cleanRoleName(credit.role);
                        
                        debugInfo.creditsFound.push({
                            album: album.title,
                            role: originalRole,
                            cleaned: cleanedRole
                        });
                        
                        // Add both original and cleaned versions for flexible matching
                        if (originalRole) actualRoles.add(originalRole);
                        if (cleanedRole) actualRoles.add(cleanedRole);
                    }
                });
            }
        });
        
        debugInfo.rolesAfterCleaning = [...actualRoles];
        
        // Return roles that match either the original or cleaned version
        const result = rolesList.filter(role => {
            const cleanedRole = this.cleanRoleName(role);
            
            // Match if:
            // 1. Exact match with original role
            // 2. Exact match with cleaned role
            // 3. The role's cleaned version matches any actual role
            // 4. Any actual role's cleaned version matches this role's cleaned version
            return actualRoles.has(role) || 
                   actualRoles.has(cleanedRole) ||
                   [...actualRoles].some(actualRole => {
                       const actualCleaned = this.cleanRoleName(actualRole);
                       return actualCleaned === cleanedRole || actualCleaned === role;
                   });
        }).map(role => {
            // Return cleaned version for display consistency
            const cleanedRole = this.cleanRoleName(role);
            return cleanedRole || role;
        }).filter(role => role); // Remove any null/empty values
        
        debugInfo.finalRoles = result;
        
        // Log debug info for specific artists
        if (artistName === 'Herbie Hancock') {
            console.log('🎭 DEBUG: Herbie Hancock role filtering:', debugInfo);
        }
        
        return result;
    }
    
    // Get ALL actual roles from credits (no filtering - show everything the artist actually has)
    // For artist modals: split comma-separated roles and keep bracketed details
    getAllActualRolesFromCredits(artistName) {
        const roleFrequency = new Map();
        
        // Go through all albums and collect ALL roles this artist has with frequency
        this.collection.albums.forEach(album => {
            if (album.credits && Array.isArray(album.credits)) {
                album.credits.forEach(credit => {
                    if (credit.name === artistName) {
                        const originalRole = credit.role;
                        
                        // Use smart splitting that respects bracket boundaries
                        const individualRoles = this.smartSplitRoles(originalRole);
                        
                        individualRoles.forEach(role => {
                            if (role) {
                                // Keep bracketed details for artist modals - don't clean them
                                // Only filter out obvious company names
                                const lowerRole = role.toLowerCase();
                                const isCompanyName = ['company', 'corporation', 'corp', 'inc', 'ltd', 'llc',
                                    'records', 'recording', 'studios', 'studio', 'sound',
                                    'entertainment', 'music', 'productions'].some(indicator => 
                                    lowerRole.includes(indicator) && 
                                    (lowerRole.endsWith(indicator) || lowerRole.includes(indicator + ' ')));
                                
                                if (!isCompanyName) {
                                    // Count frequency
                                    roleFrequency.set(role, (roleFrequency.get(role) || 0) + 1);
                                }
                            }
                        });
                    }
                });
            }
        });
        
        // Convert to array and sort by frequency (most frequent first)
        const sortedRoles = Array.from(roleFrequency.entries())
            .sort((a, b) => b[1] - a[1]) // Sort by frequency descending
            .map(entry => entry[0]); // Extract just the role names
        
        return sortedRoles;
    }
    
    // Switch between musical and technical role tabs
    switchArtistRoleTab(artistId, tabType) {
        // Update tab buttons
        const tabs = document.querySelectorAll('.role-tab-btn');
        tabs.forEach(tab => tab.classList.remove('active'));
        event.target.classList.add('active');
        
        // Update content
        const musicalContent = document.getElementById(`musical-roles-${artistId}`);
        const technicalContent = document.getElementById(`technical-roles-${artistId}`);
        
        if (tabType === 'musical') {
            musicalContent.classList.add('active');
            technicalContent.classList.remove('active');
        } else {
            technicalContent.classList.add('active');
            musicalContent.classList.remove('active');
        }
    }
    
    // Filter albums in artist modal by specific role (integrates with sorting)
    filterAlbumsByRole(artistName, role) {
        // Unescape the artist name since it comes from an HTML attribute
        const unescapedArtistName = this.unescapeHtmlAttribute(artistName);
        console.log(`🎭 Filtering albums for ${unescapedArtistName} by role: ${role}`);
        
        const albumsGrid = document.getElementById('artist-albums-grid');
        if (!albumsGrid) {
            console.error('❌ Albums grid not found');
            return;
        }
        
        // Get all albums data
        const allAlbumsData = albumsGrid.getAttribute('data-all-albums');
        if (!allAlbumsData) {
            console.error('❌ No albums data found');
            return;
        }
        
        let allAlbums;
        try {
            allAlbums = JSON.parse(allAlbumsData);
        } catch (e) {
            console.error('❌ Error parsing albums data:', e);
            return;
        }
        
        // Filter albums where artist had this specific role
        const filteredAlbums = allAlbums.filter(album => {
            return this.artistHasRoleOnAlbum(unescapedArtistName, role, album);
        });
        
        console.log(`🎯 Filter result: ${filteredAlbums.length} albums visible out of ${allAlbums.length} total`);
        
        // Get current sort setting and apply it to filtered albums
        const sortSelect = document.getElementById('artist-albums-sort');
        const currentSort = sortSelect ? sortSelect.value : 'year-asc';
        
        // Sort the filtered albums according to current sort setting
        let sortedFilteredAlbums = [...filteredAlbums];
        
        switch(currentSort) {
            case 'year-asc':
                sortedFilteredAlbums.sort((a, b) => {
                    const yearA = this.isValidYear(a.year) ? a.year : Infinity;
                    const yearB = this.isValidYear(b.year) ? b.year : Infinity;
                    return yearA - yearB;
                });
                break;
            case 'year-desc':
                sortedFilteredAlbums.sort((a, b) => {
                    const yearA = this.isValidYear(a.year) ? a.year : -Infinity;
                    const yearB = this.isValidYear(b.year) ? b.year : -Infinity;
                    return yearB - yearA;
                });
                break;
            case 'title-asc':
                sortedFilteredAlbums.sort((a, b) => a.title.localeCompare(b.title));
                break;
            case 'title-desc':
                sortedFilteredAlbums.sort((a, b) => b.title.localeCompare(a.title));
                break;
            case 'random':
                this.shuffleArray(sortedFilteredAlbums);
                break;
        }
        
        // Re-render grid with filtered and sorted albums
        this.renderArtistAlbumsGrid(unescapedArtistName, sortedFilteredAlbums, role);
        
        // Show filter status
        this.showRoleFilterStatus(role, sortedFilteredAlbums.length);
        
        console.log(`✅ Filtered to ${sortedFilteredAlbums.length} albums with role "${role}" (sorted by ${currentSort})`);
    }
    
    // Extract roles by removing brackets and splitting bracketed content
    extractExpandedRoles(roleString) {
        if (!roleString || typeof roleString !== 'string') {
            return [];
        }
        
        const roles = [];
        
        // Check if role has brackets
        const bracketMatch = roleString.match(/^([^[]+)\s*\[([^\]]+)\](.*)$/);
        
        if (bracketMatch) {
            // Has brackets: "Synthesizer [Oberheim, Prophet V]"
            const mainRole = bracketMatch[1].trim(); // "Synthesizer"
            const bracketContent = bracketMatch[2].trim(); // "Oberheim, Prophet V" 
            const suffix = bracketMatch[3].trim(); // anything after brackets
            
            // Add main role
            if (mainRole) {
                roles.push(mainRole);
            }
            
            // Split bracketed content by commas and add each as separate role
            const bracketRoles = bracketContent.split(',').map(r => r.trim()).filter(r => r);
            roles.push(...bracketRoles);
            
            // Add suffix if exists
            if (suffix) {
                roles.push(suffix);
            }
        } else {
            // No brackets: treat as simple role
            roles.push(roleString.trim());
        }
        
        return roles.filter(role => role); // Remove empty roles
    }

    // Smart role splitting that first expands brackets, then handles commas
    smartSplitRoles(roleString) {
        if (!roleString || typeof roleString !== 'string') {
            return [];
        }
        
        const allRoles = [];
        
        // First split by commas at the top level
        const commaSeparatedParts = [];
        let current = '';
        let bracketDepth = 0;
        
        for (let i = 0; i < roleString.length; i++) {
            const char = roleString[i];
            
            if (char === '[') {
                bracketDepth++;
                current += char;
            } else if (char === ']') {
                bracketDepth--;
                current += char;
            } else if (char === ',' && bracketDepth === 0) {
                if (current.trim()) {
                    commaSeparatedParts.push(current.trim());
                }
                current = '';
            } else {
                current += char;
            }
        }
        
        if (current.trim()) {
            commaSeparatedParts.push(current.trim());
        }
        
        // Now expand each part (extract main role + bracketed content)
        commaSeparatedParts.forEach(part => {
            const expandedRoles = this.extractExpandedRoles(part);
            allRoles.push(...expandedRoles);
        });
        
        return allRoles;
    }

    // Check if artist has specific role on album
    artistHasRoleOnAlbum(artistName, role, album) {
        if (!album.credits || !Array.isArray(album.credits)) {
            return false;
        }
        
        return album.credits.some(credit => {
            if (credit.name !== artistName) return false;
            
            // Use smart splitting that respects bracket boundaries
            const individualRoles = this.smartSplitRoles(credit.role);
            
            // Check if any individual role matches
            return individualRoles.some(individualRole => {
                // EXACT match first - preserves full specificity
                if (individualRole === role) return true;
                
                // For role filtering, be more strict - clean both roles and compare exactly
                const cleanedCreditRole = this.cleanRoleName(individualRole);
                const cleanedSearchRole = this.cleanRoleName(role);
                
                // Skip if either role was filtered out (cleanRoleName returns null for company names)
                if (cleanedCreditRole === null || cleanedSearchRole === null) {
                    return false;
                }
                
                // Exact match after cleaning
                if (cleanedCreditRole === cleanedSearchRole) return true;
                
                // Case-insensitive exact match after cleaning
                if (cleanedCreditRole.toLowerCase() === cleanedSearchRole.toLowerCase()) return true;
                
                return false;
            });
        });
    }
    
    // Show role filter status
    showRoleFilterStatus(role, albumCount) {
        const filterStatus = document.getElementById('role-filter-status');
        
        if (filterStatus) {
            // Update the albums count in the status
            const albumText = albumCount === 1 ? '1 album' : `${albumCount} albums`;
            const artistName = document.getElementById('artist-albums-grid')?.getAttribute('data-artist') || '';
            filterStatus.innerHTML = `<span class="filter-text">Filtered by role: <strong>${role}</strong> (${albumText})</span>
                                      <button class="clear-filter-btn" onclick="window.albumApp.clearRoleFilter('${artistName}')">Clear Filter</button>`;
            filterStatus.style.display = 'flex';
        }
    }
    
    // Clear role filter (maintains current sort order)
    clearRoleFilter(artistName) {
        console.log(`🎭 Clearing role filter for ${artistName}`);
        
        const albumsGrid = document.getElementById('artist-albums-grid');
        const filterStatus = document.getElementById('role-filter-status');
        
        // IMPORTANT: Clear the filter UI state FIRST before sorting
        if (filterStatus) {
            filterStatus.style.display = 'none';
        }
        
        // Remove active filter styling from all role tags
        document.querySelectorAll('.clickable-role-filter').forEach(role => {
            role.classList.remove('active-filter');
        });
        
        if (albumsGrid) {
            // Get all albums data
            const allAlbumsData = albumsGrid.getAttribute('data-all-albums');
            if (allAlbumsData) {
                try {
                    const allAlbums = JSON.parse(allAlbumsData);
                    
                    // Get current sort setting and apply it to all albums
                    const sortSelect = document.getElementById('artist-albums-sort');
                    const currentSort = sortSelect ? sortSelect.value : 'year-asc';
                    
                    // Apply the current sort to all albums (now that filter state is cleared)
                    this.sortArtistAlbums(artistName, currentSort);
                    
                } catch (e) {
                    console.error('❌ Error parsing albums data while clearing filter:', e);
                    // Fallback: show all album cards
                    const allAlbumCards = albumsGrid.querySelectorAll('.album-card');
                    allAlbumCards.forEach(card => {
                        card.style.display = 'block';
                    });
                }
            }
        }
        
        console.log(`✅ Role filter cleared, showing all albums with current sort`);
    }

    // ============================================
    // SCRAPED CONTENT DISPLAY FUNCTIONALITY
    // ============================================
    
    switchScrapedTab(tabType) {
        // Remove active class from all tabs and content
        document.querySelectorAll('.scraped-tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.scraped-tab-content').forEach(content => content.classList.remove('active'));
        
        // Add active class to selected tab and content
        const tabBtn = document.querySelector(`[data-tab="scraped-${tabType}"]`);
        const tabContent = document.getElementById(`scraped-${tabType}-tab`);
        
        if (tabBtn) tabBtn.classList.add('active');
        if (tabContent) tabContent.classList.add('active');
        
        console.log(`📋 Switched to scraped ${tabType} tab`);
    }
    
    updateScrapedContentStats() {
        // Update collection statistics
        const albumsCount = this.collection.albums.length;
        const artistsCount = this.collection.artists.length;
        const tracksCount = this.collection.tracks.length;
        
        const albumsCountEl = document.getElementById('scraped-albums-count');
        const artistsCountEl = document.getElementById('scraped-artists-count');
        const tracksCountEl = document.getElementById('scraped-tracks-count');
        
        if (albumsCountEl) albumsCountEl.textContent = albumsCount;
        if (artistsCountEl) artistsCountEl.textContent = artistsCount;
        if (tracksCountEl) tracksCountEl.textContent = tracksCount;
        
        console.log(`📊 Updated stats: ${albumsCount} albums, ${artistsCount} artists, ${tracksCount} tracks`);
    }
    
    updateScrapedArtistsList() {
        const container = document.getElementById('scraped-artists-list');
        if (!container) return;
        
        const artists = this.collection.artists || [];
        
        if (artists.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>🎭 No artists scraped yet</p>
                    <p>Start by searching and scraping an artist's discography below.</p>
                </div>
            `;
            return;
        }
        
        // Sort artists by album count (descending)
        const sortedArtists = [...artists].sort((a, b) => {
            const aCount = a.albums ? a.albums.length : 0;
            const bCount = b.albums ? b.albums.length : 0;
            return bCount - aCount;
        });
        
        const artistsHtml = sortedArtists.map(artist => {
            const initials = artist.name.split(' ')
                .map(word => word.charAt(0).toUpperCase())
                .join('')
                .slice(0, 2);
            
            const albumCount = artist.albums ? artist.albums.length : 0;
            const topRoles = artist.roles ? artist.roles.slice(0, 2) : [];
            
            return `
                <div class="scraped-artist-item">
                    <div class="scraped-artist-info">
                        <div class="scraped-artist-avatar">${initials}</div>
                        <div class="scraped-artist-details">
                            <div class="scraped-artist-name">${artist.name}</div>
                            <div class="scraped-artist-meta">
                                ${topRoles.length > 0 ? topRoles.join(', ') : 'Various roles'}
                            </div>
                        </div>
                    </div>
                    <div class="scraped-artist-stats">
                        <div class="scraped-artist-albums">${albumCount}</div>
                        <span>albums</span>
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = artistsHtml;
        console.log(`📋 Updated scraped artists list: ${artists.length} artists`);
    }
    
    updateScrapedAlbumsList() {
        const container = document.getElementById('scraped-albums-list');
        if (!container) return;
        
        const albums = this.collection.albums || [];
        
        if (albums.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>💿 No albums scraped yet</p>
                    <p>Recent albums will appear here after scraping.</p>
                </div>
            `;
            return;
        }
        
        // Sort albums by year (descending) and take the most recent 20
        const sortedAlbums = [...albums]
            .sort((a, b) => (b.year || 0) - (a.year || 0))
            .slice(0, 20);
        
        const albumsHtml = sortedAlbums.map((album, index) => {
            const isRecent = index < 5; // Mark first 5 as recently added
            const coverImage = album.cover_image || album.images?.[0]?.uri;
            
            return `
                <div class="scraped-album-item ${isRecent ? 'recently-added' : ''}">
                    <div class="scraped-album-cover">
                        ${coverImage ? 
                            `<img src="${coverImage}" alt="${album.title}" loading="lazy">` :
                            '🎵'
                        }
                    </div>
                    <div class="scraped-album-details">
                        <div class="scraped-album-title">${album.title}</div>
                        <div class="scraped-album-meta">
                            <span>${album.artist || 'Unknown Artist'}</span>
                            ${album.year ? `<span class="scraped-album-year">${album.year}</span>` : ''}
                        </div>
                    </div>
                    <div class="scraped-album-timestamp">
                        ${isRecent ? 'Recent' : album.year || ''}
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = albumsHtml;
        console.log(`📋 Updated scraped albums list: ${albums.length} total, showing ${sortedAlbums.length} most recent`);
    }
    
    refreshScrapedContentDisplay() {
        // Update scraped artists history display
        this.renderScrapedHistory();
        
        console.log('🔄 Refreshed scraped content display');
    }
    
    // ============================================
    // SCRAPER FUNCTIONALITY (Step 3.1)
    // ============================================
    
    setupScraperEvents() {
        console.log('🔧 Setting up scraper event listeners...');
        
        // Artist search functionality
        const artistSearchBtn = document.getElementById('search-artists-btn');
        const artistSearchInput = document.getElementById('artist-search');
        
        if (artistSearchBtn && artistSearchInput) {
            artistSearchBtn.addEventListener('click', () => this.searchArtists());
            artistSearchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.searchArtists();
            });
        }
        
        // Album search functionality (Step 3.2)
        const albumSearchBtn = document.getElementById('search-albums-btn');
        const albumSearchInput = document.getElementById('album-search');
        const scrapeAlbumsBtn = document.getElementById('scrape-albums-btn');
        
        if (albumSearchBtn && albumSearchInput) {
            albumSearchBtn.addEventListener('click', () => this.searchAlbums());
            albumSearchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.searchAlbums();
            });
        }
        
        if (scrapeAlbumsBtn) {
            scrapeAlbumsBtn.addEventListener('click', () => this.scrapeSelectedAlbums());
        }
        
        // Initialize album cart
        this.albumCart = [];
        
        // Initialize Discogs API and Parser
        this.discogsAPI = new window.DiscogsAPI();
        
        // Use the singleton parser instance instead of creating a new one
        this.parser = window.discogsParser;
        if (!this.parser) {
            console.error('❌ DiscogsDataParser not available. Check if parser.js loaded correctly.');
            // Fallback: try to create a new instance
            try {
                this.parser = new window.DiscogsDataParser();
            } catch (error) {
                console.error('❌ Failed to create DiscogsDataParser instance:', error);
                this.parser = null;
            }
        }
        
        console.log('✅ Scraper events setup complete', { 
            parser: this.parser ? 'available' : 'NOT AVAILABLE',
            discogsAPI: this.discogsAPI ? 'available' : 'NOT AVAILABLE'
        });
    }
    
    async searchArtists() {
        const searchInput = document.getElementById('artist-search');
        const resultsContainer = document.getElementById('artist-results');
        const query = searchInput.value.trim();
        
        if (!query) {
            alert('Please enter an artist name to search');
            return;
        }
        
        console.log(`🔍 Searching for artist: ${query}`);
        this.showLoading('Searching for artists...');
        
        try {
            // Search for artists with more results for selection
            const searchResults = await this.discogsAPI.searchArtist(query, 10);
            
            if (!searchResults || searchResults.length === 0) {
                this.hideLoading();
                resultsContainer.innerHTML = '<p class="no-results">No artists found. Try a different search term.</p>';
                return;
            }
            
            console.log(`✅ Found ${searchResults.length} artists`);
            this.displayArtistSearchResults(searchResults);
            this.hideLoading();
            
        } catch (error) {
            console.error('❌ Error searching artists:', error);
            this.hideLoading();
            resultsContainer.innerHTML = '<p class="error-message">Error searching artists. Please try again.</p>';
        }
    }
    
    displayArtistSearchResults(artists) {
        const resultsContainer = document.getElementById('artist-results');
        
        if (!artists || artists.length === 0) {
            resultsContainer.innerHTML = '<p class="no-results">No artists found.</p>';
            return;
        }
        
        const resultsHtml = artists.map(artist => `
            <div class="search-result-item artist-result" data-discogs-id="${artist.id}">
                <div class="result-info">
                    <div class="result-title">
                        <span class="artist-name">${artist.title}</span>
                    </div>
                    <div class="result-meta">
                        ID: ${artist.id} | Type: ${artist.type || 'Artist'}
                        ${artist.thumb ? ` | Has Image` : ''}
                    </div>
                </div>
                <div class="result-actions">
                    <button class="scrape-artist-btn" data-artist-id="${artist.id}" data-artist-name="${artist.title}">
                        🎧 Scrape Discography
                    </button>
                </div>
            </div>
        `).join('');
        
        resultsContainer.innerHTML = `
            <div class="search-results-header">
                <h4>Found ${artists.length} artists:</h4>
            </div>
            <div class="search-results-list">
                ${resultsHtml}
            </div>
        `;
        
        // Add event listeners to scrape buttons
        document.querySelectorAll('.scrape-artist-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const artistId = e.target.getAttribute('data-artist-id');
                const artistName = e.target.getAttribute('data-artist-name');
                this.scrapeArtistDiscography(artistId, artistName);
            });
        });
        
        // Mark already scraped artists
        setTimeout(() => this.markSearchResultsAsScraped(), 100);
    }
    
    async scrapeArtistDiscography(artistId, artistName) {
        console.log(`🎼 Starting discography scrape for: ${artistName} (ID: ${artistId})`);
        
        const btn = document.querySelector(`[data-artist-id="${artistId}"]`);
        if (btn) {
            btn.disabled = true;
            btn.textContent = '⏳ Scraping...';
        }
        
        // Enhanced progress tracking
        let progressState = {
            totalPages: 0,
            currentPage: 0,
            totalReleases: 0,
            processed: 0,
            added: 0,
            skipped: 0,
            errors: 0,
            musicalRoleFiltered: 0,  // NEW: Track musical role filtering
            startTime: Date.now()
        };
        
        this.showLoading(`Discovering ${artistName} discography...`);
        
        try {
            let page = 1;
            let totalProcessed = 0;
            let totalAdded = 0;
            let totalSkipped = 0;
            let totalErrors = 0;
            let hasMorePages = true;
            let consecutiveErrors = 0;
            const MAX_CONSECUTIVE_ERRORS = 5;
            
            // First, get total count for better progress tracking
            console.log(`📊 Getting total release count for ${artistName}...`);
            const firstPageData = await this.discogsAPI.getArtistReleases(artistId, 1, 100);
            if (firstPageData && firstPageData.pagination) {
                progressState.totalPages = firstPageData.pagination.pages;
                progressState.totalReleases = firstPageData.pagination.items;
                console.log(`📊 Found ${progressState.totalReleases} total releases across ${progressState.totalPages} pages`);
            }
            
            while (hasMorePages) {
                progressState.currentPage = page;
                
                const pageProgress = progressState.totalPages > 0 ? 
                    `(Page ${page}/${progressState.totalPages})` : 
                    `(Page ${page})`;
                
                console.log(`📄 Fetching page ${page} for ${artistName}...`);
                this.updateLoadingText(`🔍 ${artistName} ${pageProgress} - Discovering releases...`);
                
                const releasesData = page === 1 && firstPageData ? firstPageData : 
                    await this.discogsAPI.getArtistReleases(artistId, page, 100);
                
                if (!releasesData || !releasesData.releases || releasesData.releases.length === 0) {
                    console.log(`📄 No more releases found on page ${page}`);
                    hasMorePages = false;
                    break;
                }
                
                console.log(`📄 Processing ${releasesData.releases.length} releases from page ${page}...`);
                
                for (let i = 0; i < releasesData.releases.length; i++) {
                    const release = releasesData.releases[i];
                    totalProcessed++;
                    progressState.processed = totalProcessed;
                    
                    // Calculate progress percentage
                    const overallProgress = progressState.totalReleases > 0 ? 
                        Math.round((totalProcessed / progressState.totalReleases) * 100) : 0;
                    
                    const releaseProgress = `${totalProcessed}`;
                    const totalText = progressState.totalReleases > 0 ? `/${progressState.totalReleases}` : '';
                    
                    // Adaptive progress updates - less frequent in background tabs
                    const shouldUpdateProgress = !window.tabVisibility || window.tabVisibility.shouldUpdateProgress() || 
                        (totalProcessed % 5 === 0); // Every 5th album in background
                    
                    if (shouldUpdateProgress) {
                        // Update progress every release with cleaner formatting
                        this.updateLoadingText(
                            `🎵 ${artistName} ${pageProgress}\n\n` +
                            `Processing: ${releaseProgress}${totalText} releases ${overallProgress > 0 ? `(${overallProgress}%)` : ''}\n\n` +
                            `✅ Added: ${totalAdded}  |  ⏭️ Skipped: ${totalSkipped}  |  ❌ Errors: ${totalErrors}\n` +
                            `🎭 Musical Role Filtered: ${progressState.musicalRoleFiltered}\n\n` +
                            `Current: ${release.title}` +
                            (!window.tabVisibility?.isVisible ? '\n\n🔍 Background tab detected' : '')
                        );
                    }
                    
                    try {
                        // Check if this release should be processed
                        if (!this.shouldProcessRelease(release)) {
                            totalSkipped++;
                            console.log(`⏭️ Skipping ${release.title} - filtered out`);
                            continue;
                        }
                        
                        // Get full release details
                        let releaseData;
                        if (release.type === 'master') {
                            // For master releases, get the main release
                            const masterData = await this.discogsAPI.getMasterRelease(release.id);
                            if (masterData && masterData.main_release) {
                                releaseData = await this.discogsAPI.getRelease(masterData.main_release);
                            }
                        } else {
                            releaseData = await this.discogsAPI.getRelease(release.id);
                        }
                        
                        if (!releaseData) {
                            totalErrors++;
                            console.log(`⚠️ Could not fetch full data for ${release.title}`);
                            continue;
                        }
                        
                        // STRICT MUSICAL ROLE FILTERING: Only include if target artist performs music
                        if (!window.hasScrapedArtistMusicalRole(releaseData, artistName)) {
                            progressState.musicalRoleFiltered++;
                            totalSkipped++;
                            console.log(`🎭 MUSICAL ROLE FILTERED: '${release.title}' - ${artistName} has no musical/performance role`);
                            continue;
                        }

                        // FAILSAFE: Double-check one more time before parsing
                        console.log(`🔒 FAILSAFE CHECK: Re-validating musical role for "${artistName}" in "${release.title}"`);
                        if (!window.hasScrapedArtistMusicalRole(releaseData, artistName)) {
                            progressState.musicalRoleFiltered++;
                            totalSkipped++;
                            console.log(`🚨 FAILSAFE TRIGGERED: Album would have passed but caught by double-check!`);
                            continue;
                        }
                        
                        // Secondary format filtering (after musical role check)
                        if (!window.shouldIncludeAlbum(releaseData)) {
                            totalSkipped++;
                            console.log(`🚫 FORMAT FILTERED: '${release.title}' - failed format/quality checks`);
                            continue;
                        }
                        
                        // Parse the release data to create album
                        const album = this.parser.parseAlbum(releaseData);
                        
                        if (!album) {
                            totalErrors++;
                            console.log(`⚠️ Could not parse album data for ${release.title}`);
                            if (window.CONFIG.DEBUG.ENABLED) {
                                console.log(`   Release data:`, releaseData);
                            }
                            continue;
                        }
                        
                        if (window.CONFIG.DEBUG.ENABLED) {
                            console.log(`🎵 Parsed album: ${album.title} (${album.year})`);
                        }
                        
                        // Check for duplicates and prioritize earlier releases
                        const duplicateStatus = this.checkAlbumDuplicateStatus(album);
                        
                        if (duplicateStatus.isDuplicate && !duplicateStatus.shouldReplace) {
                            totalSkipped++;
                            consecutiveErrors = 0; // Reset error counter on success
                            console.log(`🔄 Duplicate skipped: ${album.title} (${album.year})`);
                        } else if (duplicateStatus.shouldReplace) {
                            // Replace with earlier version
                            const replaced = await this.replaceAlbumWithEarlierVersion(album, duplicateStatus.existingIndex);
                            if (replaced) {
                                totalAdded++;
                                consecutiveErrors = 0;
                                console.log(`🔄 Replaced with earlier version: ${album.title} (${album.year})`);
                            } else {
                                totalErrors++;
                                console.log(`❌ Failed to replace: ${album.title} (${album.year})`);
                            }
                        } else {
                            // Add new album
                            await this.addAlbumToCollection(album);
                            totalAdded++;
                            consecutiveErrors = 0; // Reset error counter on success
                            console.log(`✅ Added: ${album.title} (${album.year})`);
                        }
                        
                        // Adaptive rate limiting delay based on tab visibility
                        const baseDelay = window.CONFIG.DISCOGS.RATE_LIMIT.SCRAPER_DELAY;
                        const adaptiveDelay = window.tabVisibility ? 
                            window.tabVisibility.getOptimalDelay(baseDelay) : baseDelay;
                        
                        await this.sleep(adaptiveDelay);
                        
                        // Log tab visibility impact on delay
                        if (window.CONFIG.DEBUG.ENABLED && window.tabVisibility && !window.tabVisibility.isVisible) {
                            console.log(`🔍 Background tab detected: Using ${adaptiveDelay}ms delay instead of ${baseDelay}ms`);
                        }
                        
                    } catch (releaseError) {
                        consecutiveErrors++;
                        totalErrors++;
                        console.error(`❌ Error processing release ${release.title} (consecutive errors: ${consecutiveErrors}):`, releaseError);
                        
                        // Circuit breaker: pause if too many consecutive errors
                        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
                            console.warn(`🚨 Circuit breaker triggered! ${consecutiveErrors} consecutive errors. Pausing for 30 seconds...`);
                            this.updateLoadingText(`⚠️ Too many errors, cooling down for 30 seconds...`);
                            await this.sleep(30000); // 30 second cooldown
                            consecutiveErrors = 0; // Reset after cooldown
                        }
                        
                        continue;
                    }
                }
                
                // Check for next page
                const pagination = releasesData.pagination;
                if (pagination && pagination.urls && pagination.urls.next) {
                    page++;
                    
                    // Adaptive page delay based on tab visibility
                    const basePageDelay = window.CONFIG.DISCOGS.RATE_LIMIT.PAGE_DELAY;
                    const adaptivePageDelay = window.tabVisibility ? 
                        window.tabVisibility.getOptimalDelay(basePageDelay) : basePageDelay;
                    
                    await this.sleep(adaptivePageDelay);
                    
                    if (window.CONFIG.DEBUG.ENABLED && window.tabVisibility && !window.tabVisibility.isVisible) {
                        console.log(`🔍 Background tab: Page delay ${adaptivePageDelay}ms (normal: ${basePageDelay}ms)`);
                    }
                } else {
                    hasMorePages = false;
                }
            }
            
            this.hideLoading();
            
            console.log(`🎉 Scraping complete for ${artistName}:`);
            console.log(`   📊 Total releases processed: ${totalProcessed}`);
            console.log(`   ✅ Albums added to collection: ${totalAdded}`);
            console.log(`   ⏭️ Albums skipped: ${totalSkipped}`);
            console.log(`   ❌ Errors encountered: ${totalErrors}`);
            
            // Update UI and show success message
            try {
                this.regenerateCollectionData();
                this.refreshCurrentView();
            } catch (updateError) {
                console.error(`⚠️ Error updating UI after successful scraping:`, updateError);
                // Continue with success message since scraping was successful
            }
            
            if (btn) {
                btn.disabled = false;
                btn.textContent = `✅ Added ${totalAdded} albums`;
                btn.classList.add('completed');
            }
            
            // Enhanced success notification with detailed stats
            const elapsedTime = Math.round((Date.now() - progressState.startTime) / 1000);
            const successRate = Math.round((totalAdded / totalProcessed) * 100);
            
            // Add to scraped history
            await this.addToScrapedHistory(
                artistName, 
                artistId, 
                artistName, // search query was the artist name
                totalProcessed, 
                totalAdded, 
                true, 
                `${elapsedTime}s | ${successRate}% success rate`
            );
            
            alert(
                `🎉 Successfully scraped ${artistName}!\n\n` +
                `📊 RESULTS:\n` +
                `• Processed: ${totalProcessed} releases\n` +
                `• Added: ${totalAdded} new albums\n` +
                `• Skipped: ${totalSkipped} (duplicates/filtered)\n` +
                `• Musical Role Filtered: ${progressState.musicalRoleFiltered}\n` +
                `• Errors: ${totalErrors}\n\n` +
                `⏱️ Time: ${elapsedTime}s | 🎯 Success Rate: ${successRate}%`
            );
            
        } catch (error) {
            console.error(`❌ Error scraping discography for ${artistName}:`, error);
            this.hideLoading();
            
            // Add failed attempt to scraped history
            await this.addToScrapedHistory(
                artistName, 
                artistId, 
                artistName, 
                0, 
                0, 
                false, 
                `Error: ${error.message}`
            );
            
            if (btn) {
                btn.disabled = false;
                btn.textContent = '❌ Error - Try Again';
                btn.classList.add('error');
            }
            
            alert(`❌ Error scraping ${artistName} discography:\n${error.message}\n\nPlease try again.`);
        }
    }
    
    shouldProcessRelease(release) {
        // Apply filters from the parser
        const formats = release.formats || [];
        
        // Debug logging for filtering
        if (window.CONFIG.DEBUG.ENABLED) {
            console.log(`🔍 Checking release: ${release.title} (ID: ${release.id})`);
            console.log(`   Type: ${release.type}`);
            console.log(`   Year: ${release.year}`);
            console.log(`   Role: ${release.role}`);
            console.log(`   Formats:`, formats);
        }
        
        // For master releases, we should check the main release formats instead
        if (release.type === 'master') {
            if (window.CONFIG.DEBUG.ENABLED) {
                console.log(`   ⚠️ Master release - will fetch main release for format check`);
            }
            // We'll let this pass for now and check formats in the main release
            return true;
        }
        
        // Check for filtered format words
        if (this.parser.hasFilteredWords(formats)) {
            if (window.CONFIG.DEBUG.ENABLED) {
                console.log(`   ❌ Has filtered words`);
            }
            return false;
        }
        
        // For releases with empty formats, let's be more lenient and check the full release data later
        if (formats.length === 0) {
            if (window.CONFIG.DEBUG.ENABLED) {
                console.log(`   ⚠️ Empty formats - will check full release data`);
            }
            // Let it pass for now, we'll check the full release data
            return true;
        }
        
        // Check for album/LP format
        if (!this.parser.hasAlbumOrLpFormat(formats)) {
            if (window.CONFIG.DEBUG.ENABLED) {
                console.log(`   ❌ Not an Album/LP format`);
            }
            return false;
        }
        
        // Check for slash in title
        if (release.title && release.title.includes('/')) {
            if (window.CONFIG.DEBUG.ENABLED) {
                console.log(`   ❌ Title contains slash`);
            }
            return false;
        }
        
        if (window.CONFIG.DEBUG.ENABLED) {
            console.log(`   ✅ Release passed initial filters`);
        }
        
        return true;
    }
    
    async replaceAlbumWithEarlierVersion(album, existingIndex) {
        try {
            const existingAlbum = this.collection.albums[existingIndex];
            console.log(`🔄 Replacing "${existingAlbum.title}" (${existingAlbum.year}) with earlier version (${album.year})`);
            
            if (this.supabaseService && this.supabaseService.initialized) {
                // Remove old version from Supabase and add new one
                console.log(`📀 Updating album in Supabase: ${album.title} (${album.year})`);
                
                // Note: We could implement a proper update/replace in Supabase
                // For now, we'll just update the local collection
                // TODO: Implement Supabase album replacement if needed
                
                this.collection.albums[existingIndex] = album;
                console.log(`✅ Album replaced in collection: ${album.title} (${album.year})`);
            } else {
                // Replace in local collection
                this.collection.albums[existingIndex] = album;
                console.log(`📀 Album replaced in local collection: ${album.title} (${album.year}) [In-memory mode]`);
            }
            
            return true;
        } catch (error) {
            console.error(`❌ Failed to replace album in collection:`, error);
            return false;
        }
    }

    checkAlbumDuplicateStatus(album) {
        // Enhanced duplicate checking with year prioritization
        // Returns: { isDuplicate: boolean, shouldReplace: boolean, existingIndex: number }
        
        // First check for exact ID match (same Discogs release)
        const exactMatch = this.collection.albums.findIndex(existingAlbum => 
            existingAlbum.id === album.id
        );
        
        if (exactMatch !== -1) {
            return { isDuplicate: true, shouldReplace: false, existingIndex: exactMatch };
        }
        
        // Check for same title with same or different year
        const titleMatch = this.collection.albums.findIndex(existingAlbum => 
            existingAlbum.title === album.title && 
            existingAlbum.artist === album.artist // Also match primary artist to avoid false positives
        );
        
        if (titleMatch !== -1) {
            const existingAlbum = this.collection.albums[titleMatch];
            
            // If same year, it's a duplicate
            if (existingAlbum.year === album.year) {
                return { isDuplicate: true, shouldReplace: false, existingIndex: titleMatch };
            }
            
            // If new album has earlier year, we should replace
            if (album.year && existingAlbum.year && album.year < existingAlbum.year) {
                console.log(`🔄 Found earlier release: "${album.title}" (${album.year}) vs existing (${existingAlbum.year})`);
                return { isDuplicate: false, shouldReplace: true, existingIndex: titleMatch };
            }
            
            // If existing album has earlier year, skip new one
            if (album.year && existingAlbum.year && album.year > existingAlbum.year) {
                console.log(`⏭️ Skipping later release: "${album.title}" (${album.year}) - keeping earlier (${existingAlbum.year})`);
                return { isDuplicate: true, shouldReplace: false, existingIndex: titleMatch };
            }
            
            // If years are missing, treat as duplicate
            return { isDuplicate: true, shouldReplace: false, existingIndex: titleMatch };
        }
        
        // No match found - album is new
        return { isDuplicate: false, shouldReplace: false, existingIndex: -1 };
    }
    
    async addAlbumToCollection(album) {
        try {
            // During scraping operations, prioritize speed and avoid Supabase errors
            // Add to local collection immediately for real-time UI updates
            this.collection.albums.push(album);
            console.log(`📀 Album added to local collection: ${album.title} (${album.year})`);
            
            // Skip Supabase during scraping to avoid 406 errors with special characters
            // Note: Data will be synced to Supabase after scraping is complete
            if (this.supabaseService && this.supabaseService.initialized) {
                // Background sync to Supabase (non-blocking)
                this.syncAlbumToSupabase(album).catch(error => {
                    console.warn(`⚠️ Background Supabase sync failed for ${album.title}:`, error.message);
                    // Don't throw error - let scraping continue
                });
            }
            
        } catch (error) {
            console.error(`❌ Failed to add album to collection:`, error);
            
            // Ensure album is at least in local collection
            if (!this.collection.albums.find(a => a.id === album.id)) {
                this.collection.albums.push(album);
                console.log(`⚠️ Album added to local collection as fallback: ${album.title} (${album.year})`);
            }
        }
    }
    
    // Background method for non-blocking Supabase sync
    async syncAlbumToSupabase(album) {
        if (!this.supabaseService || !this.supabaseService.initialized) {
            return;
        }
        
        try {
            console.log(`🔄 Background sync to Supabase: ${album.title}`);
            await this.supabaseService.addAlbum(album);
            console.log(`✅ Synced to Supabase: ${album.title}`);
        } catch (error) {
            // Log but don't throw - this is background sync
            console.warn(`⚠️ Supabase sync failed for ${album.title}:`, error.message);
        }
    }
    
    async regenerateCollectionData() {
        try {
            // Always use in-memory regeneration for local collection updates
            // This avoids expensive Supabase reloads after album edits/deletions
            console.log('🔄 Regenerating collection data (in-memory mode)...');
            
            // Flag that artists need regeneration for next Artists page visit
            this.artistsNeedRegeneration = true;
            
            // Generate artists from albums
            this.collection.artists = this.generateArtistsFromAlbums();
            
            // Generate tracks from albums
            this.collection.tracks = this.generateTracksFromAlbums();
            
            // Generate roles from albums
            this.collection.roles = this.generateRolesFromAlbums();
            
            console.log(`✅ Collection updated: ${this.collection.albums.length} albums, ${this.collection.artists.length} artists, ${this.collection.tracks.length} tracks, ${this.collection.roles.length} roles`);
            
            // Update page title counts
            this.updatePageTitleCounts();
            
            // Refresh scraped content display after data regeneration
            this.refreshScrapedContentDisplay();
            
        } catch (error) {
            console.error('❌ Error regenerating collection data:', error);
            // Ensure arrays exist even if regeneration fails
            if (!this.collection.artists) this.collection.artists = [];
            if (!this.collection.tracks) this.collection.tracks = [];
            if (!this.collection.roles) this.collection.roles = [];
            
            // Still try to refresh the display with whatever data we have
            this.refreshScrapedContentDisplay();
            
            // Update page title counts (may show partial counts)
            this.updatePageTitleCounts();
        }
    }
    
    refreshCurrentView() {
        // Refresh the current view to show new data
        console.log(`🔄 Refreshing ${this.currentView} view...`);
        
        // Preserve sort state for each view
        let currentSort = null;
        
        switch (this.currentView) {
            case 'albums':
                // Get current sort selection before refresh
                const albumsSort = document.getElementById('albums-sort');
                if (albumsSort) {
                    currentSort = albumsSort.value;
                    console.log(`📋 Preserving albums sort: ${currentSort}`);
                }
                
                // If we have a sort state, apply it directly (which includes rendering)
                // Otherwise, just render the grid
                if (currentSort) {
                    this.sortAlbums(currentSort);
                } else {
                    this.renderAlbumsGrid();
                }
                break;
            case 'artists':
                // Get current sort selection before refresh  
                const artistsSort = document.getElementById('artists-sort');
                if (artistsSort) {
                    currentSort = artistsSort.value;
                    console.log(`👥 Preserving artists sort: ${currentSort}`);
                }
                
                // If we have a sort state, apply it directly (which includes rendering)
                // Otherwise, just render the grid
                if (currentSort) {
                    this.sortArtists(currentSort);
                } else {
                    this.renderArtistsGrid();
                }
                break;
            case 'tracks':
                // Get current sort selection before refresh
                const tracksSort = document.getElementById('tracks-sort');
                if (tracksSort) {
                    currentSort = tracksSort.value;
                    console.log(`🎵 Preserving tracks sort: ${currentSort}`);
                }
                
                // If we have a sort state, apply it directly (which includes rendering)
                // Otherwise, just render the grid
                if (currentSort) {
                    this.sortTracks(currentSort);
                } else {
                    this.renderTracksGrid();
                }
                break;
            case 'roles':
                // Get current sort selection before refresh
                const rolesSort = document.getElementById('roles-sort');
                if (rolesSort) {
                    currentSort = rolesSort.value;
                    console.log(`🎭 Preserving roles sort: ${currentSort}`);
                }
                
                // If we have a sort state, apply it directly (which includes rendering)
                // Otherwise, just render the grid
                if (currentSort) {
                    this.sortRoles(currentSort);
                } else {
                    this.renderRolesGrid();
                }
                break;
            default:
                break;
        }
        
        // Update page title counts after view refresh
        this.updatePageTitleCounts();
    }
    
    // Helper method for delays
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    // Update loading text during long operations
    updateLoadingText(text) {
        const loadingText = document.getElementById('loading-text');
        if (loadingText) {
            // Support multi-line text by converting newlines to <br> tags
            const htmlText = text.replace(/\n/g, '<br>');
            loadingText.innerHTML = htmlText;
        }
    }

    // ============================================
    // STEP 3.2: SPECIFIC ALBUMS SCRAPER
    // ============================================

    async searchAlbums() {
        const searchInput = document.getElementById('album-search');
        const resultsContainer = document.getElementById('album-results');
        const query = searchInput.value.trim();
        
        if (!query) {
            alert('Please enter an album name to search');
            return;
        }
        
        console.log(`🔍 Searching for albums: ${query}`);
        this.showLoading('Searching for albums...');
        
        try {
            // Search for releases using relevance-based sorting first, then apply intelligent sorting
            const searchResults = await this.discogsAPI.searchReleases(query, 'release', 20);
            
            if (!searchResults || searchResults.length === 0) {
                this.hideLoading();
                resultsContainer.innerHTML = '<p class="no-results">No albums found. Try a different search term.</p>';
                return;
            }
            
            console.log(`✅ Found ${searchResults.length} albums - applying intelligent sorting...`);
            
            // Apply intelligent sorting for better relevance
            const intelligentlySorted = this.applyIntelligentSorting(searchResults, query);
            console.log(`📊 Sorted results by relevance + year`);
            
            this.displayAlbumSearchResults(intelligentlySorted);
            this.hideLoading();
            
        } catch (error) {
            console.error('❌ Error searching albums:', error);
            this.hideLoading();
            resultsContainer.innerHTML = '<p class="error-message">Error searching albums. Please try again.</p>';
        }
    }

    // Apply intelligent sorting to prioritize relevance while maintaining chronological order
    applyIntelligentSorting(albums, searchQuery) {
        const query = searchQuery.toLowerCase().trim();
        
        console.log(`🧠 Applying intelligent sorting for query: "${query}"`);
        
        return albums.sort((a, b) => {
            const titleA = (a.title || '').toLowerCase();
            const titleB = (b.title || '').toLowerCase();
            const artistA = (a.artist || '').toLowerCase();
            const artistB = (b.artist || '').toLowerCase();
            
            // Calculate relevance scores
            const scoreA = this.calculateRelevanceScore(titleA, artistA, query);
            const scoreB = this.calculateRelevanceScore(titleB, artistB, query);
            
            // If relevance scores are different, sort by relevance (higher score first)
            if (scoreA !== scoreB) {
                return scoreB - scoreA;
            }
            
            // If relevance scores are equal, sort by year ascending (earlier first)
            const yearA = a.year || 9999;
            const yearB = b.year || 9999;
            return yearA - yearB;
        });
    }

    // Detect if an album is a reissue or remaster
    isReissueOrRemaster(album) {
        const title = (album.title || '').toLowerCase();
        const formats = album.format || [];
        
        // Check title for reissue/remaster indicators
        const reissueKeywords = [
            'reissue', 'remastered', 'remaster', 'deluxe', 'expanded', 
            'anniversary', 'special edition', 'collector', 'enhanced',
            'digitally remastered', 're-release', 'legacy edition',
            'definitive', 'complete', 'box set', 'limited edition'
        ];
        
        // Check title
        if (reissueKeywords.some(keyword => title.includes(keyword))) {
            return true;
        }
        
        // Check formats array for reissue indicators
        for (const fmt of formats) {
            if (typeof fmt === 'object') {
                for (const [key, value] of Object.entries(fmt)) {
                    if (typeof value === 'string') {
                        if (reissueKeywords.some(keyword => 
                            value.toLowerCase().includes(keyword))) {
                            return true;
                        }
                    } else if (Array.isArray(value)) {
                        for (const item of value) {
                            if (typeof item === 'string' && 
                                reissueKeywords.some(keyword => 
                                    item.toLowerCase().includes(keyword))) {
                                return true;
                            }
                        }
                    }
                }
            } else if (typeof fmt === 'string') {
                if (reissueKeywords.some(keyword => 
                    fmt.toLowerCase().includes(keyword))) {
                    return true;
                }
            }
        }
        
        return false;
    }

    // Calculate relevance score for search results
    calculateRelevanceScore(title, artist, query) {
        let score = 0;
        
        // Exact title match gets highest score
        if (title === query) {
            score += 100;
            console.log(`🎯 Exact title match: "${title}" = ${score}`);
        }
        // Title starts with query gets high score
        else if (title.startsWith(query)) {
            score += 80;
            console.log(`🎯 Title starts with query: "${title}" = ${score}`);
        }
        // Title contains query as whole word gets good score
        else if (title.split(/\s+/).some(word => word === query)) {
            score += 60;
            console.log(`🎯 Title contains exact word: "${title}" = ${score}`);
        }
        // Title contains query as substring gets medium score
        else if (title.includes(query)) {
            score += 40;
            console.log(`🎯 Title contains substring: "${title}" = ${score}`);
        }
        
        // Artist name contains query gets lower score
        if (artist.includes(query)) {
            score += 20;
            console.log(`🎯 Artist contains query: "${artist}" = ${score}`);
        }
        
        // Bonus for shorter titles (more likely to be exact matches)
        if (title.length < 30) {
            score += 5;
        }
        
        // NEW: Bonus for likely original releases (early years)
        // This helps prioritize original releases over later reissues
        const currentYear = new Date().getFullYear();
        const albumYear = parseInt(title.match(/\((\d{4})\)$/)?.[1]) || currentYear;
        
        if (albumYear < 1990) {
            score += 10; // Significant bonus for pre-1990 releases
            console.log(`🎯 Vintage release bonus: ${albumYear} = +10`);
        } else if (albumYear < 2000) {
            score += 5; // Moderate bonus for 1990s releases
            console.log(`🎯 90s release bonus: ${albumYear} = +5`);
        }
        
        return score;
    }

    displayAlbumSearchResults(albums) {
        const resultsContainer = document.getElementById('album-results');
        
        if (!albums || albums.length === 0) {
            resultsContainer.innerHTML = '<p class="no-results">No albums found.</p>';
            return;
        }

        // Enhanced filter results to focus on albums/LPs and exclude reissues/remasters
        const filteredAlbums = albums.filter(album => {
            const formats = album.format || [];
            const title = album.title || '';
            
            // Apply basic filtering similar to the artist scraper
            if (this.parser.hasFilteredWords(formats)) return false;
            if (title.includes('/')) return false;
            
            // NEW: Filter out reissues and remasters
            if (this.isReissueOrRemaster(album)) {
                console.log(`🚫 Filtered out reissue/remaster: "${title}"`);
                return false;
            }
            
            return true;
        });

        const resultsHtml = filteredAlbums.map(album => {
            const isInCart = this.albumCart.some(cartItem => cartItem.id === album.id);
            const artistDisplay = album.artist || 'Various Artists';
            const yearDisplay = album.year ? ` (${album.year})` : '';
            
            return `
                <div class="search-result-item album-result">
                    <div class="result-info">
                        <div class="result-title">${album.title}${yearDisplay}</div>
                        <div class="result-artist">${artistDisplay}</div>
                        <div class="result-meta">
                            ID: ${album.id} | Format: ${album.format ? album.format.join(', ') : 'Unknown'}
                            ${album.thumb ? ' | Has Cover' : ''}
                        </div>
                    </div>
                    <div class="result-actions">
                        <button class="add-to-cart-btn ${isInCart ? 'in-cart' : ''}" 
                                data-album-id="${album.id}" 
                                data-album-title="${album.title}"
                                data-album-artist="${artistDisplay}"
                                data-album-year="${album.year || ''}"
                                ${isInCart ? 'disabled' : ''}>
                            ${isInCart ? '✅ In Cart' : '🛒 Add to Cart'}
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        
        resultsContainer.innerHTML = `
            <div class="search-results-header">
                <h4>Found ${filteredAlbums.length} albums:</h4>
                <p class="filter-note">Results filtered to show albums and LPs only</p>
            </div>
            <div class="search-results-list">
                ${resultsHtml}
            </div>
        `;
        
        // Add event listeners to cart buttons
        document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
            if (!btn.disabled) {
                btn.addEventListener('click', (e) => {
                    const albumData = {
                        id: e.target.getAttribute('data-album-id'),
                        title: e.target.getAttribute('data-album-title'),
                        artist: e.target.getAttribute('data-album-artist'),
                        year: e.target.getAttribute('data-album-year')
                    };
                    this.addAlbumToCart(albumData, e.target);
                });
            }
        });
    }

    addAlbumToCart(albumData, buttonElement) {
        // Check if album is already in cart
        if (this.albumCart.some(item => item.id === albumData.id)) {
            console.log(`Album already in cart: ${albumData.title}`);
            return;
        }

        // Add to cart
        this.albumCart.push(albumData);
        console.log(`🛒 Added to cart: ${albumData.title} by ${albumData.artist}`);

        // Update button state
        if (buttonElement) {
            buttonElement.textContent = '✅ In Cart';
            buttonElement.classList.add('in-cart');
            buttonElement.disabled = true;
        }

        // Update cart display
        this.updateCartDisplay();
        this.updateScrapeButton();
    }

    removeAlbumFromCart(albumId) {
        const index = this.albumCart.findIndex(item => item.id === albumId);
        if (index !== -1) {
            const removedAlbum = this.albumCart.splice(index, 1)[0];
            console.log(`🗑️ Removed from cart: ${removedAlbum.title}`);

            // Update cart display
            this.updateCartDisplay();
            this.updateScrapeButton();

            // Update search results if visible
            const searchBtn = document.querySelector(`[data-album-id="${albumId}"]`);
            if (searchBtn) {
                searchBtn.textContent = '🛒 Add to Cart';
                searchBtn.classList.remove('in-cart');
                searchBtn.disabled = false;
            }
        }
    }

    updateCartDisplay() {
        const cartContainer = document.getElementById('album-cart');
        
        if (this.albumCart.length === 0) {
            cartContainer.innerHTML = '<p class="empty-cart">No albums selected</p>';
            return;
        }

        const cartHtml = this.albumCart.map(album => `
            <div class="cart-item">
                <div class="cart-item-info">
                    <div class="cart-item-title">${album.title}</div>
                    <div class="cart-item-artist">${album.artist}${album.year ? ` (${album.year})` : ''}</div>
                </div>
                <button class="remove-from-cart-btn" data-album-id="${album.id}">
                    ❌ Remove
                </button>
            </div>
        `).join('');

        cartContainer.innerHTML = `
            <div class="cart-header">
                <h5>${this.albumCart.length} album${this.albumCart.length !== 1 ? 's' : ''} selected:</h5>
            </div>
            <div class="cart-items-list">
                ${cartHtml}
            </div>
        `;

        // Add event listeners to remove buttons
        cartContainer.querySelectorAll('.remove-from-cart-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const albumId = e.target.getAttribute('data-album-id');
                this.removeAlbumFromCart(albumId);
            });
        });
    }

    updateScrapeButton() {
        const scrapeButton = document.getElementById('scrape-albums-btn');
        if (this.albumCart.length > 0) {
            scrapeButton.disabled = false;
            scrapeButton.textContent = `🎵 Scrape ${this.albumCart.length} Album${this.albumCart.length !== 1 ? 's' : ''}`;
        } else {
            scrapeButton.disabled = true;
            scrapeButton.textContent = 'Scrape Selected Albums';
        }
    }

    async scrapeSelectedAlbums() {
        if (this.albumCart.length === 0) {
            alert('Please select some albums to scrape first');
            return;
        }

        const albumCount = this.albumCart.length;
        console.log(`🎵 Starting batch scrape for ${albumCount} selected albums`);

        // Enhanced progress tracking
        let progressState = {
            total: albumCount,
            processed: 0,
            added: 0,
            errors: 0,
            startTime: Date.now()
        };

        this.showLoading(`Preparing to scrape ${albumCount} selected albums...`);
        
        const scrapeButton = document.getElementById('scrape-albums-btn');
        scrapeButton.disabled = true;
        scrapeButton.textContent = '⏳ Scraping...';

        let successCount = 0;
        let duplicateCount = 0;
        let errorCount = 0;
        const processedAlbums = [];
        const addedAlbums = [];
        const errorDetails = [];

        try {
            for (let i = 0; i < this.albumCart.length; i++) {
                const albumInfo = this.albumCart[i];
                progressState.processed = i + 1;
                
                // Calculate progress percentage
                const progress = Math.round((progressState.processed / progressState.total) * 100);
                
                // Adaptive progress updates - less frequent in background tabs
                const shouldUpdateProgress = !window.tabVisibility || window.tabVisibility.shouldUpdateProgress() || 
                    (i % 3 === 0); // Every 3rd album in background
                
                if (shouldUpdateProgress) {
                    // Enhanced progress display with better spacing
                    this.updateLoadingText(
                        `🎵 Batch Album Scraping\n\n` +
                        `Progress: ${progressState.processed}/${progressState.total} (${progress}%)\n\n` +
                        `✅ Added: ${successCount}  |  🔄 Duplicates: ${duplicateCount}  |  ❌ Errors: ${errorCount}\n\n` +
                        `Current: ${albumInfo.title} by ${albumInfo.artist}` +
                        (!window.tabVisibility?.isVisible ? '\n\n🔍 Background tab detected' : '')
                    );
                }

                try {
                    console.log(`📀 Processing ${i + 1}/${albumCount}: ${albumInfo.title} by ${albumInfo.artist} (ID: ${albumInfo.id})`);

                    // Get full release data
                    const releaseData = await this.discogsAPI.getRelease(albumInfo.id);
                    
                    if (!releaseData) {
                        errorCount++;
                        errorDetails.push(`${albumInfo.title}: Could not fetch data`);
                        console.warn(`⚠️ Could not fetch data for ${albumInfo.title}`);
                        continue;
                    }

                    // No filtering - user has specifically chosen this album to scrape

                    // Parse the release data
                    const album = this.parser.parseAlbum(releaseData);
                    
                    if (!album) {
                        errorCount++;
                        errorDetails.push(`${albumInfo.title}: Could not parse album data`);
                        console.warn(`⚠️ Could not parse album data for ${albumInfo.title}`);
                        continue;
                    }

                    // Check for duplicates and prioritize earlier releases
                    const duplicateStatus = this.checkAlbumDuplicateStatus(album);
                    
                    if (duplicateStatus.isDuplicate && !duplicateStatus.shouldReplace) {
                        duplicateCount++;
                        console.log(`🔄 Duplicate skipped: ${album.title} (${album.year})`);
                    } else if (duplicateStatus.shouldReplace) {
                        // Replace with earlier version
                        const replaced = await this.replaceAlbumWithEarlierVersion(album, duplicateStatus.existingIndex);
                        if (replaced) {
                            successCount++;
                            processedAlbums.push(album.title);
                            addedAlbums.push({
                                title: album.title,
                                artist: album.artist,
                                year: album.year
                            });
                            console.log(`🔄 Replaced with earlier version: ${album.title} (${album.year})`);
                        } else {
                            errorCount++;
                            errorDetails.push(`${albumInfo.title}: Failed to replace with earlier version`);
                            console.log(`❌ Failed to replace: ${album.title} (${album.year})`);
                        }
                    } else {
                        // Add new album
                        await this.addAlbumToCollection(album);
                        successCount++;
                        processedAlbums.push(album.title);
                        addedAlbums.push({
                            title: album.title,
                            artist: album.artist,
                            year: album.year
                        });
                        console.log(`✅ Added: ${album.title} (${album.year})`);
                    }

                    // Adaptive rate limiting delay based on tab visibility
                    const baseDelay = window.CONFIG.DISCOGS.RATE_LIMIT.SCRAPER_DELAY;
                    const adaptiveDelay = window.tabVisibility ? 
                        window.tabVisibility.getOptimalDelay(baseDelay) : baseDelay;
                    
                    await this.sleep(adaptiveDelay);
                    
                    // Log tab visibility impact
                    if (window.CONFIG.DEBUG.ENABLED && window.tabVisibility && !window.tabVisibility.isVisible) {
                        console.log(`🔍 Background tab: Using ${adaptiveDelay}ms delay instead of ${baseDelay}ms`);
                    }

                } catch (albumError) {
                    errorCount++;
                    errorDetails.push(`${albumInfo.title}: ${albumError.message}`);
                    console.error(`❌ Error processing ${albumInfo.title}:`, albumError);
                }
            }

            this.hideLoading();

            // Update UI
            try {
                this.regenerateCollectionData();
                this.refreshCurrentView();
            } catch (updateError) {
                console.error(`⚠️ Error updating UI after successful scraping:`, updateError);
            }

            // Clear cart
            this.albumCart = [];
            this.updateCartDisplay();
            this.updateScrapeButton();

            // Update button with detailed stats
            scrapeButton.disabled = false;
            if (successCount > 0) {
                scrapeButton.textContent = `✅ Added ${successCount} albums`;
                scrapeButton.classList.add('completed');
            } else {
                scrapeButton.textContent = `⚠️ No albums added`;
                scrapeButton.classList.add('warning');
            }

            // Enhanced results display
            const elapsedTime = Math.round((Date.now() - progressState.startTime) / 1000);
            const successRate = Math.round((successCount / albumCount) * 100);
            
            let message = `🎉 Batch scraping complete!\n\n`;
            message += `📊 RESULTS:\n`;
            message += `• Processed: ${albumCount} albums\n`;
            message += `• Added: ${successCount} new albums\n`;
            message += `• Duplicates: ${duplicateCount} skipped\n`;
            message += `• Errors: ${errorCount}\n\n`;
            message += `⏱️ Time: ${elapsedTime}s | 🎯 Success Rate: ${successRate}%\n`;
            message += `📀 Total collection: ${this.collection.albums.length} albums`;
            
            // Show detailed console log for debugging
            console.log(`🎉 Batch scraping results:`);
            console.log(`   📊 Processed: ${albumCount} albums`);
            console.log(`   ✅ Added: ${successCount} new albums`);
            console.log(`   🔄 Duplicates: ${duplicateCount} skipped`);
            console.log(`   ❌ Errors: ${errorCount}`);
            console.log(`   ⏱️ Time: ${elapsedTime} seconds`);
            console.log(`   🎯 Success Rate: ${successRate}%`);
            
            if (addedAlbums.length > 0) {
                console.log(`📀 Added albums:`, addedAlbums);
            }
            
            if (errorDetails.length > 0) {
                console.log(`❌ Error details:`, errorDetails);
            }
            
            alert(message);

        } catch (error) {
            console.error('❌ Error during batch scraping:', error);
            this.hideLoading();
            
            scrapeButton.disabled = false;
            scrapeButton.textContent = '❌ Error - Try Again';
            scrapeButton.classList.add('error');
            
            alert(`❌ Error during batch scraping:\n${error.message}\n\nPlease try again.`);
        }
    }

    // ============================================
    // END SCRAPER FUNCTIONALITY
    // ============================================

    // View management
    switchView(viewName) {
        console.log(`Switching to view: ${viewName}`);
        
        // Clean up lazy loading for previous view
        if (this.lazyLoadingManager) {
            this.lazyLoadingManager.cleanup();
        }
        
        // Clear all search inputs when switching views
        this.clearAllSearchInputs();
        
        // Update navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-view="${viewName}"]`).classList.add('active');
        
        // Update view containers
        document.querySelectorAll('.view-container').forEach(container => {
            container.classList.remove('active');
        });
        document.getElementById(`${viewName}-view`).classList.add('active');
        
        this.currentView = viewName;
        this.loadViewContent(viewName);
    }

    loadInitialView() {
        this.loadViewContent(this.currentView);
    }

    loadViewContent(viewType) {
        console.log(`Loading content for view: ${viewType}`);
        
        switch(viewType) {
            case 'albums':
                // Don't call renderAlbumsGrid() here - sortAlbums() will handle it
                // Apply current sort after rendering
                const albumsSort = document.getElementById('albums-sort');
                if (albumsSort && albumsSort.value) {
                    console.log(`🔄 Auto-applying albums sort: ${albumsSort.value}`);
                    this.sortAlbums(albumsSort.value);
                } else {
                    // If no sort is set, use default sort that matches HTML (recently-added)
                    console.log(`🔄 No sort selected, applying default sort: recently-added`);
                    this.sortAlbums('recently-added');
                }
                break;
            case 'artists':
                // Don't call renderArtistsGrid() here - sortArtists() will handle it
                // Apply current sort after rendering
                const artistsSort = document.getElementById('artists-sort');
                if (artistsSort && artistsSort.value) {
                    console.log(`🔄 Auto-applying artists sort: ${artistsSort.value}`);
                    this.sortArtists(artistsSort.value);
                } else {
                    // If no sort is set, render with default sort
                    this.renderArtistsGrid();
                }
                break;
            case 'tracks':
                // Don't call renderTracksGrid() here - sortTracks() will handle it
                // Apply current sort after rendering
                const tracksSort = document.getElementById('tracks-sort');
                if (tracksSort && tracksSort.value) {
                    console.log(`🔄 Auto-applying tracks sort: ${tracksSort.value}`);
                    this.sortTracks(tracksSort.value);
                } else {
                    // If no sort is set, use default sort (frequency) for consistency
                    console.log(`🔄 No sort selected, applying default sort: frequency`);
                    this.sortTracks('frequency');
                }
                break;
            case 'roles':
                // Don't call renderRolesGrid() here - sortRoles() will handle it
                // Apply current sort after rendering
                const rolesSort = document.getElementById('roles-sort');
                if (rolesSort && rolesSort.value) {
                    console.log(`🔄 Auto-applying roles sort: ${rolesSort.value}`);
                    this.sortRoles(rolesSort.value);
                } else {
                    // If no sort is set, use default sort (frequency) for consistency
                    console.log(`🔄 No sort selected, applying default sort: frequency`);
                    this.sortRoles('frequency');
                }
                break;
            case 'scraper':
                // Refresh scraped content display when switching to scraper view
                this.refreshScrapedContentDisplay();
                break;
            default:
                console.log('Unknown view type:', viewType);
        }
        
        // Update page title counts after loading view content
        this.updatePageTitleCounts();
    }

    displayEmptyState(viewType) {
        const containers = {
            albums: document.getElementById('albums-grid'),
            artists: document.getElementById('musical-artists-grid'), // Use musical tab as default
            tracks: document.getElementById('tracks-grid'),
            roles: document.getElementById('roles-grid')
        };

        const messages = {
            albums: 'No albums in your collection yet. Use the scraper to add some!',
            artists: 'No artists found. Add some albums to see artists.',
            tracks: 'No tracks available. Your album collection will populate tracks.',
            roles: 'No roles detected. Album credits will show up here.'
        };

        // Special handling for artists - show empty state in both tabs
        if (viewType === 'artists') {
            const musicalGrid = document.getElementById('musical-artists-grid');
            const technicalGrid = document.getElementById('technical-artists-grid');
            
            const emptyStateHtml = `
                <div class="empty-state">
                    <div class="empty-state-content">
                        <h3>Nothing here yet</h3>
                        <p>${messages[viewType]}</p>
                    </div>
                </div>
            `;
            
            if (musicalGrid) musicalGrid.innerHTML = emptyStateHtml;
            if (technicalGrid) technicalGrid.innerHTML = emptyStateHtml;
            return;
        }

        const container = containers[viewType];
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-content">
                        <h3>Nothing here yet</h3>
                        <p>${messages[viewType]}</p>
                    </div>
                </div>
            `;
        }
    }

    // Sorting methods
    sortAlbums(sortType) {
        console.log(`Sorting albums by: ${sortType}`);
        
        // Show/hide shuffle button based on sort type
        const shuffleBtn = document.getElementById('shuffle-albums');
        if (shuffleBtn) {
            if (sortType === 'random') {
                shuffleBtn.classList.remove('hidden');
            } else {
                shuffleBtn.classList.add('hidden');
            }
        }
        
        // Ensure albums collection is initialized
        if (!this.collection.albums || !Array.isArray(this.collection.albums)) {
            this.collection.albums = [];
        }
        
        // Only sort if we have albums
        if (this.collection.albums.length === 0) {
            console.log('No albums to sort');
            return;
        }
        
        // Check if there's an active search filter
        const currentSearchQuery = this.currentSearchQueries.albums;
        let albumsToDisplay;
        
        if (currentSearchQuery && currentSearchQuery.trim()) {
            // There's an active search - get filtered results and sort them
            console.log(`🔍 Sorting with active search filter: "${currentSearchQuery}"`);
            albumsToDisplay = this.collection.albums.filter(album => {
                const searchText = currentSearchQuery.toLowerCase();
                return (
                    album.title.toLowerCase().includes(searchText) ||
                    album.artist.toLowerCase().includes(searchText) ||
                    (album.year && album.year.toString().includes(searchText)) ||
                    (album.genres && album.genres.some(genre => genre.toLowerCase().includes(searchText))) ||
                    (album.styles && album.styles.some(style => style.toLowerCase().includes(searchText)))
                );
            });
        } else {
            // No active search - sort the full collection
            albumsToDisplay = [...this.collection.albums]; // Create a copy to sort
        }
        
        // Sort the data to display
        switch(sortType) {
            case 'year-asc':
                albumsToDisplay.sort((a, b) => {
                    const yearA = this.isValidYear(a.year) ? a.year : Infinity;
                    const yearB = this.isValidYear(b.year) ? b.year : Infinity;
                    return yearA - yearB;
                });
                break;
            case 'year-desc':
                albumsToDisplay.sort((a, b) => {
                    const yearA = this.isValidYear(a.year) ? a.year : Infinity;
                    const yearB = this.isValidYear(b.year) ? b.year : Infinity;
                    // For descending, we want valid years first (largest to smallest)
                    // Then unknown years at the end
                    if (yearA === Infinity && yearB === Infinity) return 0;
                    if (yearA === Infinity) return 1; // a goes to end
                    if (yearB === Infinity) return -1; // b goes to end
                    return yearB - yearA; // Normal descending for valid years
                });
                break;
            case 'recently-added':
                albumsToDisplay.sort((a, b) => {
                    // Sort by created_at timestamp (newest first)
                    const dateA = new Date(a.created_at || 0);
                    const dateB = new Date(b.created_at || 0);
                    return dateB.getTime() - dateA.getTime(); // Descending order (newest first)
                });
                break;
            case 'random':
                // Initial randomization, additional shuffles via shuffle button
                this.shuffleArray(albumsToDisplay);
                break;
            default:
                console.log(`Unknown sort type: ${sortType}`);
                break;
        }
        
        // Temporarily replace collection.albums with sorted/filtered data for rendering
        const originalAlbums = this.collection.albums;
        this.collection.albums = albumsToDisplay;
        
        // Render the grid with the filtered/sorted data
        this.renderAlbumsGrid();
        
        // Restore original collection
        this.collection.albums = originalAlbums;
        
        console.log(`✅ Sorted and displayed ${albumsToDisplay.length} albums`);
    }

    sortArtists(sortType) {
        console.log(`Sorting artists by: ${sortType}`);
        
        // Show/hide shuffle button based on sort type
        const shuffleBtn = document.getElementById('shuffle-artists');
        if (shuffleBtn) {
            if (sortType === 'random') {
                shuffleBtn.classList.remove('hidden');
            } else {
                shuffleBtn.classList.add('hidden');
            }
        }
        
        // Ensure artists collections are initialized
        if (!this.musicalArtists) this.musicalArtists = [];
        if (!this.technicalArtists) this.technicalArtists = [];
        
        // Generate artists if not already done
        if (this.musicalArtists.length === 0 && this.technicalArtists.length === 0) {
            this.collection.artists = this.generateArtistsFromAlbums();
        }
        
        // Only sort if we have artists
        if ((!this.musicalArtists || this.musicalArtists.length === 0) && 
            (!this.technicalArtists || this.technicalArtists.length === 0)) {
            console.log('No artists to sort');
            return;
        }
        
        // Define sort functions for different contexts
        const musicalSortFunction = (a, b) => {
            switch(sortType) {
                case 'most-albums':
                    // For musical tab, use musical album count if available, otherwise total
                    const aCount = a.musicalAlbumCount !== undefined ? a.musicalAlbumCount : (a.albumCount || 0);
                    const bCount = b.musicalAlbumCount !== undefined ? b.musicalAlbumCount : (b.albumCount || 0);
                    return bCount - aCount;
                case 'a-z':
                    return (a.name || '').localeCompare(b.name || '');
                case 'random':
                    return Math.random() - 0.5;
                default:
                    return 0;
            }
        };
        
        const technicalSortFunction = (a, b) => {
            switch(sortType) {
                case 'most-albums':
                    // For technical tab, use technical album count if available, otherwise total
                    const aCount = a.technicalAlbumCount !== undefined ? a.technicalAlbumCount : (a.albumCount || 0);
                    const bCount = b.technicalAlbumCount !== undefined ? b.technicalAlbumCount : (b.albumCount || 0);
                    return bCount - aCount;
                case 'a-z':
                    return (a.name || '').localeCompare(b.name || '');
                case 'random':
                    return Math.random() - 0.5;
                default:
                    return 0;
            }
        };
        
        // Apply tab-specific sorting to both arrays
        this.musicalArtists.sort(musicalSortFunction);
        this.technicalArtists.sort(technicalSortFunction);
        
        // Create unique combined array for backward compatibility (removing duplicates)
        const uniqueArtistsMap = new Map();
        [...this.musicalArtists, ...this.technicalArtists].forEach(artist => {
            uniqueArtistsMap.set(artist.name, artist);
        });
        this.collection.artists = Array.from(uniqueArtistsMap.values());
        
        console.log(`🎵 Sorted ${this.musicalArtists.length} musical artists`);
        console.log(`🔧 Sorted ${this.technicalArtists.length} technical artists`);
        console.log(`📋 Combined unique collection: ${this.collection.artists.length} artists`);
        
        // Update tab counts
        document.getElementById('musical-artists-count').textContent = `(${this.musicalArtists.length})`;
        document.getElementById('technical-artists-count').textContent = `(${this.technicalArtists.length})`;
        
        // Re-render the active tab
        this.renderActiveArtistsTab();
    }

    // Tracks View Implementation
    renderTracksGrid() {
        console.log('🎵 Starting renderTracksGrid...');
        const tracksGrid = document.getElementById('tracks-grid');
        
        // Only generate tracks if they don't exist or are empty
        if (!this.collection.tracks || this.collection.tracks.length === 0) {
            console.log('🔄 Generating tracks from albums...');
            this.collection.tracks = this.generateTracksFromAlbums();
        }
        
        if (this.collection.tracks.length === 0) {
            this.displayEmptyState('tracks');
            return;
        }
        
        // Add optimized grid class for performance
        tracksGrid.classList.add('optimized-grid');
        
        // Initialize lazy loading for tracks grid
        const trackRenderFunction = (trackData, index) => {
            const trackCard = this.createTrackCard(trackData);
            trackCard.classList.add('grid-item');
            return trackCard;
        };
        
        // For tracks, load more items initially since users want to browse/search
        // Use a larger batch size to show more tracks upfront
        const itemsPerPage = Math.max(100, Math.ceil(this.collection.tracks.length / 3)); // Show at least 1/3 of tracks initially
        
        this.lazyLoadingManager.initializeLazyGrid('tracks-grid', this.collection.tracks, trackRenderFunction, {
            itemsPerPage: itemsPerPage,
            loadingMessage: '🎶 Loading more tracks...',
            noMoreMessage: '✅ All tracks loaded',
            enableInfiniteScroll: true
        });
        
        console.log(`🚀 Lazy loading initialized for ${this.collection.tracks.length} tracks (${itemsPerPage} per page)`);
        
        // Add debug function to check lazy loading state
        window.debugTracksLoading = () => {
            const stats = this.lazyLoadingManager.getStats('tracks-grid');
            console.log('🎵 Tracks Loading Stats:', stats);
            
            // Check if sentinel exists and is visible
            const sentinel = document.getElementById('tracks-grid-sentinel');
            console.log('🎯 Sentinel element:', sentinel ? 'exists' : 'missing');
            if (sentinel) {
                const rect = sentinel.getBoundingClientRect();
                console.log('🎯 Sentinel position:', rect);
                console.log('🎯 Sentinel visible:', rect.top < window.innerHeight);
            }
            
            return stats;
        };
        
        // Add manual load more button as backup
        this.addManualLoadMoreButton('tracks-grid');
    }
    
    // Add manual "Load More" button for debugging and backup
    addManualLoadMoreButton(gridId) {
        const viewContainer = document.querySelector(`#${gridId}`).closest('.view-container');
        if (!viewContainer) return;
        
        // Remove existing button
        const existingButton = viewContainer.querySelector('.manual-load-more-btn');
        if (existingButton) existingButton.remove();
        
        const button = document.createElement('button');
        button.className = 'manual-load-more-btn secondary-btn';
        button.innerHTML = '📋 Load More Tracks';
        button.style.margin = '1rem auto';
        button.style.display = 'block';
        
        button.addEventListener('click', () => {
            console.log(`🔄 Manual load more for ${gridId}`);
            this.lazyLoadingManager.loadNextBatch(gridId);
            
            // Update button text based on loading state
            const stats = this.lazyLoadingManager.getStats(gridId);
            if (stats && stats.allLoaded) {
                button.style.display = 'none';
            } else {
                button.innerHTML = `📋 Load More Tracks (${stats?.loadedItems || 0}/${stats?.totalItems || 0})`;
            }
        });
        
        viewContainer.appendChild(button);
        
        // Hide button when all loaded
        setTimeout(() => {
            const stats = this.lazyLoadingManager.getStats(gridId);
            if (stats && stats.allLoaded) {
                button.style.display = 'none';
            }
        }, 100);
    }

    // Roles View Implementation with Tabs
    renderRolesGrid() {
        console.log('🎭 Starting renderRolesGrid...');
        console.log('📊 Collection albums count:', this.collection.albums?.length || 0);
        
        // Force regeneration of roles to ensure we have latest data with improved logic
        console.log('🔄 Forcing regeneration of roles data...');
        this.collection.roles = this.generateRolesFromAlbums();
        
        console.log('🎭 Total roles found:', this.collection.roles?.length || 0);
        
        if (this.collection.roles.length === 0) {
            console.log('⚠️ No roles found, displaying empty state');
            this.displayEmptyState('roles');
            return;
        }
        
        // Separate roles into musical and technical categories using proper categorizer
        // First, collect all album credits to categorize properly with brackets
        const allCredits = [];
        this.collection.albums.forEach(album => {
            if (album.credits && Array.isArray(album.credits)) {
                allCredits.push(...album.credits);
            }
        });
        
        // Use the role categorizer that categorizes BEFORE expanding brackets
        const { musicalCredits, technicalCredits } = window.roleCategorizer.separateRoles(allCredits);
        
        // Convert back to role format for display
        const musicalRoles = this.convertCreditsToRoles(musicalCredits);
        const technicalRoles = this.convertCreditsToRoles(technicalCredits);
        
        console.log(`🎵 Separated roles: ${musicalRoles.length} musical, ${technicalRoles.length} technical`);
        
        // Update tab counts
        document.getElementById('musical-roles-count').textContent = `(${musicalRoles.length})`;
        document.getElementById('technical-roles-count').textContent = `(${technicalRoles.length})`;
        
        // Store roles for tab switching
        this.musicalRoles = musicalRoles;
        this.technicalRoles = technicalRoles;
        
        // Render the active tab content
        this.renderActiveRolesTab();
        
        console.log(`✅ Rendered ${this.collection.roles.length} roles in tabbed interface`);
    }
    
    // Render the currently active roles tab with Lazy Loading
    renderActiveRolesTab() {
        const activeTab = this.currentRolesTab || 'musical';
        const roles = activeTab === 'musical' ? this.musicalRoles : this.technicalRoles;
        const gridId = activeTab === 'musical' ? 'musical-roles-grid' : 'technical-roles-grid';
        const grid = document.getElementById(gridId);
        
        console.log(`🎭 Rendering ${activeTab} roles tab...`);
        console.log(`🎭 Roles data:`, roles?.length || 0, 'roles');
        console.log(`🎭 Grid element:`, grid ? 'found' : 'NOT FOUND');
        
        if (!grid) {
            console.error(`❌ Grid not found: ${gridId}`);
            return;
        }
        
        // Add optimized grid class for performance
        grid.classList.add('optimized-grid');
        
        if (!roles || roles.length === 0) {
            console.log(`⚠️ No ${activeTab} roles found`);
            grid.innerHTML = `<div class="empty-state">No ${activeTab} roles found</div>`;
            return;
        }
        
        // Initialize lazy loading for roles grid
        const roleRenderFunction = (roleData, index) => {
            console.log(`🎭 Creating role card ${index + 1}:`, roleData.name);
            const roleCard = this.createRoleCard(roleData, activeTab);
            roleCard.classList.add('grid-item');
            return roleCard;
        };
        
        const tabLabel = activeTab === 'musical' ? 'Musical Roles' : 'Technical Roles';
        this.lazyLoadingManager.initializeLazyGrid(gridId, roles, roleRenderFunction, {
            itemsPerPage: 18,
            loadingMessage: `🎭 Loading more ${tabLabel.toLowerCase()}...`,
            noMoreMessage: `✅ All ${tabLabel.toLowerCase()} loaded`
        });
        
        console.log(`🚀 Lazy loading initialized for ${roles.length} ${activeTab} role cards`);
    }
    
    // Switch between roles tabs
    switchRolesTab(tabType) {
        console.log(`🔄 Switching to ${tabType} roles tab`);
        
        // Update current tab
        this.currentRolesTab = tabType;
        
        // Update tab buttons
        const tabs = document.querySelectorAll('.role-tab-btn');
        tabs.forEach(tab => {
            if (tab.dataset.tab === tabType) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
        
        // Update tab content
        const musicalContent = document.getElementById('musical-roles-tab');
        const technicalContent = document.getElementById('technical-roles-tab');
        
        if (tabType === 'musical') {
            musicalContent.classList.add('active');
            technicalContent.classList.remove('active');
        } else {
            technicalContent.classList.add('active');
            musicalContent.classList.remove('active');
        }
        
        // Render the new active tab
        this.renderActiveRolesTab();
    }
    
    // Separate roles into musical and technical categories
    separateRolesByCategory(roles) {
        const musicalRoles = [];
        const technicalRoles = [];
        
        roles.forEach(roleData => {
            const category = window.roleCategorizer.categorizeRole(roleData.name);
            
            if (category === 'technical') {
                technicalRoles.push(roleData);
            } else {
                musicalRoles.push(roleData);
            }
        });
        
        return { musicalRoles, technicalRoles };
    }

    // Convert credits to roles format for display
    convertCreditsToRoles(credits) {
        const roleMap = new Map();
        
        credits.forEach(credit => {
            const roleName = credit.role;
            if (!roleMap.has(roleName)) {
                roleMap.set(roleName, {
                    name: roleName,
                    frequency: 0,
                    artists: new Set()
                });
            }
            
            const roleData = roleMap.get(roleName);
            roleData.frequency++;
            roleData.artists.add(credit.name);
        });
        
        // Convert to array format expected by UI
        return Array.from(roleMap.values()).map(role => ({
            name: role.name,
            frequency: role.frequency,
            artists: role.artists.size
        }));
    }
    
    // Generate track data from current album collection
    generateTracksFromAlbums() {
        console.log('🎵 Generating tracks from albums...', this.collection.albums?.length || 0, 'albums');
        const trackMap = new Map();
        
        try {
            // Extract tracks from all albums
            this.collection.albums.forEach(album => {
                try {
                    if (album.tracklist && Array.isArray(album.tracklist)) {
                        album.tracklist.forEach(track => {
                            const trackTitle = track.title;
                            if (trackTitle) {
                                // Safely get album artists
                                const albumArtists = Array.isArray(album.artists) ? album.artists : 
                                                   (album.artist ? [album.artist] : ['Unknown Artist']);
                                
                                if (trackMap.has(trackTitle)) {
                                    // Increment frequency for existing track
                                    const existingTrack = trackMap.get(trackTitle);
                                    existingTrack.frequency++;
                                    existingTrack.albums.push({
                                        albumId: album.id,
                                        albumTitle: album.title,
                                        albumYear: album.year,
                                        albumArtists: albumArtists,
                                        albumImage: album.images && album.images[0] ? album.images[0].uri : null,
                                        trackPosition: track.position,
                                        trackDuration: track.duration
                                    });
                                } else {
                                    // Create new track entry
                                    trackMap.set(trackTitle, {
                                        id: `track-${trackTitle.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')}`,
                                        title: trackTitle,
                                        frequency: 1,
                                        albums: [{
                                            albumId: album.id,
                                            albumTitle: album.title,
                                            albumYear: album.year,
                                            albumArtists: albumArtists,
                                            albumImage: album.images && album.images[0] ? album.images[0].uri : null,
                                            trackPosition: track.position,
                                            trackDuration: track.duration
                                        }]
                                    });
                                }
                            }
                        });
                    }
                } catch (albumError) {
                    console.warn(`⚠️ Error processing tracks for album "${album.title}":`, albumError);
                }
            });
        } catch (error) {
            console.error('❌ Error generating tracks from albums:', error);
            return []; // Return empty array on error
        }
        
        // Convert map to array
        const tracksArray = Array.from(trackMap.values());
        console.log(`🎵 Generated ${tracksArray.length} tracks from ${this.collection.albums.length} albums`);
        
        // Log sample track for debugging
        if (tracksArray.length > 0) {
            const sampleTrack = tracksArray[0];
            console.log(`🎵 Sample track: "${sampleTrack.title}" (frequency: ${sampleTrack.frequency}, albums: ${sampleTrack.albums.length})`);
        }
        
        return tracksArray;
    }

    // Async version with progress updates - optimized for performance
    async generateTracksFromAlbumsAsync() {
        console.log('🎵 Generating tracks from albums (async)...', this.collection.albums?.length || 0, 'albums');
        const trackMap = new Map();
        const totalAlbums = this.collection.albums?.length || 0;
        let processedAlbums = 0;
        
        try {
            // Process albums in batches to avoid blocking the UI
            const batchSize = 100;
            for (let i = 0; i < totalAlbums; i += batchSize) {
                const albumBatch = this.collection.albums.slice(i, i + batchSize);
                
                // Process batch synchronously for performance
                albumBatch.forEach(album => {
                    try {
                        if (album.tracklist && Array.isArray(album.tracklist)) {
                            album.tracklist.forEach(track => {
                                const trackTitle = track.title;
                                if (trackTitle) {
                                    // Safely get album artists
                                    const albumArtists = Array.isArray(album.artists) ? album.artists : 
                                                       (album.artist ? [album.artist] : ['Unknown Artist']);
                                    
                                    if (trackMap.has(trackTitle)) {
                                        // Increment frequency for existing track
                                        const existingTrack = trackMap.get(trackTitle);
                                        existingTrack.frequency++;
                                        existingTrack.albums.push({
                                            albumId: album.id,
                                            albumTitle: album.title,
                                            albumYear: album.year,
                                            albumArtists: albumArtists,
                                            albumImage: album.images && album.images[0] ? album.images[0].uri : null,
                                            trackPosition: track.position,
                                            trackDuration: track.duration
                                        });
                                    } else {
                                        // Create new track entry
                                        trackMap.set(trackTitle, {
                                            id: `track-${trackTitle.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')}`,
                                            title: trackTitle,
                                            frequency: 1,
                                            albums: [{
                                                albumId: album.id,
                                                albumTitle: album.title,
                                                albumYear: album.year,
                                                albumArtists: albumArtists,
                                                albumImage: album.images && album.images[0] ? album.images[0].uri : null,
                                                trackPosition: track.position,
                                                trackDuration: track.duration
                                            }]
                                        });
                                    }
                                }
                            });
                        }
                    } catch (albumError) {
                        // Minimal logging for performance
                        console.warn(`⚠️ Error processing tracks for album "${album.title}"`);
                    }
                });
                
                processedAlbums += albumBatch.length;
                
                // Yield control to prevent UI blocking - only every few batches
                if (i % (batchSize * 3) === 0) {
                    await new Promise(resolve => setTimeout(resolve, 1));
                }
            }
        } catch (error) {
            console.error('❌ Error generating tracks from albums:', error);
            return []; // Return empty array on error
        }
        
        // Convert map to array
        const tracksArray = Array.from(trackMap.values());
        console.log(`🎵 Generated ${tracksArray.length} tracks from ${processedAlbums} albums`);
        
        return tracksArray;
    }
    
    // Create track card element
    createTrackCard(trackData) {
        const card = document.createElement('div');
        card.className = 'track-card';
        card.setAttribute('data-track-id', trackData.id);
        
        // Build frequency display
        const frequencyText = trackData.frequency === 1 ? '1 album' : `${trackData.frequency} albums`;
        
        card.innerHTML = `
            <div class="track-card-content">
                <div class="track-title">${trackData.title}</div>
                <div class="track-frequency">${frequencyText}</div>
                <div class="track-actions">
                    <button class="track-view-albums-btn" data-track-id="${trackData.id}">
                        View Albums
                    </button>
                </div>
            </div>
        `;
        
        // Add click event for the track card
        card.addEventListener('click', (e) => {
            // Don't trigger if clicking the button
            if (!e.target.classList.contains('track-view-albums-btn')) {
                console.log(`🎵 Track clicked: ${trackData.title}`);
                this.showTrackAlbums(trackData);
            }
        });
        
        // Add click event for view albums button
        const viewAlbumsBtn = card.querySelector('.track-view-albums-btn');
        viewAlbumsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showTrackAlbums(trackData);
        });
        
        return card;
    }

    // Create role card element
    createRoleCard(roleData, category = 'musical') {
        const card = document.createElement('div');
        card.className = `role-card ${category}-role-card`;
        card.setAttribute('data-role-id', roleData.id);
        card.setAttribute('data-category', category);
        
        // Build display with count as primary metric (since we sort by this)
        // Use different terminology for musical vs technical roles
        // Ensure artists array exists to prevent TypeError
        const artists = roleData.artists || [];
        const frequency = roleData.frequency || 0;
        
        const personText = category === 'musical' 
            ? (artists.length === 1 ? '1 artist' : `${artists.length} artists`)
            : (artists.length === 1 ? '1 contributor' : `${artists.length} contributors`);
        const frequencyText = frequency === 1 ? '1 album' : `${frequency} albums`;
        
        // Choose icon based on category
        const roleIcon = category === 'musical' ? '🎵' : '🔧';
        
        // Button text based on category
        const buttonText = category === 'musical' ? 'View Artists' : 'View Contributors';
        
        card.innerHTML = `
            <div class="role-card-content">
                <div class="role-header">
                    <span class="role-category-icon">${roleIcon}</span>
                    <div class="role-title">${roleData.name}</div>
                </div>
                <div class="role-stats">
                    <div class="role-artists primary-stat">${personText}</div>
                    <div class="role-frequency secondary-stat">${frequencyText}</div>
                </div>
                <div class="role-actions">
                    <button class="role-view-artists-btn ${category}-action-btn" data-role-id="${roleData.id}">
                        ${buttonText}
                    </button>
                </div>
            </div>
        `;
        
        // Add click event for the role card
        card.addEventListener('click', (e) => {
            // Don't trigger if clicking the button
            if (!e.target.classList.contains('role-view-artists-btn')) {
                console.log(`🎭 Role clicked: ${roleData.name} (${category})`);
                this.showRoleArtists(roleData);
            }
        });
        
        // Add click event for view artists button
        const viewArtistsBtn = card.querySelector('.role-view-artists-btn');
        viewArtistsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showRoleArtists(roleData);
        });
        
        return card;
    }

    // Show artists that have a specific role
    showRoleArtists(roleData) {
        console.log(`🎭 Showing artists for role: ${roleData?.name || 'Unknown'}`, roleData);
        
        if (!roleData || !roleData.name) {
            console.error('❌ Invalid role data - missing role name:', roleData);
            this.showModal('Error', '<p>No role data available.</p>');
            return;
        }
        
        // Ensure artists array exists
        if (!roleData.artists || !Array.isArray(roleData.artists)) {
            console.error('❌ Invalid role data - missing or invalid artists array:', roleData);
            this.showModal('Error', `<p>No artists found for role "${roleData.name}".</p>`);
            return;
        }
        
        if (roleData.artists.length === 0) {
            console.warn('⚠️ Role has no artists:', roleData.name);
            const category = window.roleCategorizer.categorizeRole(roleData.name);
            const personTerm = category === 'musical' ? 'Artists' : 'Contributors';
            this.showModal(`Role: "${roleData.name}"`, `<p>No ${personTerm.toLowerCase()} found with the role "${roleData.name}".</p>`);
            return;
        }
        
        // Determine category for appropriate terminology
        const category = window.roleCategorizer.categorizeRole(roleData.name);
        const personTerm = category === 'musical' ? 'Artists' : 'Contributors';
        const modalTitle = `${personTerm} with role: "${roleData.name}"`;
        
        try {
            const modalContent = this.generateRoleArtistsModalContent(roleData);
            if (modalContent) {
                // Use the proper showModal method to ensure event listeners are set up
                this.showModal(modalTitle, modalContent);
                
                // Add special event delegation for role artist interactions
                // Note: setupRoleArtistEvents is additional to the main modal event system
                const modalBody = document.getElementById('modal-body');
                this.setupRoleArtistEvents(modalBody);
            } else {
                this.showModal(modalTitle, '<p>No content could be generated for this role.</p>');
            }
        } catch (error) {
            console.error('❌ Error generating modal content:', error);
            this.showModal('Error', '<p>Error loading role information.</p>');
        }
    }

    // Generate modal content for role artists
    generateRoleArtistsModalContent(roleData) {
        console.log('🎭 Generating modal content for role:', roleData);
        
        // Determine category for appropriate terminology
        const category = window.roleCategorizer.categorizeRole(roleData.name);
        const personTerm = category === 'musical' ? 'artists' : 'contributors';
        const PersonTerm = category === 'musical' ? 'Artists' : 'Contributors';
        
        if (!roleData || !roleData.artists || !Array.isArray(roleData.artists)) {
            console.error('❌ Invalid role data for modal generation:', roleData);
            return `<p>No ${personTerm} found for this role.</p>`;
        }
        
        if (roleData.artists.length === 0) {
            return `<p>This role has no associated ${personTerm}.</p>`;
        }
        
        try {
            // First, calculate role-specific album counts for all artists and create sortable array
            const artistsWithCounts = roleData.artists.map(artistInfo => {
                console.log('🎭 Processing artist:', artistInfo);
                
                // Count albums where this artist performed this SPECIFIC role
                let roleSpecificAlbumCount = 0;
                const roleSpecificAlbums = new Set(); // Use Set to avoid duplicates
                
                // Look through all albums in the collection for this artist in this role
                this.collection.albums.forEach(album => {
                    if (album.credits && Array.isArray(album.credits)) {
                        // Use the same sophisticated role checking as the filtering logic
                        const hasRoleInAlbum = this.artistHasRoleOnAlbum(artistInfo.name, roleData.name, album);
                        if (hasRoleInAlbum) {
                            roleSpecificAlbums.add(album.id);
                        }
                    }
                });
                
                roleSpecificAlbumCount = roleSpecificAlbums.size;
                
                console.log(`🎭 Role-specific count for ${artistInfo.name} as ${roleData.name}: ${roleSpecificAlbumCount} albums`);
                
                return {
                    ...artistInfo,
                    roleSpecificAlbumCount
                };
            });
            
            // Sort artists by role-specific album count (most albums for this role first)
            const sortedArtists = artistsWithCounts.sort((a, b) => b.roleSpecificAlbumCount - a.roleSpecificAlbumCount);
            console.log(`🎭 Sorted ${sortedArtists.length} artists by role-specific album count for role "${roleData.name}"`);
            
            // Generate HTML for sorted artists
            const artistsHtml = sortedArtists.map((artistInfo, index) => {
                const albumText = artistInfo.roleSpecificAlbumCount === 1 ? '1 album' : `${artistInfo.roleSpecificAlbumCount} albums`;
                const initials = artistInfo.name.split(' ').map(word => word[0]).join('').slice(0, 2).toUpperCase();
                
                return `
                    <div class="role-artist-item clickable-artist-item" 
                         data-artist-name="${this.escapeHtmlAttribute(artistInfo.name)}"
                         data-artist-index="${index}">
                        <div class="role-artist-image">
                            <img 
                                src="" 
                                alt="Photo of ${this.escapeHtmlAttribute(artistInfo.name)}"
                                class="artist-photo role-artist-photo"
                                loading="lazy"
                                style="display: none;"
                                onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
                            />
                            <div class="placeholder-artist-image" style="display: flex;">
                                ${initials}
                            </div>
                        </div>
                        <div class="role-artist-details">
                            <div class="role-artist-name" title="${this.escapeHtmlAttribute(artistInfo.name)}">${artistInfo.name}</div>
                            <div class="role-artist-role">${roleData.name}</div>
                            <div class="role-artist-count">${albumText}</div>
                        </div>
                        <div class="role-artist-actions">
                            <button class="view-artist-albums-btn" data-artist-name="${this.escapeHtmlAttribute(artistInfo.name)}">
                                View Albums
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
            
            const result = `
                <div class="role-artists-content">
                    <div class="role-artists-header">
                        <p>${PersonTerm} who worked as <strong>${roleData.name}</strong> in <strong>${roleData.frequency}</strong> album${roleData.frequency !== 1 ? 's' : ''} (sorted by most albums with this role):</p>
                    </div>
                    <div class="role-artists-list">
                        ${artistsHtml}
                    </div>
                </div>
            `;
            
            console.log('✅ Generated role artists modal content successfully');
            return result;
            
        } catch (error) {
            console.error('❌ Error generating role artists content:', error);
            return `<p>Error loading ${personTerm} information for this role.</p>`;
        }
    }

    // Setup event handlers for role artist interactions
    setupRoleArtistEvents(modalBody) {
        // Event delegation for artist clicks and buttons
        modalBody.addEventListener('click', (e) => {
            // Handle clicking on artist item (but not on buttons)
            const artistItem = e.target.closest('.clickable-artist-item');
            if (artistItem && !e.target.closest('button')) {
                const artistName = artistItem.dataset.artistName;
                console.log(`🎭 Artist item clicked from role modal: ${artistName}`);
                
                // Create artist data for modal and redirect to artist albums
                this.handleCreditArtistClick(artistName);
                return;
            }
            
            // Handle View Albums button
            const viewAlbumsBtn = e.target.closest('.view-artist-albums-btn');
            if (viewAlbumsBtn) {
                const artistName = viewAlbumsBtn.dataset.artistName;
                console.log(`🎭 View Albums clicked from role modal: ${artistName}`);
                
                // Create artist data and show albums
                this.handleCreditArtistClick(artistName);
                return;
            }
        });
        
        // Initialize lazy loading for artist images
        this.initializeRoleModalLazyLoading(modalBody);
    }

    // Initialize lazy loading for role modal artist images
    initializeRoleModalLazyLoading(modalBody) {
        if (!window.ImageService) {
            console.warn('🖼️ ImageService not available for role modal lazy loading');
            return;
        }

        console.log('🖼️ Initializing lazy loading for role modal artist images');
        
        // Find all artist items
        const artistItems = modalBody.querySelectorAll('.role-artist-item');
        console.log(`🖼️ Found ${artistItems.length} artist items for lazy loading`);
        
        if (artistItems.length === 0) {
            console.warn('🖼️ No artist items found in modal for lazy loading');
            return;
        }
        
        // Create IntersectionObserver for lazy loading images
        const imageObserver = new IntersectionObserver((entries) => {
            console.log(`🖼️ IntersectionObserver triggered with ${entries.length} entries`);
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const artistItem = entry.target;
                    const artistName = artistItem.dataset.artistName;
                    const artistIndex = parseInt(artistItem.dataset.artistIndex, 10);
                    
                    console.log(`🖼️ Artist item intersecting: ${artistName} (index: ${artistIndex})`);
                    
                    // Only load images for first 10 artists to avoid overload
                    if (artistIndex < 10) {
                        console.log(`🖼️ Loading image for artist ${artistIndex + 1}/10: ${artistName}`);
                        this.loadRoleArtistImage(artistItem, artistName);
                    } else {
                        console.log(`🖼️ Skipping image load for artist ${artistIndex + 1} (beyond 10 limit): ${artistName}`);
                    }
                    
                    // Stop observing this item
                    imageObserver.unobserve(artistItem);
                }
            });
        }, {
            root: modalBody,
            rootMargin: '50px',
            threshold: 0.1
        });

        // Observe all artist items
        console.log(`🖼️ Starting to observe ${artistItems.length} artist items`);
        artistItems.forEach((item, index) => {
            const artistName = item.dataset.artistName;
            console.log(`🖼️ Observing artist ${index + 1}: ${artistName}`);
            imageObserver.observe(item);
        });
    }

    // Load individual artist image for role modal
    async loadRoleArtistImage(artistItem, artistName) {
        if (!artistName || !artistItem) {
            console.warn(`🖼️ Invalid parameters for loadRoleArtistImage: artistName=${artistName}, artistItem=${!!artistItem}`);
            return;
        }
        
        try {
            console.log(`🖼️ Starting image load for role modal artist: ${artistName}`);
            
            // Find the image and placeholder elements first
            const imgElement = artistItem.querySelector('.role-artist-photo');
            const placeholderElement = artistItem.querySelector('.placeholder-artist-image');
            
            console.log(`🖼️ Elements found - img: ${!!imgElement}, placeholder: ${!!placeholderElement}`);
            
            if (!imgElement || !placeholderElement) {
                console.warn(`🖼️ Missing elements for ${artistName} - img: ${!!imgElement}, placeholder: ${!!placeholderElement}`);
                return;
            }
            
            const imageService = new window.ImageService();
            console.log(`🖼️ Fetching image URL for: ${artistName}`);
            const imageUrl = await imageService.fetchArtistImage(artistName);
            
            console.log(`🖼️ Image fetch result for ${artistName}: ${imageUrl ? 'SUCCESS' : 'NO_IMAGE'}`);
            
            if (imageUrl && artistItem.parentNode) {
                console.log(`🖼️ Setting image source for ${artistName}: ${imageUrl}`);
                
                // Create a new image element to test loading
                const testImg = new Image();
                testImg.onload = () => {
                    console.log(`✅ Image loaded successfully for ${artistName}, now displaying`);
                    // Set the actual image source
                    imgElement.src = imageUrl;
                    imgElement.style.display = 'block';
                    placeholderElement.style.display = 'none';
                    console.log(`🎭 Image display updated for ${artistName}`);
                };
                testImg.onerror = () => {
                    console.log(`❌ Image failed to load for ${artistName}, keeping placeholder`);
                };
                // Start loading
                testImg.src = imageUrl;
            } else {
                console.log(`🖼️ No image URL found for ${artistName}, keeping placeholder`);
            }
        } catch (error) {
            console.error(`❌ Error loading image for ${artistName}:`, error);
        }
    }

    // Show albums for an artist found in role credits
    showArtistAlbumsFromRole(artistName) {
        console.log(`🎭 Finding albums for role artist: ${artistName}`);
        
        // Try to detect the active role filter from the current modal title
        let activeRole = null;
        const modalTitle = document.getElementById('modal-title');
        if (modalTitle) {
            const titleText = modalTitle.textContent;
            console.log(`🔍 Current modal title: "${titleText}"`);
            
            // Try multiple patterns to detect the role
            const patterns = [
                /Contributors with role: "([^"]+)"/,
                /Artists with role: "([^"]+)"/,
                /role: "([^"]+)"/
            ];
            
            for (const pattern of patterns) {
                const roleMatch = titleText.match(pattern);
                if (roleMatch) {
                    activeRole = roleMatch[1];
                    console.log(`🎯 Detected active role filter: "${activeRole}" using pattern: ${pattern}`);
                    break;
                }
            }
            
            if (!activeRole) {
                console.log(`⚠️ Could not detect role from title: "${titleText}"`);
            }
        }
        
        // Find all albums where this artist appears in credits
        const artistAlbums = [];
        this.collection.albums.forEach(album => {
            if (album.credits && Array.isArray(album.credits)) {
                const appearsInAlbum = album.credits.some(credit => 
                    credit.name === artistName
                );
                if (appearsInAlbum) {
                    artistAlbums.push(album);
                }
            }
        });
        
        console.log(`🎭 Found ${artistAlbums.length} total albums for ${artistName}`);
        
        // If we have an active role, pre-filter albums to only those where artist had this role
        let filteredAlbums = artistAlbums;
        if (activeRole) {
            filteredAlbums = artistAlbums.filter(album => {
                const hasRole = this.artistHasRoleOnAlbum(artistName, activeRole, album);
                console.log(`🔍 Album "${album.title}": ${artistName} has role "${activeRole}"? ${hasRole}`);
                return hasRole;
            });
            console.log(`🎯 After filtering by role "${activeRole}": ${filteredAlbums.length} albums found`);
        }
        
        if (filteredAlbums.length === 0) {
            const message = activeRole 
                ? `No albums found where "${artistName}" had the role "${activeRole}"`
                : `No albums found for artist "${artistName}"`;
            console.warn(`⚠️ ${message}`);
            return;
        }
        
        // Create a temporary artist object for the modal
        // IMPORTANT: Use TOTAL album count from main collection, not filtered count
        const completeArtist = this.collection.artists.find(a => a.name === artistName);
        const totalAlbumCount = completeArtist ? completeArtist.albumCount : artistAlbums.length;
        
        const temporaryArtist = {
            name: artistName,
            albumCount: totalAlbumCount,  // Use TOTAL count for consistent modal titles
            albums: filteredAlbums,       // Use filtered albums for modal content
            roles: [],
            id: `temp-artist-${artistName.toLowerCase().replace(/\s+/g, '-')}`
        };
        
        console.log(`🎭 Created temporary artist with total count: ${totalAlbumCount} (displaying ${filteredAlbums.length} filtered albums)`);
        
        // Collect all roles this artist has across albums
        const rolesSet = new Set();
        artistAlbums.forEach(album => {  // Still use all albums for role collection
            if (album.credits) {
                album.credits.forEach(credit => {
                    if (credit.name === artistName && credit.role) {
                        credit.role.split(',').forEach(role => {
                            rolesSet.add(role.trim());
                        });
                    }
                });
            }
        });
        temporaryArtist.roles = Array.from(rolesSet);
        
        console.log(`🎭 Created temporary artist:`, temporaryArtist);
        
        // Show the artist albums modal
        this.showArtistAlbums(temporaryArtist);
    }
    
    // Show albums that contain a specific track
    showTrackAlbums(trackData) {
        console.log(`📀 Showing albums for track: ${trackData.title}`, trackData);
        
        if (!trackData || !trackData.albums) {
            console.error('❌ Invalid track data:', trackData);
            this.showModal('Error', '<p>No track data available.</p>');
            return;
        }
        
        try {
            const modalContent = this.generateTrackAlbumsModalContent(trackData);
            const albumCount = trackData.albums ? trackData.albums.length : 0;
            const modalTitle = `Albums containing "${trackData.title}" (${albumCount} album${albumCount !== 1 ? 's' : ''})`;
            
            if (modalContent) {
                // Use the proper showModal method to ensure event listeners are set up
                this.showModal(modalTitle, modalContent);
            } else {
                this.showModal(modalTitle, '<p>No content could be generated for this track.</p>');
            }
        } catch (error) {
            console.error('❌ Error generating modal content:', error);
            this.showModal('Error', '<p>Error loading track information.</p>');
        }
    }
    
    // Generate modal content for track albums
    generateTrackAlbumsModalContent(trackData) {
        console.log('🎵 Generating modal content for track:', trackData);
        
        if (!trackData || !trackData.albums || !Array.isArray(trackData.albums)) {
            console.error('❌ Invalid track data for modal generation:', trackData);
            return '<p>No albums found for this track.</p>';
        }
        
        if (trackData.albums.length === 0) {
            return '<p>This track does not appear in any albums.</p>';
        }
        
        try {
            // Group albums by album ID to consolidate multiple track positions
            const albumsMap = new Map();
            
            trackData.albums.forEach(albumInfo => {
                const albumId = albumInfo.albumId || albumInfo.albumTitle?.replace(/\s+/g, '-');
                
                if (albumsMap.has(albumId)) {
                    // Add track position to existing album
                    const existingAlbum = albumsMap.get(albumId);
                    existingAlbum.trackPositions.push({
                        position: albumInfo.trackPosition || '?',
                        duration: albumInfo.trackDuration
                    });
                } else {
                    // Create new album entry
                    albumsMap.set(albumId, {
                        ...albumInfo,
                        trackPositions: [{
                            position: albumInfo.trackPosition || '?',
                            duration: albumInfo.trackDuration
                        }]
                    });
                }
            });
            
            // Convert map to array for sorting and searching
            const albumsArray = Array.from(albumsMap.values()).map(albumInfo => {
                // Find the full album data from collection
                const fullAlbum = this.collection.albums.find(album => 
                    album.id === albumInfo.albumId || 
                    album.title === albumInfo.albumTitle
                );
                
                // Use full album data if available, fallback to albumInfo
                const albumData = fullAlbum || {
                    id: albumInfo.albumId || albumInfo.albumTitle?.replace(/\s+/g, '-'),
                    title: albumInfo.albumTitle || 'Unknown Album',
                    year: albumInfo.albumYear || 'Unknown Year',
                    images: albumInfo.albumImage ? [{ uri: albumInfo.albumImage }] : null,
                    track_count: albumInfo.trackCount || 0,
                    genres: albumInfo.genres || [],
                    styles: albumInfo.styles || []
                };
                
                // Add track position data to album data
                albumData.trackPositions = albumInfo.trackPositions;
                albumData.albumArtists = albumInfo.albumArtists;
                
                return albumData;
            });
            
            // Sort albums by year ascending (default)
            const sortedAlbums = [...albumsArray].sort((a, b) => {
                const yearA = a.year || 0;
                const yearB = b.year || 0;
                return yearA - yearB;
            });
            
            // Convert sorted albums to HTML
            const albumsHtml = sortedAlbums.map(albumData => {
                console.log('🎵 Processing consolidated album:', albumData);
                
                const artistNames = albumData.albumArtists && Array.isArray(albumData.albumArtists) 
                    ? albumData.albumArtists.map(artist => typeof artist === 'string' ? artist : artist.name).join(', ')
                    : 'Unknown Artist';

                // Get cover image URL with fallback logic
                const coverImageUrl = albumData.images && albumData.images[0] ? albumData.images[0].uri : '';
                
                // Generate genre and style tags (same as main album cards)
                const tags = [];
                if (albumData.genres && Array.isArray(albumData.genres)) {
                    tags.push(...albumData.genres);
                }
                if (albumData.styles && Array.isArray(albumData.styles)) {
                    tags.push(...albumData.styles);
                }
                const uniqueTags = [...new Set(tags)].slice(0, 4);
                const genreStyleTagsHtml = uniqueTags.length > 0 
                    ? `<div class="genre-tags-container">${uniqueTags.map(tag => 
                        `<span class="genre-tag" title="${tag}">${tag}</span>`
                    ).join('')}</div>` 
                    : '';

                // Generate track positions display for track context
                const trackPositionsHtml = albumData.trackPositions && albumData.trackPositions.length > 0 
                    ? `<div class="track-positions">Track positions: ${albumData.trackPositions.map(track => track.position).join(', ')}</div>`
                    : '';

                return `
                    <div class="album-card" data-album-id="${albumData.id}">
                        <div class="album-card-inner">
                            <div class="album-cover">
                                <img 
                                    src="${coverImageUrl}" 
                                    alt="${this.escapeAttributeValue('Cover art for ' + albumData.title)}"
                                    class="cover-image"
                                    loading="lazy"
                                    onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
                                />
                                <div class="album-placeholder" style="display: none;">
                                    <div class="placeholder-icon">🎵</div>
                                    <div class="placeholder-text">No Cover</div>
                                </div>
                                <div class="album-overlay">
                                    <div class="album-actions">
                                        <button class="overlay-circle-btn more-info-btn" data-album-id="${albumData.id}" title="More Info">
                                            ℹ️
                                        </button>
                                        <button class="overlay-circle-btn spotify-btn" data-search-query="${artistNames} ${albumData.title}" title="Spotify">
                                            🎵
                                        </button>
                                        <button class="overlay-circle-btn youtube-btn" data-search-query="${artistNames} ${albumData.title}" title="YouTube">
                                            📺
                                        </button>
                                    </div>
                                </div>
                                <div class="card-edit-overlay">
                                    <button class="card-edit-btn edit" onclick="window.albumApp.openEditAlbumModal('${albumData.id}'); event.stopPropagation();" title="Edit Album">
                                        ✏️
                                    </button>
                                    <button class="card-edit-btn delete" onclick="window.albumApp.confirmDeleteAlbum('${albumData.id}', '${this.escapeAttributeValue(albumData.title)}'); event.stopPropagation();" title="Delete Album">
                                        🗑️
                                    </button>
                                </div>
                            </div>
                            <div class="album-info">
                                <h3 class="album-title" title="${albumData.title}">${albumData.title}</h3>
                                <p class="album-artist" title="${this.escapeHtmlAttribute(artistNames)}">${artistNames}</p>
                                <p class="album-year">${albumData.year}</p>
                                <div class="album-meta">
                                    <span class="track-count">${albumData.track_count || 0} tracks</span>
                                    ${genreStyleTagsHtml}
                                </div>
                                ${trackPositionsHtml}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
            
            const uniqueAlbumCount = sortedAlbums.length;
            const result = `
                <div class="track-albums-modal">
                    <div class="modal-section">
                        <div class="albums-section-header">
                            <div class="modal-search-container">
                                <input type="text" 
                                       id="track-albums-search" 
                                       placeholder="🔍 Search by title, artist, year, genre..." 
                                       class="modal-search-input"
                                       data-track="${trackData.title}">
                                <div class="search-results-count" id="track-search-results-count">
                                    ${uniqueAlbumCount} album${uniqueAlbumCount !== 1 ? 's' : ''}
                                </div>
                            </div>
                            <div class="modal-sort-controls">
                                <label>Sort by:</label>
                                <select id="track-albums-sort" data-track="${trackData.title}">
                                    <option value="year-asc" selected>Year (Ascending)</option>
                                    <option value="year-desc">Year (Descending)</option>
                                    <option value="title-asc">Title (A-Z)</option>
                                    <option value="title-desc">Title (Z-A)</option>
                                    <option value="random">Random</option>
                                </select>
                                <button class="shuffle-btn hidden" id="track-albums-shuffle" data-track="${trackData.title}">🔀 Shuffle</button>
                            </div>
                        </div>
                        <div class="albums-grid" id="track-albums-grid" data-track="${trackData.title}" data-all-albums='${this.escapeJsonForAttribute(sortedAlbums)}'>
                            ${albumsHtml}
                        </div>
                    </div>
                </div>
            `;
            
            console.log('✅ Generated modal content successfully');
            return result;
            
        } catch (error) {
            console.error('❌ Error generating track albums content:', error);
            return '<p>Error loading album information for this track.</p>';
        }
    }

    // Helper method to escape HTML attribute values (for display content only)
    escapeAttributeValue(value) {
        if (!value) return '';
        return value
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    // Helper method to safely escape JSON for HTML attributes
    escapeJsonForAttribute(obj) {
        try {
            const jsonString = JSON.stringify(obj);
            // Escape quotes and other problematic characters for HTML attributes
            return jsonString
                .replace(/'/g, '&#39;')
                .replace(/"/g, '&quot;');
        } catch (e) {
            console.error('❌ Error stringifying object for attribute:', e);
            return '[]'; // Return empty array as fallback
        }
    }

    // Helper method to generate genre/style tags for album cards
    getGenreStyleTagsForAlbum(album) {
        if (!album) return '';
        
        const genres = album.genres || [];
        const styles = album.styles || [];
        const allTags = [...genres, ...styles];
        
        if (allTags.length === 0) return '';
        
        // Limit to 4 tags for compact display
        const limitedTags = [...new Set(allTags)].slice(0, 4);
        
        const tagsHtml = limitedTags.map(tag => 
            `<span class="genre-tag-modal">${tag}</span>`
        ).join('');
        
        return `<div class="genre-tags-container">${tagsHtml}</div>`;
    }

    // Generate role data from current album collection
    generateRolesFromAlbums() {
        console.log('🎭 Starting generateRolesFromAlbums...');
        const roleMap = new Map();
        
        console.log('📊 Albums to process:', this.collection.albums?.length || 0);
        
        try {
            // Extract roles from all albums' credits
            this.collection.albums.forEach((album, albumIndex) => {
                try {
                    if (album.credits && Array.isArray(album.credits)) {
                        album.credits.forEach((credit, creditIndex) => {
                            // Collect all role names from this credit
                            let roleNames = [];
                            
                            // Handle new structured format
                            if (credit.albumRoles && Array.isArray(credit.albumRoles)) {
                                roleNames.push(...credit.albumRoles);
                            }
                            
                            if (credit.trackRoles && Array.isArray(credit.trackRoles)) {
                                const trackRoleNames = credit.trackRoles.map(tr => tr.role).filter(r => r);
                                roleNames.push(...trackRoleNames);
                            }
                            
                            // Handle legacy single role format - keep original roles intact for proper categorization
                            if (credit.role && typeof credit.role === 'string') {
                                // Split only by top-level commas, preserve brackets for role categorizer
                                const legacyRoles = [];
                                let current = '';
                                let bracketDepth = 0;
                                
                                for (let i = 0; i < credit.role.length; i++) {
                                    const char = credit.role[i];
                                    
                                    if (char === '[') {
                                        bracketDepth++;
                                        current += char;
                                    } else if (char === ']') {
                                        bracketDepth--;
                                        current += char;
                                    } else if (char === ',' && bracketDepth === 0) {
                                        if (current.trim()) {
                                            legacyRoles.push(current.trim());
                                        }
                                        current = '';
                                    } else {
                                        current += char;
                                    }
                                }
                                
                                if (current.trim()) {
                                    legacyRoles.push(current.trim());
                                }
                                
                                roleNames.push(...legacyRoles.filter(r => r));
                            }
                            
                            // Process each role name
                            roleNames.forEach(roleName => {
                                if (roleName && typeof roleName === 'string') {
                                    // Clean role name by removing brackets and their contents
                                    const cleanRoleName = this.cleanRoleName(roleName);
                                    
                                    if (cleanRoleName) {
                                        if (roleMap.has(cleanRoleName)) {
                                            const existingRole = roleMap.get(cleanRoleName);
                                            existingRole.frequency++;
                                            
                                            // Add unique artist to this role
                                            const existingArtist = existingRole.artists.find(a => a.name === credit.name);
                                            if (existingArtist) {
                                                existingArtist.albumCount++;
                                                if (!existingArtist.albums.some(a => a.albumId === album.id)) {
                                                    existingArtist.albums.push({
                                                        albumId: album.id,
                                                        albumTitle: album.title,
                                                        albumYear: album.year,
                                                        albumImage: album.images && album.images[0] ? album.images[0].uri : null
                                                    });
                                                }
                                            } else {
                                                existingRole.artists.push({
                                                    id: credit.id || `artist-${credit.name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')}`,
                                                    name: credit.name,
                                                    image: null,
                                                    albumCount: 1,
                                                    albums: [{
                                                        albumId: album.id,
                                                        albumTitle: album.title,
                                                        albumYear: album.year,
                                                        albumImage: album.images && album.images[0] ? album.images[0].uri : null
                                                    }]
                                                });
                                            }
                                        } else {
                                            // Create new role entry
                                            roleMap.set(cleanRoleName, {
                                                id: `role-${cleanRoleName.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')}`,
                                                name: cleanRoleName,
                                                frequency: 1,
                                                artists: [{
                                                    id: credit.id || `artist-${credit.name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')}`,
                                                    name: credit.name,
                                                    image: null,
                                                    albumCount: 1,
                                                    albums: [{
                                                        albumId: album.id,
                                                        albumTitle: album.title,
                                                        albumYear: album.year,
                                                        albumImage: album.images && album.images[0] ? album.images[0].uri : null
                                                    }]
                                                }]
                                            });
                                        }
                                    }
                                }
                            });
                        });
                    }
                } catch (creditError) {
                    console.warn(`⚠️ Error processing credits for album "${album.title}":`, creditError);
                }
            });
        } catch (error) {
            console.error('❌ Error generating roles from albums:', error);
            return []; // Return empty array on error
        }
        
        // Convert map to array and sort by frequency
        const rolesArray = Array.from(roleMap.values()).sort((a, b) => b.frequency - a.frequency);
        console.log(`🎭 Generated ${rolesArray.length} roles from ${this.collection.albums.length} albums`);
        
        return rolesArray;
    }

    // Async version with progress updates - optimized for performance (removed excessive logging)
    async generateRolesFromAlbumsAsync() {
        console.log('🎭 Starting generateRolesFromAlbumsAsync...');
        const roleMap = new Map();
        const totalAlbums = this.collection.albums?.length || 0;
        let processedAlbums = 0;
        
        try {
            // Process albums in batches to avoid blocking the UI
            const batchSize = 50; // Smaller batches for credit processing
            for (let i = 0; i < totalAlbums; i += batchSize) {
                const albumBatch = this.collection.albums.slice(i, i + batchSize);
                
                // Process batch synchronously for performance
                albumBatch.forEach((album, albumIndex) => {
                    try {
                        if (album.credits && Array.isArray(album.credits)) {
                            album.credits.forEach((credit, creditIndex) => {
                                // Collect all role names from this credit
                                let roleNames = [];
                                
                                // Handle new structured format
                                if (credit.albumRoles && Array.isArray(credit.albumRoles)) {
                                    roleNames.push(...credit.albumRoles);
                                }
                                
                                if (credit.trackRoles && Array.isArray(credit.trackRoles)) {
                                    const trackRoleNames = credit.trackRoles.map(tr => tr.role).filter(r => r);
                                    roleNames.push(...trackRoleNames);
                                }
                                
                                // Handle legacy single role format - keep original roles intact for proper categorization
                                if (credit.role && typeof credit.role === 'string') {
                                    // Split only by top-level commas, preserve brackets for role categorizer
                                    const legacyRoles = [];
                                    let current = '';
                                    let bracketDepth = 0;
                                    
                                    for (let i = 0; i < credit.role.length; i++) {
                                        const char = credit.role[i];
                                        
                                        if (char === '[') {
                                            bracketDepth++;
                                            current += char;
                                        } else if (char === ']') {
                                            bracketDepth--;
                                            current += char;
                                        } else if (char === ',' && bracketDepth === 0) {
                                            if (current.trim()) {
                                                legacyRoles.push(current.trim());
                                            }
                                            current = '';
                                        } else {
                                            current += char;
                                        }
                                    }
                                    
                                    if (current.trim()) {
                                        legacyRoles.push(current.trim());
                                    }
                                    
                                    roleNames.push(...legacyRoles.filter(r => r));
                                }
                                
                                // Process each role name
                                roleNames.forEach(roleName => {
                                    if (roleName && typeof roleName === 'string') {
                                        // Clean role name by removing brackets and their contents
                                        const cleanRoleName = this.cleanRoleName(roleName);
                                        
                                        if (cleanRoleName) {
                                            if (roleMap.has(cleanRoleName)) {
                                                const existingRole = roleMap.get(cleanRoleName);
                                                existingRole.frequency++;
                                                
                                                // Add unique artist to this role
                                                const existingArtist = existingRole.artists.find(a => a.name === credit.name);
                                                if (existingArtist) {
                                                    existingArtist.albumCount++;
                                                    if (!existingArtist.albums.some(a => a.albumId === album.id)) {
                                                        existingArtist.albums.push({
                                                            albumId: album.id,
                                                            albumTitle: album.title,
                                                            albumYear: album.year,
                                                            albumImage: album.images && album.images[0] ? album.images[0].uri : null
                                                        });
                                                    }
                                                } else {
                                                    existingRole.artists.push({
                                                        id: credit.id || `artist-${credit.name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')}`,
                                                        name: credit.name,
                                                        image: null,
                                                        albumCount: 1,
                                                        albums: [{
                                                            albumId: album.id,
                                                            albumTitle: album.title,
                                                            albumYear: album.year,
                                                            albumImage: album.images && album.images[0] ? album.images[0].uri : null
                                                        }]
                                                    });
                                                }
                                            } else {
                                                // Create new role entry
                                                roleMap.set(cleanRoleName, {
                                                    id: `role-${cleanRoleName.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')}`,
                                                    name: cleanRoleName,
                                                    frequency: 1,
                                                    artists: [{
                                                        id: credit.id || `artist-${credit.name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')}`,
                                                        name: credit.name,
                                                        image: null,
                                                        albumCount: 1,
                                                        albums: [{
                                                            albumId: album.id,
                                                            albumTitle: album.title,
                                                            albumYear: album.year,
                                                            albumImage: album.images && album.images[0] ? album.images[0].uri : null
                                                        }]
                                                    }]
                                                });
                                            }
                                        }
                                    }
                                });
                            });
                        }
                    } catch (creditError) {
                        // Minimal logging for performance
                        console.warn(`⚠️ Error processing credits for album "${album.title}"`);
                    }
                });
                
                processedAlbums += albumBatch.length;
                
                // Yield control to prevent UI blocking - only every few batches
                if (i % (batchSize * 2) === 0) {
                    await new Promise(resolve => setTimeout(resolve, 1));
                }
            }
        } catch (error) {
            console.error('❌ Error generating roles from albums:', error);
            return []; // Return empty array on error
        }
        
        // Convert map to array and sort by frequency
        const rolesArray = Array.from(roleMap.values()).sort((a, b) => b.frequency - a.frequency);
        console.log(`🎭 Generated ${rolesArray.length} roles from ${processedAlbums} albums`);
        
        return rolesArray;
    }

    sortTracks(sortType) {
        console.log(`🎵 Sorting tracks by: ${sortType}`);
        
        // Ensure tracks collection is initialized
        if (!this.collection.tracks || !Array.isArray(this.collection.tracks)) {
            console.log('⚠️ No tracks to sort - generating tracks first');
            this.collection.tracks = this.generateTracksFromAlbums();
        }
        
        // Only sort if we have tracks
        if (this.collection.tracks.length === 0) {
            console.log('⚠️ No tracks available to sort');
            return;
        }
        
        // Check if there's an active search filter
        const currentSearchQuery = this.currentSearchQueries.tracks;
        let tracksToDisplay;
        
        if (currentSearchQuery && currentSearchQuery.trim()) {
            // There's an active search - get filtered results and sort them
            console.log(`🔍 Sorting tracks with active search filter: "${currentSearchQuery}"`);
            tracksToDisplay = this.collection.tracks.filter(track => {
                return track.title.toLowerCase().includes(currentSearchQuery.toLowerCase());
            });
        } else {
            // No active search - sort the full collection
            tracksToDisplay = [...this.collection.tracks]; // Create a copy to sort
        }
        
        console.log(`🎵 Sorting ${tracksToDisplay.length} tracks...`);
        
        switch(sortType) {
            case 'frequency':
                tracksToDisplay.sort((a, b) => b.frequency - a.frequency);
                console.log(`✅ Sorted by frequency: "${tracksToDisplay[0]?.title}" (${tracksToDisplay[0]?.frequency} albums) to "${tracksToDisplay[tracksToDisplay.length-1]?.title}" (${tracksToDisplay[tracksToDisplay.length-1]?.frequency} albums)`);
                break;
            case 'a-z':
                tracksToDisplay.sort((a, b) => a.title.localeCompare(b.title));
                console.log(`✅ Sorted alphabetically: "${tracksToDisplay[0]?.title}" to "${tracksToDisplay[tracksToDisplay.length-1]?.title}"`);
                break;
            default:
                console.log(`❌ Unknown sort type: ${sortType}`);
                return;
        }
        
        // Temporarily replace collection.tracks with sorted/filtered data for rendering
        const originalTracks = this.collection.tracks;
        this.collection.tracks = tracksToDisplay;
        
        // Render the grid with the filtered/sorted data
        console.log(`🔄 Rendering tracks grid with sorted data...`);
        this.renderTracksGrid();
        
        // Restore original collection
        this.collection.tracks = originalTracks;
        
        console.log(`✅ Sorted and displayed ${tracksToDisplay.length} tracks`);
    }

    // Force regeneration of tracks from albums
    forceRegenerateTracksFromAlbums() {
        console.log('🔄 Force regenerating tracks from albums...');
        this.collection.tracks = this.generateTracksFromAlbums();
        console.log(`✅ Regenerated ${this.collection.tracks.length} tracks`);
        return this.collection.tracks;
    }

    sortRoles(sortType) {
        console.log(`Sorting roles by: ${sortType}`);
        
        if (!this.collection.roles || !Array.isArray(this.collection.roles)) {
            console.warn('⚠️ No roles to sort');
            return;
        }
        
        // Check if there's an active search filter
        const currentSearchQuery = this.currentSearchQueries.roles;
        let rolesToSort;
        
        if (currentSearchQuery && currentSearchQuery.trim()) {
            // There's an active search - get filtered results
            console.log(`🔍 Sorting roles with active search filter: "${currentSearchQuery}"`);
            const searchText = currentSearchQuery.toLowerCase();
            rolesToSort = this.collection.roles.filter(role => {
                return role.name.toLowerCase().includes(searchText);
            });
        } else {
            // No active search - use full collection
            rolesToSort = [...this.collection.roles]; // Create a copy to sort
        }
        
        // Sort the data
        switch(sortType) {
            case 'frequency':
                // Sort by most artists in this role (not most albums)
                rolesToSort.sort((a, b) => {
                    const aArtistCount = (a.artists && Array.isArray(a.artists)) ? a.artists.length : 0;
                    const bArtistCount = (b.artists && Array.isArray(b.artists)) ? b.artists.length : 0;
                    return bArtistCount - aArtistCount;
                });
                break;
            case 'a-z':
                rolesToSort.sort((a, b) => a.name.localeCompare(b.name));
                break;
            case 'z-a':
                rolesToSort.sort((a, b) => b.name.localeCompare(a.name));
                break;
        }
        
        // Separate sorted roles by category
        const { musicalRoles, technicalRoles } = this.separateRolesByCategory(rolesToSort);
        this.musicalRoles = musicalRoles;
        this.technicalRoles = technicalRoles;
        
        // Update tab counts
        document.getElementById('musical-roles-count').textContent = `(${musicalRoles.length})`;
        document.getElementById('technical-roles-count').textContent = `(${technicalRoles.length})`;
        
        // Re-render the active tab
        this.renderActiveRolesTab();
        console.log(`✅ Sorted and displayed ${rolesToSort.length} roles (${musicalRoles.length} musical, ${technicalRoles.length} technical)`);
    }

    // Shuffle methods
    shuffleAlbums() {
        console.log('Shuffling albums...');
        
        // Check if there's an active search filter
        const currentSearchQuery = this.currentSearchQueries.albums;
        let albumsToShuffle;
        
        if (currentSearchQuery && currentSearchQuery.trim()) {
            // There's an active search - get filtered results and shuffle them
            console.log(`🔍 Shuffling albums with active search filter: "${currentSearchQuery}"`);
            albumsToShuffle = this.collection.albums.filter(album => {
                const searchText = currentSearchQuery.toLowerCase();
                return (
                    album.title.toLowerCase().includes(searchText) ||
                    album.artist.toLowerCase().includes(searchText) ||
                    (album.year && album.year.toString().includes(searchText)) ||
                    (album.genres && album.genres.some(genre => genre.toLowerCase().includes(searchText))) ||
                    (album.styles && album.styles.some(style => style.toLowerCase().includes(searchText)))
                );
            });
        } else {
            // No active search - shuffle the full collection
            albumsToShuffle = [...this.collection.albums]; // Create a copy to shuffle
        }
        
        this.shuffleArray(albumsToShuffle);
        
        // Temporarily replace collection.albums with shuffled data for rendering
        const originalAlbums = this.collection.albums;
        this.collection.albums = albumsToShuffle;
        
        // Render the grid with the shuffled data
        this.renderAlbumsGrid();
        
        // Restore original collection
        this.collection.albums = originalAlbums;
        
        console.log(`✅ Shuffled and displayed ${albumsToShuffle.length} albums`);
    }

    shuffleArtists() {
        console.log('Shuffling artists...');
        
        // Shuffle both musical and technical artists arrays
        if (this.musicalArtists && this.musicalArtists.length > 0) {
            this.shuffleArray(this.musicalArtists);
        }
        if (this.technicalArtists && this.technicalArtists.length > 0) {
            this.shuffleArray(this.technicalArtists);
        }
        
        // Create unique combined array for backward compatibility (removing duplicates)
        const uniqueArtistsMap = new Map();
        [...(this.musicalArtists || []), ...(this.technicalArtists || [])].forEach(artist => {
            uniqueArtistsMap.set(artist.name, artist);
        });
        this.collection.artists = Array.from(uniqueArtistsMap.values());
        
        console.log(`🔀 Shuffled ${this.musicalArtists?.length || 0} musical + ${this.technicalArtists?.length || 0} technical artists`);
        
        // Re-render the active tab
        this.renderActiveArtistsTab();
    }

    // Sort artist albums in modal (respects active role filtering)
    sortArtistAlbums(artistName, sortType) {
        console.log(`Sorting albums for ${artistName} by: ${sortType}`);
        
        // Show/hide shuffle button based on sort type
        const shuffleBtn = document.getElementById('artist-albums-shuffle');
        if (shuffleBtn) {
            if (sortType === 'random') {
                shuffleBtn.classList.remove('hidden');
            } else {
                shuffleBtn.classList.add('hidden');
            }
        }
        
        // Get the albums data from the modal
        const albumsGrid = document.getElementById('artist-albums-grid');
        if (!albumsGrid) {
            console.error('Artist albums grid not found');
            return;
        }
        
        const allAlbumsData = albumsGrid.getAttribute('data-all-albums');
        if (!allAlbumsData) {
            console.error('No albums data found in grid');
            return;
        }
        
        let albums;
        try {
            albums = JSON.parse(allAlbumsData);
        } catch (e) {
            console.error('Error parsing albums data:', e);
            return;
        }
        
        // Check if there's an active role filter
        const currentRoleFilter = this.getCurrentRoleFilter();
        let albumsToSort = [...albums]; // Start with all albums
        
        // If role filtering is active, apply filter first
        if (currentRoleFilter) {
            console.log(`🎭 Applying role filter "${currentRoleFilter}" before sorting`);
            albumsToSort = albums.filter(album => {
                return this.artistHasRoleOnAlbum(artistName, currentRoleFilter, album);
            });
            console.log(`🎯 Filtered to ${albumsToSort.length} albums with role "${currentRoleFilter}"`);
        }
        
        // Sort the albums (filtered or all)
        let sortedAlbums = [...albumsToSort]; // Create a copy to sort
        
        switch(sortType) {
            case 'year-asc':
                sortedAlbums.sort((a, b) => {
                    const yearA = this.isValidYear(a.year) ? a.year : Infinity;
                    const yearB = this.isValidYear(b.year) ? b.year : Infinity;
                    return yearA - yearB;
                });
                break;
            case 'year-desc':
                sortedAlbums.sort((a, b) => {
                    const yearA = this.isValidYear(a.year) ? a.year : -Infinity;
                    const yearB = this.isValidYear(b.year) ? b.year : -Infinity;
                    return yearB - yearA;
                });
                break;
            case 'title-asc':
                sortedAlbums.sort((a, b) => a.title.localeCompare(b.title));
                break;
            case 'title-desc':
                sortedAlbums.sort((a, b) => b.title.localeCompare(a.title));
                break;
            case 'random':
                this.shuffleArray(sortedAlbums);
                break;
            default:
                console.warn(`Unknown sort type: ${sortType}`);
                return;
        }
        
        // Re-render the albums grid with sorted data
        this.renderArtistAlbumsGrid(artistName, sortedAlbums, currentRoleFilter);
        
        // Update role filter status if active
        if (currentRoleFilter) {
            this.showRoleFilterStatus(currentRoleFilter, sortedAlbums.length);
        }
        
    }

    // Sort track albums in modal
    sortTrackAlbums(trackTitle, sortType) {
        console.log(`Sorting albums for track "${trackTitle}" by: ${sortType}`);
        
        // Show/hide shuffle button based on sort type
        const shuffleBtn = document.getElementById('track-albums-shuffle');
        if (shuffleBtn) {
            if (sortType === 'random') {
                shuffleBtn.classList.remove('hidden');
            } else {
                shuffleBtn.classList.add('hidden');
            }
        }
        
        // Get the albums data from the modal
        const albumsGrid = document.getElementById('track-albums-grid');
        if (!albumsGrid) {
            console.error('Track albums grid not found');
            return;
        }
        
        const allAlbumsData = albumsGrid.getAttribute('data-all-albums');
        if (!allAlbumsData) {
            console.error('No albums data found in grid');
            return;
        }
        
        let albums;
        try {
            albums = JSON.parse(allAlbumsData);
        } catch (e) {
            console.error('Error parsing albums data:', e);
            return;
        }
        
        // Sort the albums
        let sortedAlbums = [...albums]; // Create a copy to sort
        
        switch(sortType) {
            case 'year-asc':
                sortedAlbums.sort((a, b) => {
                    const yearA = this.isValidYear(a.year) ? a.year : Infinity;
                    const yearB = this.isValidYear(b.year) ? b.year : Infinity;
                    return yearA - yearB;
                });
                break;
            case 'year-desc':
                sortedAlbums.sort((a, b) => {
                    const yearA = this.isValidYear(a.year) ? a.year : -Infinity;
                    const yearB = this.isValidYear(b.year) ? b.year : -Infinity;
                    return yearB - yearA;
                });
                break;
            case 'title-asc':
                sortedAlbums.sort((a, b) => a.title.localeCompare(b.title));
                break;
            case 'title-desc':
                sortedAlbums.sort((a, b) => b.title.localeCompare(a.title));
                break;
            case 'random':
                this.shuffleArray(sortedAlbums);
                break;
            default:
                console.warn(`Unknown sort type: ${sortType}`);
                return;
        }
        
        // Re-render the albums grid with sorted data
        this.renderTrackAlbumsGrid(trackTitle, sortedAlbums);
        
        console.log(`✅ Sorted ${sortedAlbums.length} albums by ${sortType}`);
    }

    // Shuffle track albums in modal
    shuffleTrackAlbums(trackTitle) {
        console.log(`Shuffling albums for track: ${trackTitle}`);
        
        // Get the albums data from the modal
        const albumsGrid = document.getElementById('track-albums-grid');
        if (!albumsGrid) {
            console.error('Track albums grid not found');
            return;
        }
        
        const allAlbumsData = albumsGrid.getAttribute('data-all-albums');
        if (!allAlbumsData) {
            console.error('No albums data found in grid');
            return;
        }
        
        let albums;
        try {
            albums = JSON.parse(allAlbumsData);
        } catch (e) {
            console.error('Error parsing albums data:', e);
            return;
        }
        
        // Shuffle the albums
        const shuffledAlbums = [...albums]; // Create a copy to shuffle
        this.shuffleArray(shuffledAlbums);
        
        // Re-render the albums grid with shuffled data
        this.renderTrackAlbumsGrid(trackTitle, shuffledAlbums);
        
        console.log(`✅ Shuffled ${shuffledAlbums.length} albums for track "${trackTitle}"`);
    }

    // Render track albums grid with provided data
    renderTrackAlbumsGrid(trackTitle, albums) {
        const albumsGrid = document.getElementById('track-albums-grid');
        if (!albumsGrid) {
            console.error('Track albums grid not found');
            return;
        }
        
        // Generate HTML for albums
        const albumsHtml = albums.map(albumData => {
            const artistNames = albumData.albumArtists && Array.isArray(albumData.albumArtists) 
                ? albumData.albumArtists.map(artist => typeof artist === 'string' ? artist : artist.name).join(', ')
                : 'Unknown Artist';

            // Get cover image URL with fallback logic
            const coverImageUrl = albumData.images && albumData.images[0] ? albumData.images[0].uri : '';
            
            // Generate genre and style tags
            const tags = [];
            if (albumData.genres && Array.isArray(albumData.genres)) {
                tags.push(...albumData.genres);
            }
            if (albumData.styles && Array.isArray(albumData.styles)) {
                tags.push(...albumData.styles);
            }
            const uniqueTags = [...new Set(tags)].slice(0, 4);
            const genreStyleTagsHtml = uniqueTags.length > 0 
                ? `<div class="genre-tags-container">${uniqueTags.map(tag => 
                    `<span class="genre-tag" title="${tag}">${tag}</span>`
                ).join('')}</div>` 
                : '';

            // Generate track positions display for track context
            const trackPositionsHtml = albumData.trackPositions && albumData.trackPositions.length > 0 
                ? `<div class="track-positions">Track positions: ${albumData.trackPositions.map(track => track.position).join(', ')}</div>`
                : '';

            return `
                <div class="album-card" data-album-id="${albumData.id}">
                    <div class="album-card-inner">
                        <div class="album-cover">
                            <img 
                                src="${coverImageUrl}" 
                                alt="${this.escapeAttributeValue('Cover art for ' + albumData.title)}"
                                class="cover-image"
                                loading="lazy"
                                onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
                            />
                            <div class="album-placeholder" style="display: none;">
                                <div class="placeholder-icon">🎵</div>
                                <div class="placeholder-text">No Cover</div>
                            </div>
                            <div class="album-overlay">
                                <div class="album-actions">
                                    <button class="action-btn more-info-btn" data-album-id="${albumData.id}" title="View album details">
                                        <span class="btn-icon">ℹ️</span>
                                        <span class="btn-text">More Info</span>
                                    </button>
                                    <button class="action-btn spotify-btn" data-search-query="${artistNames} ${albumData.title}" title="Open in Spotify">
                                        <span class="btn-icon">🎵</span>
                                        <span class="btn-text">Spotify</span>
                                    </button>
                                    <button class="action-btn youtube-btn" data-search-query="${artistNames} ${albumData.title}" title="Open in YouTube">
                                        <span class="btn-icon">📺</span>
                                        <span class="btn-text">YouTube</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div class="album-info">
                            <h3 class="album-title" title="${albumData.title}">${albumData.title}</h3>
                            <p class="album-artist" title="${this.escapeHtmlAttribute(artistNames)}">${artistNames}</p>
                            <p class="album-year">${albumData.year}</p>
                            <div class="album-meta">
                                <span class="track-count">${albumData.track_count || 0} tracks</span>
                                ${genreStyleTagsHtml}
                            </div>
                            ${trackPositionsHtml}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        // Update the grid content
        albumsGrid.innerHTML = albumsHtml;
        
        // Update search results count
        const resultsCount = document.getElementById('track-search-results-count');
        if (resultsCount) {
            resultsCount.textContent = `${albums.length} album${albums.length !== 1 ? 's' : ''}`;
        }
        
        console.log(`✅ Rendered ${albums.length} albums in track albums grid`);
    }

    // Search track albums in modal
    searchTrackAlbums(trackTitle, searchTerm) {
        console.log(`Searching albums for track "${trackTitle}" with term: "${searchTerm}"`);
        
        // Get the albums data from the modal
        const albumsGrid = document.getElementById('track-albums-grid');
        if (!albumsGrid) {
            console.error('Track albums grid not found');
            return;
        }
        
        const allAlbumsData = albumsGrid.getAttribute('data-all-albums');
        if (!allAlbumsData) {
            console.error('No albums data found in grid');
            return;
        }
        
        let albums;
        try {
            albums = JSON.parse(allAlbumsData);
        } catch (e) {
            console.error('Error parsing albums data:', e);
            return;
        }
        
        // Filter albums based on search term
        let filteredAlbums = albums;
        
        if (searchTerm) {
            filteredAlbums = albums.filter(album => {
                // Search in album title
                const titleMatch = album.title && album.title.toLowerCase().includes(searchTerm);
                
                // Search in artist names
                let artistMatch = false;
                if (album.albumArtists && Array.isArray(album.albumArtists)) {
                    artistMatch = album.albumArtists.some(artist => {
                        const artistName = typeof artist === 'string' ? artist : artist.name;
                        return artistName && artistName.toLowerCase().includes(searchTerm);
                    });
                }
                
                // Search in year
                const yearMatch = album.year && album.year.toString().includes(searchTerm);
                
                // Search in genres
                let genreMatch = false;
                if (album.genres && Array.isArray(album.genres)) {
                    genreMatch = album.genres.some(genre => 
                        genre && genre.toLowerCase().includes(searchTerm)
                    );
                }
                
                // Search in styles
                let styleMatch = false;
                if (album.styles && Array.isArray(album.styles)) {
                    styleMatch = album.styles.some(style => 
                        style && style.toLowerCase().includes(searchTerm)
                    );
                }
                
                return titleMatch || artistMatch || yearMatch || genreMatch || styleMatch;
            });
        }
        
        // Apply current sort to filtered albums
        const sortSelect = document.getElementById('track-albums-sort');
        const currentSort = sortSelect ? sortSelect.value : 'year-asc';
        
        // Sort the filtered albums
        switch(currentSort) {
            case 'year-asc':
                filteredAlbums.sort((a, b) => {
                    const yearA = this.isValidYear(a.year) ? a.year : Infinity;
                    const yearB = this.isValidYear(b.year) ? b.year : Infinity;
                    return yearA - yearB;
                });
                break;
            case 'year-desc':
                filteredAlbums.sort((a, b) => {
                    const yearA = this.isValidYear(a.year) ? a.year : -Infinity;
                    const yearB = this.isValidYear(b.year) ? b.year : -Infinity;
                    return yearB - yearA;
                });
                break;
            case 'title-asc':
                filteredAlbums.sort((a, b) => a.title.localeCompare(b.title));
                break;
            case 'title-desc':
                filteredAlbums.sort((a, b) => b.title.localeCompare(a.title));
                break;
            case 'random':
                this.shuffleArray(filteredAlbums);
                break;
        }
        
        // Re-render the albums grid with filtered and sorted data
        this.renderTrackAlbumsGrid(trackTitle, filteredAlbums);
        
        console.log(`✅ Search completed: ${filteredAlbums.length} of ${albums.length} albums match "${searchTerm}"`);
    }

    // Shuffle artist albums in modal
    shuffleArtistAlbums(artistName) {
        console.log(`Shuffling albums for ${artistName}...`);
        this.sortArtistAlbums(artistName, 'random');
    }

    // Render artist albums grid with sorted data (respects role filtering)
    renderArtistAlbumsGrid(artistName, albums, activeRoleFilter = null) {
        const albumsGrid = document.getElementById('artist-albums-grid');
        if (!albumsGrid) {
            console.error('Artist albums grid not found');
            return;
        }
        
        // Only update data-all-albums if this is NOT a filtered view
        // (preserve the original complete album list for future filtering)
        if (!activeRoleFilter) {
            albumsGrid.setAttribute('data-all-albums', JSON.stringify(albums));
        }
        
        // Generate albums HTML
        const albumsHtml = albums.map(album => {
            // Get formatted artists display (same as main collection view)
            const artistsDisplay = this.getAlbumArtistsDisplay(album);
            
            // Get cover image URL with fallback logic
            const coverImageUrl = album.images && album.images[0] ? album.images[0].uri : '';
            
            // Generate genre and style tags (same as main album cards)
            const tags = [];
            if (album.genres && Array.isArray(album.genres)) {
                tags.push(...album.genres);
            }
            if (album.styles && Array.isArray(album.styles)) {
                tags.push(...album.styles);
            }
            const uniqueTags = [...new Set(tags)].slice(0, 4);
            const genreStyleTagsHtml = uniqueTags.length > 0 
                ? `<div class="genre-tags-container">${uniqueTags.map(tag => 
                    `<span class="genre-tag" title="${tag}">${tag}</span>`
                ).join('')}</div>` 
                : '';
            
            return `
                <div class="album-card" data-album-id="${album.id}">
                    <div class="album-card-inner">
                        <div class="album-cover">
                            <img 
                                src="${coverImageUrl}" 
                                alt="${this.escapeAttributeValue('Cover art for ' + album.title)}"
                                class="cover-image"
                                loading="lazy"
                                onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
                            />
                            <div class="album-placeholder" style="display: none;">
                                <div class="placeholder-icon">🎵</div>
                                <div class="placeholder-text">No Cover</div>
                            </div>
                            <div class="album-overlay">
                                <div class="album-actions">
                                    <button class="overlay-circle-btn more-info-btn" data-album-id="${album.id || albumData.id}" title="More Info">
                                        ℹ️
                                    </button>
                                    <button class="overlay-circle-btn spotify-btn" data-search-query="${(artistsDisplay || albumData.artist)} ${(album.title || albumData.title)}" title="Spotify">
                                        🎵
                                    </button>
                                    <button class="overlay-circle-btn youtube-btn" data-search-query="${(artistsDisplay || albumData.artist)} ${(album.title || albumData.title)}" title="YouTube">
                                        📺
                                    </button>
                                </div>
                            </div>
                            <div class="card-edit-overlay">
                                <button class="card-edit-btn edit" onclick="window.albumApp.openEditAlbumModal('${album.id || albumData.id}'); event.stopPropagation();" title="Edit Album">
                                    ✏️
                                </button>
                                <button class="card-edit-btn delete" onclick="window.albumApp.confirmDeleteAlbum('${album.id || albumData.id}', '${this.escapeAttributeValue((album.title || albumData.title))}'); event.stopPropagation();" title="Delete Album">
                                    🗑️
                                </button>
                            </div>
                        </div>
                        <div class="album-info">
                            <h3 class="album-title" title="${album.title}">${album.title}</h3>
                            <p class="album-artist" title="${artistsDisplay}">${artistsDisplay}</p>
                            <p class="album-year">${album.year || 'Unknown Year'}</p>
                            <div class="album-meta">
                                <span class="track-count">${album.track_count || album.trackCount || 0} tracks</span>
                                ${genreStyleTagsHtml}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        // Update the grid HTML
        albumsGrid.innerHTML = albumsHtml;
        
        // Update album count
        const resultsCount = document.getElementById('search-results-count');
        if (resultsCount) {
            const countText = activeRoleFilter 
                ? `${albums.length} album${albums.length !== 1 ? 's' : ''} (filtered by "${activeRoleFilter}")`
                : `${albums.length} album${albums.length !== 1 ? 's' : ''}`;
            resultsCount.textContent = countText;
        }
    }

    // Get current role filter if active
    getCurrentRoleFilter() {
        const filterStatus = document.getElementById('role-filter-status');
        if (filterStatus && filterStatus.style.display !== 'none') {
            const roleElement = filterStatus.querySelector('strong');
            return roleElement ? roleElement.textContent : null;
        }
        return null;
    }

    // Helper method to check if a year is valid
    isValidYear(year) {
        return year && year !== 0 && year !== '0' && !isNaN(year) && year > 1800 && year <= new Date().getFullYear() + 5;
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    // Modal methods
    showModal(title, content, isNestedModal = false) {
        // Debug logging to track modal stack pollution
        console.log(`🔍 showModal called with title: "${title}", isNestedModal: ${isNestedModal}, current stack size: ${this.modalStack.length}`);
        console.trace('🔍 showModal call stack');
        
        // If this is a nested modal (opened from another modal), save current modal state
        if (isNestedModal) {
            const currentTitle = document.getElementById('modal-title').innerHTML;
            const currentContent = document.getElementById('modal-body').innerHTML;
            const modalBody = document.getElementById('modal-body');
            const currentScrollPosition = modalBody.scrollTop;
            
            // Enhanced duplicate detection for artist modals
            const lastStackEntry = this.modalStack[this.modalStack.length - 1];
            let isDuplicate = false;
            
            if (lastStackEntry) {
                // Exact title match (original detection)
                if (lastStackEntry.title === currentTitle) {
                    isDuplicate = true;
                    console.warn(`⚠️ EXACT DUPLICATE MODAL DETECTED! "${currentTitle}"`);
                }
                
                // Smart artist modal detection (same artist, different album counts)
                const currentArtistMatch = currentTitle.match(/^(.*?) - Albums \(\d+\)$/);
                const lastArtistMatch = lastStackEntry.title.match(/^(.*?) - Albums \(\d+\)$/);
                
                if (currentArtistMatch && lastArtistMatch && currentArtistMatch[1] === lastArtistMatch[1]) {
                    isDuplicate = true;
                    console.warn(`⚠️ ARTIST MODAL DUPLICATE DETECTED! Same artist "${currentArtistMatch[1]}" with different counts`);
                    console.warn(`⚠️ Previous: "${lastStackEntry.title}", Current: "${currentTitle}"`);
                }
            }
            
            if (isDuplicate) {
                console.warn(`⚠️ Not pushing duplicate to stack. Stack contents:`, this.modalStack.map(m => m.title));
            } else {
                this.modalStack.push({
                    title: currentTitle,
                    content: currentContent,
                    scrollPosition: currentScrollPosition
                });
                
                console.log(`📚 Pushed modal to stack: "${currentTitle}" (scroll: ${currentScrollPosition}px, stack size: ${this.modalStack.length})`);
            }
        }
        
        if (title) document.getElementById('modal-title').innerHTML = title;
        if (content) document.getElementById('modal-body').innerHTML = content;
        
        // Reset scroll position for new modal
        document.getElementById('modal-body').scrollTop = 0;
        
        // Add/remove back button based on modal stack
        this.updateModalNavigation();
        
        // Set up event delegation for "More Info" buttons in artist albums modal
        this.setupModalEventListeners();
        
        document.getElementById('more-info-modal').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    updateModalNavigation() {
        const modalHeader = document.querySelector('.modal-header');
        const existingBackBtn = modalHeader.querySelector('.modal-back-btn');
        
        // Remove existing back button if present
        if (existingBackBtn) {
            existingBackBtn.remove();
        }
        
        // Add back button if there are previous modals
        if (this.modalStack.length > 0) {
            const backBtn = document.createElement('button');
            backBtn.className = 'modal-back-btn';
            backBtn.innerHTML = '← Back';
            backBtn.title = 'Return to previous view';
            backBtn.onclick = () => this.closeModal();
            
            // Insert before the close button
            const closeBtn = modalHeader.querySelector('.modal-close');
            modalHeader.insertBefore(backBtn, closeBtn);
        }
    }

    setupModalEventListeners() {
        const modalBody = document.getElementById('modal-body');
        
        // Remove existing listeners to avoid duplicates
        if (this.handleModalClick) {
            modalBody.removeEventListener('click', this.handleModalClick);
        }
        
        // Create bound event handler to preserve 'this' context
        this.handleModalClick = (event) => {
            console.log('Modal click detected:', event.target, event.target.classList);
            
            // Handle "More Info" button clicks in artist albums modal
            // Use closest() to handle clicks on button children (icon/text spans)
            const moreInfoBtn = event.target.closest('.more-info-btn');
            if (moreInfoBtn) {
                const albumId = moreInfoBtn.getAttribute('data-album-id');
                console.log('More Info button clicked, album ID:', albumId);
                if (albumId) {
                    this.handleAlbumMoreInfo(albumId);
                }
                return;
            }
            
            // Handle Spotify button clicks (both mini and modal action buttons)
            const spotifyBtn = event.target.closest('.spotify-btn');
            if (spotifyBtn) {
                const searchQuery = spotifyBtn.getAttribute('data-search-query');
                console.log('Spotify button clicked, search query:', searchQuery);
                if (searchQuery) {
                    const encodedQuery = encodeURIComponent(searchQuery);
                    window.open(`https://open.spotify.com/search/${encodedQuery}/albums`, '_blank');
                }
                return;
            }
            
            // Handle YouTube button clicks (both mini and modal action buttons)
            const youtubeBtn = event.target.closest('.youtube-btn');
            if (youtubeBtn) {
                const searchQuery = youtubeBtn.getAttribute('data-search-query');
                console.log('YouTube button clicked, search query:', searchQuery);
                if (searchQuery) {
                    const encodedQuery = encodeURIComponent(searchQuery);
                    window.open(`https://www.youtube.com/results?search_query=${encodedQuery}`, '_blank');
                }
                return;
            }
            
            // Handle artist name clicks in credits
            if (event.target.classList.contains('clickable-artist-name')) {
                const artistName = event.target.getAttribute('data-artist-name');
                if (artistName) {
                    this.handleCreditArtistClick(artistName);
                }
                return;
            }
            
            // Handle role filter clicks in artist albums modal
            if (event.target.classList.contains('clickable-role-filter')) {
                const role = event.target.getAttribute('data-role');
                const artistName = event.target.getAttribute('data-artist');
                if (role && artistName) {
                    this.filterAlbumsByRole(artistName, role);
                    
                    // Add visual feedback to clicked role
                    document.querySelectorAll('.clickable-role-filter').forEach(r => r.classList.remove('active-filter'));
                    event.target.classList.add('active-filter');
                }
                return;
            }
            
            // Handle album card clicks (click anywhere on card to open "More Info")
            const albumCard = event.target.closest('.album-card');
            if (albumCard) {
                // Don't trigger if clicking on action buttons or edit buttons
                if (!event.target.closest('.overlay-circle-btn, .card-edit-btn')) {
                    const albumId = albumCard.getAttribute('data-album-id');
                    console.log('Album card clicked, opening details for album ID:', albumId);
                    if (albumId) {
                        this.handleAlbumMoreInfo(albumId);
                    }
                }
                return;
            }
        };
        
        modalBody.addEventListener('click', this.handleModalClick);
        console.log('Modal event listeners set up successfully');
        
        // Set up modal sort controls event listeners
        this.setupModalSortListeners();
    }

    setupModalSortListeners() {
        // Set up event listeners for artist albums modal sorting controls
        const artistSortSelect = document.getElementById('artist-albums-sort');
        const artistShuffleBtn = document.getElementById('artist-albums-shuffle');
        
        if (artistSortSelect) {
            // Remove existing listener if any
            artistSortSelect.removeEventListener('change', artistSortSelect.sortHandler);
            
            // Create new event handler
            artistSortSelect.sortHandler = (e) => {
                const artistName = e.target.getAttribute('data-artist');
                const sortType = e.target.value;
                console.log(`Artist modal sort change: ${artistName} by ${sortType}`);
                if (artistName) {
                    this.sortArtistAlbums(artistName, sortType);
                }
            };
            
            artistSortSelect.addEventListener('change', artistSortSelect.sortHandler);
        }
        
        if (artistShuffleBtn) {
            // Remove existing listener if any
            artistShuffleBtn.removeEventListener('click', artistShuffleBtn.shuffleHandler);
            
            // Create new event handler
            artistShuffleBtn.shuffleHandler = (e) => {
                const artistName = e.target.getAttribute('data-artist');
                console.log(`Artist modal shuffle clicked for: ${artistName}`);
                if (artistName) {
                    this.shuffleArtistAlbums(artistName);
                }
            };
            
            artistShuffleBtn.addEventListener('click', artistShuffleBtn.shuffleHandler);
        }
        
        // Set up event listeners for track albums modal sorting controls
        const trackSortSelect = document.getElementById('track-albums-sort');
        const trackShuffleBtn = document.getElementById('track-albums-shuffle');
        const trackSearchInput = document.getElementById('track-albums-search');
        
        if (trackSortSelect) {
            // Remove existing listener if any
            trackSortSelect.removeEventListener('change', trackSortSelect.sortHandler);
            
            // Create new event handler
            trackSortSelect.sortHandler = (e) => {
                const trackTitle = e.target.getAttribute('data-track');
                const sortType = e.target.value;
                console.log(`Track modal sort change: ${trackTitle} by ${sortType}`);
                if (trackTitle) {
                    this.sortTrackAlbums(trackTitle, sortType);
                }
            };
            
            trackSortSelect.addEventListener('change', trackSortSelect.sortHandler);
        }
        
        if (trackShuffleBtn) {
            // Remove existing listener if any
            trackShuffleBtn.removeEventListener('click', trackShuffleBtn.shuffleHandler);
            
            // Create new event handler
            trackShuffleBtn.shuffleHandler = (e) => {
                const trackTitle = e.target.getAttribute('data-track');
                console.log(`Track modal shuffle clicked for: ${trackTitle}`);
                if (trackTitle) {
                    this.shuffleTrackAlbums(trackTitle);
                }
            };
            
            trackShuffleBtn.addEventListener('click', trackShuffleBtn.shuffleHandler);
        }
        
        // Set up search functionality for track albums
        if (trackSearchInput) {
            // Remove existing listener if any
            trackSearchInput.removeEventListener('input', trackSearchInput.searchHandler);
            
            // Create new event handler
            trackSearchInput.searchHandler = (e) => {
                const searchTerm = e.target.value.toLowerCase().trim();
                const trackTitle = e.target.getAttribute('data-track');
                console.log(`Track modal search: "${searchTerm}" for track "${trackTitle}"`);
                this.searchTrackAlbums(trackTitle, searchTerm);
            };
            
            trackSearchInput.addEventListener('input', trackSearchInput.searchHandler);
        }
    }

    handleAlbumMoreInfo(albumId) {
        // Find the album in the collection
        const album = this.collection.albums.find(a => a.id == albumId);
        if (album) {
            console.log(`📀 Opening detailed info for album: ${album.title}`);
            
            // Generate detailed album modal content
            const modalContent = this.generateAlbumModalContent(album);
            
            // Show the detailed album modal as a nested modal
            this.showModal(`${album.title} (${album.year})`, modalContent, true);
        } else {
            console.error(`❌ Album not found with ID: ${albumId}`);
        }
    }

    handleCreditArtistClick(artistName) {
        console.log(`🎤 Credit artist clicked: ${artistName}`);
        
        // Debug current collection state
        console.log(`🔍 Current collection state:`, {
            albums: this.collection.albums?.length || 0,
            artists: this.collection.artists?.length || 0,
            musicalArtists: this.musicalArtists?.length || 0,
            technicalArtists: this.technicalArtists?.length || 0
        });
        
        // Force regeneration of artists collection if empty to ensure we have current data
        if (!this.collection.artists || this.collection.artists.length === 0) {
            console.log(`🔄 Regenerating artists collection for credit click...`);
            this.collection.artists = this.generateArtistsFromAlbums();
        }
        
        // Find the artist in the main collection (which includes both musical and technical artists)
        let artist = this.collection.artists.find(a => a.name === artistName);
        console.log(`🔍 Artist found in main collection:`, !!artist);
        
        // Check if the found artist has albums - if not, we need to recreate from credits
        if (artist && (!artist.albums || artist.albums.length === 0)) {
            console.log(`⚠️ Artist found but has no albums, recreating from credits: ${artistName}`);
            artist = this.createArtistFromCreditsModern(artistName);
            console.log(`🏗️ Recreated artist from credits:`, artist);
        }
        
        // Also check the separated collections if main collection doesn't have the artist
        if (!artist && this.musicalArtists) {
            artist = this.musicalArtists.find(a => a.name === artistName);
            console.log(`🔍 Artist found in musical artists:`, !!artist);
        }
        if (!artist && this.technicalArtists) {
            artist = this.technicalArtists.find(a => a.name === artistName);
            console.log(`🔍 Artist found in technical artists:`, !!artist);
        }
        
        if (!artist) {
            // If still not found, create a temporary artist using the modern method
            console.log(`🔍 Artist not found in collections, creating from credits: ${artistName}`);
            artist = this.createArtistFromCreditsModern(artistName);
            console.log(`🏗️ Created artist from credits:`, artist);
        }
        
        if (artist) {
            console.log(`🎤 Found artist data:`, {
                name: artist.name,
                albumCount: artist.albumCount,
                albums: artist.albums?.length || 0,
                hasAlbums: artist.albums && artist.albums.length > 0
            });
            
            if (artist.albums && artist.albums.length > 0) {
                console.log(`✅ Showing albums for artist: ${artist.name}`);
                this.showArtistAlbums(artist);
            } else {
                console.warn(`⚠️ Artist found but no albums: ${artistName}`, artist);
                alert(`Artist "${artistName}" found but has no albums in the current collection.`);
            }
        } else {
            console.error(`❌ Could not find or create artist: ${artistName}`);
            alert(`No albums found for ${artistName} in the current collection.`);
        }
    }

    createArtistFromCreditsModern(artistName) {
        console.log(`🏗️ Creating artist from credits (modern): ${artistName}`);
        console.log(`📚 Total albums to check: ${this.collection.albums.length}`);
        
        const artistAlbums = [];
        const roleFrequency = new Map();
        
        // Use the same credit processing logic as generateArtistsFromAlbums
        this.collection.albums.forEach((album, albumIndex) => {
            let creditsToProcess = [];
            
            console.log(`🔍 Checking album ${albumIndex + 1}/${this.collection.albums.length}: "${album.title}"`);
            
            if (album.credits && Array.isArray(album.credits)) {
                console.log(`  📝 Album has ${album.credits.length} credits`);
                
                // PREFERRED: Use processed comprehensive credits (includes both album-level AND track-level)
                album.credits.forEach(consolidatedCredit => {
                    if (consolidatedCredit.name === artistName) {
                        console.log(`  ✅ Found matching artist in album credits:`, consolidatedCredit);
                        
                        // Split consolidated roles like "Piano (Track A), Guitar (Track B)" back into individual roles
                        const rolesPart = consolidatedCredit.role || '';
                        const individualRoles = this.extractIndividualRoles(rolesPart);
                        
                        console.log(`  🎭 Individual roles extracted:`, individualRoles);
                        
                        individualRoles.forEach(role => {
                            creditsToProcess.push({
                                name: consolidatedCredit.name,
                                role: role,
                                id: consolidatedCredit.id
                            });
                        });
                    }
                });
            } else if (album._rawData && album._rawData.extraartists) {
                console.log(`  📝 Album has ${album._rawData.extraartists.length} raw extraartists`);
                
                // FALLBACK: Use raw extraartists (album-level only)
                const matchingCredits = album._rawData.extraartists.filter(credit => credit.name === artistName);
                
                if (matchingCredits.length > 0) {
                    console.log(`  ✅ Found ${matchingCredits.length} matching credits in raw extraartists:`, matchingCredits);
                    creditsToProcess = matchingCredits.map(credit => ({
                        name: credit.name,
                        role: credit.role,
                        id: credit.id
                    }));
                }
            } else {
                console.log(`  ⚠️ No credits found for album: ${album.title}`);
            }
            
            // If this artist appears in this album's credits, add the album and track roles
            if (creditsToProcess.length > 0) {
                console.log(`  ✅ Adding album "${album.title}" to artist's albums (${creditsToProcess.length} credits)`);
                artistAlbums.push(album);
                
                creditsToProcess.forEach(credit => {
                    const cleanRole = this.cleanRoleName(credit.role);
                    if (cleanRole) {
                        if (roleFrequency.has(cleanRole)) {
                            roleFrequency.set(cleanRole, roleFrequency.get(cleanRole) + 1);
                        } else {
                            roleFrequency.set(cleanRole, 1);
                        }
                        console.log(`    🎭 Added role: ${cleanRole}`);
                    }
                });
            } else {
                console.log(`  ⏭️ No matching credits in "${album.title}"`);
            }
        });
        
        console.log(`📊 Artist search complete. Found ${artistAlbums.length} albums for "${artistName}"`);
        
        if (artistAlbums.length === 0) {
            console.log(`❌ No albums found for artist: ${artistName}`);
            return null;
        }
        
        // Sort roles by frequency
        const sortedRoles = Array.from(roleFrequency.entries())
            .sort((a, b) => b[1] - a[1]) // Sort by frequency (descending)
            .map(entry => entry[0]); // Extract role names
        
        console.log(`🎭 Roles by frequency: ${sortedRoles.join(', ')}`);
        
        // Create temporary artist object using the same structure as generateArtistsFromAlbums
        const artist = {
            id: `artist-${artistName.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')}`,
            name: artistName,
            albumCount: artistAlbums.length,
            albums: artistAlbums,
            roles: sortedRoles,
            image: null,
            discogsId: null
        };
        
        console.log(`✅ Created modern artist from credits:`, {
            name: artist.name,
            albumCount: artist.albumCount,
            albums: artist.albums.map(a => a.title),
            roles: artist.roles
        });
        
        return artist;
    }
    
    openModal() {
        document.getElementById('more-info-modal').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    closeModal() {
        // Check if there's a previous modal to return to
        if (this.modalStack.length > 0) {
            const previousModal = this.modalStack.pop();
            console.log(`📚 Returning to previous modal: "${previousModal.title}" (scroll: ${previousModal.scrollPosition}px, stack size: ${this.modalStack.length})`);
            
            // Restore previous modal content
            document.getElementById('modal-title').innerHTML = previousModal.title;
            document.getElementById('modal-body').innerHTML = previousModal.content;
            
            // Update navigation buttons
            this.updateModalNavigation();
            
            // Re-setup event listeners for the restored modal
            this.setupModalEventListeners();
            
            // Restore scroll position after a brief delay to ensure content is rendered
            const modalBody = document.getElementById('modal-body');
            setTimeout(() => {
                modalBody.scrollTop = previousModal.scrollPosition || 0;
                console.log(`📍 Restored scroll position to ${previousModal.scrollPosition}px`);
            }, 50);
            
            // Keep modal open
            return;
        }
        
        // No previous modal, close entirely
        console.log('📚 Closing modal stack entirely');
        document.getElementById('more-info-modal').classList.add('hidden');
        document.body.style.overflow = '';
        
        // Clear any remaining modal stack
        this.modalStack = [];
    }

    // Force close modal entirely (for after saving edits)
    forceCloseModal() {
        console.log('🚫 Force closing modal entirely (bypassing stack)');
        const modal = document.getElementById('more-info-modal');
        
        // Remove any event listeners that might interfere
        modal.removeEventListener('click', this.modalClickHandler);
        
        // Hide modal immediately
        modal.classList.add('hidden');
        document.body.style.overflow = '';
        
        // Clear modal content to prevent any issues
        document.getElementById('modal-title').innerHTML = '';
        document.getElementById('modal-body').innerHTML = '';
        
        // Clear any remaining modal stack
        this.modalStack = [];
        
        // Restore main page scroll position
        if (this.mainPageScrollPosition > 0) {
            console.log(`📍 Restoring main page scroll position: ${this.mainPageScrollPosition}px`);
            setTimeout(() => {
                window.scrollTo({
                    top: this.mainPageScrollPosition,
                    behavior: 'smooth'
                });
            }, 300); // Longer delay to ensure grid rendering is complete
        }
        
        // Re-attach the main modal event listener after a delay
        setTimeout(() => {
            this.modalClickHandler = (e) => {
                if (e.target === modal) this.closeModal();
            };
            modal.addEventListener('click', this.modalClickHandler);
        }, 200);
    }

    // Loading state methods
    showLoading(message = 'Loading...') {
        document.getElementById('loading-text').textContent = message;
        document.getElementById('loading-overlay').classList.remove('hidden');
    }

    hideLoading() {
        document.getElementById('loading-overlay').classList.add('hidden');
    }

    // ===============================
    // COMPREHENSIVE EDIT & DELETE FUNCTIONALITY
    // ===============================

    // Open edit album modal
    async openEditAlbumModal(albumId) {
        // Store current main page scroll position
        this.mainPageScrollPosition = window.pageYOffset || document.documentElement.scrollTop;
        console.log(`📍 Storing main page scroll position: ${this.mainPageScrollPosition}px`);
        
        const album = this.collection.albums.find(a => a.id == albumId);
        if (!album) {
            console.error('Album not found:', albumId);
            return;
        }

        const editForm = this.generateEditAlbumForm(album);
        this.showModal(`Edit Album: ${album.title}`, editForm, true);
    }

    // Generate edit album form
    generateEditAlbumForm(album) {
        const genresString = (album.genres || []).join(', ');
        const stylesString = (album.styles || []).join(', ');
        const tracklistHtml = this.generateTracklistEditSection(album.tracklist || []);
        const creditsHtml = this.generateCreditsEditSection(album.credits || []);
        
        return `
            <div class="edit-form">
                <form id="edit-album-form" onsubmit="return false;">
                    <!-- Basic Information -->
                    <div class="edit-section">
                        <h4 class="edit-section-title">📝 Basic Information</h4>
                        
                        <div class="form-group">
                            <label for="edit-title">Album Title *</label>
                            <input type="text" id="edit-title" value="${this.escapeAttributeValue(album.title || '')}" required>
                        </div>
                        
                        <div class="form-group">
                            <label for="edit-artist">Primary Artist *</label>
                            <input type="text" id="edit-artist" value="${this.escapeAttributeValue(album.artist || '')}" required>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label for="edit-year">Year</label>
                                <input type="number" id="edit-year" value="${album.year || ''}" min="1900" max="2030">
                            </div>
                            <div class="form-group">
                                <label for="edit-track-count">Track Count</label>
                                <input type="number" id="edit-track-count" value="${album.trackCount || album.track_count || 0}" min="0" max="100">
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label for="edit-genres">Genres (comma-separated)</label>
                            <input type="text" id="edit-genres" value="${this.escapeAttributeValue(genresString)}" placeholder="Jazz, Rock, Electronic">
                            <small>Separate multiple genres with commas</small>
                        </div>
                        
                        <div class="form-group">
                            <label for="edit-styles">Styles (comma-separated)</label>
                            <input type="text" id="edit-styles" value="${this.escapeAttributeValue(stylesString)}" placeholder="Hard Bop, Progressive Rock">
                            <small>Separate multiple styles with commas</small>
                        </div>
                        
                        <div class="form-group">
                            <label for="edit-cover-image">Cover Image URL</label>
                            <input type="url" id="edit-cover-image" value="${this.escapeAttributeValue((album.images && album.images[0]) ? album.images[0].uri : '')}" placeholder="https://...">
                            <small>URL to album cover image</small>
                        </div>
                    </div>

                    <!-- Credits Section -->
                    <div class="edit-section">
                        <h4 class="edit-section-title">👥 Credits</h4>
                        <div id="credits-edit-container">
                            ${creditsHtml}
                        </div>
                        <button type="button" class="add-credit-btn" onclick="window.albumApp.addCreditRow()">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" y1="8" x2="12" y2="16"></line>
                                <line x1="8" y1="12" x2="16" y2="12"></line>
                            </svg>
                            Add Credit
                        </button>
                    </div>

                    <!-- Tracklist Section -->
                    <div class="edit-section">
                        <h4 class="edit-section-title">🎵 Tracklist</h4>
                        <div id="tracklist-edit-container">
                            ${tracklistHtml}
                        </div>
                        <button type="button" class="add-track-btn" onclick="window.albumApp.addTrackRow()">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" y1="8" x2="12" y2="16"></line>
                                <line x1="8" y1="12" x2="16" y2="12"></line>
                            </svg>
                            Add Track
                        </button>
                    </div>
                    
                    <div class="form-actions">
                        <button type="button" class="form-btn cancel-btn" onclick="window.albumApp.closeModal()">
                            ❌ Cancel
                        </button>
                        <button type="button" class="form-btn save-btn" onclick="window.albumApp.saveAlbumEdit('${album.id}')">
                            💾 Save Changes
                        </button>
                    </div>
                </form>
            </div>
        `;
    }

    // Save album edits
    async saveAlbumEdit(albumId) {
        const saveBtn = document.querySelector('.save-btn');
        const originalText = saveBtn.innerHTML;
        
        try {
            saveBtn.classList.add('loading');
            saveBtn.innerHTML = '💾 Saving...';
            
            // Collect basic album information
            const updates = {
                title: document.getElementById('edit-title').value.trim(),
                artist: document.getElementById('edit-artist').value.trim(),
                year: parseInt(document.getElementById('edit-year').value) || null,
                genres: document.getElementById('edit-genres').value.split(',').map(g => g.trim()).filter(g => g),
                styles: document.getElementById('edit-styles').value.split(',').map(s => s.trim()).filter(s => s),
                coverImage: document.getElementById('edit-cover-image').value.trim() || null
            };

            if (!updates.title || !updates.artist) {
                alert('Title and Artist are required fields.');
                return;
            }

            // Collect tracklist data from form
            const trackRows = document.querySelectorAll('.track-edit-row');
            const tracklist = [];
            
            trackRows.forEach((row, index) => {
                const position = row.querySelector('.track-position').value.trim();
                const title = row.querySelector('.track-title').value.trim();
                const duration = row.querySelector('.track-duration').value.trim();

                if (title) { // Only add tracks with titles
                    tracklist.push({
                        position: position || `${index + 1}`,
                        title: title,
                        duration: duration || null,
                        type_: 'track'
                    });
                }
            });

            updates.tracklist = tracklist;
            updates.trackCount = tracklist.length;

            // Collect credits data from form
            const creditRows = document.querySelectorAll('.credit-edit-row');
            const credits = [];

            creditRows.forEach((row, index) => {
                const name = row.querySelector('.credit-name').value.trim();
                const role = row.querySelector('.credit-role').value.trim();

                if (name && role) { // Only add credits with both name and role
                    credits.push({
                        name: name,
                        role: role,
                        id: null // Will be populated by Supabase processing
                    });
                }
            });

            updates.credits = credits;

            console.log('🔄 Saving album updates:', {
                basicInfo: { title: updates.title, artist: updates.artist, year: updates.year },
                tracks: `${tracklist.length} tracks`,
                credits: `${credits.length} credits`,
                genres: updates.genres.length,
                styles: updates.styles.length
            });

            // Update album in Supabase
            await this.supabaseService.updateAlbum(albumId, updates);
            
            // Update local collection efficiently (no need to reload everything)
            const albumIndex = this.collection.albums.findIndex(a => a.id == albumId);
            if (albumIndex !== -1) {
                const album = this.collection.albums[albumIndex];
                album.title = updates.title;
                album.artist = updates.artist;
                album.year = updates.year;
                album.genres = updates.genres;
                album.styles = updates.styles;
                album.tracklist = updates.tracklist;
                album.trackCount = updates.trackCount;
                album.track_count = updates.trackCount;
                album.credits = updates.credits;
                if (updates.coverImage) {
                    album.images = [{ uri: updates.coverImage }];
                }
            }

            // Just refresh the current view instead of reloading all data
            this.refreshCurrentView();
            
            // Force close modal AFTER view refresh and restore scroll position
            this.forceCloseModal();
            
            console.log('✅ Album updated successfully:', {
                title: updates.title,
                tracks: tracklist.length,
                credits: credits.length
            });
            
        } catch (error) {
            console.error('❌ Failed to save album edit:', error);
            alert('Failed to save changes. Please try again.');
        } finally {
            saveBtn.classList.remove('loading');
            saveBtn.innerHTML = originalText;
        }
    }

    // Generate tracklist edit section
    generateTracklistEditSection(tracklist) {
        if (!tracklist || tracklist.length === 0) {
            return `
                <div class="track-edit-row" data-track-index="0">
                    <div class="track-number">#1</div>
                    <div class="track-fields-group">
                        <div class="track-field-wrapper">
                            <label class="track-field-label">Position</label>
                            <input type="text" class="track-position" placeholder="A1" value="">
                        </div>
                        <div class="track-field-wrapper track-title-wrapper">
                            <label class="track-field-label">Track Title</label>
                            <input type="text" class="track-title" placeholder="Enter track title" value="" required>
                        </div>
                        <div class="track-field-wrapper">
                            <label class="track-field-label">Duration</label>
                            <input type="text" class="track-duration" placeholder="3:24" value="">
                        </div>
                    </div>
                    <button type="button" class="remove-track-btn" onclick="window.albumApp.removeTrackRow(this)" title="Remove track">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="15" y1="9" x2="9" y2="15"></line>
                            <line x1="9" y1="9" x2="15" y2="15"></line>
                        </svg>
                    </button>
                </div>
            `;
        }

        return tracklist.map((track, index) => `
            <div class="track-edit-row" data-track-index="${index}">
                <div class="track-number">#${index + 1}</div>
                <div class="track-fields-group">
                    <div class="track-field-wrapper">
                        <label class="track-field-label">Position</label>
                        <input type="text" class="track-position" placeholder="A1" value="${this.escapeAttributeValue(track.position || '')}">
                    </div>
                    <div class="track-field-wrapper track-title-wrapper">
                        <label class="track-field-label">Track Title</label>
                        <input type="text" class="track-title" placeholder="Enter track title" value="${this.escapeAttributeValue(track.title || '')}" required>
                    </div>
                    <div class="track-field-wrapper">
                        <label class="track-field-label">Duration</label>
                        <input type="text" class="track-duration" placeholder="3:24" value="${this.escapeAttributeValue(track.duration || '')}">
                    </div>
                </div>
                <button type="button" class="remove-track-btn" onclick="window.albumApp.removeTrackRow(this)" title="Remove track">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="15" y1="9" x2="9" y2="15"></line>
                        <line x1="9" y1="9" x2="15" y2="15"></line>
                    </svg>
                </button>
            </div>
        `).join('');
    }

    // Generate credits edit section
    generateCreditsEditSection(credits) {
        if (!credits || credits.length === 0) {
            return `
                <div class="credit-edit-row" data-credit-index="0">
                    <div class="credit-fields-group">
                        <div class="credit-field-wrapper credit-name-wrapper">
                            <label class="credit-field-label">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                    <circle cx="12" cy="7" r="4"></circle>
                                </svg>
                                Artist Name
                            </label>
                            <input type="text" class="credit-name" placeholder="Enter artist name" value="" required>
                        </div>
                        <div class="credit-field-wrapper credit-role-wrapper">
                            <label class="credit-field-label">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M9 12l2 2 4-4"></path>
                                    <path d="M21 12c-1 0-3-1-3-3s2-3 3-3 3 1 3 3-2 3-3 3"></path>
                                    <path d="M3 12c1 0 3-1 3-3s-2-3-3-3-3 1-3 3 2 3 3 3"></path>
                                </svg>
                                Role
                            </label>
                            <input type="text" class="credit-role" placeholder="e.g., Piano, Producer, Vocals" value="" required>
                        </div>
                    </div>
                    <button type="button" class="remove-credit-btn" onclick="window.albumApp.removeCreditRow(this)" title="Remove credit">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="15" y1="9" x2="9" y2="15"></line>
                            <line x1="9" y1="9" x2="15" y2="15"></line>
                        </svg>
                    </button>
                </div>
            `;
        }

        return credits.map((credit, index) => `
            <div class="credit-edit-row" data-credit-index="${index}">
                <div class="credit-fields-group">
                    <div class="credit-field-wrapper credit-name-wrapper">
                        <label class="credit-field-label">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                <circle cx="12" cy="7" r="4"></circle>
                            </svg>
                            Artist Name
                        </label>
                        <input type="text" class="credit-name" placeholder="Enter artist name" value="${this.escapeAttributeValue(credit.name || '')}" required>
                    </div>
                    <div class="credit-field-wrapper credit-role-wrapper">
                        <label class="credit-field-label">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M9 12l2 2 4-4"></path>
                                <path d="M21 12c-1 0-3-1-3-3s2-3 3-3 3 1 3 3-2 3-3 3"></path>
                                <path d="M3 12c1 0 3-1 3-3s-2-3-3-3-3 1-3 3 2 3 3 3"></path>
                            </svg>
                            Role
                        </label>
                        <input type="text" class="credit-role" placeholder="e.g., Piano, Producer, Vocals" value="${this.escapeAttributeValue(credit.role || '')}" required>
                    </div>
                </div>
                <button type="button" class="remove-credit-btn" onclick="window.albumApp.removeCreditRow(this)" title="Remove credit">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="15" y1="9" x2="9" y2="15"></line>
                        <line x1="9" y1="9" x2="15" y2="15"></line>
                    </svg>
                </button>
            </div>
        `).join('');
    }

    // Add new track row
    addTrackRow() {
        const container = document.getElementById('tracklist-edit-container');
        const trackCount = container.children.length;
        
        const newRow = document.createElement('div');
        newRow.className = 'track-edit-row';
        newRow.setAttribute('data-track-index', trackCount);
        newRow.innerHTML = `
            <div class="track-number">#${trackCount + 1}</div>
            <div class="track-fields-group">
                <div class="track-field-wrapper">
                    <label class="track-field-label">Position</label>
                    <input type="text" class="track-position" placeholder="A${trackCount + 1}" value="">
                </div>
                <div class="track-field-wrapper track-title-wrapper">
                    <label class="track-field-label">Track Title</label>
                    <input type="text" class="track-title" placeholder="Enter track title" value="" required>
                </div>
                <div class="track-field-wrapper">
                    <label class="track-field-label">Duration</label>
                    <input type="text" class="track-duration" placeholder="3:24" value="">
                </div>
            </div>
            <button type="button" class="remove-track-btn" onclick="window.albumApp.removeTrackRow(this)" title="Remove track">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="15" y1="9" x2="9" y2="15"></line>
                    <line x1="9" y1="9" x2="15" y2="15"></line>
                </svg>
            </button>
        `;
        
        container.appendChild(newRow);
        
        // Focus on the title input of the new track
        const titleInput = newRow.querySelector('.track-title');
        if (titleInput) {
            titleInput.focus();
        }
    }

    // Remove track row
    removeTrackRow(button) {
        const row = button.closest('.track-edit-row');
        const container = document.getElementById('tracklist-edit-container');
        
        // Don't remove if it's the only row
        if (container.children.length > 1) {
            row.remove();
            this.reindexTrackRows();
        } else {
            // Clear the row instead of removing it
            row.querySelector('.track-position').value = '';
            row.querySelector('.track-title').value = '';
            row.querySelector('.track-duration').value = '';
        }
    }

    // Add new credit row
    addCreditRow() {
        const container = document.getElementById('credits-edit-container');
        const creditCount = container.children.length;
        
        const newRow = document.createElement('div');
        newRow.className = 'credit-edit-row';
        newRow.setAttribute('data-credit-index', creditCount);
        newRow.innerHTML = `
            <div class="credit-fields-group">
                <div class="credit-field-wrapper credit-name-wrapper">
                    <label class="credit-field-label">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                        Artist Name
                    </label>
                    <input type="text" class="credit-name" placeholder="Enter artist name" value="" required>
                </div>
                <div class="credit-field-wrapper credit-role-wrapper">
                    <label class="credit-field-label">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M9 12l2 2 4-4"></path>
                            <path d="M21 12c-1 0-3-1-3-3s2-3 3-3 3 1 3 3-2 3-3 3"></path>
                            <path d="M3 12c1 0 3-1-3-3s-2-3-3-3-3 1-3 3 2 3 3 3"></path>
                        </svg>
                        Role
                    </label>
                    <input type="text" class="credit-role" placeholder="e.g., Piano, Producer, Vocals" value="" required>
                </div>
            </div>
            <button type="button" class="remove-credit-btn" onclick="window.albumApp.removeCreditRow(this)" title="Remove credit">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="15" y1="9" x2="9" y2="15"></line>
                    <line x1="9" y1="9" x2="15" y2="15"></line>
                </svg>
            </button>
        `;
        
        container.appendChild(newRow);
        
        // Focus on the name input of the new credit
        const nameInput = newRow.querySelector('.credit-name');
        if (nameInput) {
            nameInput.focus();
        }
    }

    // Remove credit row
    removeCreditRow(button) {
        const row = button.closest('.credit-edit-row');
        const container = document.getElementById('credits-edit-container');
        
        // Don't remove if it's the only row
        if (container.children.length > 1) {
            row.remove();
            this.reindexCreditRows();
        } else {
            // Clear the row instead of removing it
            row.querySelector('.credit-name').value = '';
            row.querySelector('.credit-role').value = '';
        }
    }

    // Reindex track rows after removal
    reindexTrackRows() {
        const container = document.getElementById('tracklist-edit-container');
        Array.from(container.children).forEach((row, index) => {
            row.setAttribute('data-track-index', index);
            // Update track number display
            const trackNumber = row.querySelector('.track-number');
            if (trackNumber) {
                trackNumber.textContent = `#${index + 1}`;
            }
        });
    }

    // Reindex credit rows after removal
    reindexCreditRows() {
        const container = document.getElementById('credits-edit-container');
        Array.from(container.children).forEach((row, index) => {
            row.setAttribute('data-credit-index', index);
        });
    }

    // Confirm album deletion
    confirmDeleteAlbum(albumId, albumTitle) {
        const confirmationHtml = `
            <div class="confirmation-dialog">
                <div class="confirmation-icon">⚠️</div>
                <h3 class="confirmation-title">Delete Album</h3>
                <p class="confirmation-message">
                    Are you sure you want to delete "<strong>${albumTitle}</strong>"?<br>
                    This action cannot be undone.
                </p>
                <div class="confirmation-actions">
                    <button class="form-btn cancel-btn" onclick="window.albumApp.closeModal()">
                        ❌ Cancel
                    </button>
                    <button class="form-btn delete-btn" onclick="window.albumApp.deleteAlbum('${albumId}')">
                        🗑️ Delete
                    </button>
                </div>
            </div>
        `;
        
        // Show confirmation directly without outer modal wrapper
        document.getElementById('modal-title').innerHTML = '';
        document.getElementById('modal-body').innerHTML = confirmationHtml;
        document.getElementById('modal-body').scrollTop = 0;
        document.getElementById('more-info-modal').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    // Delete album
    async deleteAlbum(albumId) {
        const deleteBtn = document.querySelector('.delete-btn');
        const originalText = deleteBtn.innerHTML;
        
        // Store current scroll position for Albums page
        this.mainPageScrollPosition = window.pageYOffset || document.documentElement.scrollTop;
        
        try {
            deleteBtn.classList.add('loading');
            deleteBtn.innerHTML = '🗑️ Deleting...';
            
            // Delete from Supabase
            await this.supabaseService.deleteAlbum(albumId);
            
            // Update local collection immediately (no database reload needed)
            this.collection.albums = this.collection.albums.filter(a => a.id != albumId);
            
            // Regenerate derived data locally (no Supabase reload)
            this.regenerateCollectionData();
            
            // Close modal immediately
            this.closeModal();
            
            // Refresh current view to show updated data
            this.refreshCurrentView();
            
            // Restore scroll position after UI update (with small delay)
            setTimeout(() => {
                if (this.currentView === 'albums' && this.mainPageScrollPosition) {
                    window.scrollTo(0, this.mainPageScrollPosition);
                }
            }, 100);
            
            console.log('✅ Album deleted successfully');
            
        } catch (error) {
            console.error('❌ Failed to delete album:', error);
            alert('Failed to delete album. Please try again.');
        } finally {
            deleteBtn.classList.remove('loading');
            deleteBtn.innerHTML = originalText;
        }
    }

    // Artist edit/delete methods
    async openEditArtistModal(artistId) {
        const artist = this.collection.artists.find(a => a.id == artistId);
        if (!artist) {
            console.error('Artist not found:', artistId);
            return;
        }
        const editForm = this.generateEditArtistForm(artist);
        this.showModal(`Edit Artist: ${artist.name}`, editForm, true);
    }

    generateEditArtistForm(artist) {
        const rolesString = (artist.roles || []).join(', ');
        return `
            <div class="edit-form">
                <form onsubmit="return false;">
                    <div class="form-group">
                        <label for="edit-artist-name">Artist Name</label>
                        <input type="text" id="edit-artist-name" value="${artist.name || ''}" required>
                    </div>
                    <div class="form-group">
                        <label for="edit-artist-image">Image URL</label>
                        <input type="url" id="edit-artist-image" value="${artist.image || ''}" placeholder="https://...">
                    </div>
                    <div class="form-group">
                        <label for="edit-artist-roles">Roles (comma-separated)</label>
                        <input type="text" id="edit-artist-roles" value="${rolesString}" placeholder="Piano, Vocals, Guitar">
                    </div>
                    <div class="form-actions">
                        <button type="button" class="form-btn cancel-btn" onclick="window.albumApp.closeModal()">❌ Cancel</button>
                        <button type="button" class="form-btn save-btn" onclick="window.albumApp.saveArtistEdit('${artist.id}')">💾 Save Changes</button>
                    </div>
                </form>
            </div>
        `;
    }

    async saveArtistEdit(artistId) {
        const saveBtn = document.querySelector('.save-btn');
        try {
            saveBtn.classList.add('loading');
            const updates = {
                name: document.getElementById('edit-artist-name').value.trim(),
                image: document.getElementById('edit-artist-image').value.trim() || null,
                roles: document.getElementById('edit-artist-roles').value.split(',').map(r => r.trim()).filter(r => r)
            };
            if (!updates.name) { alert('Artist name is required.'); return; }
            if (window.RoleCategorizer) {
                const { musical, technical } = window.RoleCategorizer.categorizeRoles(updates.roles);
                updates.musicalRoles = musical;
                updates.technicalRoles = technical;
                updates.mostCommonRole = updates.roles[0] || null;
            }
            await this.supabaseService.updateArtist(artistId, updates);
            await this.loadDataFromSupabase();
            this.closeModal();
            console.log('✅ Artist updated successfully');
        } catch (error) {
            console.error('❌ Failed to save artist edit:', error);
            alert('Failed to save changes. Please try again.');
        } finally {
            saveBtn.classList.remove('loading');
        }
    }

    confirmDeleteArtist(artistId, artistName) {
        this.showModal('Confirm Deletion', `
            <div class="confirmation-dialog">
                <div class="confirmation-icon">⚠️</div>
                <h3 class="confirmation-title">Delete Artist</h3>
                <p class="confirmation-message">Are you sure you want to delete "<strong>${artistName}</strong>"?<br>This will also remove their associations with albums and roles.<br>This action cannot be undone.</p>
                <div class="confirmation-actions">
                    <button class="form-btn cancel-btn" onclick="window.albumApp.closeModal()">❌ Cancel</button>
                    <button class="form-btn delete-btn" onclick="window.albumApp.deleteArtist('${artistId}')">🗑️ Delete</button>
                </div>
            </div>
        `, true);
    }

    async deleteArtist(artistId) {
        try {
            await this.supabaseService.deleteArtist(artistId);
            await this.loadDataFromSupabase();
            this.closeModal();
            console.log('✅ Artist deleted successfully');
        } catch (error) {
            console.error('❌ Failed to delete artist:', error);
            alert('Failed to delete artist. Please try again.');
        }
    }

    // Track edit/delete methods
    async openEditTrackModal(trackId) {
        const track = this.collection.tracks.find(t => t.id == trackId);
        if (!track) return;
        const editForm = `
            <div class="edit-form">
                <form onsubmit="return false;">
                    <div class="form-group">
                        <label for="edit-track-title">Track Title</label>
                        <input type="text" id="edit-track-title" value="${track.title || ''}" required>
                    </div>
                    <div class="form-group">
                        <label for="edit-track-duration">Duration</label>
                        <input type="text" id="edit-track-duration" value="${track.duration || ''}" placeholder="3:45">
                    </div>
                    <div class="form-actions">
                        <button type="button" class="form-btn cancel-btn" onclick="window.albumApp.closeModal()">❌ Cancel</button>
                        <button type="button" class="form-btn save-btn" onclick="window.albumApp.saveTrackEdit('${track.id}')">💾 Save Changes</button>
                    </div>
                </form>
            </div>
        `;
        this.showModal(`Edit Track: ${track.title}`, editForm, true);
    }

    async saveTrackEdit(trackId) {
        try {
            const updates = {
                title: document.getElementById('edit-track-title').value.trim(),
                duration: document.getElementById('edit-track-duration').value.trim() || null
            };
            if (!updates.title) { alert('Track title is required.'); return; }
            await this.supabaseService.updateTrack(trackId, updates);
            await this.loadDataFromSupabase();
            this.closeModal();
            console.log('✅ Track updated successfully');
        } catch (error) {
            console.error('❌ Failed to save track edit:', error);
            alert('Failed to save changes. Please try again.');
        }
    }

    confirmDeleteTrack(trackId, trackTitle) {
        this.showModal('Confirm Deletion', `
            <div class="confirmation-dialog">
                <div class="confirmation-icon">⚠️</div>
                <h3 class="confirmation-title">Delete Track</h3>
                <p class="confirmation-message">Are you sure you want to delete "<strong>${trackTitle}</strong>"?<br>This action cannot be undone.</p>
                <div class="confirmation-actions">
                    <button class="form-btn cancel-btn" onclick="window.albumApp.closeModal()">❌ Cancel</button>
                    <button class="form-btn delete-btn" onclick="window.albumApp.deleteTrack('${trackId}')">🗑️ Delete</button>
                </div>
            </div>
        `, true);
    }

    async deleteTrack(trackId) {
        try {
            await this.supabaseService.deleteTrack(trackId);
            await this.loadDataFromSupabase();
            this.closeModal();
            console.log('✅ Track deleted successfully');
        } catch (error) {
            console.error('❌ Failed to delete track:', error);
            alert('Failed to delete track. Please try again.');
        }
    }

    // Role edit/delete methods
    async openEditRoleModal(roleId) {
        const role = this.collection.roles.find(r => r.id == roleId);
        if (!role) return;
        const editForm = `
            <div class="edit-form">
                <form onsubmit="return false;">
                    <div class="form-group">
                        <label for="edit-role-name">Role Name</label>
                        <input type="text" id="edit-role-name" value="${role.name || ''}" required>
                    </div>
                    <div class="form-group">
                        <label for="edit-role-category">Category</label>
                        <select id="edit-role-category" required>
                            <option value="musical" ${role.category === 'musical' ? 'selected' : ''}>Musical</option>
                            <option value="technical" ${role.category === 'technical' ? 'selected' : ''}>Technical</option>
                        </select>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="form-btn cancel-btn" onclick="window.albumApp.closeModal()">❌ Cancel</button>
                        <button type="button" class="form-btn save-btn" onclick="window.albumApp.saveRoleEdit('${role.id}')">💾 Save Changes</button>
                    </div>
                </form>
            </div>
        `;
        this.showModal(`Edit Role: ${role.name}`, editForm, true);
    }

    async saveRoleEdit(roleId) {
        try {
            const updates = {
                name: document.getElementById('edit-role-name').value.trim(),
                category: document.getElementById('edit-role-category').value
            };
            if (!updates.name) { alert('Role name is required.'); return; }
            await this.supabaseService.updateRole(roleId, updates);
            await this.loadDataFromSupabase();
            this.closeModal();
            console.log('✅ Role updated successfully');
        } catch (error) {
            console.error('❌ Failed to save role edit:', error);
            alert('Failed to save changes. Please try again.');
        }
    }

    confirmDeleteRole(roleId, roleName) {
        this.showModal('Confirm Deletion', `
            <div class="confirmation-dialog">
                <div class="confirmation-icon">⚠️</div>
                <h3 class="confirmation-title">Delete Role</h3>
                <p class="confirmation-message">Are you sure you want to delete the role "<strong>${roleName}</strong>"?<br>This action cannot be undone.</p>
                <div class="confirmation-actions">
                    <button class="form-btn cancel-btn" onclick="window.albumApp.closeModal()">❌ Cancel</button>
                    <button class="form-btn delete-btn" onclick="window.albumApp.deleteRole('${roleId}')">🗑️ Delete</button>
                </div>
            </div>
        `, true);
    }

    async deleteRole(roleId) {
        try {
            await this.supabaseService.deleteRole(roleId);
            await this.loadDataFromSupabase();
            this.closeModal();
            console.log('✅ Role deleted successfully');
        } catch (error) {
            console.error('❌ Failed to delete role:', error);
            alert('Failed to delete role. Please try again.');
        }
    }

    // ===== SCRAPED ARTISTS HISTORY METHODS =====
    
    async loadScrapedHistory() {
        if (!this.supabaseService) return;
        
        try {
            this.scrapedHistory = await this.supabaseService.getScrapedArtistsHistory();
            this.renderScrapedHistory();
        } catch (error) {
            console.error('❌ Failed to load scraped history:', error);
            this.scrapedHistory = [];
        }
    }
    
    renderScrapedHistory() {
        const container = document.getElementById('scraped-history-list');
        const countElement = document.getElementById('history-count');
        
        if (!container || !countElement) return;
        
        if (this.scrapedHistory.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>🎭 No artists scraped yet</p>
                    <p>Your scraping history will appear here to avoid duplicates.</p>
                </div>
            `;
            countElement.textContent = '0';
            return;
        }
        
        const historyHtml = this.scrapedHistory.map(entry => {
            const date = new Date(entry.scraped_at).toLocaleDateString();
            const success = entry.success ? '✅' : '❌';
            const details = `${entry.albums_added}/${entry.albums_found} albums added`;
            
            return `
                <div class="history-item">
                    <div class="history-item-info">
                        <span class="history-item-name">${success} ${entry.artist_name}</span>
                        <span class="history-item-details">${details}</span>
                    </div>
                    <span class="history-item-date">${date}</span>
                </div>
            `;
        }).join('');
        
        container.innerHTML = historyHtml;
        countElement.textContent = this.scrapedHistory.length.toString();
    }
    
    async addToScrapedHistory(artistName, discogsId, searchQuery, albumsFound, albumsAdded, success = true, notes = null) {
        if (!this.supabaseService) return;
        
        try {
            const entry = await this.supabaseService.addScrapedArtist(
                artistName, discogsId, searchQuery, albumsFound, albumsAdded, success, notes
            );
            
            // Add to local array and re-render
            this.scrapedHistory.unshift(entry);
            this.renderScrapedHistory();
            
        } catch (error) {
            console.error('❌ Failed to add to scraped history:', error);
        }
    }
    
    async isArtistAlreadyScraped(artistName, discogsId = null) {
        if (!this.supabaseService) return false;
        
        try {
            const result = await this.supabaseService.isArtistAlreadyScraped(artistName, discogsId);
            return result !== null;
        } catch (error) {
            console.error('❌ Failed to check scraped history:', error);
            return false;
        }
    }
    
    async clearScrapedHistory() {
        if (!this.supabaseService) return;
        
        if (!confirm('Are you sure you want to clear all scraped artists history? This cannot be undone.')) {
            return;
        }
        
        try {
            await this.supabaseService.clearScrapedHistory();
            this.scrapedHistory = [];
            this.renderScrapedHistory();
            
            // Remove scraped indicators from any visible search results
            this.removeScrapedIndicators();
            
            alert('✅ Scraped artists history cleared successfully!');
        } catch (error) {
            console.error('❌ Failed to clear scraped history:', error);
            alert('❌ Failed to clear history. Please try again.');
        }
    }
    
    removeScrapedIndicators() {
        const searchResults = document.querySelectorAll('.search-result-item.already-scraped');
        searchResults.forEach(item => {
            item.classList.remove('already-scraped');
        });
    }
    
    async markSearchResultsAsScraped() {
        const searchResults = document.querySelectorAll('.search-result-item');
        
        for (const item of searchResults) {
            const artistName = item.querySelector('.artist-name')?.textContent?.trim();
            const discogsId = item.dataset.discogsId;
            
            if (artistName) {
                const isScraped = await this.isArtistAlreadyScraped(artistName, discogsId);
                if (isScraped) {
                    item.classList.add('already-scraped');
                }
            }
        }
    }

    // Search Event Listeners Setup
    setupSearchEventListeners() {
        // Albums search
        const albumsSearch = document.getElementById('albums-search');
        if (albumsSearch) {
            albumsSearch.addEventListener('input', (e) => {
                this.searchAlbumsCollection(e.target.value);
            });
        }

        // Artists search
        const artistsSearch = document.getElementById('artists-search');
        if (artistsSearch) {
            artistsSearch.addEventListener('input', (e) => {
                this.searchArtistsCollection(e.target.value);
            });
        }

        // Tracks search
        const tracksSearch = document.getElementById('tracks-search');
        if (tracksSearch) {
            tracksSearch.addEventListener('input', (e) => {
                this.searchTracksCollection(e.target.value);
            });
        }

        // Roles search
        const rolesSearch = document.getElementById('roles-search');
        if (rolesSearch) {
            rolesSearch.addEventListener('input', (e) => {
                this.searchRolesCollection(e.target.value);
            });
        }

        // Artist albums modal search (dynamic - will be added when modal opens)
        document.addEventListener('input', (e) => {
            if (e.target && e.target.id === 'artist-albums-search') {
                console.log('🔍 Artist albums search event detected:', e.target.value, e.target.dataset.artist);
                this.searchArtistAlbums(e.target.value, e.target.dataset.artist);
            }
        });
        
        console.log('✅ Search event listeners set up successfully');
    }

    // Search Functionality
    searchAlbumsCollection(query) {
        console.log(`🔍 Searching albums for: "${query}"`);
        
        // Store current search query
        this.currentSearchQueries.albums = query;
        
        if (!query.trim()) {
            // Empty search - re-apply current sort to show all albums
            const albumsSort = document.getElementById('albums-sort');
            const currentSortType = albumsSort ? albumsSort.value : 'recently-added';
            console.log(`🔄 Clearing search, re-applying sort: ${currentSortType}`);
            this.sortAlbums(currentSortType);
            return;
        }

        // Apply search filter by re-running current sort (which will now use the search filter)
        const albumsSort = document.getElementById('albums-sort');
        const currentSortType = albumsSort ? albumsSort.value : 'recently-added';
        console.log(`🔍 Applying search filter with current sort: ${currentSortType}`);
        this.sortAlbums(currentSortType);
    }

    searchArtistsCollection(query) {
        console.log(`🔍 Searching artists for: "${query}"`);
        
        // Store current search query
        this.currentSearchQueries.artists = query;
        
        // Ensure we have backup arrays to work with
        if (!this.originalMusicalArtists || !this.originalTechnicalArtists) {
            this.originalMusicalArtists = [...(this.musicalArtists || [])];
            this.originalTechnicalArtists = [...(this.technicalArtists || [])];
        }

        // Store current sort state before filtering
        const artistsSort = document.getElementById('artists-sort');
        const currentSortType = artistsSort ? artistsSort.value : 'most-albums';
        console.log(`🔄 Current sort type: ${currentSortType}`);
        
        if (!query.trim()) {
            // Empty search - restore original arrays and re-render
            this.musicalArtists = [...this.originalMusicalArtists];
            this.technicalArtists = [...this.originalTechnicalArtists];
            
            // Update tab counts
            document.getElementById('musical-artists-count').textContent = `(${this.musicalArtists.length})`;
            document.getElementById('technical-artists-count').textContent = `(${this.technicalArtists.length})`;
            
            // Re-apply the current sort to restored data
            console.log(`🔄 Re-applying sort after clearing search: ${currentSortType}`);
            this.sortArtists(currentSortType);
            return;
        }

        const searchText = query.toLowerCase();
        
        // Filter from original arrays (not current filtered arrays)
        const filteredMusical = this.originalMusicalArtists.filter(artist => {
            return (
                artist.name.toLowerCase().includes(searchText) ||
                (artist.roles && artist.roles.some(role => role.toLowerCase().includes(searchText)))
            );
        });

        const filteredTechnical = this.originalTechnicalArtists.filter(artist => {
            return (
                artist.name.toLowerCase().includes(searchText) ||
                (artist.roles && artist.roles.some(role => role.toLowerCase().includes(searchText)))
            );
        });

        // Update current arrays with filtered results
        this.musicalArtists = filteredMusical;
        this.technicalArtists = filteredTechnical;
        
        // Update tab counts
        document.getElementById('musical-artists-count').textContent = `(${filteredMusical.length})`;
        document.getElementById('technical-artists-count').textContent = `(${filteredTechnical.length})`;
        
        // Re-apply current sort to filtered results (always apply, regardless of sort type)
        console.log(`🔄 Re-applying sort after search filtering: ${currentSortType}`);
        this.sortArtists(currentSortType);
        
        console.log(`✅ Found ${filteredMusical.length} musical, ${filteredTechnical.length} technical artists matching "${query}"`);
    }

    searchTracksCollection(query) {
        console.log(`🔍 Searching tracks for: "${query}"`);
        
        // Store current search query
        this.currentSearchQueries.tracks = query;
        
        if (!query.trim()) {
            // Empty search - re-apply current sort to show all tracks
            const tracksSort = document.getElementById('tracks-sort');
            const currentSortType = tracksSort ? tracksSort.value : 'frequency';
            console.log(`🔄 Clearing search, re-applying sort: ${currentSortType}`);
            this.sortTracks(currentSortType);
            return;
        }

        // Apply search filter by re-running current sort (which will now use the search filter)
        const tracksSort = document.getElementById('tracks-sort');
        const currentSortType = tracksSort ? tracksSort.value : 'frequency';
        console.log(`🔍 Applying search filter with current sort: ${currentSortType}`);
        this.sortTracks(currentSortType);
    }

    searchRolesCollection(query) {
        console.log(`🔍 Searching roles for: "${query}"`);
        
        // Store current search query
        this.currentSearchQueries.roles = query;
        
        if (!query.trim()) {
            // Empty search - show all roles
            this.renderRolesGrid();
            return;
        }

        const searchText = query.toLowerCase();
        
        // Filter musical roles
        const filteredMusical = (this.musicalRoles || []).filter(role => {
            return role.name.toLowerCase().includes(searchText);
        });

        // Filter technical roles
        const filteredTechnical = (this.technicalRoles || []).filter(role => {
            return role.name.toLowerCase().includes(searchText);
        });

        // Update lazy loading for both tabs with filtered results
        this.musicalRoles = filteredMusical;
        this.technicalRoles = filteredTechnical;
        
        // Update tab counts
        document.getElementById('musical-roles-count').textContent = `(${filteredMusical.length})`;
        document.getElementById('technical-roles-count').textContent = `(${filteredTechnical.length})`;
        
        // Re-render the active tab with filtered data
        this.renderActiveRolesTab();
        
        console.log(`✅ Found ${filteredMusical.length} musical, ${filteredTechnical.length} technical roles matching "${query}"`);
    }

    // Search artist albums within modal
    searchArtistAlbums(query, artistName) {
        console.log(`🔍 searchArtistAlbums called with query: "${query}", artist: "${artistName}"`);
        
        const albumsGrid = document.getElementById('artist-albums-grid');
        const resultsCount = document.getElementById('search-results-count');
        
        console.log('🔍 Album grid element found:', !!albumsGrid);
        console.log('🔍 Results count element found:', !!resultsCount);
        
        if (!albumsGrid) {
            console.error('❌ Could not find artist-albums-grid element');
            return;
        }
        
        // Get all albums from the data attribute
        let allAlbums;
        try {
            const escapedJson = albumsGrid.dataset.allAlbums;
            // Unescape the JSON data that was escaped for HTML attribute
            const unescapedJson = escapedJson
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'");
            allAlbums = JSON.parse(unescapedJson);
            console.log('🔍 All albums data loaded:', allAlbums.length, 'albums');
        } catch (e) {
            console.error('❌ Error parsing album data:', e);
            console.error('❌ Raw dataset value:', albumsGrid.dataset.allAlbums);
            return;
        }
        
        if (!query.trim()) {
            console.log('🔍 Empty search - showing all albums');
            // Empty search - show all albums
            this.renderFilteredArtistAlbums(allAlbums, artistName);
            if (resultsCount) {
                resultsCount.textContent = `${allAlbums.length} album${allAlbums.length !== 1 ? 's' : ''}`;
            }
            return;
        }

        const searchText = query.toLowerCase();
        console.log('🔍 Search text processed:', searchText);
        
        // Enhanced filtering with multiple search criteria
        const filteredAlbums = allAlbums.filter(album => {
            // Search in title
            if (album.title && album.title.toLowerCase().includes(searchText)) {
                return true;
            }
            
            // Search in year
            if (album.year && album.year.toString().includes(searchText)) {
                return true;
            }
            
            // Search in album artist field
            if (album.artist && album.artist.toLowerCase().includes(searchText)) {
                return true;
            }
            
            // Search in artists array (if available)
            if (album.artists && Array.isArray(album.artists)) {
                if (album.artists.some(artist => {
                    const artistName = typeof artist === 'string' ? artist : artist.name;
                    return artistName && artistName.toLowerCase().includes(searchText);
                })) {
                    return true;
                }
            }
            
            // Search in genres
            if (album.genres && album.genres.some(genre => 
                genre.toLowerCase().includes(searchText))) {
                return true;
            }
            
            // Search in styles
            if (album.styles && album.styles.some(style => 
                style.toLowerCase().includes(searchText))) {
                return true;
            }
            
            // Search in roles that the current artist had on this album
            if (album.credits && Array.isArray(album.credits)) {
                const artistRoles = album.credits
                    .filter(credit => credit.name === artistName)
                    .map(credit => credit.role || '')
                    .join(' ')
                    .toLowerCase();
                if (artistRoles.includes(searchText)) {
                    return true;
                }
            }
            
            // Search in track titles
            if (album.tracklist && Array.isArray(album.tracklist)) {
                if (album.tracklist.some(track => 
                    track.title && track.title.toLowerCase().includes(searchText))) {
                    return true;
                }
            }
            
            // Search in album ID (for technical users)
            if (album.id && album.id.toString().includes(searchText)) {
                return true;
            }
            
            // Search in album format information
            if (album.formats && Array.isArray(album.formats)) {
                if (album.formats.some(format => {
                    const formatStr = JSON.stringify(format).toLowerCase();
                    return formatStr.includes(searchText);
                })) {
                    return true;
                }
            }
            
            return false;
        });

        console.log(`🔍 Filtered ${filteredAlbums.length} albums from ${allAlbums.length} total`);

        // Render filtered results
        this.renderFilteredArtistAlbums(filteredAlbums, artistName);
        
        // Update results count with more detailed info
        if (resultsCount) {
            if (filteredAlbums.length === allAlbums.length) {
                resultsCount.textContent = `${allAlbums.length} album${allAlbums.length !== 1 ? 's' : ''}`;
            } else {
                resultsCount.textContent = `${filteredAlbums.length} of ${allAlbums.length} album${allAlbums.length !== 1 ? 's' : ''} found`;
            }
        }
        
        console.log(`✅ Search completed: Found ${filteredAlbums.length} albums matching "${query}" for ${artistName}`);
    }

    // Render filtered artist albums in modal
    renderFilteredArtistAlbums(albums, artistName) {
        const albumsGrid = document.getElementById('artist-albums-grid');
        if (!albumsGrid) return;
        
        if (!albums || albums.length === 0) {
            albumsGrid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-content">
                        <h3>No albums found</h3>
                        <p>Try adjusting your search terms</p>
                    </div>
                </div>
            `;
            return;
        }

        const albumsHtml = albums.map(album => {
            // Get formatted artists display (same as main collection view)
            const artistsDisplay = this.getAlbumArtistsDisplay(album);
            
            // Get cover image URL with fallback logic
            const coverImageUrl = album.images && album.images[0] ? album.images[0].uri : '';
            
            // Generate genre and style tags (same as main album cards)
            const tags = [];
            if (album.genres && Array.isArray(album.genres)) {
                tags.push(...album.genres);
            }
            if (album.styles && Array.isArray(album.styles)) {
                tags.push(...album.styles);
            }
            const uniqueTags = [...new Set(tags)].slice(0, 4);
            const genreStyleTagsHtml = uniqueTags.length > 0 
                ? `<div class="genre-tags-container">${uniqueTags.map(tag => 
                    `<span class="genre-tag" title="${tag}">${tag}</span>`
                ).join('')}</div>` 
                : '';
            
            return `
                <div class="album-card" data-album-id="${album.id}">
                    <div class="album-card-inner">
                        <div class="album-cover">
                            <img 
                                src="${coverImageUrl}" 
                                alt="${this.escapeAttributeValue('Cover art for ' + album.title)}"
                                class="cover-image"
                                loading="lazy"
                                onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
                            />
                            <div class="album-placeholder" style="display: none;">
                                <div class="placeholder-icon">🎵</div>
                                <div class="placeholder-text">No Cover</div>
                            </div>
                            <div class="album-overlay">
                                <div class="album-actions">
                                    <button class="overlay-circle-btn more-info-btn" data-album-id="${album.id || albumData.id}" title="More Info">
                                        ℹ️
                                    </button>
                                    <button class="overlay-circle-btn spotify-btn" data-search-query="${(artistsDisplay || albumData.artist)} ${(album.title || albumData.title)}" title="Spotify">
                                        🎵
                                    </button>
                                    <button class="overlay-circle-btn youtube-btn" data-search-query="${(artistsDisplay || albumData.artist)} ${(album.title || albumData.title)}" title="YouTube">
                                        📺
                                    </button>
                                </div>
                            </div>
                            <div class="card-edit-overlay">
                                <button class="card-edit-btn edit" onclick="window.albumApp.openEditAlbumModal('${album.id || albumData.id}'); event.stopPropagation();" title="Edit Album">
                                    ✏️
                                </button>
                                <button class="card-edit-btn delete" onclick="window.albumApp.confirmDeleteAlbum('${album.id || albumData.id}', '${this.escapeAttributeValue((album.title || albumData.title))}'); event.stopPropagation();" title="Delete Album">
                                    🗑️
                                </button>
                            </div>
                        </div>
                        <div class="album-info">
                            <h3 class="album-title" title="${album.title}">${album.title}</h3>
                            <p class="album-artist" title="${artistsDisplay}">${artistsDisplay}</p>
                            <p class="album-year">${album.year || 'Unknown Year'}</p>
                            <div class="album-meta">
                                <span class="track-count">${album.track_count || album.trackCount || 0} tracks</span>
                                ${genreStyleTagsHtml}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        albumsGrid.innerHTML = albumsHtml;
    }

    // Debug methods for lazy loading
    getLazyLoadingStats() {
        if (!this.lazyLoadingManager) {
            console.log('Lazy loading manager not initialized');
            return;
        }
        
        const grids = ['albums-grid', 'musical-artists-grid', 'technical-artists-grid', 'tracks-grid', 'musical-roles-grid', 'technical-roles-grid'];
        console.log('📊 Lazy Loading Performance Stats:');
        
        grids.forEach(gridId => {
            const stats = this.lazyLoadingManager.getStats(gridId);
            if (stats) {
                console.log(`   ${gridId}:`, `${stats.loadedItems}/${stats.totalItems} (${stats.loadingPercentage}%) - Page ${stats.currentPage}`);
            }
        });
    }
    
    // Force load more items for testing
    forceLoadMore(gridId) {
        if (this.lazyLoadingManager) {
            this.lazyLoadingManager.loadNextBatch(gridId || 'albums-grid');
        }
    }

    // Filtered Rendering Methods
    renderFilteredAlbums(albumsArray) {
        const albumsGrid = document.getElementById('albums-grid');
        
        if (albumsArray.length === 0) {
            albumsGrid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-content">
                        <h3>No albums found</h3>
                        <p>Try adjusting your search terms.</p>
                    </div>
                </div>
            `;
            return;
        }
        
        // Clear existing content
        albumsGrid.innerHTML = '';
        
        // Create album cards for filtered results
        albumsArray.forEach(albumData => {
            const albumCard = new AlbumCard(albumData);
            const cardElement = albumCard.render();
            albumsGrid.appendChild(cardElement);
        });
        
        console.log(`✅ Rendered ${albumsArray.length} filtered album cards`);
    }

    renderFilteredArtists(musicalArray, technicalArray) {
        // Update tab counts
        document.getElementById('musical-artists-count').textContent = `(${musicalArray.length})`;
        document.getElementById('technical-artists-count').textContent = `(${technicalArray.length})`;
        
        // Store filtered data for tab switching
        this.musicalArtists = musicalArray;
        this.technicalArtists = technicalArray;
        
        // Only render the currently active tab instead of both
        this.renderActiveArtistsTab();
        
        console.log(`✅ Rendered filtered artists: ${musicalArray.length} musical, ${technicalArray.length} technical`);
    }

    renderFilteredTracks(tracksArray) {
        const tracksGrid = document.getElementById('tracks-grid');
        
        if (tracksArray.length === 0) {
            tracksGrid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-content">
                        <h3>No tracks found</h3>
                        <p>Try adjusting your search terms.</p>
                    </div>
                </div>
            `;
            return;
        }
        
        // Clear existing content
        tracksGrid.innerHTML = '';
        
        // Create track cards for filtered results
        tracksArray.forEach(track => {
            const trackCard = this.createTrackCard(track);
            tracksGrid.appendChild(trackCard);
        });
        
        console.log(`✅ Rendered ${tracksArray.length} filtered track cards`);
    }

    renderFilteredRoles(musicalArray, technicalArray) {
        // Update tab counts
        document.getElementById('musical-roles-count').textContent = `(${musicalArray.length})`;
        document.getElementById('technical-roles-count').textContent = `(${technicalArray.length})`;
        
        // Render musical roles tab
        const musicalGrid = document.getElementById('musical-roles-grid');
        this.renderRoleCards(musicalGrid, musicalArray, 'No musical roles found');
        
        // Render technical roles tab
        const technicalGrid = document.getElementById('technical-roles-grid');
        this.renderRoleCards(technicalGrid, technicalArray, 'No technical roles found');
        
        console.log(`✅ Rendered filtered roles: ${musicalArray.length} musical, ${technicalArray.length} technical`);
    }

    // Helper methods for rendering individual cards
    renderArtistCards(container, artistsArray, emptyMessage) {
        if (artistsArray.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-content">
                        <h3>${emptyMessage}</h3>
                        <p>Try adjusting your search terms.</p>
                    </div>
                </div>
            `;
            return;
        }
        
        // Clear existing content
        container.innerHTML = '';
        
        // Create artist cards
        artistsArray.forEach(artistData => {
            const artistCard = new ArtistCard(artistData);
            const cardElement = artistCard.render();
            container.appendChild(cardElement);
        });
    }

    renderRoleCards(container, rolesArray, emptyMessage) {
        if (rolesArray.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-content">
                        <h3>${emptyMessage}</h3>
                        <p>Try adjusting your search terms.</p>
                    </div>
                </div>
            `;
            return;
        }
        
        // Clear existing content
        container.innerHTML = '';
        
        // Create role cards
        rolesArray.forEach(role => {
            const roleCard = this.createRoleCard(role);
            container.appendChild(roleCard);
        });
    }

    // Clear all search inputs
    clearAllSearchInputs() {
        const searchInputs = [
            'albums-search',
            'artists-search', 
            'tracks-search',
            'roles-search'
        ];
        
        searchInputs.forEach(inputId => {
            const input = document.getElementById(inputId);
            if (input) {
                input.value = '';
            }
        });
        
        console.log('🧹 Cleared all search inputs');
    }
}

// Global function for toggling track role details
window.toggleTrackRoles = function(creditId) {
    const detailsElement = document.getElementById(`${creditId}-details`);
    const toggleButton = detailsElement.previousElementSibling;
    const toggleIcon = toggleButton.querySelector('.toggle-icon');
    
    if (detailsElement.style.display === 'none') {
        // Expand
        detailsElement.style.display = 'block';
        toggleIcon.textContent = '▼';
        toggleButton.classList.add('expanded');
    } else {
        // Collapse
        detailsElement.style.display = 'none';
        toggleIcon.textContent = '▶';
        toggleButton.classList.remove('expanded');
    }
};

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing app...');
    window.albumApp = new AlbumCollectionApp();
    
    // Test Discogs API integration (Enhanced UX version)
    window.testDiscogsAPI = async function(manuallyTriggered = false) {
        console.log('🧪 Testing Discogs API integration...');
        
        try {
            // Test API connection
            const connectionTest = await window.discogsAPI.testConnection();
            if (!connectionTest) {
                console.error('❌ API connection test failed');
                // Show error overlay if manually triggered
                if (manuallyTriggered) {
                    window.albumApp.showLoading('API Connection Failed ❌');
                    setTimeout(() => {
                        window.albumApp.hideLoading();
                    }, 3000);
                } else if (window.CONFIG.DEBUG.ENABLED) {
                    console.log('🔧 API test available via console: window.testDiscogsAPI()');
                }
                return;
            }
            
            // Test parser functionality
            console.log('🔍 Testing parser functionality...');
            const parserStats = window.discogsParser.getParsingStats();
            console.log('📊 Parser configuration:', parserStats);
            
            console.log('✅ All Discogs API tests passed!');
            
            // Show overlay if manually triggered or if auto-test is enabled
            if (manuallyTriggered || (window.CONFIG.DEBUG.ENABLED && window.CONFIG.DEBUG.AUTO_TEST_API)) {
                // Show success message to user
                window.albumApp.showLoading('Discogs API Connected ✅');
                setTimeout(() => {
                    window.albumApp.hideLoading();
                }, 2000);
            }
            
        } catch (error) {
            console.error('❌ Discogs API test failed:', error);
            
            // Show overlay for failures if manually triggered or auto-test is enabled
            if (manuallyTriggered || window.CONFIG.DEBUG.AUTO_TEST_API) {
                // Show error to user
                window.albumApp.showLoading('API Connection Failed ❌');
                setTimeout(() => {
                    window.albumApp.hideLoading();
                }, 3000);
            }
        }
    };
    
    // Optional: Auto-test API only if explicitly enabled in config
    if (window.CONFIG.DEBUG.AUTO_TEST_API) {
        setTimeout(() => {
            window.testDiscogsAPI();
        }, 1000);
    }
    
    // Test function to manually check shuffle button
    window.testShuffleButton = function() {
        console.log('=== SHUFFLE BUTTON TEST ===');
        const shuffleBtn = document.getElementById('shuffle-albums');
        const sortSelect = document.getElementById('albums-sort');
        
        console.log('Shuffle button element:', shuffleBtn);
        console.log('Sort select element:', sortSelect);
        console.log('Current sort value:', sortSelect.value);
        console.log('Has hidden class?', shuffleBtn.classList.contains('hidden'));
        console.log('Button computed display:', getComputedStyle(shuffleBtn).display);
        console.log('All button classes:', shuffleBtn.className);
        
        // Force show the button for testing
        shuffleBtn.classList.remove('hidden');
        console.log('After removing hidden class:');
        console.log('Button computed display:', getComputedStyle(shuffleBtn).display);
        console.log('All button classes:', shuffleBtn.className);
        
        // Test the sort function directly
        console.log('Testing sortAlbums("random"):');
        window.albumApp.sortAlbums('random');
        
        console.log('=== END TEST ===');
    };
    
    // Test function for album cards
    window.testAlbumCards = function() {
        console.log('=== ALBUM CARD TEST ===');
        console.log('Albums in collection:', window.albumApp.collection.albums.length);
        console.log('Album cards rendered:', document.querySelectorAll('.album-card').length);
        
        // Test clicking first album card
        const firstCard = document.querySelector('.album-card');
        if (firstCard) {
            console.log('Testing album card click...');
            firstCard.click();
        }
        
        console.log('=== END TEST ===');
    };
    
    // Test function for artist cards
    window.testArtistCards = function() {
        console.log('=== ARTIST CARD TEST ===');
        console.log('Artists in collection:', window.albumApp.collection.artists.length);
        console.log('Artist cards rendered:', document.querySelectorAll('.artist-card').length);
        
        // Switch to artists view if not already there
        if (window.albumApp.currentView !== 'artists') {
            console.log('Switching to artists view...');
            window.albumApp.switchView('artists');
        }
        
        // Test clicking first artist card
        setTimeout(() => {
            const firstCard = document.querySelector('.artist-card');
            if (firstCard) {
                console.log('Testing artist card click...');
                firstCard.click();
            }
            
            // Test view albums button
            const viewAlbumsBtn = document.querySelector('.view-albums-btn');
            if (viewAlbumsBtn) {
                console.log('Testing view albums button...');
                setTimeout(() => {
                    viewAlbumsBtn.click();
                }, 1000);
            }
        }, 500);
        
        console.log('=== END TEST ===');
    };
    
    console.log('🎧 App initialized. Available test functions:');
    console.log('   - window.testDiscogsAPI() - Test API connection');
    console.log('   - window.testShuffleButton() - Test shuffle functionality');
    console.log('   - window.testAlbumCards() - Test album card functionality');
    console.log('   - window.testArtistCards() - Test artist card functionality');
    console.log('   - window.debugPost1994() - DEBUG: Find missing post-1994 albums');
    console.log('   - window.debugCollection() - DEBUG: Check collection data');
    console.log('   - window.debugSupabaseLoad() - DEBUG: Test direct Supabase load');
    console.log('   - window.debugArtistRoles("Artist Name") - DEBUG: Artist role processing');
    console.log('   - window.debugArtistCredits("Artist Name") - DEBUG: Artist credits across albums');
    
    // ============================================
    // DEBUG FUNCTIONS FOR POST-1994 ALBUMS ISSUE  
    // ============================================
    
    window.debugPost1994 = async function() {
        console.log('🔍 DEBUGGING POST-1994 ALBUMS...');
        console.log('=====================================');
        
        // Step 1: Check collection
        const collection = window.albumApp.collection;
        console.log(`📊 Collection albums: ${collection.albums.length}`);
        
        const post1994 = collection.albums.filter(album => album.year > 1994);
        console.log(`🎯 Post-1994 albums in collection: ${post1994.length}`);
        
        if (post1994.length > 0) {
            console.log('📅 Sample post-1994 albums in collection:');
            post1994.slice(0, 10).forEach(album => {
                console.log(`   ${album.year}: ${album.title} by ${album.artist}`);
            });
            window.post1994Albums = post1994; // Store for inspection
            console.log('✅ Stored in window.post1994Albums for inspection');
        } else {
            console.log('❌ No post-1994 albums in app collection!');
            console.log('🔍 Checking all years in collection:');
            const years = collection.albums.map(a => a.year).filter(y => y).sort((a, b) => b - a);
            console.log(`   Latest years: ${years.slice(0, 10).join(', ')}`);
        }
        
        // Step 2: Check what's displayed in UI
        const albumCards = document.querySelectorAll('.album-card');
        console.log(`🎵 Album cards in DOM: ${albumCards.length}`);
        
        const displayedYears = [];
        albumCards.forEach(card => {
            const yearSpan = card.querySelector('.album-year');
            if (yearSpan) {
                const year = parseInt(yearSpan.textContent);
                if (year) displayedYears.push(year);
            }
        });
        
        const post1994Displayed = displayedYears.filter(year => year > 1994);
        console.log(`📅 Post-1994 years displayed in UI: ${post1994Displayed.length}`);
        console.log(`   UI Years: ${displayedYears.sort((a, b) => b - a).slice(0, 10).join(', ')}`);
        
        console.log('=====================================');
        return {
            collectionTotal: collection.albums.length,
            collectionPost1994: post1994.length,
            uiCardsTotal: albumCards.length,
            uiPost1994: post1994Displayed.length
        };
    };
    
    window.debugCollection = function() {
        console.log('🔍 DEBUGGING COLLECTION DATA...');
        console.log('================================');
        
        const collection = window.albumApp.collection;
        console.log('📊 Collection overview:');
        console.log(`   Albums: ${collection.albums.length}`);
        console.log(`   Artists: ${collection.artists.length}`);
        console.log(`   Tracks: ${collection.tracks.length}`);
        console.log(`   Roles: ${collection.roles.length}`);
        
        if (collection.albums.length > 0) {
            const years = collection.albums.map(a => a.year).filter(y => y).sort((a, b) => a - b);
            console.log(`📅 Year range: ${years[0]} - ${years[years.length - 1]}`);
            
            // Year distribution
            const yearCounts = {};
            collection.albums.forEach(album => {
                const year = album.year;
                if (year) {
                    yearCounts[year] = (yearCounts[year] || 0) + 1;
                }
            });
            
            const post1994Years = Object.entries(yearCounts)
                .filter(([year]) => parseInt(year) > 1994)
                .sort(([a], [b]) => parseInt(b) - parseInt(a));
                
            if (post1994Years.length > 0) {
                console.log('📅 Post-1994 year distribution:');
                post1994Years.slice(0, 10).forEach(([year, count]) => {
                    console.log(`   ${year}: ${count} albums`);
                });
            } else {
                console.log('❌ No post-1994 albums found in collection!');
            }
        }
        
        console.log('================================');
        return collection;
    };
    
    window.debugSupabaseLoad = async function() {
        console.log('🔍 DEBUGGING DIRECT SUPABASE LOAD...');
        console.log('====================================');
        
        try {
            const supabaseService = window.albumApp.supabaseService;
            if (!supabaseService) {
                console.log('❌ Supabase service not available');
                return;
            }
            
            console.log('📊 Loading albums directly from Supabase...');
            const albums = await supabaseService.getAlbums();
            console.log(`✅ Loaded ${albums.length} albums from database`);
            
            const post1994 = albums.filter(album => album.year > 1994);
            console.log(`🎯 Post-1994 albums in database: ${post1994.length}`);
            
            if (post1994.length > 0) {
                console.log('📅 Sample post-1994 albums from database:');
                post1994.slice(0, 10).forEach(album => {
                    console.log(`   ${album.year}: ${album.title} by ${album.artist}`);
                });
                window.supabasePost1994 = post1994; // Store for inspection
                console.log('✅ Stored in window.supabasePost1994 for inspection');
            }
            
            console.log('====================================');
            return {
                databaseTotal: albums.length,
                databasePost1994: post1994.length
            };
            
        } catch (error) {
            console.error('❌ Error loading from Supabase:', error);
            console.log('====================================');
        }
    };
    
    // Quick reload function to test the fix
    window.reloadData = async function() {
        console.log('🔄 RELOADING DATA FROM SUPABASE...');
        console.log('==================================');
        
        try {
            await window.albumApp.loadDataFromSupabase();
            console.log('✅ Data reloaded successfully!');
            console.log('🎯 Run window.debugPost1994() to check if fix worked');
        } catch (error) {
            console.error('❌ Error reloading data:', error);
        }
        
        console.log('==================================');
    };
    
    // Check exact truncation point
    window.checkTruncation = async function() {
        console.log('🔍 CHECKING ALBUM TRUNCATION...');
        console.log('==============================');
        
        try {
            // Get raw albums from Supabase
            const rawAlbums = await window.albumApp.supabaseService.getAlbums();
            console.log(`📊 Raw from Supabase: ${rawAlbums.length} albums`);
            
            // Check what's in collection
            const collectionAlbums = window.albumApp.collection.albums;
            console.log(`📊 In collection: ${collectionAlbums.length} albums`);
            
            if (rawAlbums.length !== collectionAlbums.length) {
                console.error(`🚨 TRUNCATION DETECTED!`);
                console.log(`   Lost: ${rawAlbums.length - collectionAlbums.length} albums`);
                
                // Find the cutoff point
                if (collectionAlbums.length > 0) {
                    const lastCollectionAlbum = collectionAlbums[collectionAlbums.length - 1];
                    const lastYear = lastCollectionAlbum.year;
                    console.log(`   Last album in collection: ${lastCollectionAlbum.title} (${lastYear})`);
                    
                    // Find missing albums
                    const missingAlbums = rawAlbums.slice(collectionAlbums.length, collectionAlbums.length + 10);
                    console.log(`   Next 10 missing albums:`);
                    missingAlbums.forEach(album => {
                        console.log(`     ${album.year}: ${album.title} by ${album.artist}`);
                    });
                }
            } else {
                console.log('✅ No truncation - albums match!');
            }
            
        } catch (error) {
            console.error('❌ Error checking truncation:', error);
        }
        
        console.log('==============================');
    };
    
    // Debug artist roles processing
    window.debugArtistRoles = (artistName) => {
        console.log(`🎭 DEBUGGING ARTIST ROLES: ${artistName}`);
        console.log('============================================');
        
        const artist = window.albumApp.collection.artists.find(a => a.name === artistName);
        if (!artist) {
            console.error(`❌ Artist not found: ${artistName}`);
            return;
        }
        
        console.log('🎤 Artist object:', artist);
        console.log('🎯 Artist roles:', artist.roles);
        
        // Check role categorization
        const { musicalRoles, technicalRoles } = window.roleCategorizer.separateArtistRoles(artist);
        console.log('🎵 Musical roles:', musicalRoles);
        console.log('🔧 Technical roles:', technicalRoles);
        
        // Check actual roles filtering (this will trigger our debug output)
        const actualMusical = window.albumApp.getActualRolesInCredits(artistName, musicalRoles);
        const actualTechnical = window.albumApp.getActualRolesInCredits(artistName, technicalRoles);
        
        console.log('✅ Final musical roles (after filtering):', actualMusical);
        console.log('✅ Final technical roles (after filtering):', actualTechnical);
        
        console.log('============================================');
    };
    
    // Debug artist credits across all albums
    window.debugArtistCredits = (artistName) => {
        console.log(`🔍 DEBUGGING ARTIST CREDITS: ${artistName}`);
        console.log('===========================================');
        
        const allCredits = [];
        const uniqueRoles = new Set();
        
        window.albumApp.collection.albums.forEach(album => {
            if (album.credits && Array.isArray(album.credits)) {
                album.credits.forEach(credit => {
                    if (credit.name === artistName) {
                        allCredits.push({
                            album: album.title,
                            year: album.year,
                            role: credit.role,
                            cleaned: window.albumApp.cleanRoleName(credit.role)
                        });
                        uniqueRoles.add(credit.role);
                    }
                });
            }
        });
        
        console.log(`📊 Found ${allCredits.length} credits across ${uniqueRoles.size} unique roles`);
        console.log('🎭 All unique roles:', [...uniqueRoles].sort());
        console.log('📋 All credits:');
        allCredits.forEach(credit => {
            console.log(`   ${credit.year}: ${credit.album} - ${credit.role} → ${credit.cleaned}`);
        });
        
        console.log('===========================================');
    };
    
    // Force regenerate artists with enhanced instrument extraction
    window.regenerateArtistsWithInstruments = () => {
        console.log('🔄 REGENERATING ARTISTS WITH ENHANCED INSTRUMENT EXTRACTION...');
        console.log('=============================================================');
        
        const oldArtistCount = window.albumApp.collection.artists.length;
        const oldFirstArtist = window.albumApp.collection.artists[0];
        const oldHerbieRoles = window.albumApp.collection.artists.find(a => a.name === 'Herbie Hancock')?.roles.length || 0;
        
        console.log(`📊 Before: ${oldArtistCount} artists`);
        console.log(`🎭 Herbie Hancock roles before: ${oldHerbieRoles}`);
        
        // Regenerate artists with new extraction logic
        window.albumApp.generateArtistsFromAlbums();
        
        const newArtistCount = window.albumApp.collection.artists.length;
        const newHerbieRoles = window.albumApp.collection.artists.find(a => a.name === 'Herbie Hancock')?.roles.length || 0;
        
        console.log(`📊 After: ${newArtistCount} artists`);
        console.log(`🎭 Herbie Hancock roles after: ${newHerbieRoles}`);
        console.log(`📈 Role increase: +${newHerbieRoles - oldHerbieRoles} roles`);
        
        // Show a sample of Herbie's new roles
        const herbie = window.albumApp.collection.artists.find(a => a.name === 'Herbie Hancock');
        if (herbie) {
            console.log(`🎹 Herbie's first 10 roles: ${herbie.roles.slice(0, 10).join(', ')}`);
            
            // Find specific instruments
            const instruments = herbie.roles.filter(role => 
                role.includes('DX') || 
                role.includes('Moog') || 
                role.includes('Rhodes') || 
                role.includes('Prophet') ||
                role.includes('Oberheim') ||
                role.includes('ARP')
            );
            console.log(`🎛️  Specific instruments found: ${instruments.join(', ')}`);
        }
        
        console.log('✅ Regeneration complete! Artist modals should now show specific instruments.');
        console.log('=============================================================');
    };
});
