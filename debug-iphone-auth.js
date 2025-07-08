// iPhone Authentication Debug Helper
// Helps diagnose authentication issues on iPhone Safari

window.iPhoneAuthDebug = {
    // Check authentication status
    async checkAuthStatus() {
        console.log('🔐 iPhone Debug: Checking authentication status...');
        
        try {
            // Check if auth services are available
            console.log('🔐 iPhone Debug: AuthService available:', !!window.AuthService);
            console.log('🔐 iPhone Debug: AuthMiddleware available:', !!window.AuthMiddleware);
            
            if (window.AuthService) {
                const user = await window.AuthService.getCurrentUser();
                console.log('🔐 iPhone Debug: Current user:', {
                    user: user,
                    isAuthenticated: !!user,
                    userId: user?.id,
                    email: user?.email
                });
                
                if (user) {
                    // Check if we can access user credentials
                    console.log('🔐 iPhone Debug: Checking user credentials...');
                    const creds = await window.AuthService.getUserCredentials();
                    console.log('🔐 iPhone Debug: User credentials:', {
                        hasCredentials: !!creds,
                        hasApiKey: !!(creds?.api_key),
                        hasSupabaseUrl: !!(creds?.supabase_url),
                        hasSupabaseKey: !!(creds?.supabase_anon_key)
                    });
                    
                    return {
                        authenticated: true,
                        user: user,
                        credentials: !!creds
                    };
                } else {
                    console.log('❌ iPhone Debug: No authenticated user found');
                    return {
                        authenticated: false,
                        user: null,
                        credentials: false
                    };
                }
            } else {
                console.log('❌ iPhone Debug: AuthService not available');
                return {
                    authenticated: false,
                    user: null,
                    credentials: false,
                    error: 'AuthService not available'
                };
            }
        } catch (error) {
            console.error('❌ iPhone Debug: Auth check failed:', error);
            return {
                authenticated: false,
                user: null,
                credentials: false,
                error: error.message
            };
        }
    },
    
    // Test Supabase connection
    async testSupabaseConnection() {
        console.log('🔗 iPhone Debug: Testing Supabase connection...');
        
        try {
            const supabaseService = window.app?.supabaseService;
            if (!supabaseService) {
                console.log('❌ iPhone Debug: SupabaseService not available');
                return { connected: false, error: 'SupabaseService not available' };
            }
            
            console.log('🔗 iPhone Debug: SupabaseService found, testing query...');
            
            // Try a simple count query
            const { data, error } = await supabaseService.client
                .from('albums')
                .select('id', { count: 'exact', head: true });
                
            console.log('🔗 iPhone Debug: Test query result:', {
                data: data,
                error: error,
                count: data?.length
            });
            
            if (error) {
                console.error('❌ iPhone Debug: Supabase connection failed:', error);
                return { connected: false, error: error.message };
            } else {
                console.log('✅ iPhone Debug: Supabase connection successful');
                return { connected: true, error: null };
            }
        } catch (error) {
            console.error('❌ iPhone Debug: Supabase test failed:', error);
            return { connected: false, error: error.message };
        }
    },
    
    // Run full authentication diagnosis
    async runFullDiagnosis() {
        console.log('📱 iPhone Debug: Running full authentication diagnosis...');
        
        const authStatus = await this.checkAuthStatus();
        const supabaseStatus = await this.testSupabaseConnection();
        
        console.log('📱 iPhone Debug: Full diagnosis complete:', {
            authentication: authStatus,
            supabase: supabaseStatus
        });
        
        // Store results globally
        window.authDiagnosis = {
            authentication: authStatus,
            supabase: supabaseStatus,
            timestamp: new Date().toISOString()
        };
        
        console.log('📱 iPhone Debug: Results saved to window.authDiagnosis');
        
        return window.authDiagnosis;
    }
};

// Auto-run diagnosis when available
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (/iPhone/.test(navigator.userAgent)) {
            console.log('📱 iPhone Auth Debug loaded - run window.iPhoneAuthDebug.runFullDiagnosis()');
            
            // Auto-run diagnosis after app should be loaded
            setTimeout(() => {
                if (window.app) {
                    console.log('📱 Auto-running iPhone auth diagnosis...');
                    window.iPhoneAuthDebug.runFullDiagnosis();
                }
            }, 8000); // Wait 8 seconds for app to fully load
        }
    }, 1000);
});
