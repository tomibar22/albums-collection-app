/**
 * Year Filter Sort Bug Fix
 * 
 * This patch ensures that year filter state is properly maintained during sorting operations.
 * 
 * The issue appears to be that while the sorting logic correctly handles filtered albums,
 * something in the sorting process is causing the year filter state to be lost or reset.
 */

// Enhanced sortAlbums method with year filter state preservation
function enhancedSortAlbums(sortType) {
    console.log(`🔄 Enhanced sortAlbums called with: ${sortType}`);
    
    // Store current year filter state before sorting
    const yearFilterSnapshot = {
        enabled: this.yearFilter?.enabled || false,
        selectedMin: this.yearFilter?.selectedMin,
        selectedMax: this.yearFilter?.selectedMax,
        minYear: this.yearFilter?.minYear,
        maxYear: this.yearFilter?.maxYear
    };
    
    console.log('📸 Year filter snapshot before sort:', yearFilterSnapshot);
    
    // 🛡️ DEFENSIVE: Ensure yearFilter is initialized
    this.ensureYearFilterInitialized();

    // 🔍 DEBUG: Year Filter State During Sort
    console.log('🔍 SORT DEBUG (Enhanced):', {
        yearFilterEnabled: this.yearFilter.enabled,
        selectedMin: this.yearFilter.selectedMin,
        selectedMax: this.yearFilter.selectedMax,
        collectionSize: this.collection.albums?.length,
        originalCollectionSize: this.originalCollection?.albums?.length,
        yearFilterObject: this.yearFilter
    });

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

    // FIX: Get the correct data source (filtered or full) - ENHANCED
    let sourceAlbums;
    if (yearFilterSnapshot.enabled) {
        // Use filtered albums from original collection - ALWAYS respect the snapshot
        sourceAlbums = this.filterAlbumsByYearRange(
            this.originalCollection.albums,
            yearFilterSnapshot.selectedMin, 
            yearFilterSnapshot.selectedMax
        );
        console.log(`🎯 Sorting with year filter: ${yearFilterSnapshot.selectedMin}-${yearFilterSnapshot.selectedMax} (${sourceAlbums.length} albums)`);
    } else {
        // Use full collection
        sourceAlbums = this.collection.albums;
    }

    if (currentSearchQuery && currentSearchQuery.trim()) {
        // There's an active search - get filtered results and sort them
        console.log(`🔍 Sorting with active search filter: "${currentSearchQuery}"`);
        albumsToDisplay = sourceAlbums.filter(album => {
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
        // No active search - sort the appropriate collection (filtered or full)
        albumsToDisplay = [...sourceAlbums]; // Create a copy to sort
    }

    // Sort the data to display (sorting logic remains the same)
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
                if (yearA === Infinity && yearB === Infinity) return 0;
                if (yearA === Infinity) return 1;
                if (yearB === Infinity) return -1;
                return yearB - yearA;
            });
            break;
        case 'recently-added':
            albumsToDisplay.sort((a, b) => {
                const dateA = new Date(a.created_at || 0);
                const dateB = new Date(b.created_at || 0);
                return dateB.getTime() - dateA.getTime();
            });
            break;
        case 'random':
            this.shuffleArray(albumsToDisplay);
            break;
        default:
            console.log(`Unknown sort type: ${sortType}`);
            break;
    }

    // ENHANCED FIX: Update collection.albums with sorted filtered results AND restore year filter state
    this.collection.albums = albumsToDisplay;
    
    // CRITICAL: Restore year filter state if it was active before sorting
    if (yearFilterSnapshot.enabled) {
        console.log('🔧 Restoring year filter state after sort...');
        this.yearFilter.enabled = true;
        this.yearFilter.selectedMin = yearFilterSnapshot.selectedMin;
        this.yearFilter.selectedMax = yearFilterSnapshot.selectedMax;
        this.yearFilter.minYear = yearFilterSnapshot.minYear;
        this.yearFilter.maxYear = yearFilterSnapshot.maxYear;
        
        // Ensure year filter UI remains active
        const container = document.getElementById('year-filter-container');
        if (container) {
            container.classList.add('year-filter-active');
        }
        
        console.log('✅ Year filter state restored:', this.yearFilter);
    }
    
    // Render the sorted (and possibly filtered) albums
    console.log('🔄 Using clean render for consistent lazy loading behavior');
    this.renderAlbumsGrid(albumsToDisplay);
    
    // Update page counts to reflect filtered results
    this.updatePageTitleCounts();

    console.log(`✅ Enhanced sort complete: ${albumsToDisplay.length} albums displayed, filter active: ${this.yearFilter.enabled}`);
}

console.log('🔧 Year Filter Sort Bug Fix loaded. This patch preserves year filter state during sorting operations.');
console.log('💡 To apply this fix, integrate the enhanced logic into the main sortAlbums method.');
