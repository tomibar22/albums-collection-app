// Data Parser Module
// Converts Discogs API responses to our data models with filtering logic from prototype

class DiscogsDataParser {
    constructor() {
        this.config = window.CONFIG;
        this.filters = this.config.FILTERS;
    }

    /**
     * Check if formats contain any filter words (from prototype)
     */
    hasFilteredWords(formats) {
        if (!formats || !Array.isArray(formats)) return false;
        
        for (const fmt of formats) {
            // Check all values in the format dictionary
            for (const [key, value] of Object.entries(fmt)) {
                if (typeof value === 'string') {
                    if (this.filters.EXCLUDE_WORDS.some(word => 
                        value.toLowerCase().includes(word.toLowerCase())
                    )) {
                        return true;
                    }
                } else if (Array.isArray(value)) {
                    // Check if value is a list (like descriptions)
                    for (const item of value) {
                        if (typeof item === 'string' && 
                            this.filters.EXCLUDE_WORDS.some(word => 
                                item.toLowerCase().includes(word.toLowerCase())
                            )) {
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }

    /**
     * Check if formats contain "Album" or "LP" (from prototype)
     */
    hasAlbumOrLpFormat(formats) {
        if (!formats || !Array.isArray(formats)) {
            if (window.CONFIG.DEBUG.ENABLED) {
                console.log(`   📝 No formats array provided`);
            }
            return false;
        }
        
        if (window.CONFIG.DEBUG.ENABLED) {
            console.log(`   📝 Checking ${formats.length} format entries:`, formats);
        }
        
        for (const fmt of formats) {
            if (window.CONFIG.DEBUG.ENABLED) {
                console.log(`   📝 Format entry:`, fmt);
            }
            
            // Check all values in the format dictionary
            for (const [key, value] of Object.entries(fmt)) {
                if (typeof value === 'string') {
                    const foundKeyword = this.filters.ALBUM_KEYWORDS.find(keyword => 
                        value.toLowerCase().includes(keyword.toLowerCase())
                    );
                    if (foundKeyword) {
                        if (window.CONFIG.DEBUG.ENABLED) {
                            console.log(`   ✅ Found album keyword "${foundKeyword}" in ${key}: "${value}"`);
                        }
                        return true;
                    }
                } else if (Array.isArray(value)) {
                    // Check if value is a list (like descriptions)
                    for (const item of value) {
                        if (typeof item === 'string') {
                            const foundKeyword = this.filters.ALBUM_KEYWORDS.find(keyword => 
                                item.toLowerCase().includes(keyword.toLowerCase())
                            );
                            if (foundKeyword) {
                                if (window.CONFIG.DEBUG.ENABLED) {
                                    console.log(`   ✅ Found album keyword "${foundKeyword}" in ${key} array: "${item}"`);
                                }
                                return true;
                            }
                        }
                    }
                }
            }
            
            // Also check if the format name itself indicates an album
            // Sometimes formats are just { "name": "Vinyl" } without descriptions
            if (fmt.name && typeof fmt.name === 'string') {
                const formatName = fmt.name.toLowerCase();
                // Common album format names
                if (formatName.includes('vinyl') || formatName.includes('cd') || 
                    formatName.includes('cassette') || formatName.includes('digital')) {
                    if (window.CONFIG.DEBUG.ENABLED) {
                        console.log(`   ⚠️ Found potential album format name: "${fmt.name}" - being lenient`);
                    }
                    // Be more lenient - if it's a common physical format, likely an album
                    // We'll do additional checks later
                    return true;
                }
            }
        }
        
        if (window.CONFIG.DEBUG.ENABLED) {
            console.log(`   ❌ No album/LP keywords found in any format`);
        }
        return false;
    }

    /**
     * Filter release based on prototype logic
     */
    shouldIncludeRelease(release, releaseData = null) {
        const title = release.title || '';
        const formats = releaseData?.formats || release.formats || [];

        // Filter out records with unwanted format words
        if (this.hasFilteredWords(formats)) {
            if (window.CONFIG.DEBUG.ENABLED) {
                console.log(`🚫 Filtered out '${title}' due to format keywords`);
            }
            return false;
        }

        // Filter out titles containing "/" if enabled
        if (this.filters.EXCLUDE_SLASH_IN_TITLE && title.includes('/')) {
            if (window.CONFIG.DEBUG.ENABLED) {
                console.log(`🚫 Filtered out '${title}' due to slash in title`);
            }
            return false;
        }

        // Only keep releases with "Album" or "LP" in formats
        if (!this.hasAlbumOrLpFormat(formats)) {
            if (window.CONFIG.DEBUG.ENABLED) {
                console.log(`🚫 Filtered out '${title}' - not an Album/LP format`);
            }
            return false;
        }

        // Filter out releases without valid year
        const year = releaseData?.year || release.year;
        if (!year || year === 0) {
            if (window.CONFIG.DEBUG.ENABLED) {
                console.log(`🚫 Filtered out '${title}' - no valid year (year: ${year})`);
            }
            return false;
        }

        // Filter out releases with "Various" artists (compilations)
        if (this.filters.EXCLUDE_VARIOUS_ARTISTS) {
            const artist = releaseData?.artists?.[0]?.name || release.artist || '';
            if (artist.toLowerCase().includes('various')) {
                if (window.CONFIG.DEBUG.ENABLED) {
                    console.log(`🚫 Filtered out '${title}' - Various Artists compilation (artist: ${artist})`);
                }
                return false;
            }
        }

        return true;
    }

    /**
     * Extract roles by removing brackets and splitting bracketed content
     */
    extractExpandedRoles(roleString) {
        if (!roleString || typeof roleString !== 'string') {
            return [];
        }
        
        const roles = [];
        
        // Check if role has brackets
        const bracketMatch = roleString.match(/^([^[]+)\s*\[([^\]]+)\](.*)$/);
        
        if (bracketMatch) {
            // Has brackets: "Synthesizer [Oberheim, Prophet V]"
            const mainRole = bracketMatch[1].trim(); // "Synthesizer"
            const bracketContent = bracketMatch[2].trim(); // "Oberheim, Prophet V" 
            const suffix = bracketMatch[3].trim(); // anything after brackets
            
            // Add main role
            if (mainRole) {
                roles.push(mainRole);
            }
            
            // Split bracketed content by commas and add each as separate role
            const bracketRoles = bracketContent.split(',').map(r => r.trim()).filter(r => r);
            roles.push(...bracketRoles);
            
            // Add suffix if exists
            if (suffix) {
                roles.push(suffix);
            }
        } else {
            // No brackets: treat as simple role
            roles.push(roleString.trim());
        }
        
        return roles.filter(role => role); // Remove empty roles
    }

    /**
     * Smart role splitting that first expands brackets, then handles commas
     */
    smartSplitRoles(roleString) {
        if (!roleString || typeof roleString !== 'string') {
            return [];
        }
        
        const allRoles = [];
        
        // First split by commas at the top level
        const commaSeparatedParts = [];
        let current = '';
        let bracketDepth = 0;
        
        for (let i = 0; i < roleString.length; i++) {
            const char = roleString[i];
            
            if (char === '[') {
                bracketDepth++;
                current += char;
            } else if (char === ']') {
                bracketDepth--;
                current += char;
            } else if (char === ',' && bracketDepth === 0) {
                if (current.trim()) {
                    commaSeparatedParts.push(current.trim());
                }
                current = '';
            } else {
                current += char;
            }
        }
        
        if (current.trim()) {
            commaSeparatedParts.push(current.trim());
        }
        
        // Now expand each part (extract main role + bracketed content)
        commaSeparatedParts.forEach(part => {
            const expandedRoles = this.extractExpandedRoles(part);
            allRoles.push(...expandedRoles);
        });
        
        return allRoles;
    }

    /**
     * Parse smart roles from credits (bracket-aware comma splitting)
     */
    parseRoles(credits) {
        const roles = [];
        
        if (!Array.isArray(credits)) return roles;

        credits.forEach(credit => {
            if (credit.role) {
                // Use smart splitting that respects bracket boundaries
                const roleNames = this.smartSplitRoles(credit.role);
                
                roleNames.forEach(roleName => {
                    if (roleName) {
                        roles.push({
                            name: credit.name || 'Unknown Artist',
                            role: roleName,
                            id: credit.id || null
                        });
                    }
                });
            } else {
                // If no specific role, default to the role from release
                roles.push({
                    name: credit.name || 'Unknown Artist',
                    role: 'Contributor',
                    id: credit.id || null
                });
            }
        });

        return roles;
    }

    /**
     * Parse tracklist data
     */
    parseTracklist(tracklist) {
        if (!Array.isArray(tracklist)) return [];

        return tracklist.map((track, index) => ({
            position: track.position || (index + 1).toString(),
            title: track.title || `Track ${index + 1}`,
            duration: track.duration || null,
            type_: track.type_ || 'track'
        }));
    }

    /**
     * Parse comprehensive credits from both album-level and track-level sources
     * Groups credits by artist name and adds track context for track-specific roles
     */
    parseComprehensiveCredits(releaseData) {
        const creditsMap = new Map(); // artist name -> credit info
        const trackData = new Map(); // role -> array of track info
        
        // Helper to add a credit to the map
        const addCredit = (name, role, source, trackInfo = null) => {
            if (!creditsMap.has(name)) {
                creditsMap.set(name, {
                    name: name,
                    roles: new Map(), // role -> track info array
                    id: null
                });
            }
            
            const artistCredit = creditsMap.get(name);
            if (!artistCredit.roles.has(role)) {
                artistCredit.roles.set(role, []);
            }
            
            if (trackInfo) {
                artistCredit.roles.get(role).push(trackInfo);
            }
        };
        
        // 1. Parse album-level credits (extraartists)
        const albumCredits = this.parseRoles(releaseData.extraartists || []);
        albumCredits.forEach(credit => {
            addCredit(credit.name, credit.role, 'album');
            
            // Store artist ID for the first occurrence
            if (credit.id && creditsMap.has(credit.name)) {
                creditsMap.get(credit.name).id = credit.id;
            }
        });
        
        // 2. Parse track-level credits from each track's extraartists
        const totalTracks = Array.isArray(releaseData.tracklist) ? releaseData.tracklist.length : 0;
        
        if (Array.isArray(releaseData.tracklist)) {
            releaseData.tracklist.forEach((track, trackIndex) => {
                if (Array.isArray(track.extraartists)) {
                    const trackCredits = this.parseRoles(track.extraartists);
                    trackCredits.forEach(credit => {
                        const trackInfo = {
                            title: track.title,
                            position: track.position
                        };
                        
                        addCredit(credit.name, credit.role, 'track', trackInfo);
                        
                        // Store artist ID for the first occurrence
                        if (credit.id && creditsMap.has(credit.name)) {
                            creditsMap.get(credit.name).id = credit.id;
                        }
                    });
                }
            });
        }
        
        // 3. Convert to final credits array with separate album and track roles
        const finalCredits = [];
        
        creditsMap.forEach((artistCredit, artistName) => {
            // First pass: identify album-level roles
            const albumRoles = [];
            const trackRolesCandidates = [];
            
            artistCredit.roles.forEach((trackInfoArray, role) => {
                if (trackInfoArray.length === 0) {
                    // No track context = album-level role
                    albumRoles.push(role);
                } else if (trackInfoArray.length >= totalTracks && totalTracks > 0) {
                    // Appears on ALL tracks = also considered album-level
                    albumRoles.push(role);
                } else {
                    // Potential track-specific role
                    trackRolesCandidates.push({
                        role: role,
                        tracks: trackInfoArray.map(track => ({
                            title: track.title,
                            position: track.position
                        }))
                    });
                }
            });
            
            // Second pass: filter track roles to exclude those already in album roles
            const trackRoles = trackRolesCandidates.filter(trackRole => {
                // Only include track roles that are NOT already in album-level credits
                const isAlreadyInAlbum = albumRoles.includes(trackRole.role);
                if (isAlreadyInAlbum && window.CONFIG.DEBUG.ENABLED) {
                    console.log(`   🔄 Filtered out duplicate role for ${artistName}: "${trackRole.role}" (already in album credits)`);
                }
                return !isAlreadyInAlbum;
            });
            
            // Create consolidated role string without track titles embedded
            const allRoleNames = [];
            
            // Add album-level roles first
            allRoleNames.push(...albumRoles);
            
            // Add track-specific roles (only those not in album roles)
            allRoleNames.push(...trackRoles.map(tr => tr.role));
            
            // Filter out artists who only have composition-only roles
            const compositionOnlyRoles = ['written-by', 'written by', 'composed by', 'composer', 'words by', 'lyrics by', 'lyricist'];
            const hasOnlyCompositionRoles = allRoleNames.length > 0 && 
                allRoleNames.every(role => compositionOnlyRoles.some(compRole => 
                    role.toLowerCase().includes(compRole.toLowerCase())
                ));
            
            if (hasOnlyCompositionRoles) {
                if (window.CONFIG.DEBUG.ENABLED) {
                    console.log(`   🚫 Filtered out composition-only artist: ${artistName} (${allRoleNames.join(', ')})`);
                }
                return; // Skip this artist
            }
            
            // Create a single entry for this artist
            finalCredits.push({
                name: artistName,
                role: allRoleNames.join(', '), // Clean role string without track titles
                id: artistCredit.id,
                albumRoles: albumRoles,
                trackRoles: trackRoles, // Only roles NOT in album credits
                source: trackRoles.length > 0 ? 'mixed' : 'album',
                roleCount: allRoleNames.length
            });
        });
        
        // Sort credits: album-level first, then by artist name
        finalCredits.sort((a, b) => {
            if (a.source !== b.source) {
                return a.source === 'album' ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
        });
        
        if (window.CONFIG.DEBUG.ENABLED && finalCredits.length > 0) {
            console.log(`📝 Parsed ${finalCredits.length} consolidated artist entries (${creditsMap.size} unique artists)`);
            finalCredits.forEach(credit => {
                console.log(`   - ${credit.name}: ${credit.role} (${credit.roleCount} roles)`);
            });
        }
        
        return finalCredits;
    }

    /**
     * Extract year from album title if it contains year patterns
     */
    extractYearFromTitle(title, originalYear) {
        if (!title || typeof title !== 'string') return originalYear;
        
        // Extract all 4-digit year patterns from title
        const yearMatches = title.match(/\b(19[0-9]{2}|20[0-2][0-9])\b/g);
        
        if (!yearMatches || yearMatches.length === 0) return originalYear;
        
        // Convert to numbers and get the earliest year
        const years = yearMatches.map(y => parseInt(y)).filter(y => y >= 1900 && y <= 2025);
        
        if (years.length === 0) return originalYear;
        
        const extractedYear = Math.min(...years);
        
        // If original year looks like a reissue (2010+) and extracted year is historical (pre-2000)
        // prefer the extracted year from the title
        if (originalYear && originalYear > 2010 && extractedYear < 2000) {
            if (window.CONFIG.DEBUG.ENABLED) {
                console.log(`🎭 YEAR EXTRACTED: "${title}" - ${originalYear} → ${extractedYear}`);
            }
            return extractedYear;
        }
        
        return originalYear;
    }

    /**
     * Parse album data from Discogs release
     */
    parseAlbum(releaseData) {
        if (!releaseData) return null;

        const tracklist = this.parseTracklist(releaseData.tracklist || []);
        const credits = this.parseComprehensiveCredits(releaseData);
        
        // Smart year handling - extract from title if needed
        const originalYear = releaseData.year || null;
        const finalYear = this.extractYearFromTitle(releaseData.title, originalYear);

        return {
            id: releaseData.id,
            title: releaseData.title || 'Unknown Title',
            year: finalYear,
            artist: this.extractMainArtist(releaseData.artists), // For backward compatibility
            artists: this.extractArtistsArray(releaseData.artists), // For app.js expectations
            role: this.extractMainRole(releaseData.artists),
            type: releaseData.master_id ? 'master' : 'release',
            
            // Additional metadata
            genres: releaseData.genres || [],
            styles: releaseData.styles || [],
            formats: releaseData.formats || [],
            images: releaseData.images || [],
            
            // Track and credits information
            tracklist: tracklist,
            trackCount: tracklist.length,
            credits: credits,
            
            // Raw data for debugging
            _rawData: window.CONFIG.DEBUG.ENABLED ? releaseData : null
        };
    }

    /**
     * Extract main artist name from artists array
     */
    extractMainArtist(artists) {
        if (!Array.isArray(artists) || artists.length === 0) {
            return 'Unknown Artist';
        }

        // If multiple artists, join with " & "
        if (artists.length > 1) {
            return artists.map(artist => artist.name).join(' & ');
        }

        return artists[0].name || 'Unknown Artist';
    }

    /**
     * Extract artists array for modern app usage
     */
    extractArtistsArray(artists) {
        if (!Array.isArray(artists) || artists.length === 0) {
            return [{ name: 'Unknown Artist' }];
        }

        return artists.map(artist => ({
            name: artist.name || 'Unknown Artist',
            role: artist.role || 'Artist',
            id: artist.id || null
        }));
    }

    /**
     * Extract main role from artists array
     */
    extractMainRole(artists) {
        if (!Array.isArray(artists) || artists.length === 0) {
            return 'Artist';
        }

        return artists[0].role || 'Artist';
    }

    /**
     * Parse artist search results
     */
    parseArtistSearchResults(searchResults) {
        if (!Array.isArray(searchResults)) return [];

        return searchResults.map(artist => ({
            id: artist.id,
            name: artist.title || 'Unknown Artist',
            type: artist.type || 'artist',
            image: artist.cover_image || artist.thumb || null,
            resourceUrl: artist.resource_url || null
        }));
    }

    /**
     * Parse release search results
     */
    parseReleaseSearchResults(searchResults) {
        if (!Array.isArray(searchResults)) return [];

        return searchResults.map(release => ({
            id: release.id,
            title: release.title || 'Unknown Title',
            year: release.year || null,
            type: release.type || 'release',
            format: release.format ? release.format.join(', ') : 'Unknown',
            label: release.label ? release.label.join(', ') : 'Unknown',
            image: release.cover_image || release.thumb || null,
            resourceUrl: release.resource_url || null
        }));
    }

    /**
     * Validate album data meets minimum requirements
     */
    validateAlbumData(albumData) {
        const required = this.config.MODELS.ALBUM.REQUIRED_FIELDS;
        
        for (const field of required) {
            if (!albumData[field]) {
                if (window.CONFIG.DEBUG.ENABLED) {
                    console.warn(`⚠️ Album missing required field: ${field}`, albumData);
                }
                return false;
            }
        }

        return true;
    }

    /**
     * Calculate statistics for debugging and monitoring
     */
    getParsingStats() {
        return {
            filterWords: this.filters.EXCLUDE_WORDS.length,
            albumKeywords: this.filters.ALBUM_KEYWORDS.length,
            slashFilterEnabled: this.filters.EXCLUDE_SLASH_IN_TITLE
        };
    }
}

// Make the class available globally first
window.DiscogsDataParser = DiscogsDataParser;

// Create and export a singleton instance with error handling
try {
    window.discogsParser = new DiscogsDataParser();
    console.log('✅ DiscogsDataParser instance created successfully');
} catch (error) {
    console.error('❌ Failed to create DiscogsDataParser instance:', error);
    window.discogsParser = null;
}

// Also make it available as a module export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DiscogsDataParser;
}

/**
 * Strict artist matching - only matches if artist names are genuinely similar
 * Prevents false matches from common names like "John" matching "John Coltrane"
 */
function isStrictArtistMatch(creditName, normalizedScrapedArtist, originalScrapedArtistName) {
    const normalizedCreditName = creditName.toLowerCase().trim();
    
    console.log(`🔍 STRICT MATCHING: "${creditName}" vs "${originalScrapedArtistName}"`);
    
    // 1. EXACT MATCH (most reliable)
    if (normalizedCreditName === normalizedScrapedArtist) {
        console.log(`   ✅ EXACT MATCH: "${creditName}" === "${originalScrapedArtistName}"`);
        return true;
    }
    
    // 2. CREDIT CONTAINS FULL SCRAPED ARTIST (e.g., "John Coltrane Quartet" contains "John Coltrane")
    if (normalizedCreditName.includes(normalizedScrapedArtist)) {
        // Extra validation: ensure it's not just a partial word match
        const words = normalizedScrapedArtist.split(' ');
        const allWordsPresent = words.every(word => {
            if (word.length <= 2) return true; // Skip short words like "Jr"
            return new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(normalizedCreditName);
        });
        
        if (allWordsPresent) {
            console.log(`   ✅ FULL NAME IN CREDIT: "${creditName}" contains full name "${originalScrapedArtistName}"`);
            return true;
        } else {
            console.log(`   ❌ PARTIAL WORD MATCH REJECTED: "${creditName}" - not all words from "${originalScrapedArtistName}" present as complete words`);
        }
    }
    
    // 3. SCRAPED ARTIST CONTAINS FULL CREDIT (e.g., "John Coltrane" contains "Coltrane")
    // BUT ONLY if credit name is substantial (3+ characters and not common name)
    if (normalizedCreditName.length >= 3 && normalizedScrapedArtist.includes(normalizedCreditName)) {
        // Reject common names that could cause false matches
        const commonNames = [
            'john', 'paul', 'george', 'bill', 'bob', 'mike', 'dave', 'steve', 'jim', 'tom',
            'mary', 'lisa', 'susan', 'karen', 'nancy', 'linda', 'carol', 'sarah', 'donna',
            'smith', 'johnson', 'williams', 'brown', 'jones', 'garcia', 'miller', 'davis',
            'rodriguez', 'martinez', 'hernandez', 'lopez', 'gonzalez', 'wilson', 'anderson',
            'taylor', 'thomas', 'jackson', 'white', 'harris', 'martin', 'thompson', 'lee'
        ];
        
        if (commonNames.includes(normalizedCreditName)) {
            console.log(`   ❌ COMMON NAME REJECTED: "${creditName}" is too common, could cause false matches`);
            return false;
        }
        
        // Check if it's a meaningful word boundary match
        const regex = new RegExp(`\\b${normalizedCreditName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
        if (regex.test(normalizedScrapedArtist)) {
            console.log(`   ⚠️ PARTIAL MATCH ACCEPTED: "${creditName}" found as complete word in "${originalScrapedArtistName}"`);
            return true;
        }
    }
    
    console.log(`   ❌ NO MATCH: "${creditName}" does not match "${originalScrapedArtistName}"`);
    return false;
}

/**
 * Enhanced filtering: Checks if the scraped artist appears in album credits with a PERFORMANCE role
 * (excludes compositional roles like "Written-By", "Composed By" even though they're musical)
 * @param {Object} albumData - Raw Discogs album data
 * @param {string} scrapedArtistName - Name of artist being scraped
 * @returns {boolean} - True if artist has performance role, false otherwise
 */
function hasScrapedArtistMusicalRole(albumData, scrapedArtistName) {
    if (!albumData || !scrapedArtistName) {
        console.log('❌ Missing album data or artist name for musical role check');
        return false;
    }

    // ENHANCED LOGGING for debugging
    console.log(`🔍 CHECKING MUSICAL ROLE for "${scrapedArtistName}" in "${albumData.title || 'Unknown Album'}"`);

    // Normalize artist name for comparison (lowercase, trim)
    const normalizedScrapedArtist = scrapedArtistName.toLowerCase().trim();
    
    // Get all credits from album and tracks
    const allCredits = [];
    
    // Album-level credits
    if (albumData.extraartists && Array.isArray(albumData.extraartists)) {
        albumData.extraartists.forEach(credit => {
            allCredits.push({
                name: credit.name,
                role: credit.role,
                source: 'album'
            });
        });
    }
    
    // Track-level credits
    if (albumData.tracklist && Array.isArray(albumData.tracklist)) {
        albumData.tracklist.forEach(track => {
            if (track.extraartists && Array.isArray(track.extraartists)) {
                track.extraartists.forEach(credit => {
                    allCredits.push({
                        name: credit.name,
                        role: credit.role,
                        source: 'track',
                        trackTitle: track.title
                    });
                });
            }
        });
    }

    // PERFORMANCE roles only (what we want for scraping)
    const performanceRoles = [
        // Instruments - Physical performance
        'piano', 'guitar', 'bass', 'drums', 'saxophone', 'trumpet', 'violin',
        'keyboards', 'synthesizer', 'organ', 'harmonica', 'flute', 'clarinet',
        'trombone', 'percussion', 'cello', 'viola', 'double bass', 'acoustic bass',
        'electric guitar', 'acoustic guitar', 'electric bass', 'acoustic piano',
        'electric piano', 'lead guitar', 'rhythm guitar', 'bass guitar',
        'harmonic', 'harp', 'banjo', 'mandolin', 'ukulele', 'accordion',
        'alto saxophone', 'tenor saxophone', 'soprano saxophone', 'baritone saxophone',
        'french horn', 'tuba', 'piccolo', 'oboe', 'bassoon', 'bagpipes',
        'vibraphone', 'xylophone', 'marimba', 'timpani', 'congas', 'bongos',
        'djembe', 'tabla', 'tambourine', 'shaker', 'maracas', 'cowbell',
        'triangle', 'cymbals', 'gong', 'celeste', 'harmonium', 'mellotron',
        'moog', 'synth', 'cornet', 'flugelhorn', 'euphonium', 'english horn',
        'recorder', 'sitar', 'fiddle', 'harpsichord', 'church organ', 'hammond organ',
        
        // Vocals - Performance
        'vocals', 'lead vocals', 'backing vocals', 'harmony vocals', 'voice',
        'singer', 'vocal', 'lead vocal', 'background vocals', 'harmony',
        'soprano', 'alto', 'tenor', 'baritone', 'bass vocals', 'choir', 'chorus',
        
        // Performance roles
        'performer', 'musician', 'soloist', 'bandleader', 'conductor',
        'musical director'
    ];

    // NON-PERFORMANCE roles to EXCLUDE (compositional, production, etc.)
    const excludedRoles = [
        // COMPOSITIONAL ROLES (musical but not performance) - COMPREHENSIVE LIST
        'written-by', 'written by', 'composer', 'composed by', 'songwriter', 'writer',
        'lyrics by', 'music by', 'words by', 'lyricist', 'text by',
        'composition', 'compositional', 'composition by', 'compositions',
        'original music', 'original music by', 'music composed by',
        'song writer', 'songs written by', 'songs by', 'material by',
        'author', 'authored by', 'copyright', 'publishing',
        
        // ARRANGEMENT ROLES (not performance)
        'arranger', 'arranged by', 'arrangement', 'arrangements',
        'orchestrator', 'orchestrated by', 'orchestration', 'orchestrations',
        'string arrangements', 'horn arrangements', 'vocal arrangements',
        'rhythm arrangements', 'orchestral arrangements', 'arranged and conducted',
        'musical arrangements', 'additional arrangements', 'score',
        'transcription', 'transcribed by', 'adaptation', 'adapted by',
        
        // Production roles
        'producer', 'produced by', 'executive producer', 'co-producer', 
        'associate producer', 'reissue producer', 'executive-producer', 
        'product manager', 'production', 'production coordinator',
        'album producer', 'record producer', 'musical producer',
        
        // Engineering roles
        'engineer', 'engineered by', 'recording engineer', 'mixing engineer', 
        'mastering engineer', 'sound engineer', 'audio engineer', 'mix engineer', 
        'master engineer', 'mixed by', 'mastered by', 'recorded by',
        'remastered by', 'transferred by', 'restoration', 'edited by',
        'assistant engineer', 'recording', 'mixing', 'mastering',
        'digital editing', 'sound design', 'audio editing',
        
        // Design & Documentation
        'photography', 'photographed by', 'design', 'designed by', 'artwork', 
        'illustration', 'illustrated by', 'graphic design', 'layout', 'typography',
        'creative director', 'sleeve design', 'album design', 'cover design',
        'liner notes', 'sleeve notes', 'notes', 'text by', 'booklet editor',
        'concept', 'art direction', 'creative concept',
        
        // Management & Business
        'coordinator', 'management', 'managed by', 'a&r', 'supervisor', 
        'supervised by', 'contractor', 'presenter', 'hosted by', 'legal',
        'copyright', 'rights', 'licensing', 'clearance', 'publisher', 
        'publishing', 'label coordinator', 'project coordinator',
        
        // VOICE SAMPLES & NON-PERFORMANCE VOCALS
        'voice', 'voice [uncredited samples]', 'uncredited samples', 'samples',
        'spoken word', 'speech', 'narrator', 'narration', 'announcement',
        'voice-over', 'voiceover', 'radio announcement', 'spoken introduction',
        'field recording', 'archive recording', 'historical recording',
        
        // CREDITS & ACKNOWLEDGMENTS
        'thanks', 'special thanks', 'acknowledgments', 'acknowledgement',
        'dedication', 'dedicated to', 'in memory of', 'tribute',
        'inspiration', 'inspired by', 'influence', 'consultant',
        
        // TECHNICAL & MISC
        'remastering', 'restoration', 'transfer', 'digitization',
        'compilation', 'compiled by', 'selection', 'selected by',
        'sequencing', 'sequence', 'programming', 'programmed by',
        'sampling', 'sample source', 'source material'
    ];

    // Check if scraped artist appears with PERFORMANCE role
    let foundPerformanceRole = false;
    let foundCredits = [];
    let excludedCredits = [];

    allCredits.forEach(credit => {
        const creditName = credit.name.toLowerCase().trim();
        const creditRole = credit.role.toLowerCase().trim();
        
        // Check if this credit is for the scraped artist - STRICT MATCHING ONLY
        // CRITICAL: We must be absolutely certain the scraped artist appears in credits
        const isArtistMatch = isStrictArtistMatch(creditName, normalizedScrapedArtist, scrapedArtistName);
        
        if (isArtistMatch) {
            foundCredits.push(credit);
            console.log(`🎯 STRICT MATCH FOUND: "${scrapedArtistName}" matches "${credit.name}" → Role: "${credit.role}" (${credit.source})`);
        }
    });

    // MANDATORY CHECK: If no credits found for scraped artist, reject immediately
    if (foundCredits.length === 0) {
        console.log(`❌ MANDATORY REJECTION: "${scrapedArtistName}" not found in ANY credits for "${albumData.title}"`);
        console.log(`📋 All credits in album:`, allCredits.map(c => `"${c.name}" (${c.role})`));
        return false;
    }

    // Now check if any of the found credits have performance roles
    foundPerformanceRole = false; // Reset the existing variable
    excludedCredits = []; // Reset the existing array

    foundCredits.forEach(credit => {
        const creditRole = credit.role.toLowerCase().trim();
        
        // First check if role is explicitly excluded (compositional/technical)
        const isExcludedRole = excludedRoles.some(excludedRole => {
            // Enhanced matching for excluded roles
            const normalizedCreditRole = creditRole.toLowerCase().trim();
            const normalizedExcludedRole = excludedRole.toLowerCase().trim();
            
            // Check for exact match, contains match, or word boundary match
            return normalizedCreditRole === normalizedExcludedRole ||
                   normalizedCreditRole.includes(normalizedExcludedRole) ||
                   // Check if the excluded role appears as a complete word
                   new RegExp(`\\b${normalizedExcludedRole.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(normalizedCreditRole);
        });
        
        if (isExcludedRole) {
            excludedCredits.push(credit);
            console.log(`🚫 EXCLUDED ROLE: "${credit.role}" - matches excluded patterns`);
            return; // Skip this credit
        }
        
        // ENHANCED: Check for any compositional keywords even if not in main list
        const compositionalKeywords = [
            'written', 'wrote', 'composer', 'composition', 'composed', 'songwriter',
            'lyrics', 'lyricist', 'author', 'copyright', 'publishing'
        ];
        
        const hasCompositionalKeyword = compositionalKeywords.some(keyword => 
            creditRole.includes(keyword.toLowerCase())
        );
        
        if (hasCompositionalKeyword) {
            excludedCredits.push(credit);
            console.log(`🚫 COMPOSITIONAL KEYWORD DETECTED: "${credit.role}" - contains compositional terms`);
            return; // Skip this credit
        }
        
        // Check if role is a CONFIRMED performance role - be very strict here
        const isPerformanceRole = performanceRoles.some(performanceRole => {
            // Enhanced matching for performance roles
            const normalizedCreditRole = creditRole.toLowerCase().trim();
            const normalizedPerformanceRole = performanceRole.toLowerCase().trim();
            
            // Must be exact match or start with the performance role
            return normalizedCreditRole === normalizedPerformanceRole ||
                   normalizedCreditRole.startsWith(normalizedPerformanceRole + ' ') ||
                   normalizedCreditRole.startsWith(normalizedPerformanceRole + ',') ||
                   // For compound instruments like "electric guitar", "acoustic piano"
                   normalizedCreditRole.endsWith(' ' + normalizedPerformanceRole) ||
                   // Check if the performance role appears as a complete word
                   new RegExp(`\\b${normalizedPerformanceRole.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(normalizedCreditRole);
        });
        
        if (isPerformanceRole) {
            console.log(`✅ CONFIRMED PERFORMANCE ROLE: "${credit.role}" - ALBUM WILL BE INCLUDED`);
            foundPerformanceRole = true;
        } else {
            // STRICT POLICY: For any unrecognized role, exclude it
            // This ensures only confirmed performance roles are included
            excludedCredits.push(credit);
            console.log(`❓ UNRECOGNIZED/AMBIGUOUS ROLE: "${credit.role}" - EXCLUDING to ensure only performance roles are included`);
        }
    });

    // Summary logging for found credits
    console.log(`📊 SUMMARY for "${albumData.title}":`);
    console.log(`   Credits found for ${scrapedArtistName}: ${foundCredits.length}`);
    console.log(`   Performance roles: ${foundPerformanceRole ? 'YES' : 'NONE'}`);
    console.log(`   Excluded credits: ${excludedCredits.length}`);

    if (!foundPerformanceRole) {
        console.log(`🚫 FINAL DECISION: REJECT "${albumData.title}" - NO PERFORMANCE ROLES FOR ${scrapedArtistName}`);
        console.log(`   All roles found: [${foundCredits.map(c => `"${c.role}"`).join(', ')}]`);
        if (excludedCredits.length > 0) {
            console.log(`   Excluded roles: [${excludedCredits.map(c => `"${c.role}"`).join(', ')}]`);
        }
        return false;
    }

    console.log(`✅ FINAL DECISION: ACCEPT "${albumData.title}" - ${scrapedArtistName} HAS PERFORMANCE ROLE(S)`);
    return true;
}

/**
 * Enhanced shouldIncludeAlbum function with artist musical role check
 * @param {Object} albumData - Raw Discogs album data
 * @param {string} scrapedArtistName - Name of artist being scraped (null for general filtering)
 * @returns {boolean} - True if album should be included
 */
function shouldIncludeAlbumEnhanced(albumData, scrapedArtistName = null) {
    // Use existing parser instance for format filtering
    const parser = window.discogsParser;
    
    // Existing filters (format, filter words, etc.)
    if (!parser.shouldIncludeRelease(albumData, albumData)) {
        return false;
    }

    // NEW: Check if scraped artist has musical role (only when scraping specific artist)
    if (scrapedArtistName) {
        const hasMusicalRole = hasScrapedArtistMusicalRole(albumData, scrapedArtistName);
        if (!hasMusicalRole) {
            console.log(`🚫 FILTERED OUT: "${albumData.title}" - ${scrapedArtistName} has no musical role`);
            return false;
        }
        console.log(`✅ ACCEPTING: "${albumData.title}" - ${scrapedArtistName} has musical role`);
    }

    return true;
}

// Add compatibility functions for existing app.js calls
function shouldIncludeAlbum(albumData) {
    return window.discogsParser.shouldIncludeRelease(albumData, albumData);
}

function parseAlbumData(albumData) {
    return window.discogsParser.parseAlbum(albumData);
}

// Export the enhanced functions
if (typeof window !== 'undefined') {
    // Ensure DiscogsDataParser is available (already done above but double-check)
    if (!window.DiscogsDataParser) {
        window.DiscogsDataParser = DiscogsDataParser;
    }
    
    // Export all functions
    window.hasScrapedArtistMusicalRole = hasScrapedArtistMusicalRole;
    window.shouldIncludeAlbumEnhanced = shouldIncludeAlbumEnhanced;
    window.shouldIncludeAlbum = shouldIncludeAlbum;
    window.parseAlbumData = parseAlbumData;
    window.isStrictArtistMatch = isStrictArtistMatch; // Export the new function too
    
    console.log('✅ All parser functions exported to window');
}