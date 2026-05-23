-- Initial migration for YouTube SEO Tool
-- Creates all tables and indexes for PostgreSQL

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    channel_id TEXT UNIQUE NOT NULL,
    email TEXT,
    plan TEXT DEFAULT 'free' NOT NULL,
    credits INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    last_refresh TIMESTAMP WITH TIME ZONE,
    is_verified BOOLEAN DEFAULT false NOT NULL,
    metadata JSONB DEFAULT '{}'
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    metadata JSONB DEFAULT '{}'
);

-- Credit transactions table
CREATE TABLE IF NOT EXISTS credit_transactions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    type TEXT NOT NULL,
    description TEXT,
    reference TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    metadata JSONB DEFAULT '{}'
);

-- API logs table
CREATE TABLE IF NOT EXISTS api_logs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    status_code INTEGER NOT NULL,
    response_time INTEGER,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    error TEXT,
    metadata JSONB DEFAULT '{}'
);

-- PayPal orders table
CREATE TABLE IF NOT EXISTS paypal_orders (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    order_id TEXT UNIQUE NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan TEXT NOT NULL,
    amount INTEGER NOT NULL,
    currency TEXT DEFAULT 'USD' NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS users_channel_id_idx ON users(channel_id);
CREATE INDEX IF NOT EXISTS users_plan_idx ON users(plan);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_session_token_idx ON sessions(session_token);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS credit_transactions_user_id_idx ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS credit_transactions_created_at_idx ON credit_transactions(created_at);
CREATE INDEX IF NOT EXISTS api_logs_user_id_idx ON api_logs(user_id);
CREATE INDEX IF NOT EXISTS api_logs_created_at_idx ON api_logs(created_at);
CREATE INDEX IF NOT EXISTS api_logs_endpoint_idx ON api_logs(endpoint);
CREATE INDEX IF NOT EXISTS paypal_orders_order_id_idx ON paypal_orders(order_id);
CREATE INDEX IF NOT EXISTS paypal_orders_user_id_idx ON paypal_orders(user_id);
CREATE INDEX IF NOT EXISTS paypal_orders_status_idx ON paypal_orders(status);
