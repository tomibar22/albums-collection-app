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
            // In development, try to load from local file
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                console.log('🔐 Loading service account credentials for development...');
                
                // Try to fetch the credentials file
                const response = await fetch('./albums-collection-465406-b3c823f3aa9d.json');
                
                if (response.ok) {
                    this.credentials = await response.json();
                    this.credentialsLoaded = true;
                    
                    // Update CONFIG with loaded credentials
                    if (window.CONFIG && window.CONFIG.GOOGLE_SHEETS) {
                        window.CONFIG.GOOGLE_SHEETS.SERVICE_ACCOUNT_CREDENTIALS = this.credentials;
                        console.log('✅ Service account credentials loaded successfully');
                    }
                    
                    return this.credentials;
                } else {
                    throw new Error(`Failed to load credentials file: ${response.status}`);
                }
            } else {
                // In production, credentials should be loaded through secure environment variables
                throw new Error('Production credential loading not implemented yet');
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