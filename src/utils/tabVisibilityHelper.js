// Tab Visibility Helper for Optimal Scraping Performance
class TabVisibilityHelper {
    constructor() {
        this.isVisible = !document.hidden;
        this.setupVisibilityListener();
    }

    setupVisibilityListener() {
        document.addEventListener('visibilitychange', () => {
            this.isVisible = !document.hidden;
            console.log(`🔍 Tab visibility changed: ${this.isVisible ? 'VISIBLE' : 'HIDDEN'}`);
            
            if (this.isVisible && this.onVisible) {
                this.onVisible();
            } else if (!this.isVisible && this.onHidden) {
                this.onHidden();
            }
        });
    }

    // Adaptive delay based on tab visibility
    getOptimalDelay(normalDelay = 1500) {
        // Increase delay in background tabs to account for throttling
        return this.isVisible ? normalDelay : normalDelay * 2;
    }

    // Adaptive batch size for API calls
    getOptimalBatchSize(normalBatch = 1) {
        // Reduce batch size in background to prevent timeout issues
        return this.isVisible ? normalBatch : Math.max(1, normalBatch - 1);
    }

    // Check if we should show progress updates
    shouldUpdateProgress() {
        return this.isVisible;
    }

    onVisible = null;   // Callback when tab becomes visible
    onHidden = null;    // Callback when tab becomes hidden
}

// Global instance
window.tabVisibility = new TabVisibilityHelper();
