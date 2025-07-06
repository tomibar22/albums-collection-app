/**
 * Authentication Middleware for Albums Collection App
 * Handles authentication checks and redirects
 */

class AuthMiddleware {
    constructor() {
        this.initialized = false;
        this.authCheckPromise = null;
    }

    /**
     * Initialize authentication middleware
     */
    async initialize() {
        if (this.initialized) return true;

        try {
            console.log('🔐 Initializing auth middleware...');

            // Wait for AuthService to be ready
            if (!window.AuthService) {
                console.error('❌ AuthService not available');
                return false;
            }

            await window.AuthService.initPromise;
            this.initialized = true;
            console.log('✅ Auth middleware initialized');
            return true;

        } catch (error) {
            console.error('❌ Auth middleware initialization failed:', error);
            this.initialized = false;
            return false;
        }
    }

    /**
     * Check if user is authenticated and redirect if needed
     */
    async requireAuthentication() {
        try {
            // Avoid multiple simultaneous checks
            if (this.authCheckPromise) {
                return await this.authCheckPromise;
            }

            this.authCheckPromise = this._performAuthCheck();
            const result = await this.authCheckPromise;
            this.authCheckPromise = null;
            return result;

        } catch (error) {
            console.error('❌ Authentication check failed:', error);
            this.authCheckPromise = null;
            this.redirectToAuth('Authentication system error');
            return false;
        }
    }

    /**
     * Perform the actual authentication check
     */
    async _performAuthCheck() {
        // Check if authentication system is properly configured
        if (!this._isAuthConfigured()) {
            this._showConfigurationError();
            return false;
        }

        // Initialize if needed
        const initialized = await this.initialize();
        if (!initialized) {
            this.redirectToAuth('Authentication system unavailable');
            return false;
        }

        // Check if user is authenticated
        const user = await window.AuthService.getCurrentUser();
        if (!user) {
            console.log('🔐 No authenticated user, redirecting to auth page');
            this.redirectToAuth();
            return false;
        }

        console.log('✅ User authenticated:', user.email);

        // Check if Discogs API is configured
        if (!this._isDiscogsConfigured()) {
            this._showDiscogsConfigurationHelp();
            return false;
        }

        // Apply user credentials to app configuration
        const credentialsApplied = await window.AuthService.applyUserCredentials();
        if (!credentialsApplied) {
            console.warn('⚠️ Could not load user credentials, may need to update settings');
            // Don't redirect - let user continue with default config or update later
        }

        // Set up user menu after successful authentication
        this._setupUserMenu(user);

        return true;
    }

    /**
     * Set up user menu in the header
     */
    _setupUserMenu(user) {
        const userMenuContainer = document.getElementById('userMenuContainer');
        if (!userMenuContainer) {
            console.warn('⚠️ User menu container not found');
            return;
        }

        userMenuContainer.innerHTML = `
            <div class="user-menu">
                <div class="user-info">
                    <span class="user-email">${user.email}</span>
                    <button class="user-menu-toggle" id="userMenuToggle">⚙️</button>
                </div>
                <div class="user-dropdown" id="userDropdown" style="display: none;">
                    <button class="dropdown-item" id="updateCredentials">🔑 Update API Keys</button>
                    <button class="dropdown-item" id="logoutBtn">🚪 Sign Out</button>
                </div>
            </div>
        `;

        // Add event listeners
        document.getElementById('userMenuToggle').addEventListener('click', () => {
            const dropdown = document.getElementById('userDropdown');
            dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
        });

        document.getElementById('updateCredentials').addEventListener('click', () => {
            this._showCredentialsModal();
        });

        document.getElementById('logoutBtn').addEventListener('click', async () => {
            await window.AuthService.signOut();
            window.location.reload();
        });

        console.log('✅ User menu set up for:', user.email);
    }

    /**
     * Show credentials update modal
     */
    _showCredentialsModal() {
        const modal = document.createElement('div');
        modal.className = 'config-error-overlay';
        modal.innerHTML = `
            <div class="config-error-content">
                <div class="config-error-header">
                    <h2>🔑 Update API Credentials</h2>
                    <button class="close-modal" id="closeCredentialsModal">✕</button>
                </div>
                
                <div class="credentials-form">
                    <div class="form-group">
                        <label for="discogsApiKey">Discogs API Key:</label>
                        <input type="text" id="discogsApiKey" placeholder="Your Discogs API token" value="${window.CONFIG.DISCOGS.API_KEY || ''}">
                        <small>Get from: <a href="https://www.discogs.com/settings/developers" target="_blank">Discogs Developer Settings</a></small>
                    </div>
                    
                    <div class="form-actions">
                        <button id="saveCredentials" class="save-btn">💾 Save Credentials</button>
                        <button id="cancelCredentials" class="cancel-btn">❌ Cancel</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Event listeners
        document.getElementById('closeCredentialsModal').addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        document.getElementById('cancelCredentials').addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        document.getElementById('saveCredentials').addEventListener('click', async () => {
            const discogsApiKey = document.getElementById('discogsApiKey').value.trim();
            
            if (!discogsApiKey) {
                alert('Please enter your Discogs API key');
                return;
            }

            // Update credentials
            const result = await window.AuthService.updateUserCredentials({
                discogsApiKey: discogsApiKey,
                supabaseProjectId: window.CONFIG.SUPABASE.URL.match(/https:\/\/(.+)\.supabase\.co/)[1],
                supabaseApiKey: window.CONFIG.SUPABASE.ANON_KEY
            });

            if (result.success) {
                // Apply immediately
                await window.AuthService.applyUserCredentials();
                alert('✅ Credentials updated successfully!');
                document.body.removeChild(modal);
                
                // Test API
                if (window.testDiscogsAPI) {
                    window.testDiscogsAPI();
                }
            } else {
                alert('❌ Error updating credentials: ' + result.error);
            }
        });
    }
    }

    /**
     * Check if authentication system is properly configured
     */
    _isAuthConfigured() {
        const hasUrl = !!(window.CONFIG?.USER_MANAGEMENT?.URL);
        const hasAnonKey = !!(window.CONFIG?.USER_MANAGEMENT?.ANON_KEY);
        const keyLength = window.CONFIG?.USER_MANAGEMENT?.ANON_KEY?.length || 0;
        const isValid = hasUrl && hasAnonKey && keyLength > 10;
        
        // Debug logging for deployment troubleshooting
        console.log('🔐 AUTH MIDDLEWARE: Configuration check', {
            hasConfig: !!(window.CONFIG),
            hasUserMgmt: !!(window.CONFIG?.USER_MANAGEMENT),
            hasUrl,
            hasAnonKey,
            keyLength,
            isValid,
            timestamp: new Date().toISOString()
        });
        
        return isValid;
    }

    /**
     * Show configuration error message for deployment
     */
    _showConfigurationError() {
        console.error('❌ Authentication not configured for deployment');
        
        // Create configuration help overlay
        const overlay = document.createElement('div');
        overlay.className = 'config-error-overlay';
        overlay.innerHTML = `
            <div class="config-error-content">
                <div class="config-error-header">
                    <h2>🔐 Authentication Setup Required</h2>
                </div>
                <div class="config-error-body">
                    <p>The Albums Collection App requires authentication configuration to function.</p>
                    
                    <div class="config-steps">
                        <h3>Quick Setup Steps:</h3>
                        <ol>
                            <li>Add your <strong>album-collection-users</strong> Supabase anon key to <code>src/config.js</code></li>
                            <li>Update the <code>USER_MANAGEMENT.ANON_KEY</code> field</li>
                            <li>Redeploy your application</li>
                        </ol>
                    </div>
                    
                    <div class="config-help">
                        <p><strong>Need help?</strong> Check the <code>AUTHENTICATION-SETUP.md</code> guide in your project.</p>
                    </div>
                    
                    <div class="config-actions">
                        <button onclick="window.location.reload()" class="config-retry-btn">
                            🔄 Retry
                        </button>
                        <a href="https://github.com/tomibar22/albums-collection-app" target="_blank" class="config-docs-btn">
                            📖 View Documentation
                        </a>
                    </div>
                </div>
            </div>
        `;

        // Add styles for the error overlay
        const style = document.createElement('style');
        style.textContent = `
            .config-error-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(15, 15, 35, 0.95);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                backdrop-filter: blur(10px);
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            }
            
            .config-error-content {
                background: #1a1a2e;
                border: 1px solid #334155;
                border-radius: 16px;
                padding: 2rem;
                max-width: 600px;
                width: 90%;
                box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
                color: #e2e8f0;
            }
            
            .config-error-header h2 {
                margin: 0 0 1.5rem 0;
                color: #3b82f6;
                font-size: 1.5rem;
                font-weight: 600;
            }
            
            .config-error-body p {
                margin-bottom: 1.5rem;
                line-height: 1.6;
                color: #94a3b8;
            }
            
            .config-steps {
                background: #0f0f23;
                border: 1px solid #334155;
                border-radius: 8px;
                padding: 1.5rem;
                margin-bottom: 1.5rem;
            }
            
            .config-steps h3 {
                margin: 0 0 1rem 0;
                color: #e2e8f0;
                font-size: 1.1rem;
            }
            
            .config-steps ol {
                margin: 0;
                padding-left: 1.5rem;
                color: #cbd5e1;
            }
            
            .config-steps li {
                margin-bottom: 0.5rem;
                line-height: 1.5;
            }
            
            .config-steps code {
                background: #334155;
                padding: 0.25rem 0.5rem;
                border-radius: 4px;
                font-family: 'Monaco', 'Consolas', monospace;
                font-size: 0.875rem;
                color: #fbbf24;
            }
            
            .config-help {
                background: #134e4a;
                border: 1px solid #14b8a6;
                border-radius: 8px;
                padding: 1rem;
                margin-bottom: 2rem;
            }
            
            .config-help p {
                margin: 0;
                color: #5eead4;
                font-size: 0.875rem;
            }
            
            .config-actions {
                display: flex;
                gap: 1rem;
                justify-content: center;
            }
            
            .config-retry-btn, .config-docs-btn {
                padding: 0.75rem 1.5rem;
                border-radius: 8px;
                font-size: 0.875rem;
                font-weight: 500;
                text-decoration: none;
                cursor: pointer;
                transition: all 0.2s ease;
                border: none;
                font-family: inherit;
            }
            
            .config-retry-btn {
                background: #3b82f6;
                color: white;
            }
            
            .config-retry-btn:hover {
                background: #2563eb;
                transform: translateY(-1px);
            }
            
            .config-docs-btn {
                background: #374151;
                color: #e5e7eb;
                border: 1px solid #4b5563;
            }
            
            .config-docs-btn:hover {
                background: #4b5563;
                border-color: #6b7280;
            }
        `;

        document.head.appendChild(style);
        document.body.appendChild(overlay);
    }

    /**
     * Check if Discogs API is configured
     */
    _isDiscogsConfigured() {
        const hasApiKey = !!(window.CONFIG?.DISCOGS?.API_KEY);
        const keyLength = window.CONFIG?.DISCOGS?.API_KEY?.length || 0;
        const isValid = hasApiKey && keyLength > 10;
        
        console.log('🎵 DISCOGS API: Configuration check', {
            hasConfig: !!(window.CONFIG),
            hasDiscogs: !!(window.CONFIG?.DISCOGS),
            hasApiKey,
            keyLength,
            isValid,
            timestamp: new Date().toISOString()
        });
        
        return isValid;
    }

    /**
     * Show Discogs API configuration help
     */
    _showDiscogsConfigurationHelp() {
        console.error('❌ Discogs API not configured');
        
        // Create configuration help overlay
        const overlay = document.createElement('div');
        overlay.className = 'config-error-overlay';
        overlay.innerHTML = `
            <div class="config-error-content">
                <div class="config-error-header">
                    <h2>🎵 Discogs API Configuration Required</h2>
                    <p>To use the music collection features, you need a free Discogs API key.</p>
                </div>
                
                <div class="config-setup-steps">
                    <h3>📋 Setup Steps:</h3>
                    <ol>
                        <li><strong>Visit:</strong> <a href="https://www.discogs.com/settings/developers" target="_blank">https://www.discogs.com/settings/developers</a></li>
                        <li><strong>Create an application</strong> (any name works)</li>
                        <li><strong>Copy your Personal Access Token</strong></li>
                        <li><strong>Update the configuration</strong> in your deployment</li>
                    </ol>
                </div>

                <div class="config-code-block">
                    <h4>Update your index.html configuration:</h4>
                    <pre><code>DISCOGS: {
    API_KEY: 'YOUR_DISCOGS_TOKEN_HERE', // ← Add your token here
    BASE_URL: 'https://api.discogs.com',
    // ... rest of config
}</code></pre>
                </div>

                <div class="config-error-note">
                    <p><strong>Note:</strong> The Discogs API is free for personal use and allows you to access comprehensive music metadata for building your collection.</p>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        return true;
    }

    /**
     * Redirect to authentication page
     */
    redirectToAuth(reason = null) {
        if (reason) {
            console.log('🔐 Redirecting to auth:', reason);
        }
        
        // Store current page for redirect after authentication
        const currentPage = window.location.pathname + window.location.search;
        if (currentPage !== '/auth.html' && currentPage !== 'auth.html') {
            localStorage.setItem('auth_redirect_url', currentPage);
        }

        // Redirect to auth page
        window.location.href = 'auth.html';
    }

    /**
     * Handle post-authentication redirect
     */
    handleAuthRedirect() {
        const redirectUrl = localStorage.getItem('auth_redirect_url');
        if (redirectUrl && redirectUrl !== window.location.pathname) {
            localStorage.removeItem('auth_redirect_url');
            window.location.href = redirectUrl;
        }
    }

    /**
     * Sign out current user
     */
    async signOut() {
        try {
            console.log('🔐 Signing out user...');
            
            const result = await window.AuthService.signOut();
            if (result.success) {
                console.log('✅ User signed out successfully');
                this.redirectToAuth();
            } else {
                console.error('❌ Sign out failed:', result.error);
                alert('Sign out failed: ' + result.error);
            }

        } catch (error) {
            console.error('❌ Sign out error:', error);
            alert('Sign out failed. Please refresh the page.');
        }
    }

    /**
     * Get current user info for display
     */
    async getCurrentUser() {
        try {
            return await window.AuthService.getCurrentUser();
        } catch (error) {
            console.error('❌ Get current user error:', error);
            return null;
        }
    }
}

// Create global instance
window.AuthMiddleware = new AuthMiddleware();

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthMiddleware;
}