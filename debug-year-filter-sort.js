/**
 * Debug script to test year filter + sorting interaction
 * Run this in browser console after applying a year filter
 */

function testYearFilterSortBug() {
    const app = window.albumApp || window.app;
    if (!app) {
        console.error('❌ App instance not found');
        return;
    }

    console.log('🧪 TESTING YEAR FILTER + SORT BUG');
    console.log('=====================================');

    // Check initial state
    console.log('📊 Initial State:');
    console.log('- Year filter enabled:', app.yearFilter?.enabled);
    console.log('- Selected range:', app.yearFilter?.selectedMin, '-', app.yearFilter?.selectedMax);
    console.log('- Collection albums count:', app.collection?.albums?.length);
    console.log('- Original collection count:', app.originalCollection?.albums?.length);

    // Test different sort types
    const sortTypes = ['year-asc', 'year-desc', 'recently-added'];
    
    sortTypes.forEach((sortType, index) => {
        setTimeout(() => {
            console.log(`\n🔄 Testing sort type: ${sortType}`);
            console.log('Before sort:');
            console.log('- Year filter enabled:', app.yearFilter?.enabled);
            console.log('- Collection count:', app.collection?.albums?.length);
            
            // Apply sort
            app.sortAlbums(sortType);
            
            console.log('After sort:');
            console.log('- Year filter enabled:', app.yearFilter?.enabled);
            console.log('- Collection count:', app.collection?.albums?.length);
            console.log('- Albums displayed:', document.querySelectorAll('.album-card').length);
            
            // Check if filter state is maintained
            if (app.yearFilter?.enabled && app.collection?.albums?.length === app.originalCollection?.albums?.length) {
                console.error(`❌ BUG DETECTED: Year filter lost during ${sortType} sort!`);
            } else {
                console.log(`✅ Year filter maintained during ${sortType} sort`);
            }
        }, index * 1000);
    });
}

// Export for manual testing
window.testYearFilterSortBug = testYearFilterSortBug;

console.log('🧪 Debug script loaded. Run testYearFilterSortBug() after applying a year filter');
