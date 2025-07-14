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
                            <button class="overlay-circle-btn more-info-btn" title="More Info">
                                ℹ️
                            </button>
                            <button class="overlay-circle-btn spotify-btn" title="Spotify" data-search-query="${this.getSearchQuery()}">
                                🎵
                            </button>
                            <button class="overlay-circle-btn youtube-btn" title="YouTube" data-search-query="${this.getSearchQuery()}">
                                📺
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

        // Only make card clickable for "More Info" when NOT in selection mode
        if (!this.selectionMode) {
            this.element.addEventListener('click', (e) => {
                // Don't trigger if clicking on action buttons or edit buttons
                if (!e.target.closest('.overlay-circle-btn, .card-edit-btn, .selection-checkbox')) {
                    this.handleMoreInfoClick();
                }
            });
        }
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
        // 📺 DEBUG: Add comprehensive logging
        console.log('📺 YOUTUBE DEBUG - Full album object:', this.album);
        console.log('📺 YOUTUBE DEBUG - Album title:', this.album?.title);
        console.log('📺 YOUTUBE DEBUG - Album artist field:', this.album?.artist);
        console.log('📺 YOUTUBE DEBUG - Album artists array:', this.album?.artists);
        
        const primaryArtist = this.getPrimaryArtist();
        console.log('📺 YOUTUBE DEBUG - Primary artist result:', primaryArtist);
        
        if (!this.album || !this.album.title) {
            console.error('📺 YOUTUBE ERROR - Missing album or title data');
            return;
        }
        
        if (!primaryArtist || primaryArtist === 'Unknown Artist') {
            console.error('📺 YOUTUBE ERROR - getPrimaryArtist() returned null/undefined/Unknown Artist');
            return;
        }
        
        const searchQuery = `${this.album.title} ${primaryArtist}`;
        console.log('📺 YOUTUBE DEBUG - Final search query:', searchQuery);
        
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
     * Check if user is on iPhone
     * @returns {boolean} True if on iPhone
     */
    isIPhone() {
        return /iPhone/i.test(navigator.userAgent);
    }

    /**
     * Generate appropriate Spotify URL for device
     * @param {string} searchQuery The search query
     * @returns {string} Spotify URL
     */
    getSpotifyUrl(searchQuery) {
        const encodedQuery = encodeURIComponent(searchQuery);
        
        // For iPhone, use URL format that works better with Spotify app
        if (this.isIPhone()) {
            return `https://open.spotify.com/search/${encodedQuery}`;
        }
        
        // For desktop and other devices, use the albums-specific URL
        return `https://open.spotify.com/search/${encodedQuery}/albums`;
    }

    /**
     * Handle "Spotify" button click - opens Spotify search
     */
    handleSpotifyClick() {
        // 🎵 DEBUG: Add comprehensive logging
        console.log('🎵 SPOTIFY DEBUG - Full album object:', this.album);
        console.log('🎵 SPOTIFY DEBUG - Album title:', this.album?.title);
        console.log('🎵 SPOTIFY DEBUG - Album artist field:', this.album?.artist);
        console.log('🎵 SPOTIFY DEBUG - Album artists array:', this.album?.artists);
        
        const primaryArtist = this.getPrimaryArtist();
        console.log('🎵 SPOTIFY DEBUG - Primary artist result:', primaryArtist);
        
        if (!this.album || !this.album.title) {
            console.error('🎵 SPOTIFY ERROR - Missing album or title data');
            return;
        }
        
        if (!primaryArtist || primaryArtist === 'Unknown Artist') {
            console.error('🎵 SPOTIFY ERROR - getPrimaryArtist() returned null/undefined/Unknown Artist');
            return;
        }
        
        const searchQuery = `${primaryArtist} ${this.album.title}`;
        console.log('🎵 SPOTIFY DEBUG - Final search query:', searchQuery);
        
        const spotifyUrl = this.getSpotifyUrl(searchQuery);
        
        console.log('🎵 Opening Spotify search for:', searchQuery);
        console.log('🔗 Spotify URL:', spotifyUrl);
        console.log('📱 iPhone detected:', this.isIPhone());
        
        // Open Spotify search in new tab
        window.open(spotifyUrl, '_blank');
        
        // Dispatch custom event for analytics/logging
        const event = new CustomEvent('album-spotify-search', {
            detail: {
                album: this.album,
                searchQuery: searchQuery,
                url: spotifyUrl,
                isIPhone: this.isIPhone()
            },
            bubbles: true
        });
        
        this.element.dispatchEvent(event);
    }

    /**
     * Generate search query for Spotify/YouTube buttons
     * @returns {string} Search query string
     */
    getSearchQuery() {
        if (!this.album || !this.album.title) {
            console.error('🔍 getSearchQuery() - Missing album or title data');
            return '';
        }
        
        const primaryArtist = this.getPrimaryArtist();
        if (!primaryArtist || primaryArtist === 'Unknown Artist') {
            console.error('🔍 getSearchQuery() - Invalid primary artist:', primaryArtist);
            return this.album.title; // Return just title if no valid artist
        }
        
        const searchQuery = `${primaryArtist} ${this.album.title}`;
        console.log('🔍 getSearchQuery() - Generated search query:', searchQuery);
        return searchQuery;
    }

    /**
     * Get the primary artist name for display
     * @returns {string} Primary artist name
     */
    getPrimaryArtist() {
        // 🎯 DEBUG: Add comprehensive logging  
        console.log('🎯 getPrimaryArtist() - Input album:', this.album);
        
        if (!this.album) {
            console.error('🎯 getPrimaryArtist() - No album object');
            return 'Unknown Artist';
        }
        
        // Handle both Supabase format (artist) and legacy format (artists array)
        if (this.album.artist) {
            console.log('🎯 getPrimaryArtist() - Found artist field:', this.album.artist);
            return this.album.artist;
        }
        
        if (!this.album.artists || this.album.artists.length === 0) {
            console.log('🎯 getPrimaryArtist() - No artists array, returning Unknown Artist');
            return 'Unknown Artist';
        }
        
        // Return the first artist from legacy format
        const firstArtist = this.album.artists[0];
        const result = typeof firstArtist === 'string' ? firstArtist : firstArtist.name || 'Unknown Artist';
        console.log('🎯 getPrimaryArtist() - Found artists array, returning:', result);
        return result;
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
            // Re-initialize event listeners to remove "More Info" click handler
            this.reinitializeEventListeners();
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
            // Re-initialize event listeners to restore "More Info" click handler
            this.reinitializeEventListeners();
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
        
        // In selection mode, clicking anywhere on the card should toggle selection
        this.element.addEventListener('click', (e) => {
            // Don't trigger if clicking on buttons
            if (!e.target.closest('.overlay-circle-btn, .card-edit-btn')) {
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
     * Re-initialize all event listeners based on current mode
     */
    reinitializeEventListeners() {
        if (!this.element) return;
        
        // Clone element to remove all existing event listeners
        const newElement = this.element.cloneNode(true);
        this.element.parentNode?.replaceChild(newElement, this.element);
        this.element = newElement;
        
        // Re-setup event listeners based on current mode
        this.setupEventListeners();
        
        // If in selection mode, also setup selection events
        if (this.selectionMode) {
            this.setupSelectionEvents();
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