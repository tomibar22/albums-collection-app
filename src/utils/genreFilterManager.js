/**
 * Genre Filter Manager - Global genre filtering with consistent state management
 * 
 * This class manages the global genre filter state and ensures all data operations
 * use the filtered dataset consistently across the entire application.
 */
class GenreFilterManager {
    constructor() {
        this.originalAlbums = [];           // Full dataset (never modified)
        this.filteredAlbums = [];           // Active dataset (all operations use this)
        this.selectedGenres = new Set();   // Currently selected genres
        this.isActive = false;
        this.listeners = new Set();        // Components that need to be notified of changes
        this.debounceTimer = null;          // Debounce filter updates
        this.debounceDelay = 50;            // 50ms debounce delay
        
        // Statistics
        this.stats = {
            totalAlbums: 0,
            filteredAlbums: 0,
            availableGenres: new Map(),     // genre -> count
            selectedGenres: new Set()
        };
        
        console.log('🎨 GenreFilterManager initialized');
    }

    /**
     * Initialize the filter manager with the full album dataset
     * @param {Array} albums - Full album collection
     */
    initialize(albums) {
        if (!Array.isArray(albums)) {
            console.error('❌ GenreFilterManager.initialize: albums must be an array');
            return;
        }

        this.originalAlbums = [...albums]; // Deep copy to prevent modification
        this.filteredAlbums = [...albums]; // Start with full dataset
        this.isActive = false;
        this.selectedGenres.clear();
        
        // Calculate genre frequencies from all albums
        this.calculateGenreFrequencies(albums);
        
        this.stats.totalAlbums = albums.length;
        this.stats.filteredAlbums = albums.length;
        
        console.log(`🎨 GenreFilterManager initialized with ${albums.length} albums (${this.stats.availableGenres.size} unique genres)`);
    }

    /**
     * Calculate genre frequencies from album dataset
     * @param {Array} albums - Albums to analyze
     */
    calculateGenreFrequencies(albums) {
        const genreCount = new Map();
        
        albums.forEach(album => {
            // Combine genres and styles into a single array
            const allGenres = [];
            if (album.genres && Array.isArray(album.genres)) {
                allGenres.push(...album.genres);
            }
            if (album.styles && Array.isArray(album.styles)) {
                allGenres.push(...album.styles);
            }
            
            // Remove duplicates and count occurrences
            const uniqueGenres = [...new Set(allGenres)];
            uniqueGenres.forEach(genre => {
                if (genre && genre.trim()) {
                    genreCount.set(genre, (genreCount.get(genre) || 0) + 1);
                }
            });
        });
        
        this.stats.availableGenres = genreCount;
    }

    /**
     * Get genres sorted by frequency (most frequent first)
     * @param {Array} albums - Albums to analyze (defaults to filteredAlbums)
     * @returns {Array} - Array of {genre, count} objects
     */
    getGenresByFrequency(albums = this.filteredAlbums) {
        const genreCount = new Map();
        
        albums.forEach(album => {
            // Combine genres and styles into a single array
            const allGenres = [];
            if (album.genres && Array.isArray(album.genres)) {
                allGenres.push(...album.genres);
            }
            if (album.styles && Array.isArray(album.styles)) {
                allGenres.push(...album.styles);
            }
            
            // Remove duplicates and count occurrences
            const uniqueGenres = [...new Set(allGenres)];
            uniqueGenres.forEach(genre => {
                if (genre && genre.trim()) {
                    genreCount.set(genre, (genreCount.get(genre) || 0) + 1);
                }
            });
        });
        
        // Convert to array and sort by frequency (descending)
        return Array.from(genreCount.entries())
            .map(([genre, count]) => ({ genre, count }))
            .sort((a, b) => b.count - a.count);
    }

    /**
     * Add a genre to the filter
     * @param {string} genre - Genre to add
     */
    addGenre(genre) {
        if (!genre || typeof genre !== 'string') {
            console.error('❌ GenreFilterManager.addGenre: genre must be a non-empty string');
            return;
        }
        
        if (this.selectedGenres.has(genre)) {
            console.log(`🎨 GenreFilterManager: Genre "${genre}" already selected`);
            return;
        }
        
        this.selectedGenres.add(genre);
        this.stats.selectedGenres.add(genre);
        
        console.log(`🎨 GenreFilterManager: Added genre "${genre}" (${this.selectedGenres.size} total)`);
        
        // Debounce the filter application
        this.debouncedApplyFilter();
    }

    /**
     * Remove a genre from the filter
     * @param {string} genre - Genre to remove
     */
    removeGenre(genre) {
        if (!genre || typeof genre !== 'string') {
            console.error('❌ GenreFilterManager.removeGenre: genre must be a non-empty string');
            return;
        }
        
        if (!this.selectedGenres.has(genre)) {
            console.log(`🎨 GenreFilterManager: Genre "${genre}" not selected`);
            return;
        }
        
        this.selectedGenres.delete(genre);
        this.stats.selectedGenres.delete(genre);
        
        console.log(`🎨 GenreFilterManager: Removed genre "${genre}" (${this.selectedGenres.size} total)`);
        
        // Debounce the filter application
        this.debouncedApplyFilter();
    }

    /**
     * Toggle a genre in the filter
     * @param {string} genre - Genre to toggle
     */
    toggleGenre(genre) {
        if (this.selectedGenres.has(genre)) {
            this.removeGenre(genre);
        } else {
            this.addGenre(genre);
        }
    }

    /**
     * Set multiple genres at once
     * @param {Array} genres - Array of genres to set
     */
    setGenres(genres) {
        if (!Array.isArray(genres)) {
            console.error('❌ GenreFilterManager.setGenres: genres must be an array');
            return;
        }
        
        this.selectedGenres.clear();
        this.stats.selectedGenres.clear();
        
        genres.forEach(genre => {
            if (genre && typeof genre === 'string') {
                this.selectedGenres.add(genre);
                this.stats.selectedGenres.add(genre);
            }
        });
        
        console.log(`🎨 GenreFilterManager: Set ${this.selectedGenres.size} genres`);
        
        // Debounce the filter application
        this.debouncedApplyFilter();
    }

    /**
     * Debounced filter application
     */
    debouncedApplyFilter() {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        
        this.debounceTimer = setTimeout(() => {
            this.applyFilter();
        }, this.debounceDelay);
    }

    /**
     * Apply the current genre filter to the dataset
     */
    applyFilter() {
        const startTime = performance.now();
        
        if (this.selectedGenres.size === 0) {
            // No genres selected, use full dataset
            this.filteredAlbums = this.originalAlbums;
            this.isActive = false;
        } else {
            // Apply genre filter
            const selectedGenresArray = Array.from(this.selectedGenres);
            
            const filtered = this.originalAlbums.filter(album => {
                // Combine genres and styles into a single array
                const allGenres = [];
                if (album.genres && Array.isArray(album.genres)) {
                    allGenres.push(...album.genres);
                }
                if (album.styles && Array.isArray(album.styles)) {
                    allGenres.push(...album.styles);
                }
                
                // Check if the album contains ALL selected genres (AND filter)
                return selectedGenresArray.every(selectedGenre => 
                    allGenres.includes(selectedGenre)
                );
            });
            
            this.filteredAlbums = filtered;
            this.isActive = true;
        }
        
        // Update statistics
        this.stats.filteredAlbums = this.filteredAlbums.length;
        
        const endTime = performance.now();
        if (endTime - startTime > 10) {
            console.log(`🎨 GenreFilterManager: Filter applied in ${(endTime - startTime).toFixed(2)}ms, ${this.filteredAlbums.length}/${this.originalAlbums.length} albums`);
        }
        
        // Notify all listeners
        this.notifyListeners();
    }

    /**
     * Clear the genre filter and return to full dataset
     */
    clearFilter() {
        console.log('🎨 GenreFilterManager: Clearing filter');
        this.selectedGenres.clear();
        this.stats.selectedGenres.clear();
        this.isActive = false;
        this.filteredAlbums = [...this.originalAlbums];
        this.stats.filteredAlbums = this.originalAlbums.length;
        
        // Clear debounce timer
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
        
        this.notifyListeners();
    }

    /**
     * Get the active (filtered) album dataset
     * @returns {Array} - Filtered albums array
     */
    getActiveAlbums() {
        return this.filteredAlbums;
    }

    /**
     * Get the original (unfiltered) album dataset
     * @returns {Array} - Original albums array
     */
    getOriginalAlbums() {
        return this.originalAlbums;
    }

    /**
     * Check if filter is currently active
     * @returns {boolean} - True if filter is active
     */
    isFilterActive() {
        return this.isActive;
    }

    /**
     * Get currently selected genres
     * @returns {Set} - Set of selected genres
     */
    getSelectedGenres() {
        return new Set(this.selectedGenres);
    }

    /**
     * Check if a genre is selected
     * @param {string} genre - Genre to check
     * @returns {boolean} - True if genre is selected
     */
    isGenreSelected(genre) {
        return this.selectedGenres.has(genre);
    }

    /**
     * Get current filter statistics
     * @returns {Object} - Statistics object
     */
    getStats() {
        return {
            totalAlbums: this.stats.totalAlbums,
            filteredAlbums: this.stats.filteredAlbums,
            availableGenres: new Map(this.stats.availableGenres),
            selectedGenres: new Set(this.stats.selectedGenres)
        };
    }

    /**
     * Add a listener for filter changes
     * @param {Function} listener - Callback function to be called when filter changes
     */
    addListener(listener) {
        if (typeof listener !== 'function') {
            console.error('❌ GenreFilterManager.addListener: listener must be a function');
            return;
        }
        
        this.listeners.add(listener);
        console.log(`🎨 GenreFilterManager: Listener added (${this.listeners.size} total)`);
    }

    /**
     * Remove a listener for filter changes
     * @param {Function} listener - Callback function to remove
     */
    removeListener(listener) {
        this.listeners.delete(listener);
        console.log(`🎨 GenreFilterManager: Listener removed (${this.listeners.size} total)`);
    }

    /**
     * Notify all listeners that the filter has changed
     */
    notifyListeners() {
        const filterData = {
            isActive: this.isActive,
            selectedGenres: this.getSelectedGenres(),
            stats: this.getStats(),
            filteredAlbums: this.filteredAlbums,
            genresByFrequency: this.getGenresByFrequency()
        };

        console.log(`🎨 GenreFilterManager: Notifying ${this.listeners.size} listeners of filter change`);
        
        this.listeners.forEach(listener => {
            try {
                listener(filterData);
            } catch (error) {
                console.error('❌ GenreFilterManager: Error in listener callback:', error);
            }
        });
    }

    /**
     * Get filter summary for UI display
     * @returns {string} - Human-readable filter summary
     */
    getFilterSummary() {
        if (!this.isActive) {
            return `All Genres`;
        }

        const selectedCount = this.selectedGenres.size;
        const percentage = Math.round((this.stats.filteredAlbums / this.stats.totalAlbums) * 100);
        
        if (selectedCount === 1) {
            return `${Array.from(this.selectedGenres)[0]} (${this.stats.filteredAlbums} albums)`;
        } else {
            return `${selectedCount} genres (${this.stats.filteredAlbums} albums, ${percentage}%)`;
        }
    }

    /**
     * Update the filter based on externally filtered albums (e.g., from year filter)
     * This recalculates available genres based on the provided dataset
     * @param {Array} albums - Externally filtered albums
     */
    updateFromExternalFilter(albums) {
        if (!Array.isArray(albums)) {
            console.error('❌ GenreFilterManager.updateFromExternalFilter: albums must be an array');
            return;
        }

        // Store the externally filtered albums as our base dataset
        this.originalAlbums = [...albums];
        
        // If we have selected genres, re-apply the filter to the new dataset
        if (this.selectedGenres.size > 0) {
            this.applyFilter();
        } else {
            // No genre filter active, use the external dataset as-is
            this.filteredAlbums = [...albums];
            this.stats.filteredAlbums = albums.length;
        }
        
        this.stats.totalAlbums = albums.length;
        
        // Recalculate available genres based on the new dataset
        this.calculateGenreFrequencies(albums);
        
        console.log(`🎨 GenreFilterManager: Updated from external filter with ${albums.length} albums`);
        
        // Notify listeners of the change
        this.notifyListeners();
    }
}

// Export for use in the application
window.GenreFilterManager = GenreFilterManager;
console.log('✅ GenreFilterManager class loaded');