/**
 * Year Filter Manager - Global year range filtering with consistent state management
 * 
 * This class manages the global year filter state and ensures all data operations
 * use the filtered dataset consistently across the entire application.
 */
class YearFilterManager {
    constructor() {
        this.originalAlbums = [];           // Full dataset (never modified)
        this.filteredAlbums = [];           // Active dataset (all operations use this)
        this.yearRange = { start: null, end: null };
        this.isActive = false;
        this.listeners = new Set();        // Components that need to be notified of changes
        this.debounceTimer = null;          // Debounce filter updates
        this.debounceDelay = 300;           // 300ms debounce delay
        
        // Statistics
        this.stats = {
            totalAlbums: 0,
            filteredAlbums: 0,
            yearRange: { min: null, max: null },
            filterRange: { start: null, end: null }
        };
        
        console.log('🎯 YearFilterManager initialized');
    }

    /**
     * Initialize the filter manager with the full album dataset
     * @param {Array} albums - Full album collection
     */
    initialize(albums) {
        if (!Array.isArray(albums)) {
            console.error('❌ YearFilterManager.initialize: albums must be an array');
            return;
        }

        this.originalAlbums = [...albums]; // Deep copy to prevent modification
        this.filteredAlbums = [...albums]; // Start with full dataset
        this.isActive = false;
        
        // Calculate year range from all albums
        const years = albums
            .map(album => album.year)
            .filter(year => year && year > 0)
            .sort((a, b) => a - b);
        
        if (years.length > 0) {
            this.stats.yearRange.min = years[0];
            this.stats.yearRange.max = years[years.length - 1];
        }
        
        this.stats.totalAlbums = albums.length;
        this.stats.filteredAlbums = albums.length;
        
        console.log(`🎯 YearFilterManager initialized with ${albums.length} albums (${this.stats.yearRange.min}-${this.stats.yearRange.max})`);
    }

    /**
     * Set the year range filter
     * @param {number} startYear - Start year (inclusive)
     * @param {number} endYear - End year (inclusive)
     */
    setYearRange(startYear, endYear) {
        // Validate inputs
        if (typeof startYear !== 'number' || typeof endYear !== 'number') {
            console.error('❌ YearFilterManager.setYearRange: start and end must be numbers');
            return;
        }

        if (startYear > endYear) {
            console.error('❌ YearFilterManager.setYearRange: start year cannot be greater than end year');
            return;
        }

        // Check if filter is actually changing
        const isSameFilter = this.yearRange.start === startYear && this.yearRange.end === endYear;
        if (isSameFilter) {
            console.log('🎯 YearFilterManager: Filter unchanged, skipping update');
            return;
        }

        this.yearRange.start = startYear;
        this.yearRange.end = endYear;
        
        // Debounce the filter application
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        
        this.debounceTimer = setTimeout(() => {
            this.applyFilter();
        }, this.debounceDelay);
        
        console.log(`🎯 YearFilterManager: Year range set to ${startYear}-${endYear} (debounced)`);
    }

    /**
     * Apply the current year filter to the dataset
     */
    applyFilter() {
        if (!this.yearRange.start || !this.yearRange.end) {
            // No filter set, use full dataset
            this.filteredAlbums = [...this.originalAlbums];
            this.isActive = false;
            console.log('🎯 YearFilterManager: No filter applied, using full dataset');
        } else {
            // Apply year range filter
            this.filteredAlbums = this.originalAlbums.filter(album => {
                const year = album.year;
                return year && year >= this.yearRange.start && year <= this.yearRange.end;
            });
            this.isActive = true;
            console.log(`🎯 YearFilterManager: Applied filter ${this.yearRange.start}-${this.yearRange.end}, ${this.filteredAlbums.length}/${this.originalAlbums.length} albums`);
        }
        
        // Update statistics
        this.stats.filteredAlbums = this.filteredAlbums.length;
        this.stats.filterRange.start = this.yearRange.start;
        this.stats.filterRange.end = this.yearRange.end;
        
        // Notify all listeners
        this.notifyListeners();
    }

    /**
     * Clear the year filter and return to full dataset
     */
    clearFilter() {
        console.log('🎯 YearFilterManager: Clearing filter');
        this.yearRange.start = null;
        this.yearRange.end = null;
        this.isActive = false;
        this.filteredAlbums = [...this.originalAlbums];
        this.stats.filteredAlbums = this.originalAlbums.length;
        this.stats.filterRange.start = null;
        this.stats.filterRange.end = null;
        
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
     * Get current filter statistics
     * @returns {Object} - Statistics object
     */
    getStats() {
        return { ...this.stats };
    }

    /**
     * Get current year range
     * @returns {Object} - Year range object
     */
    getYearRange() {
        return { ...this.yearRange };
    }

    /**
     * Get available year range from all albums
     * @returns {Object} - Available year range
     */
    getAvailableYearRange() {
        return { ...this.stats.yearRange };
    }

    /**
     * Add a listener for filter changes
     * @param {Function} listener - Callback function to be called when filter changes
     */
    addListener(listener) {
        if (typeof listener !== 'function') {
            console.error('❌ YearFilterManager.addListener: listener must be a function');
            return;
        }
        
        this.listeners.add(listener);
        console.log(`🎯 YearFilterManager: Listener added (${this.listeners.size} total)`);
    }

    /**
     * Remove a listener for filter changes
     * @param {Function} listener - Callback function to remove
     */
    removeListener(listener) {
        this.listeners.delete(listener);
        console.log(`🎯 YearFilterManager: Listener removed (${this.listeners.size} total)`);
    }

    /**
     * Notify all listeners that the filter has changed
     */
    notifyListeners() {
        const filterData = {
            isActive: this.isActive,
            yearRange: this.getYearRange(),
            stats: this.getStats(),
            filteredAlbums: this.filteredAlbums
        };

        console.log(`🎯 YearFilterManager: Notifying ${this.listeners.size} listeners of filter change`);
        
        this.listeners.forEach(listener => {
            try {
                listener(filterData);
            } catch (error) {
                console.error('❌ YearFilterManager: Error in listener callback:', error);
            }
        });
    }

    /**
     * Set a preset year range (e.g., "1970s", "1980s", etc.)
     * @param {string} preset - Preset name
     */
    setPreset(preset) {
        const presets = {
            '1960s': { start: 1960, end: 1969 },
            '1970s': { start: 1970, end: 1979 },
            '1980s': { start: 1980, end: 1989 },
            '1990s': { start: 1990, end: 1999 },
            '2000s': { start: 2000, end: 2009 },
            '2010s': { start: 2010, end: 2019 },
            '2020s': { start: 2020, end: 2029 },
            'modern': { start: 2000, end: new Date().getFullYear() },
            'classic': { start: 1950, end: 1989 },
            'all': { start: null, end: null }
        };

        if (preset === 'all') {
            this.clearFilter();
            return;
        }

        if (presets[preset]) {
            this.setYearRange(presets[preset].start, presets[preset].end);
            console.log(`🎯 YearFilterManager: Applied preset "${preset}" (${presets[preset].start}-${presets[preset].end})`);
        } else {
            console.error(`❌ YearFilterManager.setPreset: Unknown preset "${preset}"`);
        }
    }

    /**
     * Get filter summary for UI display
     * @returns {string} - Human-readable filter summary
     */
    getFilterSummary() {
        if (!this.isActive) {
            return `All ${this.stats.totalAlbums} albums`;
        }

        const percentage = Math.round((this.stats.filteredAlbums / this.stats.totalAlbums) * 100);
        return `${this.stats.filteredAlbums} of ${this.stats.totalAlbums} albums (${percentage}%) • ${this.yearRange.start}-${this.yearRange.end}`;
    }

    /**
     * Validate that the active albums array is properly maintained
     * @returns {boolean} - True if validation passes
     */
    validateState() {
        const issues = [];

        // Check if arrays exist
        if (!Array.isArray(this.originalAlbums)) {
            issues.push('originalAlbums is not an array');
        }
        if (!Array.isArray(this.filteredAlbums)) {
            issues.push('filteredAlbums is not an array');
        }

        // Check consistency
        if (this.filteredAlbums.length > this.originalAlbums.length) {
            issues.push('filteredAlbums has more items than originalAlbums');
        }

        // Check filter logic
        if (this.isActive && this.filteredAlbums.length === this.originalAlbums.length) {
            issues.push('Filter is marked as active but no albums are filtered out');
        }

        if (issues.length > 0) {
            console.error('❌ YearFilterManager validation failed:', issues);
            return false;
        }

        return true;
    }
}

// Export for use in the application
window.YearFilterManager = YearFilterManager;
console.log('✅ YearFilterManager class loaded');