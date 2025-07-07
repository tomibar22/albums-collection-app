// Discogs API Integration Module
// Based on the Jupyter notebook prototype with comprehensive retry logic

class DiscogsAPI {
    constructor() {
        console.log('🔧 NEW DiscogsAPI instance created at:', new Date().toISOString());
        console.log('🔧 CONFIG at constructor time:', {
            hasConfig: !!window.CONFIG,
            hasDiscogs: !!window.CONFIG?.DISCOGS,
            configApiKey: window.CONFIG?.DISCOGS?.API_KEY?.substring(0, 15) + '...' || 'EMPTY'
        });
        
        this.config = window.CONFIG.DISCOGS;
        this.baseUrl = this.config.BASE_URL;
        this._token = this.config.API_KEY; // Private token storage
        this.headers = { ...this.config.HEADERS };
        this.rateLimit = this.config.RATE_LIMIT;
        this.debug = window.CONFIG.DEBUG; // Add debug configuration
        
        // Add token mutation watcher
        Object.defineProperty(this, 'token', {
            get: function() {
                return this._token;
            },
            set: function(newValue) {
                console.log('🚨 TOKEN MUTATION DETECTED:', {
                    oldValue: this._token?.substring(0, 15) + '...' || 'UNDEFINED',
                    newValue: newValue?.substring(0, 15) + '...' || 'UNDEFINED',
                    stackTrace: new Error().stack.split('\n').slice(1, 5),
                    timestamp: new Date().toISOString()
                });
                this._token = newValue;
            }
        });
        
        console.log('🔧 DiscogsAPI initialized with token:', {
            hasToken: !!this.token,
            tokenLength: this.token?.length || 0,
            tokenPreview: this.token?.substring(0, 15) + '...' || 'EMPTY',
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Make a request with comprehensive error handling and retries
     * Based on the make_request_with_retry function from the prototype
     */
    async makeRequestWithRetry(url, maxRetries = null, delay = null, max429Retries = null) {
        const retries = maxRetries || this.rateLimit.MAX_RETRIES;
        const initialDelay = delay || this.rateLimit.DELAY;
        const maxRateLimitRetries = max429Retries || this.rateLimit.MAX_429_RETRIES;
        
        let rateLimitAttempts = 0;
        let currentDelay = initialDelay;

        console.log('🚀 API Request Starting:', {
            url: url.substring(0, 120) + '...',
            hasToken: !!this.token,
            tokenLength: this.token?.length || 0,
            tokenPreview: this.token?.substring(0, 15) + '...' || 'EMPTY',
            attempt: 1,
            timestamp: new Date().toISOString()
        });

        if (this.debug.LOG_API_CALLS) {
            console.log(`🔗 Making Discogs API request: ${url}`);
        }

        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                const response = await fetch(url, {
                    method: 'GET',
                    headers: this.headers
                });

                // Success case
                if (response.status === 200) {
                    try {
                        const data = await response.json();
                        if (this.debug.LOG_API_CALLS) {
                            console.log(`✅ API request successful (attempt ${attempt + 1})`);
                        }
                        return data;
                    } catch (jsonError) {
                        console.error(`JSON decode error on attempt ${attempt + 1}:`, jsonError);
                        if (attempt < retries - 1) {
                            console.log(`🔄 Retrying in ${currentDelay}ms...`);
                            await this.sleep(currentDelay);
                            currentDelay *= 2; // Exponential backoff
                            continue;
                        } else {
                            console.error('❌ Max retries reached for JSON decode errors');
                            return null;
                        }
                    }
                }

                // Rate limiting (429)
                else if (response.status === 429) {
                    rateLimitAttempts++;
                    if (rateLimitAttempts <= maxRateLimitRetries) {
                        // More aggressive exponential backoff for 429 errors
                        const baseWait = initialDelay * Math.pow(2, rateLimitAttempts);
                        const jitter = Math.random() * 1000; // Add random jitter
                        const waitTime = Math.min(baseWait + jitter, this.rateLimit.MAX_DELAY);
                        
                        console.warn(`⏳ Rate limited (429) - attempt ${rateLimitAttempts}/${maxRateLimitRetries}. Waiting ${Math.round(waitTime/1000)}s...`);
                        await this.sleep(waitTime);
                        continue; // Don't count this as a regular retry
                    } else {
                        console.error(`❌ Rate limited too many times (${maxRateLimitRetries} attempts). Giving up.`);
                        return null;
                    }
                }

                // Not found (404)
                else if (response.status === 404) {
                    console.warn(`⚠️ Resource not found (404): ${url}`);
                    return null;
                }

                // Other HTTP errors
                else {
                    const errorText = await response.text();
                    console.error(`❌ HTTP Error ${response.status}: ${errorText.substring(0, 200)}`);
                    if (attempt < retries - 1) {
                        await this.sleep(currentDelay);
                        continue;
                    } else {
                        console.error('❌ Max retries reached for HTTP errors');
                        return null;
                    }
                }

            } catch (networkError) {
                // Handle CORS errors specifically
                if (networkError.message && networkError.message.includes('CORS')) {
                    console.error('🚫 CORS Error: The app needs to be served from a local server, not opened as a file.');
                    console.error('💡 Solution: Use a local HTTP server (e.g., python -m http.server 8000)');
                    return null;
                }
                
                // Handle other network errors
                console.error(`🌐 Network error on attempt ${attempt + 1}:`, networkError);
                if (attempt < retries - 1) {
                    const networkDelay = currentDelay * (attempt + 2); // Progressive delay for network errors
                    console.log(`🔄 Network error - retrying in ${Math.round(networkDelay/1000)}s...`);
                    await this.sleep(networkDelay);
                    currentDelay *= 2; // Exponential backoff
                    continue;
                } else {
                    console.error('❌ Max retries reached for network errors');
                    console.error('💡 If you see CORS errors, please serve the app from a local HTTP server');
                    return null;
                }
            }
        }

        return null;
    }

    /**
     * Sleep utility function for delays
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Add authentication token to URL
     */
    addTokenToUrl(url) {
        console.log('🔑 Adding token to URL:', {
            hasToken: !!this.token,
            tokenLength: this.token?.length || 0,
            tokenPreview: this.token?.substring(0, 15) + '...' || 'EMPTY',
            originalUrl: url,
            timestamp: new Date().toISOString()
        });
        
        const separator = url.includes('?') ? '&' : '?';
        const finalUrl = `${url}${separator}token=${this.token}`;
        
        console.log('🔗 Final URL preview:', finalUrl.substring(0, 100) + '...');
        return finalUrl;
    }

    /**
     * Search for artists
     */
    async searchArtist(artistName, perPage = 1) {
        const encodedArtist = encodeURIComponent(artistName.replace(' ', '+'));
        const url = this.addTokenToUrl(
            `${this.baseUrl}/database/search?q=${encodedArtist}&type=artist&per_page=${perPage}`
        );
        
        const data = await this.makeRequestWithRetry(url);
        return data?.results || [];
    }

    /**
     * Get artist details by ID
     */
    async getArtist(artistId) {
        const url = this.addTokenToUrl(`${this.baseUrl}/artists/${artistId}`);
        return await this.makeRequestWithRetry(url);
    }

    /**
     * Get artist releases with pagination support
     */
    async getArtistReleases(artistId, page = 1, perPage = 500, sort = 'year', sortOrder = 'asc') {
        const url = this.addTokenToUrl(
            `${this.baseUrl}/artists/${artistId}/releases?page=${page}&per_page=${perPage}&sort=${sort}&sort_order=${sortOrder}`
        );
        
        return await this.makeRequestWithRetry(url);
    }

    /**
     * Get release details by ID
     */
    async getRelease(releaseId) {
        const url = this.addTokenToUrl(`${this.baseUrl}/releases/${releaseId}`);
        return await this.makeRequestWithRetry(url);
    }

    /**
     * Get master release details by ID
     */
    async getMasterRelease(masterId) {
        const url = this.addTokenToUrl(`${this.baseUrl}/masters/${masterId}`);
        return await this.makeRequestWithRetry(url);
    }

    /**
     * Search for releases/albums
     */
    async searchReleases(query, type = 'release', perPage = 50, sort = null, sortOrder = null) {
        const encodedQuery = encodeURIComponent(query);
        let url = `${this.baseUrl}/database/search?q=${encodedQuery}&type=${type}&per_page=${perPage}`;
        
        // Add sorting parameters only if provided (allows for relevance-based default sorting)
        if (sort) {
            url += `&sort=${sort}&sort_order=${sortOrder || 'asc'}`;
            if (this.debug.LOG_API_CALLS) {
                console.log(`🔍 Searching releases with sort: ${sort} ${sortOrder || 'asc'}`);
            }
        } else {
            if (this.debug.LOG_API_CALLS) {
                console.log(`🔍 Searching releases with default relevance sorting`);
            }
        }
        
        const finalUrl = this.addTokenToUrl(url);
        
        const data = await this.makeRequestWithRetry(finalUrl);
        return data?.results || [];
    }

    /**
     * Test API connection with a simple request
     */
    async testConnection() {
        console.log('🧪 Testing Discogs API connection...');
        
        try {
            // Simple search to test connection
            const testData = await this.searchArtist('bill evans', 1);
            
            if (testData && testData.length > 0) {
                console.log('✅ Discogs API connection successful!');
                console.log('📋 Test result:', testData[0]);
                return true;
            } else {
                console.warn('⚠️ API connection working but no results returned');
                return false;
            }
        } catch (error) {
            console.error('❌ Discogs API connection failed:', error);
            return false;
        }
    }

    /**
     * Get rate limit status (if available in response headers)
     */
    getRateLimitStatus() {
        // Note: This would require access to response headers
        // For now, return current configuration
        return {
            maxRetries: this.rateLimit.MAX_RETRIES,
            maxDelay: this.rateLimit.MAX_DELAY,
            max429Retries: this.rateLimit.MAX_429_RETRIES
        };
    }
}

// Make the class available globally
window.DiscogsAPI = DiscogsAPI;

// Create and export a singleton instance
window.discogsAPI = new DiscogsAPI();

// Also make it available as a module export for consistency
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DiscogsAPI;
}