// Supabase Service for Albums Collection App
class SupabaseService {
    constructor() {
        this.client = null;
        this.initialized = false;
        this.debug = window.CONFIG?.DEBUG?.LOG_SUPABASE || false;
        
        this.init();
    }

    async init() {
        try {
            // Check if Supabase is available
            if (typeof window.supabase === 'undefined') {
                console.error('❌ Supabase client not loaded. Please include the Supabase JS library.');
                return;
            }

            const config = window.CONFIG.SUPABASE;
            if (!config.URL || !config.ANON_KEY) {
                console.warn('⚠️ Supabase configuration not yet available. Will initialize after user credentials are applied.');
                return;
            }

            // Initialize Supabase client
            this.client = window.supabase.createClient(config.URL, config.ANON_KEY);
            this.initialized = true;

            if (this.debug) {
                console.log('✅ Supabase service initialized');
                console.log('🔗 URL:', config.URL);
                console.log('🔑 Key:', config.ANON_KEY.substring(0, 20) + '...');
            }

            // Test connection
            await this.testConnection();

        } catch (error) {
            console.error('❌ Failed to initialize Supabase service:', error);
            this.initialized = false;
        }
    }

    /**
     * DataService compatibility method - ensures service is initialized
     */
    async initialize() {
        if (!this.initialized) {
            await this.init();
        }
        return this.initialized;
    }

    /**
     * Reinitialize Supabase service after credentials are applied
     */
    async reinitialize() {
        console.log('🔄 Reinitializing Supabase service with user credentials...');
        this.initialized = false;
        await this.init();
        return this.initialized;
    }

    async testConnection() {
        if (!this.initialized) {
            throw new Error('Supabase service not initialized');
        }

        try {
            const { data, error } = await this.client
                .from(window.CONFIG.SUPABASE.TABLES.COLLECTIONS)
                .select('id')
                .limit(1);

            if (error) throw error;

            if (this.debug) {
                console.log('✅ Supabase connection test successful');
            }
            return true;
        } catch (error) {
            console.error('❌ Supabase connection test failed:', error);
            throw error;
        }
    }

    // ===============================
    // ALBUM OPERATIONS
    // ===============================

    async addAlbum(albumData) {
        if (!this.initialized) throw new Error('Supabase service not initialized');

        try {
            if (this.debug) {
                console.log('📀 Adding album to Supabase:', albumData.title);
            }

            // Insert album
            const { data: album, error: albumError } = await this.client
                .from(window.CONFIG.SUPABASE.TABLES.ALBUMS)
                .insert({
                    id: albumData.id,
                    title: albumData.title,
                    year: albumData.year,
                    artist: albumData.artist,
                    role: albumData.role,
                    type: albumData.type || 'release',
                    genres: albumData.genres || [],
                    styles: albumData.styles || [],
                    formats: albumData.formats || [],
                    images: albumData.images || [],
                    tracklist: albumData.tracklist || [],
                    track_count: albumData.trackCount || 0,
                    credits: albumData.credits || [],
                    cover_image: albumData.images?.[0]?.uri || null,
                    formatted_year: albumData.year?.toString() || null
                })
                .select()
                .single();

            if (albumError) throw albumError;

            // Process relationships
            // PHASE 1a: Disable relationship processing for BOTH scrapers
            // await this.processAlbumRelationships(album.id, albumData);

            if (this.debug) {
                console.log('✅ Album added successfully:', album.title);
            }

            return album;
        } catch (error) {
            console.error('❌ Failed to add album:', error);
            throw error;
        }
    }

    // PHASE 2B: Commented out unused relationship processing methods
    /*
    async processAlbumRelationships(albumId, albumData) {
        // Process artists
        if (albumData.credits && albumData.credits.length > 0) {
            await this.processAlbumCredits(albumId, albumData.credits);
        }

        // Process tracks
        if (albumData.tracklist && albumData.tracklist.length > 0) {
            await this.processAlbumTracks(albumId, albumData.tracklist);
        }
    }
    */

    /*
    async processAlbumCredits(albumId, credits) {
        try {
            for (const credit of credits) {
                // Ensure artist exists
                const artistId = await this.ensureArtist(credit.name);
                
                // Ensure role exists
                const roleId = await this.ensureRole(credit.role);

                // Create album-artist relationship
                await this.client
                    .from(window.CONFIG.SUPABASE.TABLES.ALBUM_ARTISTS)
                    .upsert({
                        album_id: albumId,
                        artist_id: artistId,
                        role: credit.role,
                        track_title: credit.trackTitle || null,
                        track_position: credit.trackPosition || null,
                        source: credit.source || 'album'
                    });

                // Create artist-role relationship
                await this.client
                    .from(window.CONFIG.SUPABASE.TABLES.ARTIST_ROLES)
                    .upsert({
                        artist_id: artistId,
                        role_id: roleId,
                        frequency: 1
                    }, {
                        onConflict: 'artist_id,role_id',
                        ignoreDuplicates: false
                    });
            }
        } catch (error) {
            console.error('❌ Failed to process album credits:', error);
            throw error;
        }
    }
    */

    /*
    async processAlbumTracks(albumId, tracklist) {
        try {
            for (const track of tracklist) {
                // Ensure track exists
                const trackId = await this.ensureTrack(track.title);

                // Create album-track relationship
                await this.client
                    .from(window.CONFIG.SUPABASE.TABLES.ALBUM_TRACKS)
                    .upsert({
                        album_id: albumId,
                        track_id: trackId,
                        position: track.position,
                        duration: track.duration || null,
                        side: this.extractSide(track.position),
                        track_number: this.extractTrackNumber(track.position)
                    });
            }
        } catch (error) {
            console.error('❌ Failed to process album tracks:', error);
            throw error;
        }
    }
    */

    // ===============================
    // ARTIST OPERATIONS (UNUSED - Phase 2B cleanup)
    // ===============================

    /*
    async ensureArtist(artistName) {
        if (!artistName) throw new Error('Artist name is required');

        try {
            // Sanitize artist name for safer querying
            const sanitizedName = this.sanitizeForQuery(artistName);
            
            // Check if artist exists
            const { data: existingArtist, error: selectError } = await this.client
                .from(window.CONFIG.SUPABASE.TABLES.ARTISTS)
                .select('id')
                .eq('name', sanitizedName)
                .maybeSingle(); // Use maybeSingle instead of single to avoid errors for no matches

            if (existingArtist) {
                return existingArtist.id;
            }

            // Create new artist
            const { data: newArtist, error: insertError } = await this.client
                .from(window.CONFIG.SUPABASE.TABLES.ARTISTS)
                .insert({
                    name: sanitizedName,
                    album_count: 0,
                    roles: [],
                    musical_roles: [],
                    technical_roles: [],
                    total_appearances: 0
                })
                .select('id')
                .single();

            if (insertError) throw insertError;

            return newArtist.id;
        } catch (error) {
            console.error('❌ Failed to ensure artist:', artistName, error);
            throw error;
        }
    }
    */

    // ===============================
    // TRACK OPERATIONS (UNUSED - Phase 2B cleanup)
    // ===============================

    /*
    async ensureTrack(trackTitle) {
        if (!trackTitle) throw new Error('Track title is required');

        try {
            // Sanitize track title for safer querying
            const sanitizedTitle = this.sanitizeForQuery(trackTitle);
            
            // Check if track exists
            const { data: existingTrack, error: selectError } = await this.client
                .from(window.CONFIG.SUPABASE.TABLES.TRACKS)
                .select('id')
                .eq('title', sanitizedTitle)
                .maybeSingle(); // Use maybeSingle instead of single to avoid errors for no matches

            if (existingTrack) {
                return existingTrack.id;
            }

            // Create new track
            const { data: newTrack, error: insertError } = await this.client
                .from(window.CONFIG.SUPABASE.TABLES.TRACKS)
                .insert({
                    title: sanitizedTitle,
                    frequency: 0
                })
                .select('id')
                .single();

            if (insertError) {
                throw insertError;
            }

            return newTrack.id;

        } catch (error) {
            console.error(`❌ Failed to ensure track "${trackTitle}":`, error);
            throw error;
        }
    }
    */

    // ===============================
    // ROLE OPERATIONS (UNUSED - Phase 2B cleanup)
    // ===============================

    /*
    async ensureRole(roleName) {
        if (!roleName) throw new Error('Role name is required');

        try {
            // Clean role name
            const cleanedRole = this.cleanRoleName(roleName);
            const sanitizedRole = this.sanitizeForQuery(cleanedRole);
            const category = this.categorizeRole(cleanedRole);

            // Check if role exists
            const { data: existingRole, error: selectError } = await this.client
                .from(window.CONFIG.SUPABASE.TABLES.ROLES)
                .select('id')
                .eq('name', sanitizedRole)
                .maybeSingle(); // Use maybeSingle instead of single to avoid errors for no matches

            if (existingRole) {
                return existingRole.id;
            }

            // Create new role
            const { data: newRole, error: insertError } = await this.client
                .from(window.CONFIG.SUPABASE.TABLES.ROLES)
                .insert({
                    name: sanitizedRole,
                    raw_name: roleName,
                    category: category,
                    frequency: 1,
                    artist_count: 1
                })
                .select('id')
                .single();

            if (insertError) throw insertError;

            return newRole.id;
        } catch (error) {
            console.error('❌ Failed to ensure role:', roleName, error);
            throw error;
        }
    }
    */

    /*
    // ===============================
    // ROLE OPERATIONS (DUPLICATE - Phase 2B cleanup)
    // ===============================

    async ensureRole(roleName) {
        if (!roleName) throw new Error('Role name is required');

        try {
            // Clean role name
            const cleanedRole = this.cleanRoleName(roleName);
            const sanitizedRole = this.sanitizeForQuery(cleanedRole);
            const category = this.categorizeRole(cleanedRole);

            // Check if role exists
            const { data: existingRole, error: selectError } = await this.client
                .from(window.CONFIG.SUPABASE.TABLES.ROLES)
                .select('id')
                .eq('name', sanitizedRole)
                .maybeSingle(); // Use maybeSingle instead of single to avoid errors for no matches

            if (existingRole) {
                return existingRole.id;
            }

            // Create new role
            const { data: newRole, error: insertError } = await this.client
                .from(window.CONFIG.SUPABASE.TABLES.ROLES)
                .insert({
                    name: sanitizedRole,
                    raw_name: roleName,
                    category: category,
                    frequency: 1,
                    artist_count: 1
                })
                .select('id')
                .single();

            if (insertError) throw insertError;

            return newRole.id;
        } catch (error) {
            console.error('❌ Failed to ensure role:', roleName, error);
            throw error;
        }
    }
    */

    // ===============================
    // COLLECTION OPERATIONS
    // ===============================

    /**
     * DataService compatibility method - alias for getAlbums()
     */
    async getAllAlbums() {
        return await this.getAlbums();
    }

    /**
     * Get albums count for efficient counting operations
     */
    async getAlbumsCount() {
        if (!this.initialized) throw new Error('Supabase service not initialized');

        try {
            const { data, error, count } = await this.client
                .from(window.CONFIG.SUPABASE.TABLES.ALBUMS)
                .select('id', { count: 'exact', head: true });

            if (error) throw error;

            if (this.debug) {
                console.log(`📊 Album count from Supabase: ${count}`);
            }

            return count || 0;
        } catch (error) {
            console.error('❌ Failed to get albums count:', error);
            throw error;
        }
    }

    /**
     * Get albums created after a specific timestamp - much more efficient than getAllAlbums()
     */
    async getAlbumsAfterTimestamp(timestamp) {
        if (!this.initialized) throw new Error('Supabase service not initialized');

        try {
            // Convert timestamp to UTC ISO string for consistent comparison
            // Handle both epoch milliseconds and ISO strings
            let utcTimestamp;
            if (typeof timestamp === 'number') {
                // Epoch milliseconds - convert to UTC ISO string
                utcTimestamp = new Date(timestamp).toISOString();
            } else if (typeof timestamp === 'string') {
                // Already a string - ensure it's properly formatted
                utcTimestamp = new Date(timestamp).toISOString();
            } else {
                throw new Error('Invalid timestamp format - must be number (epoch) or ISO string');
            }
            
            console.log(`📅 Fetching albums created after: ${utcTimestamp} (from input: ${timestamp})`);
            console.log(`📅 Current UTC time: ${new Date().toISOString()}`);
            
            const { data: albums, error } = await this.client
                .from(window.CONFIG.SUPABASE.TABLES.ALBUMS)
                .select('*')
                .gt('created_at', utcTimestamp)
                .order('created_at', { ascending: false }); // Newest first

            if (error) throw error;

            console.log(`📈 Found ${albums?.length || 0} albums created after cache timestamp`);
            return albums || [];
            
        } catch (error) {
            console.error('❌ Failed to get albums after timestamp:', error);
            throw error;
        }
    }

    /**
     * Get the newest N albums - optimized for cache fallback scenarios
     */
    async getNewestAlbums(count) {
        if (!this.initialized) throw new Error('Supabase service not initialized');

        try {
            console.log(`📈 Fetching ${count} newest albums from database`);
            
            const { data: albums, error } = await this.client
                .from(window.CONFIG.SUPABASE.TABLES.ALBUMS)
                .select('*')
                .order('created_at', { ascending: false }) // Newest first
                .limit(count);

            if (error) throw error;

            console.log(`📈 Retrieved ${albums?.length || 0} newest albums`);
            return albums || [];
            
        } catch (error) {
            console.error('❌ Failed to get newest albums:', error);
            throw error;
        }
    }

    async getAlbums() {
        if (!this.initialized) {
            console.error('❌ Supabase service not initialized!');
            throw new Error('Supabase service not initialized');
        }

        console.log('📚 Loading all albums from Supabase...');

        try {
            const startTime = performance.now();

            // First, get total count
            const { count: totalCount, error: countError } = await this.client
                .from(window.CONFIG.SUPABASE.TABLES.ALBUMS)
                .select('*', { count: 'exact', head: true });

            if (countError) throw countError;

            console.log(`📊 Total albums: ${totalCount}`);

            // Load in batches of 2000, 4 at a time (limited parallelism)
            const batchSize = 2000;
            const concurrency = 4;
            const numBatches = Math.ceil(totalCount / batchSize);
            let allAlbums = [];

            for (let wave = 0; wave < numBatches; wave += concurrency) {
                const wavePromises = [];

                for (let i = wave; i < Math.min(wave + concurrency, numBatches); i++) {
                    const start = i * batchSize;
                    const end = start + batchSize - 1;

                    wavePromises.push(
                        this.client
                            .from(window.CONFIG.SUPABASE.TABLES.ALBUMS)
                            .select('*')
                            .range(start, end)
                    );
                }

                console.log(`📦 Loading wave ${Math.floor(wave/concurrency) + 1}/${Math.ceil(numBatches/concurrency)} (${wavePromises.length} batches)...`);
                const results = await Promise.all(wavePromises);

                for (const result of results) {
                    if (result.error) throw result.error;
                    if (result.data) {
                        allAlbums = allAlbums.concat(result.data);
                    }
                }

                console.log(`✓ ${allAlbums.length}/${totalCount} albums loaded`);
            }

            const duration = ((performance.now() - startTime) / 1000).toFixed(2);
            console.log(`✅ Loaded ${allAlbums.length} albums in ${duration}s`);

            return allAlbums;
        } catch (error) {
            console.error('❌ Failed to get albums:', error);
            throw error;
        }
    }

    /*
    async getArtists() {
        if (!this.initialized) throw new Error('Supabase service not initialized');

        try {
            const { data: artists, error } = await this.client
                .from(window.CONFIG.SUPABASE.TABLES.ARTISTS)
                .select('*')
                .order('album_count', { ascending: false });

            if (error) throw error;

            if (this.debug) {
                console.log(`🎤 Retrieved ${artists.length} artists from Supabase`);
            }

            return artists;
        } catch (error) {
            console.error('❌ Failed to get artists:', error);
            throw error;
        }
    }
    */

    /*
    async getTracks() {
        if (!this.initialized) throw new Error('Supabase service not initialized');

        try {
            const { data: tracks, error } = await this.client
                .from(window.CONFIG.SUPABASE.TABLES.TRACKS)
                .select('*')
                .order('frequency', { ascending: false });

            if (error) throw error;

            if (this.debug) {
                console.log(`🎵 Retrieved ${tracks.length} tracks from Supabase`);
            }

            return tracks;
        } catch (error) {
            console.error('❌ Failed to get tracks:', error);
            throw error;
        }
    }
    */

    /*
    async getRoles() {
        if (!this.initialized) throw new Error('Supabase service not initialized');

        try {
            const { data: roles, error } = await this.client
                .from(window.CONFIG.SUPABASE.TABLES.ROLES)
                .select('*')
                .order('artist_count', { ascending: false });

            if (error) throw error;

            if (this.debug) {
                console.log(`🎭 Retrieved ${roles.length} roles from Supabase`);
            }

            return roles;
        } catch (error) {
            console.error('❌ Failed to get roles:', error);
            throw error;
        }
    }
    */

    // ===============================
    // HELPER METHODS
    // ===============================

    // Helper function to clean role names by removing brackets for musical roles only
    cleanRoleName(roleName, shouldCleanBrackets = null) {
        if (!roleName || typeof roleName !== 'string') return roleName;
        
        // Determine if we should clean brackets based on role category
        if (shouldCleanBrackets === null) {
            shouldCleanBrackets = this.shouldCleanRoleBrackets(roleName);
        }
        
        let cleaned = roleName;
        
        // Only remove brackets for musical roles
        if (shouldCleanBrackets) {
            cleaned = cleaned.replace(/\s*\[.*?\]/g, '');
        }
        
        return cleaned.trim();
    }

    // Helper function to determine if brackets should be cleaned from a role
    shouldCleanRoleBrackets(roleName) {
        if (!roleName || typeof roleName !== 'string') return false;
        
        // Use role categorizer to determine if this is a musical or technical role
        if (window.roleCategorizer) {
            // For categorization, temporarily remove brackets to get the core role
            const coreRole = roleName.replace(/\s*\[.*?\]/g, '').trim();
            const category = window.roleCategorizer.categorizeRole(coreRole);
            
            // Only clean brackets for musical roles
            return category === 'musical';
        }
        
        // Fallback: default to cleaning brackets (preserve existing behavior)
        return true;
    }

    categorizeRole(roleName) {
        // Import role categorizer if available
        if (window.RoleCategorizer) {
            return window.RoleCategorizer.categorizeRole(roleName);
        }
        
        // Fallback simple categorization
        const musicalRoles = ['Piano', 'Guitar', 'Bass', 'Drums', 'Vocals', 'Saxophone', 'Trumpet'];
        return musicalRoles.some(role => roleName.toLowerCase().includes(role.toLowerCase())) 
            ? 'musical' : 'technical';
    }

    extractSide(position) {
        if (!position) return null;
        const match = position.match(/^([A-Z])/);
        return match ? match[1] : null;
    }

    extractTrackNumber(position) {
        if (!position) return null;
        const match = position.match(/(\d+)$/);
        return match ? parseInt(match[1]) : null;
    }

    // ===============================
    // UTILITY METHODS
    // ===============================

    sanitizeForQuery(text) {
        if (!text) return text;
        
        const original = text;
        
        // Handle special characters that cause 406 errors in Supabase queries
        const sanitized = text
            .replace(/\+/g, ' ')        // Convert + back to spaces
            .replace(/&/g, 'and')       // Convert & to "and" 
            .replace(/'/g, "")          // Remove apostrophes entirely to avoid SQL issues
            .replace(/"/g, '')          // Remove double quotes entirely
            .replace(/%27/g, '')        // Remove URL-encoded apostrophes
            .replace(/%22/g, '')        // Remove URL-encoded quotes
            .replace(/%20/g, ' ')       // Convert URL-encoded spaces back to spaces
            .replace(/%26/g, 'and')     // Convert URL-encoded & to "and"
            .replace(/[^\w\s-]/g, '')   // Remove any remaining special characters except word chars, spaces, and hyphens
            .replace(/\s+/g, ' ')       // Normalize multiple spaces to single space
            .trim();                    // Remove leading/trailing spaces
        
        if (this.debug && original !== sanitized) {
            console.log(`🧹 Sanitized query: "${original}" → "${sanitized}"`);
        }
        
        return sanitized;
    }

    async clearAllData() {
        if (!this.initialized) throw new Error('Supabase service not initialized');

        try {
            // Delete in order of dependencies
            await this.client.from(window.CONFIG.SUPABASE.TABLES.ALBUM_ARTISTS).delete().gte('id', 0);
            await this.client.from(window.CONFIG.SUPABASE.TABLES.ALBUM_TRACKS).delete().gte('id', 0);
            await this.client.from(window.CONFIG.SUPABASE.TABLES.ARTIST_ROLES).delete().gte('id', 0);
            await this.client.from(window.CONFIG.SUPABASE.TABLES.ALBUMS).delete().gte('id', 0);
            await this.client.from(window.CONFIG.SUPABASE.TABLES.ARTISTS).delete().gte('id', 0);
            await this.client.from(window.CONFIG.SUPABASE.TABLES.TRACKS).delete().gte('id', 0);
            await this.client.from(window.CONFIG.SUPABASE.TABLES.ROLES).delete().gte('id', 0);

            console.log('🗑️ All data cleared from Supabase');
        } catch (error) {
            console.error('❌ Failed to clear data:', error);
            throw error;
        }
    }

    // ===============================
    // UPDATE OPERATIONS
    // ===============================

    async updateAlbum(albumId, updates) {
        if (!this.initialized) throw new Error('Supabase service not initialized');

        try {
            if (this.debug) {
                console.log('📝 Updating album in Supabase:', albumId, updates);
            }

            // For performance, just update the main album record
            // Skip expensive relationship processing for basic edits
            const { data, error } = await this.client
                .from(window.CONFIG.SUPABASE.TABLES.ALBUMS)
                .update({
                    title: updates.title,
                    year: updates.year,
                    artist: updates.artist,
                    genres: updates.genres || [],
                    styles: updates.styles || [],
                    tracklist: updates.tracklist || [],
                    track_count: updates.trackCount || 0,
                    credits: updates.credits || [],
                    cover_image: updates.coverImage || null,
                    formatted_year: updates.year?.toString() || null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', albumId)
                .select()
                .single();

            if (error) throw error;

            if (this.debug) {
                console.log('✅ Album updated in Supabase:', data);
            }

            return data;
        } catch (error) {
            console.error('❌ Failed to update album:', error);
            throw error;
        }
    }

    // Heavy relationship processing (for new albums only)
    async updateAlbumWithRelationships(albumId, updates) {
        if (!this.initialized) throw new Error('Supabase service not initialized');

        try {
            if (this.debug) {
                console.log('📝 Updating album with full relationships:', albumId, updates);
            }

            // First update the main album record
            const { data, error } = await this.client
                .from(window.CONFIG.SUPABASE.TABLES.ALBUMS)
                .update({
                    title: updates.title,
                    year: updates.year,
                    artist: updates.artist,
                    genres: updates.genres || [],
                    styles: updates.styles || [],
                    tracklist: updates.tracklist || [],
                    track_count: updates.trackCount || 0,
                    credits: updates.credits || [],
                    cover_image: updates.coverImage || null,
                    formatted_year: updates.year?.toString() || null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', albumId)
                .select()
                .single();

            if (error) throw error;

            // Clear existing relationships for this album
            await this.clearAlbumRelationships(albumId);

            // Recreate relationships if we have new credits or tracklist
            if (updates.credits || updates.tracklist) {
                const albumData = {
                    credits: updates.credits || [],
                    tracklist: updates.tracklist || []
                };
                await this.processAlbumRelationships(albumId, albumData);
            }

            if (this.debug) {
                console.log('✅ Album updated with relationships:', data);
            }

            return data;
        } catch (error) {
            console.error('❌ Failed to update album with relationships:', error);
            throw error;
        }
    }

    // Clear all relationships for a specific album
    async clearAlbumRelationships(albumId) {
        if (!this.initialized) throw new Error('Supabase service not initialized');

        try {
            if (this.debug) {
                console.log('🧹 Clearing relationships for album:', albumId);
            }

            // Clear album-artist relationships
            await this.client
                .from(window.CONFIG.SUPABASE.TABLES.ALBUM_ARTISTS)
                .delete()
                .eq('album_id', albumId);

            // Clear album-track relationships
            await this.client
                .from(window.CONFIG.SUPABASE.TABLES.ALBUM_TRACKS)
                .delete()
                .eq('album_id', albumId);

            if (this.debug) {
                console.log('✅ Album relationships cleared');
            }
        } catch (error) {
            console.error('❌ Failed to clear album relationships:', error);
            throw error;
        }
    }

    async updateArtist(artistId, updates) {
        if (!this.initialized) throw new Error('Supabase service not initialized');

        try {
            if (this.debug) {
                console.log('📝 Updating artist in Supabase:', artistId, updates);
            }

            const { data, error } = await this.client
                .from(window.CONFIG.SUPABASE.TABLES.ARTISTS)
                .update({
                    name: updates.name,
                    image: updates.image || null,
                    roles: updates.roles || [],
                    musical_roles: updates.musicalRoles || [],
                    technical_roles: updates.technicalRoles || [],
                    most_common_role: updates.mostCommonRole || null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', artistId)
                .select()
                .single();

            if (error) throw error;

            if (this.debug) {
                console.log('✅ Artist updated in Supabase:', data);
            }

            return data;
        } catch (error) {
            console.error('❌ Failed to update artist:', error);
            throw error;
        }
    }

    async updateTrack(trackId, updates) {
        if (!this.initialized) throw new Error('Supabase service not initialized');

        try {
            if (this.debug) {
                console.log('📝 Updating track in Supabase:', trackId, updates);
            }

            const { data, error } = await this.client
                .from(window.CONFIG.SUPABASE.TABLES.TRACKS)
                .update({
                    title: updates.title,
                    duration: updates.duration || null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', trackId)
                .select()
                .single();

            if (error) throw error;

            if (this.debug) {
                console.log('✅ Track updated in Supabase:', data);
            }

            return data;
        } catch (error) {
            console.error('❌ Failed to update track:', error);
            throw error;
        }
    }

    async updateRole(roleId, updates) {
        if (!this.initialized) throw new Error('Supabase service not initialized');

        try {
            if (this.debug) {
                console.log('📝 Updating role in Supabase:', roleId, updates);
            }

            const { data, error } = await this.client
                .from(window.CONFIG.SUPABASE.TABLES.ROLES)
                .update({
                    name: updates.name,
                    raw_name: updates.rawName || null,
                    category: updates.category,
                    updated_at: new Date().toISOString()
                })
                .eq('id', roleId)
                .select()
                .single();

            if (error) throw error;

            if (this.debug) {
                console.log('✅ Role updated in Supabase:', data);
            }

            return data;
        } catch (error) {
            console.error('❌ Failed to update role:', error);
            throw error;
        }
    }

    // ===============================
    // DELETE OPERATIONS
    // ===============================

    async deleteAlbum(albumId) {
        if (!this.initialized) throw new Error('Supabase service not initialized');

        try {
            if (this.debug) {
                console.log('🗑️ Deleting album from Supabase:', albumId);
            }

            // Delete album record
            const { data, error } = await this.client
                .from(window.CONFIG.SUPABASE.TABLES.ALBUMS)
                .delete()
                .eq('id', albumId)
                .select();

            if (error) {
                console.error('❌ Supabase DELETE error:', error);
                throw error;
            }

            if (data && data.length === 0) {
                console.warn('⚠️ No rows were deleted - album ID may not exist:', albumId);
                return false;
            }

            if (this.debug) {
                console.log('✅ Album deleted from Supabase:', albumId);
            }

            return true;
        } catch (error) {
            console.error('❌ Failed to delete album:', error);
            throw error;
        }
    }

    async deleteArtist(artistId) {
        if (!this.initialized) throw new Error('Supabase service not initialized');

        try {
            if (this.debug) {
                console.log('🗑️ Deleting artist from Supabase:', artistId);
            }

            const { error } = await this.client
                .from(window.CONFIG.SUPABASE.TABLES.ARTISTS)
                .delete()
                .eq('id', artistId);

            if (error) throw error;

            if (this.debug) {
                console.log('✅ Artist deleted from Supabase:', artistId);
            }

            return true;
        } catch (error) {
            console.error('❌ Failed to delete artist:', error);
            throw error;
        }
    }

    async deleteTrack(trackId) {
        if (!this.initialized) throw new Error('Supabase service not initialized');

        try {
            if (this.debug) {
                console.log('🗑️ Deleting track from Supabase:', trackId);
            }

            const { error } = await this.client
                .from(window.CONFIG.SUPABASE.TABLES.TRACKS)
                .delete()
                .eq('id', trackId);

            if (error) throw error;

            if (this.debug) {
                console.log('✅ Track deleted from Supabase:', trackId);
            }

            return true;
        } catch (error) {
            console.error('❌ Failed to delete track:', error);
            throw error;
        }
    }

    async deleteRole(roleId) {
        if (!this.initialized) throw new Error('Supabase service not initialized');

        try {
            if (this.debug) {
                console.log('🗑️ Deleting role from Supabase:', roleId);
            }

            const { error } = await this.client
                .from(window.CONFIG.SUPABASE.TABLES.ROLES)
                .delete()
                .eq('id', roleId);

            if (error) throw error;

            if (this.debug) {
                console.log('✅ Role deleted from Supabase:', roleId);
            }

            return true;
        } catch (error) {
            console.error('❌ Failed to delete role:', error);
            throw error;
        }
    }

    async getStats() {
        if (!this.initialized) throw new Error('Supabase service not initialized');

        try {
            const [albumsCount, artistsCount, tracksCount, rolesCount] = await Promise.all([
                this.client.from(window.CONFIG.SUPABASE.TABLES.ALBUMS).select('id', { count: 'exact' }),
                this.client.from(window.CONFIG.SUPABASE.TABLES.ARTISTS).select('id', { count: 'exact' }),
                this.client.from(window.CONFIG.SUPABASE.TABLES.TRACKS).select('id', { count: 'exact' }),
                this.client.from(window.CONFIG.SUPABASE.TABLES.ROLES).select('id', { count: 'exact' })
            ]);

            return {
                albums: albumsCount.count || 0,
                artists: artistsCount.count || 0,
                tracks: tracksCount.count || 0,
                roles: rolesCount.count || 0
            };
        } catch (error) {
            console.error('❌ Failed to get stats:', error);
            throw error;
        }
    }

    // ===== SCRAPED ARTISTS HISTORY METHODS =====
    
    async addScrapedArtist(artistData) {
        if (!this.initialized) throw new Error('Supabase service not initialized');

        try {
            const { data, error } = await this.client
                .from(window.CONFIG.SUPABASE.TABLES.SCRAPED_ARTISTS_HISTORY)
                .insert([{
                    artist_name: artistData.artist_name,
                    discogs_id: artistData.discogs_id,
                    search_query: artistData.search_query,
                    albums_found: artistData.albums_found,
                    albums_added: artistData.albums_added,
                    success: artistData.success,
                    notes: artistData.notes,
                    scraped_at: new Date().toISOString()
                }])
                .select();

            if (error) throw error;

            if (this.debug) {
                console.log(`📋 Added scraped artist to history: ${artistData.artist_name}`);
            }

            return data[0];
        } catch (error) {
            console.error('❌ Failed to add scraped artist to history:', error);
            throw error;
        }
    }
    
    async getScrapedArtistsHistory() {
        if (!this.initialized) throw new Error('Supabase service not initialized');

        try {
            const { data: history, error } = await this.client
                .from(window.CONFIG.SUPABASE.TABLES.SCRAPED_ARTISTS_HISTORY)
                .select('*')
                .order('scraped_at', { ascending: false });

            if (error) {
                console.error('❌ Failed to get scraped artists history:', error);
                return []; // Crucial: Return an empty array on error
            }

            if (this.debug) {
                console.log(`📋 Retrieved ${history ? history.length : 0} scraped artists from history`);
            }

            return history || []; // Crucial: Return empty array if data is null
        } catch (error) {
            console.error('❌ Failed to get scraped artists history:', error);
            return []; // Crucial: Return an empty array if an unexpected error occurs
        }
    }

    async isArtistAlreadyScraped(artistName, discogsId = null) {
        if (!this.initialized) throw new Error('Supabase service not initialized');

        try {
            let data = [];
            let error = null;

            if (discogsId) {
                // Try both artist name and discogs ID
                const result = await this.client
                    .from(window.CONFIG.SUPABASE.TABLES.SCRAPED_ARTISTS_HISTORY)
                    .select('*')
                    .or(`artist_name.eq."${artistName}",discogs_id.eq.${discogsId}`)
                    .limit(1);
                
                data = result.data;
                error = result.error;
            } else {
                // Just search by artist name
                const result = await this.client
                    .from(window.CONFIG.SUPABASE.TABLES.SCRAPED_ARTISTS_HISTORY)
                    .select('*')
                    .eq('artist_name', artistName)
                    .limit(1);
                
                data = result.data;
                error = result.error;
            }

            if (error) throw error;

            return data && data.length > 0 ? data[0] : null;
        } catch (error) {
            console.error('❌ Failed to check if artist already scraped:', error);
            throw error;
        }
    }

    async clearScrapedHistory() {
        if (!this.initialized) throw new Error('Supabase service not initialized');

        try {
            const { error } = await this.client
                .from(window.CONFIG.SUPABASE.TABLES.SCRAPED_ARTISTS_HISTORY)
                .delete()
                .neq('id', 0); // Delete all records

            if (error) throw error;

            if (this.debug) {
                console.log('📋 Cleared all scraped artists history');
            }

            return true;
        } catch (error) {
            console.error('❌ Failed to clear scraped history:', error);
            throw error;
        }
    }
}

// Initialize and export globally
window.SupabaseService = SupabaseService;
