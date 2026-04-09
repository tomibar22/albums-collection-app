// Spotify API Integration Module
// Uses OAuth 2.0 PKCE flow for client-side authentication

class SpotifyAPI {
    constructor() {
        this.baseUrl = 'https://api.spotify.com/v1';
        this.authUrl = 'https://accounts.spotify.com/authorize';
        this.tokenUrl = 'https://accounts.spotify.com/api/token';
        this.scopes = 'user-follow-read';
        this.accessToken = sessionStorage.getItem('spotify_access_token') || null;
        this.tokenExpiry = parseInt(sessionStorage.getItem('spotify_token_expiry') || '0');

        console.log('🎵 SpotifyAPI initialized', {
            hasToken: !!this.accessToken
        });
    }

    get clientId() {
        return window.CONFIG?.SPOTIFY?.CLIENT_ID || '';
    }

    get redirectUri() {
        // Use saved redirect URI from authorization step if available (must match exactly)
        const saved = sessionStorage.getItem('spotify_redirect_uri');
        if (saved) return saved;
        return window.CONFIG?.SPOTIFY?.REDIRECT_URI || window.location.origin + '/';
    }

    // ─── PKCE Auth Flow ───────────────────────────────────────────

    /**
     * Generate a random string for PKCE code verifier
     */
    generateCodeVerifier(length = 128) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
        const array = new Uint8Array(length);
        crypto.getRandomValues(array);
        return Array.from(array, b => chars[b % chars.length]).join('');
    }

    /**
     * Generate SHA-256 code challenge from verifier
     */
    async generateCodeChallenge(verifier) {
        const encoder = new TextEncoder();
        const data = encoder.encode(verifier);
        const digest = await crypto.subtle.digest('SHA-256', data);
        return btoa(String.fromCharCode(...new Uint8Array(digest)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    }

    /**
     * Start the OAuth PKCE authorization flow
     */
    async authorize() {
        if (!this.clientId) {
            console.error('CONFIG.SPOTIFY:', window.CONFIG?.SPOTIFY, 'All CONFIG keys:', Object.keys(window.CONFIG || {}));
            throw new Error('Spotify Client ID not configured. Add SPOTIFY.CLIENT_ID to config.js. Current CONFIG keys: ' + Object.keys(window.CONFIG || {}).join(', '));
        }

        const codeVerifier = this.generateCodeVerifier();
        const codeChallenge = await this.generateCodeChallenge(codeVerifier);
        const state = this.generateCodeVerifier(32);

        // Store for callback
        const redirectUri = this.redirectUri;
        sessionStorage.setItem('spotify_code_verifier', codeVerifier);
        sessionStorage.setItem('spotify_auth_state', state);
        sessionStorage.setItem('spotify_redirect_uri', redirectUri);

        const params = new URLSearchParams({
            client_id: this.clientId,
            response_type: 'code',
            redirect_uri: redirectUri,
            scope: this.scopes,
            state: state,
            code_challenge_method: 'S256',
            code_challenge: codeChallenge
        });

        window.location.href = `${this.authUrl}?${params.toString()}`;
    }

    /**
     * Handle the OAuth callback - exchange code for token
     */
    async handleCallback() {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        const state = params.get('state');
        const error = params.get('error');

        // If we have a code in the URL, save it in case auth guard redirects us away
        if (code && state) {
            sessionStorage.setItem('spotify_auth_code', code);
            sessionStorage.setItem('spotify_auth_state_from_url', state);
        }

        // Try URL params first, then fall back to saved params (in case auth guard stripped the URL)
        const authCode = code || sessionStorage.getItem('spotify_auth_code');
        const authState = state || sessionStorage.getItem('spotify_auth_state_from_url');

        console.log('🎵 handleCallback check:', {
            codeFromUrl: !!code,
            codeFromStorage: !!sessionStorage.getItem('spotify_auth_code'),
            hasState: !!authState,
            hasError: !!error,
            url: window.location.href.substring(0, 100),
            hasSavedVerifier: !!sessionStorage.getItem('spotify_code_verifier')
        });

        if (error) {
            console.error('❌ Spotify auth error:', error);
            this.clearAuthParams();
            return false;
        }

        if (!authCode) return false;

        const savedState = sessionStorage.getItem('spotify_auth_state');
        if (authState !== savedState) {
            console.error('❌ Spotify auth state mismatch', { authState, savedState });
            this.clearAuthParams();
            return false;
        }

        const codeVerifier = sessionStorage.getItem('spotify_code_verifier');
        if (!codeVerifier) {
            console.error('❌ No code verifier found');
            this.clearAuthParams();
            return false;
        }

        try {
            console.log('🔄 Exchanging code for token...', {
                redirectUri: this.redirectUri,
                hasCode: !!authCode,
                hasVerifier: !!codeVerifier
            });

            const response = await fetch(this.tokenUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: this.clientId,
                    grant_type: 'authorization_code',
                    code: authCode,
                    redirect_uri: this.redirectUri,
                    code_verifier: codeVerifier
                })
            });

            const responseText = await response.text();
            console.log('🔄 Token response status:', response.status, 'body:', responseText.substring(0, 500));

            if (!response.ok) {
                console.error('❌ Token exchange failed:', responseText);
                this.clearAuthParams();
                return false;
            }

            const data = JSON.parse(responseText);
            console.log('✅ Token received:', {
                expires_in: data.expires_in,
                token_type: data.token_type,
                scope: data.scope,
                hasAccessToken: !!data.access_token,
                tokenPreview: data.access_token?.substring(0, 20) + '...'
            });
            this.accessToken = data.access_token;
            this.tokenExpiry = Date.now() + (data.expires_in * 1000);

            sessionStorage.setItem('spotify_access_token', this.accessToken);
            sessionStorage.setItem('spotify_token_expiry', this.tokenExpiry.toString());

            // Clean URL
            this.clearAuthParams();
            window.history.replaceState({}, document.title, window.location.pathname);

            console.log('✅ Spotify authenticated successfully');
            return true;
        } catch (err) {
            console.error('❌ Spotify token exchange error:', err);
            this.clearAuthParams();
            return false;
        }
    }

    clearAuthParams() {
        sessionStorage.removeItem('spotify_code_verifier');
        sessionStorage.removeItem('spotify_auth_state');
        sessionStorage.removeItem('spotify_redirect_uri');
        sessionStorage.removeItem('spotify_auth_code');
        sessionStorage.removeItem('spotify_auth_state_from_url');
    }

    disconnect() {
        this.accessToken = null;
        this.tokenExpiry = 0;
        sessionStorage.removeItem('spotify_access_token');
        sessionStorage.removeItem('spotify_token_expiry');
        console.log('🔌 Spotify disconnected');
    }

    isConnected() {
        if (!this.accessToken || Date.now() >= this.tokenExpiry) {
            // Clean up stale session data
            if (this.accessToken) this.disconnect();
            return false;
        }
        return true;
    }

    // ─── API Requests ─────────────────────────────────────────────

    async apiRequest(endpoint, retries = 3) {
        if (!this.isConnected()) {
            throw new Error('Spotify not connected. Please authorize first.');
        }

        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                console.log(`🎵 API request: ${endpoint}`, {
                    tokenPreview: this.accessToken?.substring(0, 20) + '...',
                    expiresIn: Math.round((this.tokenExpiry - Date.now()) / 1000) + 's'
                });
                const response = await fetch(`${this.baseUrl}${endpoint}`, {
                    headers: { 'Authorization': `Bearer ${this.accessToken}` }
                });

                if (response.status === 401) {
                    const errBody = await response.text();
                    console.error('❌ Spotify 401:', errBody);
                    this.disconnect();
                    throw new Error('Spotify token expired. Please reconnect.');
                }

                if (response.status === 429) {
                    const retryAfter = parseInt(response.headers.get('Retry-After') || '1');
                    console.log(`⏳ Spotify rate limited, waiting ${retryAfter}s...`);
                    await new Promise(r => setTimeout(r, retryAfter * 1000));
                    continue;
                }

                if (!response.ok) {
                    throw new Error(`Spotify API error: ${response.status}`);
                }

                return await response.json();
            } catch (err) {
                if (attempt === retries - 1) throw err;
                await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
            }
        }
    }

    // ─── Data Fetching ────────────────────────────────────────────

    /**
     * Get all followed artists (paginated)
     */
    async getFollowedArtists(onProgress) {
        const artists = [];
        let after = null;
        const limit = 50;

        do {
            let endpoint = `/me/following?type=artist&limit=${limit}`;
            if (after) endpoint += `&after=${after}`;

            const data = await this.apiRequest(endpoint);
            const batch = data.artists.items;
            artists.push(...batch);

            if (onProgress) onProgress(artists.length, data.artists.total);

            after = data.artists.cursors?.after || null;
        } while (after);

        console.log(`🎤 Found ${artists.length} followed artists on Spotify`);
        return artists;
    }

    /**
     * Get an artist's own albums (studio albums only)
     * Uses include_groups=album to exclude singles, compilations, EPs
     */
    async getArtistAlbums(artistId, artistName) {
        const albums = [];
        let offset = 0;
        const limit = 50;

        do {
            const data = await this.apiRequest(
                `/artists/${artistId}/albums?include_groups=album&market=US&limit=${limit}&offset=${offset}`
            );

            albums.push(...data.items);
            offset += limit;

            if (offset >= data.total) break;
        } while (true);

        // Deduplicate by name (Spotify often has multiple versions of same album)
        const seen = new Map();
        const unique = [];
        for (const album of albums) {
            const key = album.name.toLowerCase().replace(/\s*\(.*?\)\s*/g, '').trim();
            if (!seen.has(key)) {
                seen.set(key, true);
                unique.push(album);
            }
        }

        return unique;
    }

    /**
     * Get albums where the artist appears on other artists' releases
     * Filters to only album_type === 'album' (no compilations/singles)
     */
    async getArtistAppearances(artistId, artistName) {
        const appearances = [];
        let offset = 0;
        const limit = 50;

        do {
            const data = await this.apiRequest(
                `/artists/${artistId}/albums?include_groups=appears_on&market=US&limit=${limit}&offset=${offset}`
            );

            // Filter: only include actual albums (not compilations or singles)
            const filtered = data.items.filter(a => a.album_type === 'album');
            appearances.push(...filtered);
            offset += limit;

            if (offset >= data.total) break;
        } while (true);

        // Deduplicate
        const seen = new Map();
        const unique = [];
        for (const album of appearances) {
            const key = `${album.artists[0]?.name}-${album.name}`.toLowerCase()
                .replace(/\s*\(.*?\)\s*/g, '').trim();
            if (!seen.has(key)) {
                seen.set(key, true);
                unique.push(album);
            }
        }

        return unique;
    }

    /**
     * Get the current user's Spotify profile
     */
    async getProfile() {
        return await this.apiRequest('/me');
    }
}

// Make available globally
window.SpotifyAPI = SpotifyAPI;
