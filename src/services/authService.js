/**
 * Authentication Service for Albums Collection App
 * Handles user authentication and credential management
 */

class AuthService {
    constructor() {
        this.client = null;
        this.currentUser = null;
        this.initialized = false;
        this.initPromise = this.initialize();
    }

    /**
     * Initialize the authentication service
     */
    async initialize() {
        try {
            // Check if Supabase config is available
            if (!window.CONFIG?.USER_MANAGEMENT?.URL || !window.CONFIG?.USER_MANAGEMENT?.ANON_KEY) {
                throw new Error('User management configuration missing. Please add your album-collection-users Supabase credentials to config.js');
            }

            // Validate anon key (should be a long JWT-like string)
            if (window.CONFIG.USER_MANAGEMENT.ANON_KEY.length < 50) {
                throw new Error('Invalid USER_MANAGEMENT.ANON_KEY. Please add your actual Supabase anon key to config.js');
            }

            // Initialize Supabase client for user management
            const { createClient } = supabase;
            this.client = createClient(
                window.CONFIG.USER_MANAGEMENT.URL,
                window.CONFIG.USER_MANAGEMENT.ANON_KEY
            );

            // Check for existing session
            const { data: { session }, error } = await this.client.auth.getSession();
            if (error) {
                console.warn('Session check error:', error);
            } else if (session) {
                this.currentUser = session.user;
                console.log('🔐 User session restored:', this.currentUser.email);
            }

            this.initialized = true;
            return true;
        } catch (error) {
            console.error('🚨 Auth service initialization failed:', error);
            this.initialized = false;
            throw error;
        }
    }

    /**
     * Ensure service is initialized
     */
    async ensureInitialized() {
        if (!this.initialized) {
            await this.initPromise;
        }
        if (!this.initialized) {
            throw new Error('Authentication service not available');
        }
    }

    /**
     * Sign up a new user with credentials
     */
    async signUp(email, password, credentials = {}) {
        try {
            await this.ensureInitialized();

            console.log('🔐 Creating new user account...');

            // Validate credentials
            const validation = this.validateCredentials(credentials);
            if (!validation.valid) {
                return { success: false, error: validation.error };
            }

            // Create user account
            const { data, error } = await this.client.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        email: email,
                        created_at: new Date().toISOString()
                    }
                }
            });

            if (error) {
                console.error('Sign up error:', error);
                return { success: false, error: error.message };
            }

            if (data.user) {
                console.log('✅ User account created:', data.user.id);

                // Store user credentials
                const credentialsStored = await this.storeUserCredentials(data.user.id, credentials);
                if (!credentialsStored.success) {
                    console.warn('⚠️ User created but credentials storage failed:', credentialsStored.error);
                    // Continue anyway - user can add credentials later
                }

                return { 
                    success: true, 
                    user: data.user,
                    message: 'Account created successfully'
                };
            }

            return { success: false, error: 'Account creation failed' };

        } catch (error) {
            console.error('Sign up error:', error);
            return { success: false, error: 'Account creation failed: ' + error.message };
        }
    }

    /**
     * Sign in an existing user
     */
    async signIn(email, password) {
        try {
            await this.ensureInitialized();

            console.log('🔐 Signing in user...');

            const { data, error } = await this.client.auth.signInWithPassword({
                email,
                password
            });

            if (error) {
                console.error('Sign in error:', error);
                return { success: false, error: error.message };
            }

            if (data.user) {
                this.currentUser = data.user;
                console.log('✅ User signed in:', data.user.email);

                // Load user credentials
                const credentials = await this.loadUserCredentials(data.user.id);
                if (credentials.success) {
                    console.log('📄 User credentials loaded');
                } else {
                    console.warn('⚠️ Could not load user credentials:', credentials.error);
                }

                return { 
                    success: true, 
                    user: data.user,
                    credentials: credentials.data || null
                };
            }

            return { success: false, error: 'Sign in failed' };

        } catch (error) {
            console.error('Sign in error:', error);
            return { success: false, error: 'Sign in failed: ' + error.message };
        }
    }

    /**
     * Sign out the current user
     */
    async signOut() {
        try {
            await this.ensureInitialized();

            const { error } = await this.client.auth.signOut();
            if (error) {
                console.error('Sign out error:', error);
                return { success: false, error: error.message };
            }

            this.currentUser = null;
            console.log('✅ User signed out');

            return { success: true };

        } catch (error) {
            console.error('Sign out error:', error);
            return { success: false, error: 'Sign out failed: ' + error.message };
        }
    }

    /**
     * Get current user
     */
    async getCurrentUser() {
        try {
            await this.ensureInitialized();

            if (this.currentUser) {
                return this.currentUser;
            }

            // Check session
            const { data: { user }, error } = await this.client.auth.getUser();
            if (error) {
                console.warn('Get user error:', error);
                return null;
            }

            this.currentUser = user;
            return user;

        } catch (error) {
            console.error('Get current user error:', error);
            return null;
        }
    }

    /**
     * Get user credentials
     */
    async getUserCredentials() {
        try {
            const user = await this.getCurrentUser();
            if (!user) {
                return { success: false, error: 'No authenticated user' };
            }

            return await this.loadUserCredentials(user.id);

        } catch (error) {
            console.error('Get user credentials error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Update user credentials
     */
    async updateUserCredentials(credentials) {
        try {
            const user = await this.getCurrentUser();
            if (!user) {
                return { success: false, error: 'No authenticated user' };
            }

            // Validate credentials
            const validation = this.validateCredentials(credentials);
            if (!validation.valid) {
                return { success: false, error: validation.error };
            }

            return await this.storeUserCredentials(user.id, credentials);

        } catch (error) {
            console.error('Update user credentials error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Store user credentials in database
     */
    async storeUserCredentials(userId, credentials) {
        try {
            await this.ensureInitialized();

            const credentialsData = {
                user_id: userId,
                discogs_api_key: credentials.discogsApiKey,
                supabase_project_id: credentials.supabaseProjectId,
                supabase_api_key: credentials.supabaseApiKey,
                updated_at: new Date().toISOString()
            };

            // Use upsert to insert or update
            const { data, error } = await this.client
                .from(window.CONFIG.USER_MANAGEMENT.TABLES.USER_CREDENTIALS)
                .upsert(credentialsData, { 
                    onConflict: 'user_id',
                    returning: 'minimal'
                });

            if (error) {
                console.error('Store credentials error:', error);
                return { success: false, error: error.message };
            }

            console.log('✅ User credentials stored');
            return { success: true };

        } catch (error) {
            console.error('Store user credentials error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Load user credentials from database
     */
    async loadUserCredentials(userId) {
        try {
            await this.ensureInitialized();
            console.log(`🔍 Loading credentials for user: ${userId}`);
            console.log(`📊 Using table: ${window.CONFIG.USER_MANAGEMENT.TABLES.USER_CREDENTIALS}`);
            console.log(`🌐 Client URL: ${this.client?.supabaseUrl}`);

            const { data, error } = await this.client
                .from(window.CONFIG.USER_MANAGEMENT.TABLES.USER_CREDENTIALS)
                .select('*')
                .eq('user_id', userId)
                .single();

            console.log('📄 Raw credential query result:', { data, error });

            if (error) {
                if (error.code === 'PGRST116') {
                    // No credentials found - this is normal for new users
                    console.log('ℹ️ No credentials found for user (new user)');
                    return { success: true, data: null };
                }
                console.error('❌ Load credentials error:', error);
                return { success: false, error: error.message };
            }

            if (!data) {
                console.log('ℹ️ No credential data returned');
                return { success: true, data: null };
            }

            const mappedCredentials = {
                discogsApiKey: data.discogs_api_key,
                supabaseProjectId: data.supabase_project_id,
                supabaseApiKey: data.supabase_api_key,
                updatedAt: data.updated_at
            };

            console.log('✅ Credentials loaded and mapped:', {
                hasDiscogsKey: !!mappedCredentials.discogsApiKey,
                discogsKeyLength: mappedCredentials.discogsApiKey?.length || 0,
                discogsKeyPreview: mappedCredentials.discogsApiKey?.substring(0, 10) + '...',
                hasSupabaseProject: !!mappedCredentials.supabaseProjectId,
                updatedAt: mappedCredentials.updatedAt
            });

            return { 
                success: true, 
                data: mappedCredentials
            };

        } catch (error) {
            console.error('❌ Load user credentials error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Validate user credentials
     */
    validateCredentials(credentials) {
        const { discogsApiKey, supabaseProjectId, supabaseApiKey } = credentials;

        if (!discogsApiKey || discogsApiKey.length < 10) {
            return { valid: false, error: 'Invalid Discogs API key' };
        }

        if (!supabaseProjectId || supabaseProjectId.length < 10) {
            return { valid: false, error: 'Invalid Supabase Project ID' };
        }

        if (!supabaseApiKey || supabaseApiKey.length < 50) {
            return { valid: false, error: 'Invalid Supabase API key' };
        }

        // Basic format validation
        if (!supabaseProjectId.match(/^[a-z0-9]{20}$/)) {
            return { valid: false, error: 'Supabase Project ID should be 20 characters (letters and numbers)' };
        }

        return { valid: true };
    }

    /**
     * Check if user is authenticated
     */
    async isAuthenticated() {
        const user = await this.getCurrentUser();
        return !!user;
    }

    /**
     * Setup authentication state listener
     */
    onAuthStateChange(callback) {
        if (!this.client) return;

        return this.client.auth.onAuthStateChange((event, session) => {
            console.log('🔐 Auth state changed:', event);
            
            if (session) {
                this.currentUser = session.user;
            } else {
                this.currentUser = null;
            }

            callback(event, session);
        });
    }

    /**
     * Apply user credentials to app config
     */
    async applyUserCredentials() {
        try {
            console.log('🔄 Applying user credentials...');
            
            const result = await this.getUserCredentials();
            console.log('📄 Get credentials result:', result);
            
            if (!result.success || !result.data) {
                console.warn('⚠️ No user credentials available');
                return false;
            }

            const credentials = result.data;
            console.log('🔑 Credentials to apply:', {
                hasDiscogsKey: !!credentials.discogsApiKey,
                discogsKeyLength: credentials.discogsApiKey?.length || 0,
                discogsKeyPreview: credentials.discogsApiKey?.substring(0, 10) + '...'
            });

            // Update app configuration with user's credentials
            window.CONFIG.DISCOGS.API_KEY = credentials.discogsApiKey;
            window.CONFIG.SUPABASE.URL = `https://${credentials.supabaseProjectId}.supabase.co`;
            window.CONFIG.SUPABASE.ANON_KEY = credentials.supabaseApiKey;

            // Recreate the Discogs API instance with new credentials
            if (window.DiscogsAPI && credentials.discogsApiKey) {
                window.discogsAPI = new window.DiscogsAPI();
                console.log('🔄 Discogs API recreated with user credentials');
            }

            // Reinitialize Supabase service with new credentials
            if (window.albumApp?.supabaseService) {
                const supabaseReinitialized = await window.albumApp.supabaseService.reinitialize();
                console.log('🔄 Supabase service reinitialized:', supabaseReinitialized);
            }

            console.log('✅ User credentials applied successfully');
            return true;

        } catch (error) {
            console.error('❌ Apply user credentials error:', error);
            return false;
        }
    }
}

// Create global instance
window.AuthService = new AuthService();

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthService;
}