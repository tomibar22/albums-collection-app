/**
 * Artist Card Component
 * Displays artist information in a card format with artist image, name,
 * and album count with action to view artist's albums
 */

class ArtistCard {
    constructor(artistData, tabContext = null, position = 0) {
        this.artist = artistData;
        this.tabContext = tabContext; // 'musical', 'technical', or null for default behavior
        this.position = position; // Position in the grid (0-based index)
        this.element = null;
    }

    /**
     * Determine if image should be shown based on tab context and position
     * @returns {boolean} Whether to show the image
     */
    shouldShowImage() {
        // Always show images for musical artists
        if (this.tabContext !== 'technical') {
            return true;
        }
        
        // For technical contributors, only show images for first 15 cards (0-14)
        return this.position < 15;
    }

    /**
     * Utility function to escape HTML attributes
     * @param {string} str - String to escape
     * @returns {string} Escaped string
     */
    escapeHtmlAttribute(str) {
        if (!str || typeof str !== 'string') {
            return '';
        }
        return str
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    /**
     * Create and return the artist card HTML element
     * @returns {HTMLElement} Artist card element
     */
    render() {
        this.element = document.createElement('div');
        this.element.className = 'artist-card';
        this.element.setAttribute('data-artist-id', this.artist.id);

        // Format album count display based on tab context
        let albumCount, albumText;
        
        if (this.tabContext === 'musical' && this.artist.musicalAlbumCount !== undefined) {
            albumCount = this.artist.musicalAlbumCount || 0;
        } else if (this.tabContext === 'technical' && this.artist.technicalAlbumCount !== undefined) {
            albumCount = this.artist.technicalAlbumCount || 0;
        } else {
            // Default: show total album count
            albumCount = this.artist.albumCount || 0;
        }
        
        albumText = albumCount === 1 ? 'album' : 'albums';

        // Format roles display (show only the most frequent role)
        let rolesDisplay = '';
        if (this.artist.roles && this.artist.roles.length > 0) {
            const primaryRole = this.artist.roles[0]; // First role is most frequent
            rolesDisplay = `
                <p class="artist-roles">
                    ${primaryRole}
                </p>
            `;
        }

        // Check if we should show image based on tab context and position
        const shouldShowImage = this.shouldShowImage();
        
        this.element.innerHTML = `
            <div class="artist-card-inner">
                <div class="artist-image${!shouldShowImage ? ' no-image' : ''}">
                    ${shouldShowImage ? `
                        <img 
                            src="${this.getArtistImageUrl()}" 
                            alt="Photo of ${this.artist.name}"
                            class="artist-photo"
                            loading="lazy"
                            onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
                        />
                        <div class="artist-placeholder" style="display: none;">
                            <div class="placeholder-icon">${this.getInitials()}</div>
                        </div>
                    ` : `
                        <div class="artist-placeholder-only">
                            <div class="placeholder-icon">${this.getInitials()}</div>
                        </div>
                    `}
                    <div class="artist-overlay">
                        <div class="artist-actions">
                            <button class="action-btn view-albums-btn" title="View ${this.escapeHtmlAttribute(this.artist.name)}'s albums">
                                <span class="btn-icon">📀</span>
                                <span class="btn-text">View Albums</span>
                            </button>
                        </div>
                    </div>
                    <div class="card-edit-overlay">
                        <button class="card-edit-btn edit" onclick="window.albumApp.openEditArtistModal('${this.artist.id}')" title="Edit Artist">
                            ✏️
                        </button>
                        <button class="card-edit-btn delete" onclick="window.albumApp.confirmDeleteArtist('${this.artist.id}', '${this.escapeHtmlAttribute(this.artist.name)}'); event.stopPropagation();" title="Delete Artist">
                            🗑️
                        </button>
                    </div>
                </div>
                <div class="artist-info">
                    <h3 class="artist-name" title="${this.escapeHtmlAttribute(this.artist.name)}">${this.artist.name}</h3>
                    <p class="artist-album-count">${albumCount} ${albumText}</p>
                    ${rolesDisplay}
                </div>
            </div>
        `;

        this.attachEventListeners();
        
        // Initialize lazy image loading only if image should be shown
        if (this.shouldShowImage()) {
            // Use immediate initialization for lazy loaded items to prevent delays
            this.initializeLazyImageLoading();
        }
        
        return this.element;
    }

    /**
     * Get artist image URL with fallback to placeholder
     * @returns {string} Image URL
     */
    getArtistImageUrl() {
        // If we already have a cached image URL, use it
        if (this.artist.image && this.artist.image !== '') {
            return this.artist.image;
        }
        
        // Default placeholder - return empty string to trigger lazy loading
        return '';
    }

    /**
     * Initialize lazy image loading for this artist card
     */
    initializeLazyImageLoading() {
        if (!this.element || this.imageLoadingInitialized) return;
        
        // Don't load images if shouldShowImage is false
        if (!this.shouldShowImage()) return;
        
        this.imageLoadingInitialized = true;
        
        // Only fetch if we don't already have an image
        if (!this.artist.image || this.artist.image === '') {
            this.fetchArtistImageLazy();
        }
    }

    /**
     * Fetch artist image using the ImageService with lazy loading
     * @private
     */
    async fetchArtistImageLazy() {
        try {
            // Check if ImageService is available
            if (!window.ImageService) {
                console.warn('ImageService not available for lazy loading');
                return;
            }

            const imageService = new window.ImageService();
            console.log(`🖼️ Lazy loading image for artist: ${this.artist.name}`);

            const imageUrl = await imageService.fetchArtistImage(this.artist.name);
            
            if (imageUrl && this.element) {
                // Update the artist data with the fetched image
                this.artist.image = imageUrl;
                
                // Update the img element
                const imgElement = this.element.querySelector('.artist-photo');
                const placeholderElement = this.element.querySelector('.artist-placeholder');
                
                if (imgElement && placeholderElement) {
                    imgElement.src = imageUrl;
                    imgElement.style.display = 'block';
                    placeholderElement.style.display = 'none';
                    
                    console.log(`✅ Updated image for artist: ${this.artist.name}`);
                }
            }
        } catch (error) {
            console.error(`❌ Failed to fetch image for ${this.artist.name}:`, error);
        }
    }

    /**
     * Get artist name initials for placeholder image
     * @returns {string} Artist initials
     */
    getInitials() {
        if (!this.artist.name) return '?';
        
        const words = this.artist.name.trim().split(' ');
        if (words.length === 1) {
            return words[0].substring(0, 2).toUpperCase();
        }
        
        return words.slice(0, 2).map(word => word[0]).join('').toUpperCase();
    }

    /**
     * Attach event listeners to card elements
     */
    attachEventListeners() {
        if (!this.element) return;

        // Main card click handler
        this.element.addEventListener('click', (e) => {
            // Don't trigger if clicking action buttons
            if (e.target.closest('.action-btn')) return;
            
            this.handleCardClick(e);
        });

        // View Albums button
        const viewAlbumsBtn = this.element.querySelector('.view-albums-btn');
        if (viewAlbumsBtn) {
            viewAlbumsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleViewAlbums(e);
            });
        }
    }

    /**
     * Handle card click event
     * @param {Event} event - Click event
     */
    handleCardClick(event) {
        console.log(`🎤 Artist card clicked: ${this.artist.name}`);
        
        // Dispatch custom event for artist card click
        const customEvent = new CustomEvent('artistCardClick', {
            detail: {
                artist: this.artist,
                element: this.element,
                originalEvent: event
            },
            bubbles: true
        });
        
        this.element.dispatchEvent(customEvent);
    }

    /**
     * Handle view albums button click
     * @param {Event} event - Click event
     */
    handleViewAlbums(event) {
        console.log(`📀 View albums clicked for: ${this.artist.name}`);
        
        // Dispatch custom event for view albums action
        const customEvent = new CustomEvent('artistViewAlbums', {
            detail: {
                artist: this.artist,
                element: this.element,
                originalEvent: event
            },
            bubbles: true
        });
        
        this.element.dispatchEvent(customEvent);
    }

    /**
     * Update artist data and re-render if needed
     * @param {Object} newArtistData - Updated artist data
     */
    updateData(newArtistData) {
        this.artist = { ...this.artist, ...newArtistData };
        
        // Update specific elements without full re-render
        if (this.element) {
            const nameElement = this.element.querySelector('.artist-name');
            const countElement = this.element.querySelector('.artist-album-count');
            
            if (nameElement) {
                nameElement.textContent = this.artist.name;
                nameElement.setAttribute('title', this.artist.name);
            }
            
            if (countElement) {
                const albumCount = this.artist.albumCount || 0;
                const albumText = albumCount === 1 ? 'album' : 'albums';
                countElement.textContent = `${albumCount} ${albumText}`;
            }
        }
    }

    /**
     * Add loading state to the card
     */
    showLoading() {
        if (this.element) {
            this.element.classList.add('loading');
        }
    }

    /**
     * Remove loading state from the card
     */
    hideLoading() {
        if (this.element) {
            this.element.classList.remove('loading');
        }
    }

    /**
     * Highlight the card (useful for search results or selections)
     */
    highlight() {
        if (this.element) {
            this.element.classList.add('highlighted');
        }
    }

    /**
     * Remove highlight from the card
     */
    removeHighlight() {
        if (this.element) {
            this.element.classList.remove('highlighted');
        }
    }

    /**
     * Get the DOM element for this card
     * @returns {HTMLElement|null} Card element
     */
    getElement() {
        return this.element;
    }

    /**
     * Destroy the card and clean up event listeners
     */
    destroy() {
        if (this.element) {
            // Remove event listeners by cloning the element
            const newElement = this.element.cloneNode(true);
            this.element.parentNode?.replaceChild(newElement, this.element);
            this.element = null;
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ArtistCard;
} else if (typeof window !== 'undefined') {
    window.ArtistCard = ArtistCard;
}
