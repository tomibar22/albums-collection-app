/**
 * @file LazyLoadingManager.js
 * @description Manages lazy loading and infinite scrolling for grid-based layouts to optimize performance.
 * It efficiently loads items in batches as the user scrolls, preventing DOM overload.
 */
class LazyLoadingManager {
    constructor() {
        /**
         * Stores IntersectionObserver instances for each grid.
         * @type {Map<string, IntersectionObserver>}
         */
        this.observers = new Map();
        /**
         * Stores the loading state and configuration for each managed grid.
         * @type {Map<string, Object>}
         */
        this.loadingStates = new Map();
        /**
         * Default number of items to load per batch.
         * @type {number}
         */
        this.itemsPerPage = 20;
        /**
         * Distance (in pixels) from the bottom of the root element to trigger loading.
         * @type {number}
         */
        this.loadingBufferDistance = 500;
        
        console.log('🚀 LazyLoadingManager initialized');
    }
    
    /**
     * Initializes lazy loading and infinite scroll for a specified grid.
     * If the grid is already initialized, it will be reset and re-initialized.
     * * @param {string} gridId - The ID of the grid container element.
     * @param {Array<Object>} items - An array of all items to be rendered.
     * @param {Function} renderItem - A callback function that takes an item object and its index,
     * and returns a DOM element representing the rendered item.
     * The returned element should ideally have a `data-item-id` attribute.
     * @param {Object} [options={}] - Configuration options for the grid.
     * @param {number} [options.itemsPerPage=20] - Number of items to load in each batch.
     * @param {string} [options.loadingMessage='Loading more items...'] - Message displayed while loading.
     * @param {string} [options.noMoreMessage='All items loaded'] - Message displayed when all items are loaded.
     * @param {boolean} [options.enableInfiniteScroll=true] - Whether to enable infinite scrolling.
     * @returns {Object} An object with methods to control the initialized grid (loadMore, reset, updateItems).
     */
    initializeLazyGrid(gridId, items, renderItem, options = {}) {
        const gridElement = document.getElementById(gridId);
        if (!gridElement) {
            console.warn(`⚠️ LazyLoadingManager: Grid element with ID '${gridId}' not found. Initialization aborted.`);
            return {};
        }

        // If grid is already being managed, reset it first to ensure a clean re-initialization
        if (this.loadingStates.has(gridId)) {
            console.log(`🔄 LazyLoadingManager: Grid '${gridId}' already initialized. Resetting before re-initialization.`);
            this.resetGrid(gridId); // Perform a full reset
        }
        
        // Configuration for the current grid instance
        const config = {
            itemsPerPage: options.itemsPerPage || this.itemsPerPage,
            loadingMessage: options.loadingMessage || 'Loading more items...',
            noMoreMessage: options.noMoreMessage || 'All items loaded',
            enableInfiniteScroll: options.enableInfiniteScroll !== false, // Default true
            ...options
        };
        
        // Initialize loading state for the new grid
        this.loadingStates.set(gridId, {
            items: items,
            renderItem: renderItem,
            currentPage: 0,
            isLoading: false,
            allLoaded: false,
            config: config
        });
        
        // Clear existing content in the grid element
        gridElement.innerHTML = '';
        
        // Load the initial batch of items
        this.loadNextBatch(gridId);
        
        // Setup infinite scroll if enabled in configuration
        if (config.enableInfiniteScroll) {
            this.setupInfiniteScroll(gridId);
        }
        
        console.log(`📊 LazyLoadingManager: Initialized lazy loading for grid '${gridId}' with ${items.length} total items.`);
        
        // Return control methods for the initialized grid
        return {
            loadMore: () => this.loadNextBatch(gridId),
            reset: () => this.resetGrid(gridId),
            updateItems: (newItems) => this.updateGridItems(gridId, newItems)
        };
    }
    
    /**
     * Loads the next batch of items for a specified grid.
     * This method is called automatically by infinite scroll or can be triggered manually.
     * * @param {string} gridId - The ID of the grid to load items for.
     */
    loadNextBatch(gridId) {
        const state = this.loadingStates.get(gridId);
        // Prevent loading if state doesn't exist, already loading, or all items are loaded
        if (!state || state.isLoading || state.allLoaded) {
            return;
        }
        
        const { items, renderItem, config } = state;
        const startIndex = state.currentPage * config.itemsPerPage;
        const endIndex = Math.min(startIndex + config.itemsPerPage, items.length);
        
        // Check if there are no more items to load
        if (startIndex >= items.length) {
            state.allLoaded = true;
            this.showNoMoreMessage(gridId);
            console.log(`✅ LazyLoadingManager: All items for '${gridId}' have been loaded.`);
            return;
        }
        
        state.isLoading = true;
        this.showLoadingIndicator(gridId);
        
        // Simulate asynchronous loading for a smoother user experience.
        // In a real application, this would typically be a `fetch` call to an API.
        setTimeout(() => {
            const gridElement = document.getElementById(gridId);
            if (!gridElement) {
                console.error(`❌ LazyLoadingManager: Grid element '${gridId}' not found during batch load.`);
                state.isLoading = false;
                return;
            }

            const batch = items.slice(startIndex, endIndex);
            
            this.hideLoadingIndicator(gridId); // Remove loading indicator
            
<<<<<<< HEAD
            const renderedIdsInBatch = new Set(); // To prevent duplicates within the current batch
            let actuallyAddedCount = 0;
            
            batch.forEach((item, index) => {
                try {
                    // Generate a unique ID for the item, prioritizing item.id
                    const itemId = item.id || `lazy-item-${gridId}-${startIndex + index}`;
                    
                    // Comprehensive duplicate prevention:
                    // 1. Check if already processed in this batch
                    if (renderedIdsInBatch.has(itemId)) {
                        console.warn(`⚠️ LazyLoadingManager: Skipping duplicate item ID '${itemId}' within the current batch for grid '${gridId}'.`);
                        return;
                    }
                    renderedIdsInBatch.add(itemId);
                    
                    // 2. Check if an element with this data-item-id already exists in the DOM
                    const existingElement = gridElement.querySelector(`[data-item-id="${itemId}"]`);
                    if (existingElement) {
                        console.warn(`⚠️ LazyLoadingManager: Element with data-item-id='${itemId}' already exists in grid '${gridId}', skipping rendering.`);
                        return;
                    }
                    
                    // Render the item using the provided renderItem function
=======
            // Render batch items
            batch.forEach((item, index) => {
                try {
>>>>>>> parent of 6d0402b (🔧 CRITICAL FIX: Resolve card duplication bug in lazy loading)
                    const element = renderItem(item, startIndex + index);
                    
                    if (element instanceof HTMLElement) {
                        // Ensure the rendered element has the data-item-id for future checks
                        element.setAttribute('data-item-id', itemId);
                        gridElement.appendChild(element);
<<<<<<< HEAD
                        actuallyAddedCount++;
=======
>>>>>>> parent of 6d0402b (🔧 CRITICAL FIX: Resolve card duplication bug in lazy loading)
                        
                        // Apply subtle animation for newly loaded items
                        this.animateNewItem(element);
                    } else {
                        console.warn(`⚠️ LazyLoadingManager: renderItem for item ${itemId} did not return a valid HTMLElement.`);
                    }
                } catch (error) {
                    console.error(`❌ LazyLoadingManager: Error rendering item ${startIndex + index} for grid '${gridId}':`, error);
                }
            });
            
            state.currentPage++;
            state.isLoading = false;
            
            // Check if all items have been loaded after this batch
            if (endIndex >= items.length) {
                state.allLoaded = true;
                this.showNoMoreMessage(gridId);
            }
            
<<<<<<< HEAD
            console.log(`✅ LazyLoadingManager: Loaded batch for '${gridId}'. Items ${startIndex} to ${endIndex-1} (${batch.length} requested, ${actuallyAddedCount} added to DOM).`);
=======
            console.log(`✅ Loaded batch for ${gridId}: items ${startIndex}-${endIndex-1} (${batch.length} items)`);
>>>>>>> parent of 6d0402b (🔧 CRITICAL FIX: Resolve card duplication bug in lazy loading)
            
        }, 50); // Small delay for a smooth loading effect
    }
    
    /**
     * Sets up the Intersection Observer for infinite scrolling for a specific grid.
     * It places a sentinel element after the grid to detect when more content needs to be loaded.
     * * @param {string} gridId - The ID of the grid element.
     */
    setupInfiniteScroll(gridId) {
        const gridElement = document.getElementById(gridId);
        if (!gridElement) {
            console.warn(`⚠️ LazyLoadingManager: Cannot setup infinite scroll for '${gridId}'. Grid element not found.`);
            return;
        }
        
        // Disconnect and remove any existing observer for this grid
        if (this.observers.has(gridId)) {
            this.observers.get(gridId).disconnect();
            this.observers.delete(gridId);
            console.log(`🗑️ LazyLoadingManager: Disconnected existing observer for '${gridId}'.`);
        }
        
        // Remove existing sentinel element if it exists
        const existingSentinel = document.getElementById(`${gridId}-sentinel`);
        if (existingSentinel) {
            existingSentinel.remove();
            console.log(`🗑️ LazyLoadingManager: Removed existing sentinel for '${gridId}'.`);
        }
        
        // Create a new scroll sentinel element
        const sentinel = document.createElement('div');
        sentinel.id = `${gridId}-sentinel`;
        sentinel.className = 'lazy-loading-sentinel';
        // Basic styling to ensure it's a visible target for the observer
        sentinel.style.height = '1px';
        sentinel.style.width = '100%';
        sentinel.style.visibility = 'hidden'; // Make it invisible but still take up space
        sentinel.style.clear = 'both'; // Clear floats if grid items are floated
        
        // Append the sentinel to the parent of the grid element.
        // This is crucial for viewport-based observation (root: null) so the sentinel
        // is in the same scrolling context as the grid but doesn't interfere with its layout.
        const sentinelContainer = gridElement.parentElement;
        if (sentinelContainer) {
            sentinelContainer.appendChild(sentinel);
            console.log(`➕ LazyLoadingManager: Sentinel for '${gridId}' appended to its parent element.`);
        } else {
            console.error(`❌ LazyLoadingManager: Could not find parent element for grid '${gridId}' to place sentinel.`);
            return;
        }
        
        // Create a new Intersection Observer
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                // If the sentinel is intersecting the viewport
                if (entry.isIntersecting) {
                    const state = this.loadingStates.get(gridId);
                    // Load next batch only if not already loading and not all items are loaded
                    if (state && !state.isLoading && !state.allLoaded) {
                        console.log(`🎯 LazyLoadingManager: Sentinel for '${gridId}' intersected. Triggering next batch load.`);
                        this.loadNextBatch(gridId);
                    }
                }
            });
        }, {
            root: null, // Observe intersection with the viewport
            rootMargin: `${this.loadingBufferDistance}px`, // Trigger when sentinel is within this distance from viewport bottom
            threshold: 0.1 // Trigger when 10% of sentinel is visible
        });
        
        observer.observe(sentinel); // Start observing the sentinel
        this.observers.set(gridId, observer); // Store the observer
        
        console.log(`👁️ LazyLoadingManager: Infinite scroll setup complete for '${gridId}'.`);
    }

    /**
     * Displays a loading indicator within the specified grid.
     * * @param {string} gridId - The ID of the grid element.
     */
    showLoadingIndicator(gridId) {
        const gridElement = document.getElementById(gridId);
        if (!gridElement) return;
        
        this.hideLoadingIndicator(gridId); // Ensure no old indicator is present
        
        const state = this.loadingStates.get(gridId);
        const loadingDiv = document.createElement('div');
        loadingDiv.id = `${gridId}-loading`;
        loadingDiv.className = 'lazy-loading-indicator';
        loadingDiv.innerHTML = `
            <div class="loading-content" style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px;">
                <div class="loading-spinner" style="border: 4px solid rgba(0, 0, 0, 0.1); border-top: 4px solid #3498db; border-radius: 50%; width: 30px; height: 30px; animation: spin 1s linear infinite;"></div>
                <span class="loading-text" style="margin-top: 10px; color: #555; font-size: 0.9em;">${state?.config?.loadingMessage || 'Loading more items...'}</span>
            </div>
            <style>
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `;
        
        gridElement.appendChild(loadingDiv);
    }
    
    /**
     * Hides the loading indicator for the specified grid.
     * * @param {string} gridId - The ID of the grid element.
     */
    hideLoadingIndicator(gridId) {
        const indicator = document.getElementById(`${gridId}-loading`);
        if (indicator) {
            indicator.remove();
        }
    }
    
    /**
     * Displays a "no more items" message for the specified grid.
     * The message will automatically hide after a few seconds.
     * * @param {string} gridId - The ID of the grid element.
     */
    showNoMoreMessage(gridId) {
        const gridElement = document.getElementById(gridId);
        if (!gridElement) return;
        
        // Remove any existing complete message
        const existingComplete = document.getElementById(`${gridId}-complete`);
        if (existingComplete) {
            existingComplete.remove();
        }

        const state = this.loadingStates.get(gridId);
        const messageDiv = document.createElement('div');
        messageDiv.id = `${gridId}-complete`;
        messageDiv.className = 'lazy-loading-complete';
        messageDiv.innerHTML = `
            <div class="complete-content" style="display: flex; align-items: center; justify-content: center; padding: 20px; color: #28a745; font-weight: bold;">
                <span class="complete-icon" style="margin-right: 10px; font-size: 1.2em;">✅</span>
                <span class="complete-text">${state?.config?.noMoreMessage || 'All items loaded'}</span>
            </div>
        `;
        
        gridElement.appendChild(messageDiv);
        
        // Auto-hide the message after 3 seconds
        setTimeout(() => {
            if (messageDiv.parentElement) {
                messageDiv.remove();
            }
        }, 3000);
    }
    
    /**
     * Applies a subtle entrance animation to a newly loaded item element.
     * * @param {HTMLElement} element - The DOM element to animate.
     */
    animateNewItem(element) {
        // Initial state for animation
        element.style.opacity = '0';
        element.style.transform = 'translateY(20px)';
        element.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        
        // Trigger animation on the next animation frame for smooth rendering
        requestAnimationFrame(() => {
            element.style.opacity = '1';
            element.style.transform = 'translateY(0)';
        });
        
        // Clean up inline styles after the animation completes to allow CSS rules to take over
        setTimeout(() => {
            element.style.transition = '';
            element.style.transform = '';
            element.style.opacity = ''; // Remove opacity if it conflicts with default styles
        }, 300);
    }
    
    /**
     * Resets a specific grid to its initial uninitialized state.
     * This clears the DOM, removes observers, and deletes its loading state.
     * * @param {string} gridId - The ID of the grid to reset.
     */
    resetGrid(gridId) {
        console.log(`🔄 LazyLoadingManager: Initiating full reset for grid '${gridId}'.`);
        
        // Remove the loading state entirely to ensure a clean slate
        if (this.loadingStates.has(gridId)) {
            this.loadingStates.delete(gridId);
            console.log(`🗑️ LazyLoadingManager: Removed loading state for '${gridId}'.`);
        }
        
        // Aggressively clear the DOM content of the grid element
        const gridElement = document.getElementById(gridId);
        if (gridElement) {
            console.log(`🧹 LazyLoadingManager: Clearing DOM content for '${gridId}' (had ${gridElement.children.length} children).`);
            gridElement.innerHTML = ''; // Fastest way to clear
            // For extra certainty, manually remove children if innerHTML wasn't enough (though it usually is)
            while (gridElement.firstChild) {
                gridElement.removeChild(gridElement.firstChild);
            }
            gridElement.textContent = ''; // Clear any lingering text nodes
            console.log(`✅ LazyLoadingManager: DOM cleared for '${gridId}' (now has ${gridElement.children.length} children).`);
        }
        
        // Remove the sentinel element
        const sentinel = document.getElementById(`${gridId}-sentinel`);
        if (sentinel) {
            sentinel.remove();
            console.log(`🗑️ LazyLoadingManager: Removed sentinel for '${gridId}'.`);
        }
        
        // Disconnect and remove the Intersection Observer
        if (this.observers.has(gridId)) {
            this.observers.get(gridId).disconnect();
            this.observers.delete(gridId);
            console.log(`🗑️ LazyLoadingManager: Disconnected and removed observer for '${gridId}'.`);
        }
        
        console.log(`✅ LazyLoadingManager: Grid '${gridId}' reset complete. Ready for fresh initialization.`);
    }
    
    /**
     * Updates the items array for an already initialized grid and re-renders the first batch.
     * This is useful for filtering, sorting, or dynamically changing the data source.
     * * @param {string} gridId - The ID of the grid to update.
     * @param {Array<Object>} newItems - The new array of items for the grid.
     * @returns {boolean} True if the update was successful, false if the grid was not found.
     */
    updateGridItems(gridId, newItems) {
        const state = this.loadingStates.get(gridId);
        if (!state) {
            console.warn(`⚠️ LazyLoadingManager: No loading state found for grid '${gridId}'. Cannot update items. Please initialize it first.`);
            return false;
        }
        
        console.log(`🔄 LazyLoadingManager: Updating data for grid '${gridId}'. Old count: ${state.items.length}, New count: ${newItems.length}.`);
        
        // Update the items array in the existing state
        state.items = newItems;
        state.currentPage = 0; // Reset to the first page
        state.isLoading = false; // Reset loading flag
        state.allLoaded = false; // Reset all loaded flag
        
        // Clear only the DOM content of the grid (keep lazy loading state intact)
        const gridElement = document.getElementById(gridId);
        if (gridElement) {
            gridElement.innerHTML = '';
            console.log(`🧹 LazyLoadingManager: Cleared DOM content for '${gridId}' for update.`);
        }
        
        // Remove existing sentinel to ensure it's re-added correctly for the new content
        const sentinel = document.getElementById(`${gridId}-sentinel`);
        if (sentinel) {
            sentinel.remove();
            console.log(`🗑️ LazyLoadingManager: Removed old sentinel for '${gridId}' during update.`);
        }
        
        // Load the first batch of items using the existing render function
        this.loadNextBatch(gridId);
        
        // Re-setup infinite scroll to ensure the observer is correctly attached to the new content/sentinel
        if (state.config.enableInfiniteScroll) {
            this.setupInfiniteScroll(gridId);
        }
        
        console.log(`✅ LazyLoadingManager: Grid '${gridId}' successfully updated with ${newItems.length} items.`);
        return true;
    }
    
    /**
     * Re-initializes the Intersection Observer for a specific grid.
     * This can be useful in scenarios where the grid's visibility or scroll context changes,
     * e.g., when switching tabs in a tabbed interface.
     * * @param {string} gridId - The ID of the grid to re-initialize the observer for.
     */
    reinitializeObserver(gridId) {
        const state = this.loadingStates.get(gridId);
        if (!state) {
            console.warn(`⚠️ LazyLoadingManager: No loading state found for '${gridId}'. Cannot reinitialize observer.`);
            return;
        }
        
        console.log(`🔄 LazyLoadingManager: Reinitializing intersection observer for '${gridId}'.`);
        
        // Disconnect and remove existing observer
        if (this.observers.has(gridId)) {
            this.observers.get(gridId).disconnect();
            this.observers.delete(gridId);
            console.log(`🗑️ LazyLoadingManager: Disconnected existing observer for '${gridId}' during re-init.`);
        }
        
        // Setup intersection observer again if infinite scroll is enabled
        if (state.config.enableInfiniteScroll) {
            this.setupInfiniteScroll(gridId);
        }
    }
    
    /**
     * Cleans up all managed grids, disconnecting all observers and clearing all states.
     * This should be called when the LazyLoadingManager instance is no longer needed.
     */
    cleanup() {
        console.log('🧹 LazyLoadingManager: Initiating global cleanup.');
        
        // Disconnect all active observers
        this.observers.forEach((observer, gridId) => {
            observer.disconnect();
            console.log(`🗑️ LazyLoadingManager: Disconnected observer for '${gridId}'.`);
        });
        this.observers.clear();
        
        // Clear all loading states
        this.loadingStates.clear();
        
        // Remove all sentinel elements from the DOM
        document.querySelectorAll('.lazy-loading-sentinel').forEach(el => {
            if (el.parentElement) {
                el.remove();
            }
        });
        console.log('🗑️ LazyLoadingManager: Removed all sentinel elements.');
        
        console.log('✅ LazyLoadingManager: Global cleanup complete.');
    }
    
    /**
     * Returns loading statistics for a specific grid, useful for debugging.
     * * @param {string} gridId - The ID of the grid to get stats for.
     * @returns {Object|null} An object containing statistics, or null if the grid is not managed.
     */
    getStats(gridId) {
        const state = this.loadingStates.get(gridId);
        if (!state) {
            console.warn(`⚠️ LazyLoadingManager: No stats available for unmanaged grid '${gridId}'.`);
            return null;
        }
        
        const loadedItems = state.currentPage * state.config.itemsPerPage;
        const actualLoadedCount = Math.min(loadedItems, state.items.length);
        
        return {
            gridId,
            totalItems: state.items.length,
            loadedItems: actualLoadedCount,
            currentPage: state.currentPage,
            isLoading: state.isLoading,
            allLoaded: state.allLoaded,
            loadingPercentage: state.items.length > 0 ? Math.round((actualLoadedCount / state.items.length) * 100) : 0
        };
    }
}

<<<<<<< HEAD
// Export for global access in a browser environment
window.LazyLoadingManager = LazyLoadingManager;
=======
// Export for global access
window.LazyLoadingManager = LazyLoadingManager;
>>>>>>> parent of 6d0402b (🔧 CRITICAL FIX: Resolve card duplication bug in lazy loading)
