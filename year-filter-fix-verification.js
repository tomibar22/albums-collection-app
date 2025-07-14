/**
 * Year Filter + Sort Fix Verification Test
 * 
 * This script verifies that the year filter persistence bug has been fixed.
 * 
 * Run this test to confirm:
 * 1. Year filter works correctly
 * 2. Sorting maintains the year filter
 * 3. UI reflects the correct state
 */

console.log('🧪 Year Filter + Sort Fix Verification Test');

function testYearFilterSortFix() {
    const app = window.albumApp || window.app;
    if (!app) {
        console.error('❌ App instance not found');
        return;
    }

    console.log('\n🎯 TESTING YEAR FILTER + SORT FIX');
    console.log('=====================================');

    // Test procedure
    console.log(`
📋 Test Procedure:
1. Apply a year filter (use the slider to set range like 1970-1990)
2. Run this test: testYearFilterSortFix()
3. The test will automatically try different sort options
4. Verify that the year filter remains active throughout

💡 Expected Result: Year filter should persist through all sorting operations
    `);

    // Check if year filter is enabled
    if (!app.yearFilter?.enabled) {
        console.log('⚠️  Year filter is not currently active.');
        console.log('📌 Please apply a year filter first using the year range slider.');
        console.log('💡 For example: Set range to 1970-1990, then run this test again.');
        return;
    }

    // Record initial filter state
    const initialState = {
        enabled: app.yearFilter.enabled,
        min: app.yearFilter.selectedMin,
        max: app.yearFilter.selectedMax,
        albumCount: app.collection.albums.length,
        originalCount: app.originalCollection.albums.length
    };

    console.log('\n📊 Initial State (Before Testing):');
    console.log(`- Year filter: ${initialState.min}-${initialState.max} (active: ${initialState.enabled})`);
    console.log(`- Albums showing: ${initialState.albumCount} (filtered from ${initialState.originalCount})`);

    // Test different sort operations
    const sortTests = [
        { type: 'year-asc', name: 'Year Ascending' },
        { type: 'year-desc', name: 'Year Descending' },
        { type: 'recently-added', name: 'Recently Added' },
        { type: 'random', name: 'Random' }
    ];

    let testIndex = 0;
    let passedTests = 0;

    function runNextTest() {
        if (testIndex >= sortTests.length) {
            // All tests completed
            console.log('\n🏁 TEST RESULTS:');
            console.log(`✅ Passed: ${passedTests}/${sortTests.length} tests`);
            if (passedTests === sortTests.length) {
                console.log('🎉 SUCCESS: Year filter persistence bug appears to be FIXED!');
            } else {
                console.log('❌ FAILURE: Some tests failed - bug may still exist');
            }
            return;
        }

        const test = sortTests[testIndex];
        console.log(`\n🔄 Test ${testIndex + 1}: ${test.name} (${test.type})`);

        // Apply the sort
        app.sortAlbums(test.type);

        // Check the result after a short delay
        setTimeout(() => {
            const afterSort = {
                enabled: app.yearFilter.enabled,
                min: app.yearFilter.selectedMin,
                max: app.yearFilter.selectedMax,
                albumCount: app.collection.albums.length
            };

            console.log(`  - Year filter enabled: ${afterSort.enabled}`);
            console.log(`  - Year range: ${afterSort.min}-${afterSort.max}`);
            console.log(`  - Albums showing: ${afterSort.albumCount}`);

            // Verify the filter state is maintained
            const filterMaintained = (
                afterSort.enabled === initialState.enabled &&
                afterSort.min === initialState.min &&
                afterSort.max === initialState.max &&
                afterSort.albumCount === initialState.albumCount
            );

            if (filterMaintained) {
                console.log(`  ✅ PASS: Year filter maintained during ${test.name} sort`);
                passedTests++;
            } else {
                console.log(`  ❌ FAIL: Year filter lost during ${test.name} sort`);
                console.log(`    Expected: ${initialState.albumCount} albums with filter ${initialState.min}-${initialState.max}`);
                console.log(`    Got: ${afterSort.albumCount} albums with filter ${afterSort.min}-${afterSort.max}`);
            }

            testIndex++;
            runNextTest();
        }, 1000);
    }

    // Start the test sequence
    runNextTest();
}

// Quick state check function
function checkCurrentFilterState() {
    const app = window.albumApp || window.app;
    if (!app) {
        console.error('❌ App instance not found');
        return;
    }

    console.log('\n📊 Current Year Filter State:');
    console.log(`- Enabled: ${app.yearFilter?.enabled || false}`);
    console.log(`- Range: ${app.yearFilter?.selectedMin || 'N/A'}-${app.yearFilter?.selectedMax || 'N/A'}`);
    console.log(`- Albums: ${app.collection?.albums?.length || 0} current / ${app.originalCollection?.albums?.length || 0} total`);
    console.log(`- UI Active: ${document.getElementById('year-filter-container')?.classList.contains('year-filter-active') || false}`);
}

// Make functions available globally
window.testYearFilterSortFix = testYearFilterSortFix;
window.checkCurrentFilterState = checkCurrentFilterState;

console.log(`
🧪 Verification functions available:
- testYearFilterSortFix() - Run comprehensive sort persistence test
- checkCurrentFilterState() - Check current filter state

💡 Quick Test Instructions:
1. Apply a year filter using the slider (e.g., 1970-1990)
2. Run: testYearFilterSortFix()
3. Watch the console for test results
`);
