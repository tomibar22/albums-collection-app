// 🔍 Debugging Script for Card Duplication Issue
// This script adds comprehensive logging to track DOM element lifecycle

console.log('🚀 Debugging script loaded for duplication investigation');

// Enhanced debug function to track DOM state
window.debugDOMState = function(prefix = '') {
    const albumsGrid = document.getElementById('albums-grid');
    const artistsMusical = document.getElementById('musical-artists-grid');
    const artistsTechnical = document.getElementById('technical-artists-grid');
    
    console.log(`${prefix} DOM STATE:`);
    console.log(`  Albums Grid: ${albumsGrid?.children.length || 0} children`);
    console.log(`  Musical Artists: ${artistsMusical?.children.length || 0} children`);
    console.log(`  Technical Artists: ${artistsTechnical?.children.length || 0} children`);
    
    // Check for duplicate elements
    if (albumsGrid) {
        const albumCards = albumsGrid.querySelectorAll('.album-card');
        const albumIds = Array.from(albumCards).map(card => card.dataset.albumId).filter(id => id);
        const uniqueIds = new Set(albumIds);
        
        if (albumIds.length !== uniqueIds.size) {
            console.error(`❌ DUPLICATE ALBUMS DETECTED: ${albumIds.length} cards but only ${uniqueIds.size} unique IDs`);
            
            // Find and log duplicates
            const duplicates = albumIds.filter((id, index) => albumIds.indexOf(id) !== index);
            console.error(`🔍 Duplicate IDs:`, [...new Set(duplicates)]);
        } else {
            console.log(`✅ No duplicate albums detected`);
        }
    }
};

// Enhanced sorting wrapper that tracks state
window.debugSortAlbums = function(sortType) {
    console.log(`🎯 Starting debug sort: ${sortType}`);
    
    // Track state before sort
    window.debugDOMState('🔍 BEFORE SORT');
    
    // Call the original sort function
    window.albumApp.sortAlbums(sortType);
    
    // Track state after sort (with delay for lazy loading)
    setTimeout(() => {
        window.debugDOMState('🔍 AFTER SORT');
    }, 500);
};

// Monitor lazy loading manager calls
if (window.LazyLoadingManager) {
    const originalResetGrid = window.LazyLoadingManager.prototype.resetGrid;
    const originalInitializeGrid = window.LazyLoadingManager.prototype.initializeLazyGrid;
    const originalLoadNextBatch = window.LazyLoadingManager.prototype.loadNextBatch;
    
    // Wrap resetGrid with debugging
    window.LazyLoadingManager.prototype.resetGrid = function(gridId) {
        console.log(`🔄 resetGrid called for: ${gridId}`);
        const gridElement = document.getElementById(gridId);
        const beforeCount = gridElement?.children.length || 0;
        console.log(`   DOM children before reset: ${beforeCount}`);
        
        const result = originalResetGrid.call(this, gridId);
        
        const afterCount = gridElement?.children.length || 0;
        console.log(`   DOM children after reset: ${afterCount}`);
        
        if (afterCount > 0) {
            console.error(`❌ WARNING: Grid not fully cleared! Still has ${afterCount} children`);
        }
        
        return result;
    };
    
    // Wrap initializeLazyGrid with debugging
    window.LazyLoadingManager.prototype.initializeLazyGrid = function(gridId, items, renderItem, options = {}) {
        console.log(`🚀 initializeLazyGrid called for: ${gridId} with ${items.length} items`);
        const gridElement = document.getElementById(gridId);
        const beforeCount = gridElement?.children.length || 0;
        console.log(`   DOM children before init: ${beforeCount}`);
        
        if (beforeCount > 0) {
            console.error(`❌ WARNING: Initializing grid that isn't empty! Has ${beforeCount} existing children`);
        }
        
        const result = originalInitializeGrid.call(this, gridId, items, renderItem, options);
        
        setTimeout(() => {
            const afterCount = gridElement?.children.length || 0;
            console.log(`   DOM children after init batch 1: ${afterCount}`);
            
            if (afterCount !== Math.min(items.length, options.itemsPerPage || 20)) {
                console.error(`❌ WARNING: Unexpected child count! Expected ${Math.min(items.length, options.itemsPerPage || 20)}, got ${afterCount}`);
            }
        }, 100);
        
        return result;
    };
    
    // Wrap loadNextBatch with debugging
    window.LazyLoadingManager.prototype.loadNextBatch = function(gridId) {
        const gridElement = document.getElementById(gridId);
        const beforeCount = gridElement?.children.length || 0;
        console.log(`📦 loadNextBatch called for: ${gridId}, current children: ${beforeCount}`);
        
        const result = originalLoadNextBatch.call(this, gridId);
        
        setTimeout(() => {
            const afterCount = gridElement?.children.length || 0;
            const added = afterCount - beforeCount;
            console.log(`   Added ${added} children (${beforeCount} → ${afterCount})`);
        }, 100);
        
        return result;
    };
    
    console.log('✅ Lazy loading manager methods wrapped with debugging');
}

// Quick test functions
window.testDuplication = function() {
    console.log('🧪 Starting duplication test...');
    
    // Test sequence that should trigger duplication on desktop
    console.log('1️⃣ Testing year-asc sort...');
    window.debugSortAlbums('year-asc');
    
    setTimeout(() => {
        console.log('2️⃣ Testing title-asc sort...');
        window.debugSortAlbums('title-asc');
        
        setTimeout(() => {
            console.log('3️⃣ Testing random sort (should work)...');
            window.debugSortAlbums('random');
            
            setTimeout(() => {
                console.log('🧪 Test sequence complete!');
            }, 1000);
        }, 1000);
    }, 1000);
};

console.log('🎯 Debug functions ready:');
console.log('  - window.debugDOMState() - Check current DOM state');
console.log('  - window.debugSortAlbums(sortType) - Sort with debugging');
console.log('  - window.testDuplication() - Run full duplication test');
console.log('');
console.log('💡 To test: Open browser, run window.testDuplication() and watch console');
