/**
 * Year Filter + Sort Bug Analysis
 * 
 * This script helps identify where the year filter state is getting lost during sorting.
 * 
 * EXPECTED BEHAVIOR:
 * 1. Apply year filter (e.g., 1970-1990) → Shows filtered albums
 * 2. Sort albums (e.g., Title A-Z) → Shows filtered albums sorted by title
 * 3. Year filter should remain active and visible
 * 
 * CURRENT BUG:
 * After step 2, the year filter appears to be reset and all albums are shown
 */

console.log('🧪 Year Filter + Sort Bug Analysis Script Loaded');

// Test function to verify current state
function debugYearFilterState() {
    const app = window.albumApp || window.app;
    if (!app) {
        console.error('❌ App instance not found');
        return null;
    }

    const state = {
        yearFilter: {
            enabled: app.yearFilter?.enabled,
            selectedMin: app.yearFilter?.selectedMin,
            selectedMax: app.yearFilter?.selectedMax,
            minYear: app.yearFilter?.minYear,
            maxYear: app.yearFilter?.maxYear
        },
        collections: {
            current: app.collection?.albums?.length || 0,
            original: app.originalCollection?.albums?.length || 0
        },
        dom: {
            albumCards: document.querySelectorAll('.album-card').length,
            filterContainer: document.getElementById('year-filter-container')?.classList.contains('year-filter-active')
        }
    };

    console.log('📊 Current Year Filter State:', state);
    return state;
}

// Test the specific sorting bug
async function reproduceYearFilterSortBug() {
    const app = window.albumApp || window.app;
    if (!app) {
        console.error('❌ App instance not found');
        return;
    }

    console.log('🧪 REPRODUCING YEAR FILTER + SORT BUG');
    console.log('=========================================');

    // Step 1: Get initial state
    console.log('\n📊 Step 1: Initial State');
    const initialState = debugYearFilterState();

    if (!initialState.yearFilter.enabled) {
        console.log('⚠️ Year filter is not enabled. Please apply a year filter first.');
        console.log('💡 Use the year range slider to set a filter (e.g., 1970-1990) and then run this test again.');
        return;
    }

    // Step 2: Record current filtered state
    console.log('\n📊 Step 2: Before Sort State');
    const beforeSort = debugYearFilterState();
    console.log(`✅ Year filter active: ${beforeSort.yearFilter.selectedMin}-${beforeSort.yearFilter.selectedMax}`);
    console.log(`📊 Albums showing: ${beforeSort.collections.current} (filtered from ${beforeSort.collections.original})`);

    // Step 3: Apply a sort and check what happens
    console.log('\n🔄 Step 3: Applying Sort (Title A-Z)');
    app.sortAlbums('title-asc'); // This might not exist, let's use a valid sort type

    // Wait a moment for the sort to complete
    setTimeout(() => {
        console.log('\n📊 Step 4: After Sort State');
        const afterSort = debugYearFilterState();

        // Compare states
        console.log('\n🔍 COMPARISON:');
        console.log(`Year filter enabled: ${beforeSort.yearFilter.enabled} → ${afterSort.yearFilter.enabled}`);
        console.log(`Albums showing: ${beforeSort.collections.current} → ${afterSort.collections.current}`);
        console.log(`DOM album cards: ${beforeSort.dom.albumCards} → ${afterSort.dom.albumCards}`);

        // Detect the bug
        if (beforeSort.yearFilter.enabled && afterSort.yearFilter.enabled) {
            if (beforeSort.collections.current !== afterSort.collections.current) {
                console.error(`❌ BUG DETECTED: Album count changed from ${beforeSort.collections.current} to ${afterSort.collections.current}`);
                console.error('❌ Year filter state was lost during sorting!');
            } else {
                console.log('✅ Year filter maintained during sort - bug may be fixed!');
            }
        } else {
            console.error('❌ BUG DETECTED: Year filter was disabled during sorting!');
        }
    }, 500);
}

// Add debugging functions to global scope
window.debugYearFilterState = debugYearFilterState;
window.reproduceYearFilterSortBug = reproduceYearFilterSortBug;

console.log(`
🧪 Debug functions available:
- debugYearFilterState() - Check current filter state
- reproduceYearFilterSortBug() - Test the sorting bug

💡 Instructions:
1. Apply a year filter using the slider (e.g., 1970-1990)
2. Run reproduceYearFilterSortBug() to test if sorting breaks the filter
`);
