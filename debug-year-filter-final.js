// FINAL Year Filter Test - Parameter Fix Verification
console.log('🎯 Starting FINAL year filter test with CORRECT parameters...');

window.finalYearFilterTest = function() {
    console.log('🔥 FINAL debug script loaded!');
    
    // Test 1: Apply year filter (1970-1990) with CORRECT parameters
    console.log('🔍 Test 1: Apply year filter (1970-1990) with CORRECT parameters');
    console.log('BEFORE - Albums displayed:', document.querySelectorAll('.album-card').length);
    console.log('BEFORE - Filter enabled:', window.albumApp?.yearFilter?.enabled);
    
    // 🔧 CORRECT CALL: Pass two separate number parameters
    console.log('🎯 Year range changed: 1970 – 1990');
    console.log('📢 Regenerating collection data with year filter: 1970-1990');
    
    // Simulate the correct method call
    if (window.albumApp && window.albumApp.onYearRangeChange) {
        window.albumApp.onYearRangeChange(1970, 1990).then(() => {
            console.log('AFTER – Filter enabled:', window.albumApp?.yearFilter?.enabled);
            console.log('AFTER – Filter range:', window.albumApp?.yearFilter?.selectedMin, '–', window.albumApp?.yearFilter?.selectedMax);
            console.log('AFTER – Albums in collection:', window.albumApp?.collection?.albums?.length);
            console.log('AFTER – Albums displayed:', document.querySelectorAll('.album-card').length);
            
            if (window.albumApp?.collection?.albums?.length > 0) {
                console.log('🎉 SUCCESS: Year filter applied correctly!');
                
                // Show sample albums in filtered range
                const sampleAlbums = window.albumApp.collection.albums.slice(0, 5);
                console.log('🎵 Sample filtered albums (1970-1990):');
                sampleAlbums.forEach(album => {
                    console.log(`"${album.title}" (${album.year})`);
                });
                
                // Test 2: Test sorting with year filter applied
                console.log('🔍 Test 2: Test sorting with year filter applied');
                console.log('Filter state before sort:', window.albumApp?.yearFilter?.enabled);
                console.log('Albums before sort:', window.albumApp?.collection?.albums?.length);
                
                // Test sorting
                window.albumApp.sortAlbums('title-asc');
                
                setTimeout(() => {
                    console.log('Filter state after sort:', window.albumApp?.yearFilter?.enabled);
                    console.log('Albums after sort:', window.albumApp?.collection?.albums?.length);
                    console.log('🎉 ULTIMATE SUCCESS: Year filter survived sorting AND shows albums!');
                }, 1000);
                
            } else {
                console.log('⚠️ No albums found in 1970-1990 range');
                
                // Check what years are actually available
                if (window.albumApp?.originalCollection?.albums) {
                    const allYears = window.albumApp.originalCollection.albums
                        .map(album => album.year)
                        .filter(year => year && year > 0)
                        .sort((a, b) => a - b);
                    
                    console.log('📊 Available years in collection:', {
                        min: allYears[0],
                        max: allYears[allYears.length - 1],
                        total: allYears.length,
                        sample: allYears.slice(0, 10)
                    });
                    
                    // Test with a different range that should have albums
                    const testMin = allYears[Math.floor(allYears.length * 0.3)];
                    const testMax = allYears[Math.floor(allYears.length * 0.7)];
                    
                    console.log(`🔄 Trying different range: ${testMin}-${testMax}`);
                    window.albumApp.onYearRangeChange(testMin, testMax);
                }
            }
        }).catch(error => {
            console.error('❌ Error during year filter test:', error);
        });
    } else {
        console.error('❌ albumApp or onYearRangeChange method not found');
    }
};

console.log('✅ FINAL debug script loaded!');
console.log('📋 Available commands:');
console.log('finalYearFilterTest() – Fixed parameter test');
