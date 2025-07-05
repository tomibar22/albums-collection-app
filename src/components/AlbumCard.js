/**
 * Album Card Component
 * Displays album information in a card format with cover image, title, year, artist,
 * and action buttons for "More Info" and "Spotify" search
 */

class AlbumCard {
    constructor(albumData, options = {}) {
        this.album = albumData;
        this.element = null;
        this.selectionMode = options.selectionMode || false;
        this.selected = options.selected || false;
        this.onSelectionChange = options.onSelectionChange || null;
    }

    /**
     * Escape HTML attribute values to prevent syntax errors
     * @param {string} value - The value to escape
     * @returns {string} Escaped value
     */
    escapeAttributeValue(value) {
        if (!value) return '';
        return value
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    /**
     * Create and return the album card HTML element
     * @returns {HTMLElement} Album card element
     */
    render() {
        this.element = document.createElement('div');
        this.element.className = 'album-card';
        if (this.selectionMode) {
            this.element.classList.add('selection-mode');
            if (this.selected) {
                this.element.classList.add('selected');
            }
        }
        this.element.setAttribute('data-album-id', this.album.id);

        // Get primary artist for display
        const primaryArtist = this.getPrimaryArtist();
        const artistsDisplay = this.getArtistsDisplay();

        // Selection checkbox HTML (only if in selection mode)
        const selectionCheckbox = this.selectionMode ? `
            <div class="selection-checkbox ${this.selected ? 'checked' : ''}" 
                 data-album-id="${this.album.id}">
            </div>
        ` : '';

        this.element.innerHTML = `
            <div class="album-card-inner">
                <div class="album-cover">
                    ${selectionCheckbox}
                    <img 
                        src="${this.getCoverImageUrl()}" 
                        alt="${this.escapeAttributeValue('Cover art for ' + this.album.title)}"
                        class="cover-image"
                        loading="lazy"
                        onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
                    />
                    <div class="album-placeholder" style="display: none;">
                        <div class="placeholder-icon">🎵</div>
                        <div class="placeholder-text">No Cover</div>
                    </div>
                    <div class="album-overlay">
                        <div class="album-actions">
                            <button class="overlay-action-btn more-info-btn" title="More Info">
                                ℹ️ More Info
                            </button>
                            <button class="overlay-action-btn spotify-btn" title="Spotify">
                                🎵 Spotify
                            </button>
                            <button class="overlay-action-btn youtube-btn" title="YouTube">
                                📺 YouTube
                            </button>
                        </div>
                    </div>
                    <div class="card-edit-overlay">
                        <button class="card-edit-btn edit" onclick="window.albumApp.openEditAlbumModal('${this.album.id}'); event.stopPropagation();" title="Edit Album">
                            ✏️
                        </button>
                        <button class="card-edit-btn delete" onclick="window.albumApp.confirmDeleteAlbum('${this.album.id}', '${this.escapeAttributeValue(this.album.title)}'); event.stopPropagation();" title="Delete Album">
                            🗑️
                        </button>
                    </div>
                </div>
                <div class="album-info">
                    <h3 class="album-title" title="${this.album.title}">${this.album.title}</h3>
                    <p class="album-artist" title="${artistsDisplay}">${artistsDisplay}</p>
                    <p class="album-year">${this.album.year || 'Unknown Year'}</p>
                    <div class="album-meta">
                        <span class="track-count">${this.album.track_count || this.album.trackCount || 0} tracks</span>
                        ${this.getGenreStyleTags()}
                    </div>
                </div>
            </div>
        `;

        this.setupEventListeners();
        return this.element;
    }

    /**
     * Set up event listeners for the card buttons
     */
    setupEventListeners() {
        const moreInfoBtn = this.element.querySelector('.more-info-btn');
        const spotifyBtn = this.element.querySelector('.spotify-btn');
        const youtubeBtn = this.element.querySelector('.youtube-btn');

        moreInfoBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleMoreInfoClick();
        });

        spotifyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleSpotifyClick();
        });

        youtubeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleYouTubeClick();
        });

        // Optional: Make entire card clickable for "More Info"
        this.element.addEventListener('click', (e) => {
            // Don't trigger if clicking on action buttons or edit buttons
            if (!e.target.closest('.overlay-action-btn, .card-edit-btn')) {
                this.handleMoreInfoClick();
            }
        });
    }

    /**
     * Handle "More Info" button click - opens modal with album details
     */
    handleMoreInfoClick() {
        console.log('🔍 Opening album details for:', this.album.title);
        
        // Dispatch custom event for the main app to handle
        const event = new CustomEvent('album-more-info', {
            detail: {
                album: this.album
            },
            bubbles: true
        });
        
        this.element.dispatchEvent(event);
    }

    /**
     * Handle "YouTube" button click - opens YouTube search
     */
    handleYouTubeClick() {
        const primaryArtist = this.getPrimaryArtist();
        const searchQuery = `${this.album.title} ${primaryArtist}`;
        const youtubeUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`;
        
        console.log('📺 Opening YouTube search for:', searchQuery);
        console.log('🔗 YouTube URL:', youtubeUrl);
        
        // Open YouTube search in new tab
        window.open(youtubeUrl, '_blank');
        
        // Dispatch custom event for analytics/logging
        const event = new CustomEvent('album-youtube-search', {
            detail: {
                album: this.album,
                searchQuery: searchQuery,
                url: youtubeUrl
            },
            bubbles: true
        });
        
        this.element.dispatchEvent(event);
    }

    /**
     * Handle "Spotify" button click - opens Spotify search
     */
    handleSpotifyClick() {
        const primaryArtist = this.getPrimaryArtist();
        const searchQuery = `${primaryArtist} ${this.album.title}`;
        const spotifyUrl = `https://open.spotify.com/search/${encodeURIComponent(searchQuery)}/albums`;
        
        console.log('🎵 Opening Spotify search for:', searchQuery);
        console.log('🔗 Spotify URL:', spotifyUrl);
        
        // Open Spotify search in new tab
        window.open(spotifyUrl, '_blank');
        
        // Dispatch custom event for analytics/logging
        const event = new CustomEvent('album-spotify-search', {
            detail: {
                album: this.album,
                searchQuery: searchQuery,
                url: spotifyUrl
            },
            bubbles: true
        });
        
        this.element.dispatchEvent(event);
    }

    /**
     * Get the primary artist name for display
     * @returns {string} Primary artist name
     */
    getPrimaryArtist() {
        // Handle both Supabase format (artist) and legacy format (artists array)
        if (this.album.artist) {
            return this.album.artist;
        }
        
        if (!this.album.artists || this.album.artists.length === 0) {
            return 'Unknown Artist';
        }
        
        // Return the first artist from legacy format
        const firstArtist = this.album.artists[0];
        return typeof firstArtist === 'string' ? firstArtist : firstArtist.name || 'Unknown Artist';
    }

    /**
     * Get formatted artists display string
     * @returns {string} Formatted artists string
     */
    getArtistsDisplay() {
        // Handle both Supabase format (artist) and legacy format (artists array)
        if (this.album.artist) {
            return this.album.artist;
        }
        
        if (!this.album.artists || this.album.artists.length === 0) {
            return 'Unknown Artist';
        }

        const artistNames = this.album.artists.map(artist => 
            typeof artist === 'string' ? artist : artist.name || 'Unknown'
        );

        if (artistNames.length === 1) {
            return artistNames[0];
        } else if (artistNames.length === 2) {
            return `${artistNames[0]} & ${artistNames[1]}`;
        } else if (artistNames.length > 2) {
            return `${artistNames[0]} & ${artistNames.length - 1} others`;
        }

        return 'Unknown Artist';
    }

    /**
     * Get formatted genre and style tags HTML
     * @returns {string} HTML string with genre and style tags
     */
    getGenreStyleTags() {
        const tags = [];
        
        // Add genres
        if (this.album.genres && Array.isArray(this.album.genres)) {
            tags.push(...this.album.genres);
        }
        
        // Add styles  
        if (this.album.styles && Array.isArray(this.album.styles)) {
            tags.push(...this.album.styles);
        }
        
        // Remove duplicates and limit to maximum 4 tags to avoid overcrowding
        const uniqueTags = [...new Set(tags)].slice(0, 4);
        
        if (uniqueTags.length === 0) {
            return '';
        }
        
        // Generate HTML for each tag
        const tagHtml = uniqueTags.map(tag => 
            `<span class="genre-tag" title="${tag}">${tag}</span>`
        ).join('');
        
        return `<div class="genre-tags-container">${tagHtml}</div>`;
    }

    /**
     * Get cover image URL with fallback
     * @returns {string} Cover image URL
     */
    getCoverImageUrl() {
        if (this.album.images && this.album.images.length > 0) {
            // Prefer medium size, fallback to first available
            const mediumImage = this.album.images.find(img => img.type === 'primary' && img.width >= 200);
            if (mediumImage) return mediumImage.uri;
            
            // Fallback to first image
            return this.album.images[0].uri || this.album.images[0];
        }
        
        // Default placeholder - return empty string to trigger onerror
        return '';
    }

    /**
     * Update the card with new album data
     * @param {Object} newAlbumData Updated album data
     */
    update(newAlbumData) {
        this.album = { ...this.album, ...newAlbumData };
        
        if (this.element) {
            // Re-render the card
            const parent = this.element.parentNode;
            const newElement = this.render();
            parent.replaceChild(newElement, this.element);
        }
    }

    /**
     * Remove the card from DOM
     */
    destroy() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
    }

    /**
     * Get the album data
     * @returns {Object} Album data
     */
    getAlbumData() {
        return this.album;
    }

    /**
     * Check if card matches search/filter criteria
     * @param {string} searchTerm Search term to match against
     * @returns {boolean} Whether card matches criteria
     */
    matchesSearch(searchTerm) {
        if (!searchTerm) return true;
        
        const term = searchTerm.toLowerCase();
        const title = (this.album.title || '').toLowerCase();
        const artist = this.getPrimaryArtist().toLowerCase();
        const year = (this.album.year || '').toString();
        
        return title.includes(term) || 
               artist.includes(term) || 
               year.includes(term);
    }

    /**
     * Enable selection mode on this card
     */
    enableSelectionMode() {
        this.selectionMode = true;
        if (this.element) {
            this.element.classList.add('selection-mode');
            this.addSelectionCheckbox();
            this.setupSelectionEvents();
        }
    }

    /**
     * Disable selection mode on this card
     */
    disableSelectionMode() {
        this.selectionMode = false;
        this.selected = false;
        if (this.element) {
            this.element.classList.remove('selection-mode', 'selected');
            this.removeSelectionCheckbox();
            this.removeSelectionEvents();
        }
    }

    /**
     * Set selection state
     * @param {boolean} selected - Whether card should be selected
     */
    setSelected(selected) {
        this.selected = selected;
        if (this.element) {
            if (selected) {
                this.element.classList.add('selected');
            } else {
                this.element.classList.remove('selected');
            }
            
            const checkbox = this.element.querySelector('.selection-checkbox');
            if (checkbox) {
                if (selected) {
                    checkbox.classList.add('checked');
                } else {
                    checkbox.classList.remove('checked');
                }
            }
        }
    }

    /**
     * Add selection checkbox to existing card
     */
    addSelectionCheckbox() {
        if (!this.element || this.element.querySelector('.selection-checkbox')) return;
        
        const albumCover = this.element.querySelector('.album-cover');
        if (albumCover) {
            const checkbox = document.createElement('div');
            checkbox.className = `selection-checkbox ${this.selected ? 'checked' : ''}`;
            checkbox.setAttribute('data-album-id', this.album.id);
            albumCover.insertBefore(checkbox, albumCover.firstChild);
        }
    }

    /**
     * Remove selection checkbox from card
     */
    removeSelectionCheckbox() {
        if (!this.element) return;
        const checkbox = this.element.querySelector('.selection-checkbox');
        if (checkbox) {
            checkbox.remove();
        }
    }

    /**
     * Setup selection event listeners
     */
    setupSelectionEvents() {
        if (!this.element) return;
        
        const checkbox = this.element.querySelector('.selection-checkbox');
        if (checkbox) {
            checkbox.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleSelection();
            });
        }
        
        // Also allow clicking on the card itself in selection mode
        this.element.addEventListener('click', (e) => {
            if (this.selectionMode && !e.target.closest('.overlay-action-btn, .card-edit-btn')) {
                e.preventDefault();
                e.stopPropagation();
                this.toggleSelection();
            }
        });
    }

    /**
     * Remove selection event listeners
     */
    removeSelectionEvents() {
        // Remove the click listener by cloning the element
        // This is a simple way to remove all event listeners
        if (this.element && this.selectionMode) {
            const newElement = this.element.cloneNode(true);
            this.element.parentNode?.replaceChild(newElement, this.element);
            this.element = newElement;
        }
    }

    /**
     * Toggle selection state
     */
    toggleSelection() {
        this.setSelected(!this.selected);
        if (this.onSelectionChange) {
            this.onSelectionChange(this.album.id, this.selected);
        }
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.AlbumCard = AlbumCard;
}
