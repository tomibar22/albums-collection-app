/**
 * Data Service - Unified interface for different backend storage options
 * Supports both Supabase and Google Sheets backends
 */
class DataService {
    constructor() {
        this.backend = window.CONFIG.DATA_BACKEND || 'supabase';
        this.service = null;
        this.initialized = false;
        
        console.log(`🔧 DataService configured for: ${this.backend}`);
    }

    async initialize() {
        if (this.initialized) return;

        try {
            // Initialize the appropriate backend service
            if (this.backend === 'sheets') {
                console.log('📊 Initializing Google Sheets backend...');
                this.service = new GoogleSheetsServiceV2();
            } else if (this.backend === 'supabase') {
                console.log('🗄️ Initializing Supabase backend...');
                this.service = new SupabaseService();
            } else {
                throw new Error(`Unknown backend: ${this.backend}`);
            }

            await this.service.initialize();
            this.initialized = true;
            
            console.log(`✅ DataService initialized with ${this.backend} backend`);
        } catch (error) {
            console.error(`❌ DataService initialization failed:`, error);
            throw error;
        }
    }

    // ==================== UNIFIED ALBUM OPERATIONS ====================

    async getAllAlbums() {
        this.ensureInitialized();
        return await this.service.getAllAlbums();
    }

    async getAlbumsCount() {
        this.ensureInitialized();
        
        // If service has dedicated count method, use it
        if (this.service.getAlbumsCount) {
            return await this.service.getAlbumsCount();
        }
        
        // Otherwise, get all albums and return count (fallback)
        const albums = await this.service.getAllAlbums();
        return albums ? albums.length : 0;
    }

    async getAlbumsAfterTimestamp(timestamp) {
        this.ensureInitialized();
        
        // If service has efficient timestamp filtering, use it
        if (this.service.getAlbumsAfterTimestamp) {
            return await this.service.getAlbumsAfterTimestamp(timestamp);
        }
        
        // Otherwise, fallback to getAllAlbums and filter (less efficient)
        console.log('⚠️ Using fallback timestamp filtering - consider implementing getAlbumsAfterTimestamp() in service');
        
        // Convert timestamp to UTC for consistent comparison
        let compareTimestamp;
        if (typeof timestamp === 'number') {
            compareTimestamp = new Date(timestamp);
        } else {
            compareTimestamp = new Date(timestamp);
        }
        
        console.log(`📅 Fallback: Filtering albums after ${compareTimestamp.toISOString()}`);
        
        const allAlbums = await this.service.getAllAlbums();
        return allAlbums.filter(album => {
            const albumDate = new Date(album.created_at || album.timestamp || 0);
            return albumDate > compareTimestamp;
        }).sort((a, b) => {
            const dateA = new Date(a.created_at || a.timestamp || 0);
            const dateB = new Date(b.created_at || b.timestamp || 0);
            return dateB - dateA; // Newest first
        });
    }

    async getNewestAlbums(count) {
        this.ensureInitialized();
        
        // If service has efficient newest albums method, use it
        if (this.service.getNewestAlbums) {
            return await this.service.getNewestAlbums(count);
        }
        
        // Otherwise, fallback to getAllAlbums and sort (less efficient)
        console.log(`⚠️ Using fallback newest albums - getting ${count} most recent`);
        
        const allAlbums = await this.service.getAllAlbums();
        
        // Sort by created_at descending (newest first) and take requested count
        return allAlbums
            .sort((a, b) => {
                const dateA = new Date(a.created_at || a.timestamp || 0);
                const dateB = new Date(b.created_at || b.timestamp || 0);
                return dateB - dateA; // Newest first
            })
            .slice(0, count);
    }

    async addAlbum(albumData) {
        this.ensureInitialized();
        return await this.service.addAlbum(albumData);
    }

    async updateAlbum(albumId, updateData) {
        this.ensureInitialized();
        return await this.service.updateAlbum(albumId, updateData);
    }

    async deleteAlbum(albumId) {
        this.ensureInitialized();
        return await this.service.deleteAlbum(albumId);
    }

    // ==================== SCRAPED HISTORY OPERATIONS ====================

    async getScrapedArtistsHistory() {
        this.ensureInitialized();
        return await this.service.getScrapedArtistsHistory();
    }

    async addScrapedArtist(artistData) {
        this.ensureInitialized();
        return await this.service.addScrapedArtist(artistData);
    }

    // ==================== UTILITY METHODS ====================

    ensureInitialized() {
        if (!this.initialized) {
            throw new Error('DataService not initialized. Call initialize() first.');
        }
    }

    getBackendInfo() {
        return {
            backend: this.backend,
            initialized: this.initialized,
            service: this.service?.constructor?.name || 'Unknown'
        };
    }
}

// Export for use in app
window.DataService = DataService;