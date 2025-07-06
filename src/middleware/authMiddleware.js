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

        // Apply user credentials to app configuration
        const credentialsApplied = await window.AuthService.applyUserCredentials();
        if (!credentialsApplied) {
            console.warn('⚠️ Could not load user credentials, may need to update settings');
            // Don't redirect - let user continue with default config or update later
        }

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