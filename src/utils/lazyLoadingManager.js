// Lazy Loading Manager for Grid Performance Optimization
class LazyLoadingManager {
    constructor() {
        this.observers = new Map();
        this.loadingStates = new Map();
        this.itemsPerPage = 20; // Number of items to load per batch
        this.loadingBufferDistance = 500; // Pixels from bottom to trigger loading
        
        // Debounce scroll events
        this.scrollDebounceTimer = null;
        this.scrollDebounceDelay = 100;
        
        console.log('🚀 LazyLoadingManager initialized');
    }
    
    /**
     * Initialize lazy loading for a grid
     * @param {string} gridId - The ID of the grid container
     * @param {Array} items - Array of all items to be rendered
     * @param {Function} renderItem - Function to render a single item
     * @param {Object} options - Configuration options
     */
    initializeLazyGrid(gridId, items, renderItem, options = {}) {
        const gridElement = document.getElementById(gridId);
        if (!gridElement) {
            console.warn(`⚠️ Grid element with ID '${gridId}' not found`);
            return;
        }

        // Check if grid is already being managed
        if (this.loadingStates.has(gridId)) {
            console.warn(`⚠️ Grid ${gridId} already initialized, updating instead`);
            return this.updateGridItems(gridId, items);
        }
        
        // Configuration
        const config = {
            itemsPerPage: options.itemsPerPage || this.itemsPerPage,
            loadingMessage: options.loadingMessage || 'Loading more items...',
            noMoreMessage: options.noMoreMessage || 'All items loaded',
            enableInfiniteScroll: options.enableInfiniteScroll !== false, // Default true
            ...options
        };
        
        // Initialize loading state
        this.loadingStates.set(gridId, {
            items: items,
            renderItem: renderItem,
            currentPage: 0,
            isLoading: false,
            allLoaded: false,
            config: config
        });
        
        // Clear existing content
        gridElement.innerHTML = '';
        
        // Load initial batch
        this.loadNextBatch(gridId);
        
        // Setup infinite scroll if enabled
        if (config.enableInfiniteScroll) {
            this.setupInfiniteScroll(gridId);
        }
        
        console.log(`📊 Lazy loading initialized for ${gridId} with ${items.length} items`);
        
        return {
            loadMore: () => this.loadNextBatch(gridId),
            reset: () => this.resetGrid(gridId),
            updateItems: (newItems) => this.updateGridItems(gridId, newItems)
        };
    }
    
    /**
     * Load the next batch of items
     */
    loadNextBatch(gridId) {
        const state = this.loadingStates.get(gridId);
        if (!state || state.isLoading || state.allLoaded) {
            return;
        }
        
        const { items, renderItem, config } = state;
        const startIndex = state.currentPage * config.itemsPerPage;
        const endIndex = Math.min(startIndex + config.itemsPerPage, items.length);
        
        if (startIndex >= items.length) {
            state.allLoaded = true;
            this.showNoMoreMessage(gridId);
            return;
        }
        
        state.isLoading = true;
        this.showLoadingIndicator(gridId);
        
        // Simulate async loading for smooth UX
        setTimeout(() => {
            const gridElement = document.getElementById(gridId);
            const batch = items.slice(startIndex, endIndex);
            
            // Remove loading indicator
            this.hideLoadingIndicator(gridId);
            
            // Render batch items
            batch.forEach((item, index) => {
                try {
                    const element = renderItem(item, startIndex + index);
                    if (element) {
                        gridElement.appendChild(element);
                        
                        // Add subtle animation for newly loaded items
                        this.animateNewItem(element);
                    }
                } catch (error) {
                    console.error(`❌ Error rendering item ${startIndex + index}:`, error);
                }
            });
            
            state.currentPage++;
            state.isLoading = false;
            
            // Check if all items loaded
            if (endIndex >= items.length) {
                state.allLoaded = true;
                this.showNoMoreMessage(gridId);
            }
            
            console.log(`✅ Loaded batch for ${gridId}: items ${startIndex}-${endIndex-1} (${batch.length} items)`);
            
        }, 50); // Small delay for smooth loading effect
    }
    
    /**
     * Setup infinite scroll for a grid
     */
    setupInfiniteScroll(gridId) {
        const gridElement = document.getElementById(gridId);
        if (!gridElement) return;
        
        // Remove existing observer if any
        if (this.observers.has(gridId)) {
            this.observers.get(gridId).disconnect();
        }
        
        // Remove existing sentinel if any
        const existingSentinel = document.getElementById(`${gridId}-sentinel`);
        if (existingSentinel) {
            existingSentinel.remove();
        }
        
        // Create scroll sentinel element
        const sentinel = document.createElement('div');
        sentinel.id = `${gridId}-sentinel`;
        sentinel.className = 'lazy-loading-sentinel';
        sentinel.style.height = '1px';
        sentinel.style.visibility = 'hidden';
        sentinel.style.width = '100%';
        sentinel.style.clear = 'both';
        
        // Find the correct container for the sentinel
        // Place OUTSIDE the grid to avoid disrupting grid layout
        let sentinelContainer;
        
        if (gridId === 'musical-artists-grid') {
            sentinelContainer = document.getElementById('musical-artists-tab');
        } else if (gridId === 'technical-artists-grid') {
            sentinelContainer = document.getElementById('technical-artists-tab');
        } else {
            // For albums, tracks, roles grids - use view container
            sentinelContainer = gridElement.closest('.view-container') || gridElement.parentElement;
        }
        
        if (sentinelContainer) {
            // Place sentinel at the end of the container, AFTER the grid
            sentinelContainer.appendChild(sentinel);
        } else {
            // Fallback: place after the grid element
            gridElement.parentElement.appendChild(sentinel);
        }
        
        // Create intersection observer
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const state = this.loadingStates.get(gridId);
                    if (state && !state.isLoading && !state.allLoaded) {
                        this.loadNextBatch(gridId);
                    }
                }
            });
        }, {
            root: null,
            rootMargin: `${this.loadingBufferDistance}px`,
            threshold: 0.1
        });
        
        observer.observe(sentinel);
        this.observers.set(gridId, observer);
        
        console.log(`👁️ Infinite scroll setup for ${gridId} - sentinel placed outside grid`);
    }

    
    /**
     * Show loading indicator
     */
    showLoadingIndicator(gridId) {
        const gridElement = document.getElementById(gridId);
        if (!gridElement) return;
        
        // Remove existing indicator
        this.hideLoadingIndicator(gridId);
        
        const state = this.loadingStates.get(gridId);
        const loadingDiv = document.createElement('div');
        loadingDiv.id = `${gridId}-loading`;
        loadingDiv.className = 'lazy-loading-indicator';
        loadingDiv.innerHTML = `
            <div class="loading-content">
                <div class="loading-spinner"></div>
                <span class="loading-text">${state?.config?.loadingMessage || 'Loading more items...'}</span>
            </div>
        `;
        
        gridElement.appendChild(loadingDiv);
    }
    
    /**
     * Hide loading indicator
     */
    hideLoadingIndicator(gridId) {
        const indicator = document.getElementById(`${gridId}-loading`);
        if (indicator) {
            indicator.remove();
        }
    }
    
    /**
     * Show "no more items" message
     */
    showNoMoreMessage(gridId) {
        const gridElement = document.getElementById(gridId);
        if (!gridElement) return;
        
        const state = this.loadingStates.get(gridId);
        const messageDiv = document.createElement('div');
        messageDiv.id = `${gridId}-complete`;
        messageDiv.className = 'lazy-loading-complete';
        messageDiv.innerHTML = `
            <div class="complete-content">
                <span class="complete-icon">✅</span>
                <span class="complete-text">${state?.config?.noMoreMessage || 'All items loaded'}</span>
            </div>
        `;
        
        gridElement.appendChild(messageDiv);
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            if (messageDiv.parentElement) {
                messageDiv.remove();
            }
        }, 3000);
    }
    
    /**
     * Add entrance animation to newly loaded items
     */
    animateNewItem(element) {
        element.style.opacity = '0';
        element.style.transform = 'translateY(20px)';
        element.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        
        // Trigger animation on next frame
        requestAnimationFrame(() => {
            element.style.opacity = '1';
            element.style.transform = 'translateY(0)';
        });
        
        // Clean up styles after animation
        setTimeout(() => {
            element.style.transition = '';
            element.style.transform = '';
        }, 300);
    }
    
    /**
     * Reset grid to initial state
     */
    resetGrid(gridId) {
        console.log(`🔄 Resetting grid: ${gridId}`);
        
        // CRITICAL FIX: Remove the loading state entirely, don't just reset properties
        if (this.loadingStates.has(gridId)) {
            console.log(`🔄 Removing loading state for ${gridId} to prevent duplication`);
            this.loadingStates.delete(gridId);
        }
        
        // AGGRESSIVE DOM CLEARING - Clear grid multiple ways to ensure it's clean
        const gridElement = document.getElementById(gridId);
        if (gridElement) {
            console.log(`🧹 Clearing DOM content for ${gridId} (had ${gridElement.children.length} items)`);
            
            // Method 1: innerHTML
            gridElement.innerHTML = '';
            
            // Method 2: Remove all children manually (more aggressive)
            while (gridElement.firstChild) {
                gridElement.removeChild(gridElement.firstChild);
            }
            
            // Method 3: Clear any remaining content
            gridElement.textContent = '';
            
            console.log(`✅ DOM cleared for ${gridId} (now has ${gridElement.children.length} items)`);
        }
        
        // Remove sentinel and observer
        const sentinel = document.getElementById(`${gridId}-sentinel`);
        if (sentinel) {
            sentinel.remove();
        }
        
        if (this.observers.has(gridId)) {
            this.observers.get(gridId).disconnect();
            this.observers.delete(gridId);
        }
        
        console.log(`🔄 Reset lazy loading for ${gridId} - fresh initialization ready`);
    }
    
    /**
     * Update items in grid (for filtering, sorting, etc.)
     */
    updateGridItems(gridId, newItems) {
        const state = this.loadingStates.get(gridId);
        if (!state) {
            console.warn(`⚠️ No loading state found for ${gridId}, initializing fresh`);
            return false; // Signal that initialization is needed
        }
        
        console.log(`🔄 Updating ${gridId} data: ${state.items.length} -> ${newItems.length} items`);
        
        // Update items in the existing state
        state.items = newItems;
        state.currentPage = 0;
        state.isLoading = false;
        state.allLoaded = false;
        
        // Clear DOM content only (keep lazy loading state)
        const gridElement = document.getElementById(gridId);
        if (gridElement) {
            gridElement.innerHTML = '';
        }
        
        // Remove existing sentinel
        const sentinel = document.getElementById(`${gridId}-sentinel`);
        if (sentinel) {
            sentinel.remove();
        }
        
        // Load first batch with existing render function
        this.loadNextBatch(gridId);
        
        // Re-setup infinite scroll
        if (state.config.enableInfiniteScroll) {
            this.setupInfiniteScroll(gridId);
        }
        
        console.log(`✅ Updated ${gridId} with ${newItems.length} items (no reinitialization)`);
        return true; // Signal successful update
    }
    
    /**
     * Re-setup intersection observer for a specific grid (useful for tabs)
     */
    reinitializeObserver(gridId) {
        const state = this.loadingStates.get(gridId);
        if (!state) {
            console.warn(`⚠️ No loading state found for ${gridId}`);
            return;
        }
        
        console.log(`🔄 Reinitializing intersection observer for ${gridId}`);
        
        // Remove existing observer
        if (this.observers.has(gridId)) {
            this.observers.get(gridId).disconnect();
            this.observers.delete(gridId);
        }
        
        // Setup intersection observer again
        if (state.config.enableInfiniteScroll !== false) {
            this.setupInfiniteScroll(gridId);
        }
    }
    
    /**
     * Cleanup all observers and states
     */
    cleanup() {
        this.observers.forEach(observer => observer.disconnect());
        this.observers.clear();
        this.loadingStates.clear();
        
        // Remove all sentinels
        document.querySelectorAll('.lazy-loading-sentinel').forEach(el => el.remove());
        
        console.log('🧹 LazyLoadingManager cleaned up');
    }
    
    /**
     * Get loading statistics for debugging
     */
    getStats(gridId) {
        const state = this.loadingStates.get(gridId);
        if (!state) return null;
        
        const loadedItems = state.currentPage * state.config.itemsPerPage;
        return {
            gridId,
            totalItems: state.items.length,
            loadedItems: Math.min(loadedItems, state.items.length),
            currentPage: state.currentPage,
            isLoading: state.isLoading,
            allLoaded: state.allLoaded,
            loadingPercentage: Math.round((Math.min(loadedItems, state.items.length) / state.items.length) * 100)
        };
    }
}

// Export for global access
window.LazyLoadingManager = LazyLoadingManager;