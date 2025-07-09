/**
 * Secure Credential Loader for Google Sheets Service Account
 * Loads credentials from secure local file for development
 */

class SecureCredentialLoader {
    constructor() {
        this.credentialsLoaded = false;
        this.credentials = null;
    }

    /**
     * Load service account credentials securely
     */
    async loadServiceAccountCredentials() {
        if (this.credentialsLoaded) {
            return this.credentials;
        }

        try {
            // Use inline credentials from configuration
            console.log('🔐 Loading service account credentials from configuration...');
            
            if (window.CONFIG?.GOOGLE_SHEETS?.SERVICE_ACCOUNT) {
                this.credentials = window.CONFIG.GOOGLE_SHEETS.SERVICE_ACCOUNT;
                this.credentialsLoaded = true;
                console.log('✅ Service account credentials loaded successfully');
                return this.credentials;
            } else {
                throw new Error('Service account credentials not found in configuration');
            }
        } catch (error) {
            console.error('❌ Failed to load service account credentials:', error);
            console.log('💡 Make sure albums-collection-465406-b3c823f3aa9d.json exists in the root directory');
            throw error;
        }
    }

    hasCredentials() {
        return this.credentialsLoaded && this.credentials !== null;
    }

    getServiceAccountEmail() {
        if (this.hasCredentials()) {
            return this.credentials.client_email;
        }
        return 'tommy-891@albums-collection-465406.iam.gserviceaccount.com'; // Fallback
    }
}

// Create global instance
window.SecureCredentialLoader = SecureCredentialLoader;