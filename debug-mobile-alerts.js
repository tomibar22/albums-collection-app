// Mobile Alert-Based Debug Helper for iPhone Testing
// This provides visual feedback when developer tools aren't available

window.mobileAlertDebug = {
    // Show collection data as alert
    showCollectionStatus() {
        const data = window.app?.collection;
        const message = `📱 Collection Status:
Albums: ${data?.albums?.length || 0}
Artists: ${data?.artists?.length || 0}  
Tracks: ${data?.tracks?.length || 0}
Roles: ${data?.roles?.length || 0}

Device: ${navigator.userAgent.includes('iPhone') ? 'iPhone' : 'Other'}
Viewport: ${window.innerWidth}x${window.innerHeight}`;
        
        alert(message);
    },
    
    // Check if lazy loading is working
    checkLazyLoading() {
        const grids = ['albums-grid', 'musical-artists-grid', 'tracks-grid'];
        let status = '📱 Grid Status:\n';
        
        grids.forEach(gridId => {
            const grid = document.getElementById(gridId);
            status += `${gridId}: ${grid ? grid.children.length + ' items' : 'NOT FOUND'}\n`;
        });
        
        alert(status);
    },
    
    // Force regenerate data
    forceRegenerate() {
        if (window.app && window.app.collection.albums?.length > 0) {
            alert('📱 Forcing data regeneration...');
            window.mobileDebug.forceDataRegeneration();
            setTimeout(() => {
                alert('📱 Regeneration complete! Check pages now.');
            }, 2000);
        } else {
            alert('❌ No albums found - data loading issue');
        }
    },
    
    // Quick status check
    quickCheck() {
        const hasData = window.app?.collection?.albums?.length > 0;
        const isIPhone = /iPhone/.test(navigator.userAgent);
        const gridCount = document.querySelectorAll('[id$="-grid"]').length;
        
        alert(`📱 Quick Status:
Has Data: ${hasData ? 'YES' : 'NO'}
Is iPhone: ${isIPhone ? 'YES' : 'NO'}
Grid Elements: ${gridCount}
Current View: ${window.app?.currentView || 'Unknown'}`);
    }
};

// Auto-create debug buttons for iPhone testing
if (/iPhone/.test(navigator.userAgent)) {
    setTimeout(() => {
        // Create floating debug button
        const debugBtn = document.createElement('button');
        debugBtn.innerHTML = '🐛';
        debugBtn.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 50px;
            height: 50px;
            border-radius: 50%;
            background: #ff4444;
            color: white;
            border: none;
            font-size: 20px;
            z-index: 9999;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        
        let debugMenuOpen = false;
        debugBtn.onclick = () => {
            if (!debugMenuOpen) {
                // Show debug menu
                const menu = `📱 Debug Menu:
1. Collection Status
2. Grid Status  
3. Force Regenerate
4. Quick Check

Enter number (1-4):`;
                
                const choice = prompt(menu);
                switch(choice) {
                    case '1': window.mobileAlertDebug.showCollectionStatus(); break;
                    case '2': window.mobileAlertDebug.checkLazyLoading(); break;
                    case '3': window.mobileAlertDebug.forceRegenerate(); break;
                    case '4': window.mobileAlertDebug.quickCheck(); break;
                    default: alert('Invalid choice');
                }
            }
        };
        
        document.body.appendChild(debugBtn);
        console.log('📱 iPhone debug button added (red circle, bottom right)');
    }, 3000);
}
