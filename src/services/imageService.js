// ImageService - Handles fetching artist images with a more robust Wikipedia approach
class ImageService {
    constructor() {
        this.cache = new Map(); // Cache for fetched images
        this.requestDelay = 2000; // 2 second delay between requests to external APIs
        this.retryDelay = 5000; // 5 seconds delay for retries on failed requests
        this.maxRetries = 2; // Max retries for a single request
        
        // Headers for external API calls, including a User-Agent as good practice
        this.headers = {
            'User-Agent': 'AlbumsCollectionApp/1.0 (https://your-app-website.com; your-email@example.com)' 
            // Replace with your actual app website/email for better API etiquette
        };

        // Artist name disambiguation mapping for correct Wikipedia pages
        // Keys should be normalized (no special chars, lowercase) to match normalizeArtistName output
        this.artistNameMappings = {
            'john robinson 2': 'John Robinson (drummer)',
            'chris potter 2': 'Chris Potter (jazz saxophonist)', 
            'richard davis 2': 'Richard Davis (bassist)'
        };

        console.log('🖼️ ImageService initialized with direct Wikipedia approach');
    }

    /**
     * Main method to fetch artist image.
     * Prioritizes Wikipedia, then falls back to placeholders.
     * @param {string} artistName - The name of the artist.
     * @returns {Promise<string|null>} The URL of the artist image or null if not found.
     */
    async fetchArtistImage(artistName) {
        if (!artistName || typeof artistName !== 'string' || artistName.trim() === '') {
            console.warn('🖼️ Invalid artist name provided:', artistName);
            return null;
        }

        const normalizedName = this.normalizeArtistName(artistName);
        
        // Check cache first
        if (this.cache.has(normalizedName)) {
            console.log(`🖼️ Image found in cache for: ${artistName}`);
            return this.cache.get(normalizedName);
        }

        console.log(`🖼️ Fetching image for: ${artistName}`);

        try {
            // Try direct Wikipedia API approach first
            let imageUrl = await this.fetchFromWikipedia(normalizedName);
            
            // If Wikipedia fails, try alternative (placeholder) sources
            if (!imageUrl) {
                console.log(`🖼️ Wikipedia failed for ${artistName}, trying alternative sources...`);
                imageUrl = await this.fetchFromAlternativeSources(normalizedName);
            }

            // Cache the result (even if null to avoid repeated requests)
            this.cache.set(normalizedName, imageUrl);
            
            if (imageUrl) {
                console.log(`✅ Image found for ${artistName}: ${imageUrl}`);
            } else {
                console.log(`❌ No image found for ${artistName}`);
            }

            return imageUrl;

        } catch (error) {
            console.error(`❌ Error fetching image for ${artistName}:`, error);
            this.cache.set(normalizedName, null); // Cache null to avoid retries on error
            return null;
        }
    }

   /**
     * Fetch artist image directly from Wikipedia API.
     * This method now performs a search first to find the correct page title,
     * then queries the REST API's page/summary endpoint for the image.
     * @param {string} artistName - The normalized artist name.
     * @returns {Promise<string|null>} The image URL or null.
     */
    async fetchFromWikipedia(artistName) {
        try {
            // Check if we have a specific mapping for this artist (using normalized name)
            const mappedName = this.artistNameMappings[artistName];
            const searchTerm = mappedName || artistName;
            
            console.log(`🖼️ Searching for: ${artistName}${mappedName ? ` (mapped to: ${mappedName})` : ''}`);
            
            // Step 1: Search for the artist on Wikipedia to get relevant page titles
            // Increased srlimit to get more results for better prioritization  
            const searchApiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(searchTerm)}&srlimit=5&format=json&origin=*`; // Increased srlimit to 5
            
            console.log(`🖼️ Step 1: Searching Wikipedia for: ${searchTerm}`);
            const searchResponse = await this.makeRequestWithRetry(searchApiUrl, {
                method: 'GET',
                headers: this.headers
            });

            if (!searchResponse || !searchResponse.query || !searchResponse.query.search || searchResponse.query.search.length === 0) {
                console.log(`🖼️ No Wikipedia search results for ${searchTerm}`);
                return null;
            }

            let pageTitle = null;
            const searchResults = searchResponse.query.search;

            // If we have a mapped name, prioritize exact matches with that name
            if (mappedName) {
                for (const result of searchResults) {
                    if (result.title.toLowerCase() === mappedName.toLowerCase()) {
                        pageTitle = result.title;
                        break;
                    }
                }
            }
            
            // If no exact match found for mapped name, use standard prioritization
            if (!pageTitle) {
                const priorityKeywords = ['(musician)', '(band)', '(singer)', '(rapper)', '(composer)', '(group)'];
                
                for (const result of searchResults) {
                    const title = result.title;
                    // Check for exact match or title containing searchTerm with a priority keyword
                    if (title.toLowerCase() === searchTerm.toLowerCase() || 
                        priorityKeywords.some(keyword => title.toLowerCase().includes(keyword))) {
                        pageTitle = title;
                        break; // Found a prioritized title, use this one
                    }
                }
            }

            // If no prioritized title found, fall back to the first result
            if (!pageTitle) {
                pageTitle = searchResults[0].title;
            }

            console.log(`🖼️ Selected Wikipedia page title: "${pageTitle}" for ${artistName}${mappedName ? ` (mapped from ${mappedName})` : ''}`);

            // Step 2: Use Wikipedia REST API's page/summary to get thumbnail
            const restApiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`;
            
            console.log(`🖼️ Step 2: Fetching summary for Wikipedia page: "${pageTitle}"`);
            const summaryResponse = await this.makeRequestWithRetry(restApiUrl, {
                method: 'GET',
                headers: this.headers
            });

            if (summaryResponse && summaryResponse.thumbnail && summaryResponse.thumbnail.source) {
                // Get higher resolution image if available (e.g., 400px width)
                const imageUrl = summaryResponse.thumbnail.source.replace(/\/\d+px-/, '/400px-');
                console.log(`🖼️ Wikipedia image found via summary: ${imageUrl}`);
                return imageUrl;
            }

            return null;

        } catch (error) {
            console.warn(`🖼️ Direct Wikipedia fetch failed for ${artistName}:`, error.message);
            return null;
        }
    }

    /**
     * Generate a consistent hash for an artist name.
     * Used for seeding placeholder images.
     * @param {string} artistName - The artist name.
     * @returns {string} A consistent hash.
     */
    generateImageHash(artistName) {
        let hash = 0;
        for (let i = 0; i < artistName.length; i++) {
            const char = artistName.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(36);
    }

    /**
     * Make HTTP request with retry logic and exponential backoff.
     * @param {string} url - The URL to fetch.
     * @param {object} options - Fetch options.
     * @param {number} retryCount - Current retry attempt.
     * @returns {Promise<object|null>} JSON response data or null on failure.
     */
    async makeRequestWithRetry(url, options = {}, retryCount = 0) {
        try {
            const response = await fetch(url, options);
            
            if (!response.ok) {
                // Handle 429 (Too Many Requests) specifically
                if (response.status === 429 && retryCount < this.maxRetries) {
                    const waitTime = this.retryDelay * Math.pow(2, retryCount); // Exponential backoff
                    console.warn(`🖼️ Rate limited (429), retrying in ${waitTime}ms...`);
                    await this.sleep(waitTime);
                    return this.makeRequestWithRetry(url, options, retryCount + 1);
                }
                // For other HTTP errors, throw to be caught below
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();

        } catch (error) {
            // Retry on network errors or other non-429 errors up to maxRetries
            if (retryCount < this.maxRetries && error.name !== 'TypeError') { // TypeError often indicates CORS block or malformed URL
                const waitTime = this.retryDelay * Math.pow(2, retryCount);
                console.warn(`🖼️ Request failed, retrying in ${waitTime}ms...`, error.message);
                await this.sleep(waitTime);
                return this.makeRequestWithRetry(url, options, retryCount + 1);
            }
            // If max retries reached or unrecoverable error, re-throw
            throw error;
        }
    }

    /**
     * Normalize artist name for consistent caching and API queries.
     * @param {string} name - The artist name.
     * @returns {string} The normalized name.
     */
    normalizeArtistName(name) {
        if (!name || typeof name !== 'string') {
            return 'unknown';
        }
        
        return name
            .toLowerCase()
            .trim()
            .replace(/[^\w\s]/g, '') // Remove special characters
            .replace(/\s+/g, ' '); // Normalize whitespace
    }

    /**
     * Utility function to pause execution.
     * @param {number} ms - Milliseconds to sleep.
     * @returns {Promise<void>}
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Batch process artist image requests with rate limiting.
     * @param {Array<object|string>} artists - Array of artist objects or names.
     * @param {Function} updateCallback - Callback to update artist object with image.
     * @returns {Promise<Array<object>>} Results of the batch processing.
     */
    async batchProcessArtists(artists, updateCallback) {
        if (!Array.isArray(artists) || artists.length === 0) {
            console.log('🖼️ No artists to process');
            return [];
        }

        console.log(`🖼️ Starting batch processing for ${artists.length} artists`);
        
        let processed = 0;
        const results = [];

        for (const artist of artists) {
            try {
                // Ensure we have a valid artist name
                const artistName = artist?.name || artist;
                if (!artistName) {
                    console.warn('🖼️ Skipping artist with no name:', artist);
                    continue;
                }

                const imageUrl = await this.fetchArtistImage(artistName);
                
                if (imageUrl && updateCallback) {
                    // Update the artist with the new image
                    if (typeof artist === 'object' && artist !== null) {
                        artist.image = imageUrl;
                        updateCallback(artist, imageUrl);
                    }
                }

                results.push({ artist: artistName, imageUrl, success: !!imageUrl });
                processed++;

                // Progress update
                if (processed % 3 === 0) {
                    console.log(`🖼️ Processed ${processed}/${artists.length} artists`);
                }

                // Rate limiting delay between requests
                // Only apply delay if there are more artists to process
                if (processed < artists.length) {
                    await this.sleep(this.requestDelay);
                }

            } catch (error) {
                console.error(`🖼️ Error processing artist:`, error);
                results.push({ 
                    artist: artist?.name || artist || 'unknown', 
                    imageUrl: null, 
                    success: false, 
                    error: error.message 
                });
                processed++;
            }
        }

        const successCount = results.filter(r => r.success).length;
        console.log(`🖼️ Batch processing complete: ${successCount}/${artists.length} images found`);
        
        return results;
    }

    /**
     * Clear the image cache.
     */
    clearCache() {
        this.cache.clear();
        console.log('🖼️ Image cache cleared');
    }

    /**
     * Get statistics about the image cache.
     * @returns {object} Cache statistics.
     */
    getCacheStats() {
        const totalEntries = this.cache.size;
        const cachedImages = Array.from(this.cache.values()).filter(url => url !== null).length;
        const nullEntries = totalEntries - cachedImages;
        
        return {
            totalEntries,
            cachedImages,
            nullEntries,
            hitRate: totalEntries > 0 ? (cachedImages / totalEntries * 100).toFixed(1) + '%' : '0%'
        };
    }

    /**
     * Test method to verify service is working.
     * @returns {Promise<object>} Test result.
     */
    async testService() {
        console.log('🧪 Testing ImageService...');
        
        try {
            const testArtist = 'Miles Davis';
            console.log(`Testing with artist: ${testArtist}`);
            
            const imageUrl = await this.fetchArtistImage(testArtist);
            
            if (imageUrl) {
                console.log(`✅ Test successful! Found image: ${imageUrl}`);
                return { success: true, imageUrl };
            } else {
                console.log(`⚠️ Test completed but no image found for ${testArtist}`);
                return { success: false, message: 'No image found' };
            }
            
        } catch (error) {
            console.error('❌ Test failed:', error);
            return { success: false, error: error.message };
        }
    }
}

// Make ImageService available globally
window.ImageService = ImageService;

// Auto-test when loaded
if (typeof window !== 'undefined') {
    console.log('🖼️ ImageService loaded successfully');
}
