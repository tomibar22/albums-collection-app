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