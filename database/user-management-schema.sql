-- ===============================================================
-- Albums Collection App - User Management Database Schema
-- ===============================================================
-- This schema should be executed in your album-collection-users 
-- Supabase project (cznrjflfqjjpsqhtmatz)
-- ===============================================================

-- Enable Row Level Security globally
ALTER DATABASE postgres SET row_security = on;

-- ===============================================================
-- 1. USER PROFILES TABLE
-- ===============================================================
-- Extends Supabase auth.users with additional profile information

CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    preferences JSONB DEFAULT '{}',
    
    -- Subscription/Plan Information
    plan_type TEXT DEFAULT 'free' CHECK (plan_type IN ('free', 'premium', 'enterprise')),
    plan_expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Usage Statistics
    total_albums INTEGER DEFAULT 0,
    total_artists INTEGER DEFAULT 0,
    last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===============================================================
-- 2. USER CREDENTIALS TABLE
-- ===============================================================
-- Securely stores user's API credentials for their personal projects

CREATE TABLE IF NOT EXISTS public.user_credentials (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT NULL,
    
    -- API Credentials (encrypted in production)
    discogs_api_key TEXT NOT NULL,
    supabase_project_id TEXT NOT NULL,
    supabase_api_key TEXT NOT NULL,
    
    -- Validation Status
    discogs_validated BOOLEAN DEFAULT FALSE,
    supabase_validated BOOLEAN DEFAULT FALSE,
    last_validated_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one credential set per user
    UNIQUE(user_id)
);

-- ===============================================================
-- 3. USER SESSIONS TABLE
-- ===============================================================
-- Track user sessions for analytics and security

CREATE TABLE IF NOT EXISTS public.user_sessions (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT NULL,
    
    -- Session Information
    session_token TEXT,
    ip_address INET,
    user_agent TEXT,
    device_info JSONB,
    
    -- Location (optional, for security)
    country TEXT,
    city TEXT,
    
    -- Session Status
    is_active BOOLEAN DEFAULT TRUE,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===============================================================
-- INDEXES FOR PERFORMANCE
-- ===============================================================

-- User Profiles
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_plan_type ON public.user_profiles(plan_type);
CREATE INDEX IF NOT EXISTS idx_user_profiles_last_active ON public.user_profiles(last_active_at DESC);

-- User Credentials  
CREATE INDEX IF NOT EXISTS idx_user_credentials_user_id ON public.user_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_user_credentials_validation ON public.user_credentials(discogs_validated, supabase_validated);

-- User Sessions
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON public.user_sessions(is_active, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_ip ON public.user_sessions(ip_address);

-- ===============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ===============================================================

-- Enable RLS on all tables
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- User Profiles: Users can only access their own profile
CREATE POLICY "Users can view own profile" ON public.user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.user_profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.user_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- User Credentials: Users can only access their own credentials
CREATE POLICY "Users can view own credentials" ON public.user_credentials
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own credentials" ON public.user_credentials
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own credentials" ON public.user_credentials
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User Sessions: Users can view their own sessions
CREATE POLICY "Users can view own sessions" ON public.user_sessions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions" ON public.user_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ===============================================================
-- FUNCTIONS AND TRIGGERS
-- ===============================================================

-- Function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, email, display_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER set_updated_at_user_profiles
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_user_credentials
    BEFORE UPDATE ON public.user_credentials
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ===============================================================
-- GRANT PERMISSIONS
-- ===============================================================

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ===============================================================
-- VERIFICATION QUERIES
-- ===============================================================

-- Verification query - run this to confirm tables were created
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
    AND table_name IN (
        'user_profiles', 
        'user_credentials', 
        'user_sessions'
    )
ORDER BY table_name;

-- Verification query - check RLS is enabled
SELECT 
    tablename,
    rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
    AND tablename IN (
        'user_profiles', 
        'user_credentials', 
        'user_sessions'
    )
ORDER BY tablename;