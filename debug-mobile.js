// Mobile Debug Helper for Albums Collection App
// This script helps identify iPhone-specific issues with data loading

window.mobileDebug = {
    // Check collection data state
    checkCollectionData() {
        console.log('📱 MOBILE DEBUG - Collection Data State:');
        console.log('Albums:', window.app?.collection?.albums?.length || 0);
        console.log('Artists:', window.app?.collection?.artists?.length || 0);
        console.log('Tracks:', window.app?.collection?.tracks?.length || 0);
        console.log('Roles:', window.app?.collection?.roles?.length || 0);
        
        // Check if data exists but isn't rendering
        if (window.app?.collection?.albums?.length > 0) {
            console.log('✅ Albums data exists');
        } else {
            console.log('❌ No albums data found');
        }
        
        return {
            albums: window.app?.collection?.albums?.length || 0,
            artists: window.app?.collection?.artists?.length || 0,
            tracks: window.app?.collection?.tracks?.length || 0,
            roles: window.app?.collection?.roles?.length || 0
        };
    },
    
    // Check lazy loading state
    checkLazyLoading() {
        console.log('📱 MOBILE DEBUG - Lazy Loading State:');
        const lazyManager = window.app?.lazyLoadingManager;
        if (lazyManager) {
            console.log('LazyLoadingManager exists:', !!lazyManager);
            console.log('Active observers:', lazyManager.observers?.size || 0);
            console.log('Loading states:', lazyManager.loadingStates?.size || 0);
        } else {
            console.log('❌ LazyLoadingManager not found');
        }
    },
    
    // Check grid elements
    checkGridElements() {
        console.log('📱 MOBILE DEBUG - Grid Elements:');
        const grids = ['albums-grid', 'musical-artists-grid', 'technical-artists-grid', 'tracks-grid', 'musical-roles-grid', 'technical-roles-grid'];
        
        grids.forEach(gridId => {
            const grid = document.getElementById(gridId);
            if (grid) {
                console.log(`${gridId}: Found, children: ${grid.children.length}, innerHTML length: ${grid.innerHTML.length}`);
            } else {
                console.log(`${gridId}: ❌ Not found`);
            }
        });
    },
    
    // Force data regeneration
    forceDataRegeneration() {
        console.log('📱 MOBILE DEBUG - Forcing data regeneration...');
        if (window.app) {
            // Force regeneration flags
            window.app.artistsNeedRegeneration = true;
            
            // Regenerate tracks and roles
            if (window.app.collection.albums?.length > 0) {
                console.log('Regenerating tracks...');
                window.app.collection.tracks = window.app.generateTracksFromAlbums();
                console.log('Tracks regenerated:', window.app.collection.tracks.length);
                
                console.log('Regenerating roles...');
                window.app.collection.roles = window.app.generateRolesFromAlbums();
                console.log('Roles regenerated:', window.app.collection.roles.length);
                
                console.log('Regenerating artists...');
                window.app.collection.artists = window.app.generateArtistsFromAlbums();
                console.log('Artists regenerated:', window.app.collection.artists.length);
            }
        }
    },
    
    // Check iOS Safari specific issues
    checkIOSCompatibility() {
        console.log('📱 MOBILE DEBUG - iOS Compatibility Check:');
        console.log('User Agent:', navigator.userAgent);
        console.log('Is iOS Safari:', /iPad|iPhone|iPod/.test(navigator.userAgent));
        console.log('IntersectionObserver support:', 'IntersectionObserver' in window);
        console.log('Viewport width:', window.innerWidth);
        console.log('Viewport height:', window.innerHeight);
        console.log('Device pixel ratio:', window.devicePixelRatio);
    },
    
    // Run comprehensive debug
    runFullDebug() {
        console.log('📱 MOBILE DEBUG - Full Debug Report:');
        this.checkIOSCompatibility();
        this.checkCollectionData();
        this.checkLazyLoading();
        this.checkGridElements();
        
        // Add to global scope for easy access
        window.debugData = {
            collection: this.checkCollectionData(),
            userAgent: navigator.userAgent,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight
        };
        
        console.log('📱 Debug data saved to window.debugData');
    }
};

// Auto-run debug on load
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        console.log('📱 MOBILE DEBUG LOADED - Run window.mobileDebug.runFullDebug() to diagnose issues');
        // Auto-run basic check after app should be loaded
        setTimeout(() => {
            if (window.app) {
                window.mobileDebug.runFullDebug();
            }
        }, 5000);
    }, 1000);
});
