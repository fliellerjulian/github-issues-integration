This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```bash
# Supabase Configuration
# Create a project at https://supabase.com/dashboard and get these from Settings > API
SUPABASE_PROJECT_URL=https://your-project-id.supabase.co
SUPABASE_API_KEY=your-supabase-anon-key

# GitHub Webhook Secret (generate with: openssl rand -hex 20)
GITHUB_WEBHOOK_SECRET=your-webhook-secret

# NextAuth.js secret for session encryption (generate with: openssl rand -base64 32)
AUTH_SECRET=your-auth-secret

# Devin API
DEVIN_API_KEY=your-devin-api-key

# GitHub OAuth App
# Register at: https://github.com/settings/applications/new
# - Application name: Your app name
# - Homepage URL: http://localhost:3000
# - Authorization callback URL: http://localhost:3000/api/auth/callback/github
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

## Database Setup

Run the following SQL queries in your Supabase SQL Editor to create the required tables:

```sql
-- Triage sessions table
CREATE TABLE triage_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  repo_owner TEXT NOT NULL,
  repo_name TEXT NOT NULL,
  issue_number INTEGER NOT NULL,
  session_id TEXT NOT NULL UNIQUE,
  session_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  structured_output JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_triage_sessions_repo ON triage_sessions(repo_owner, repo_name);
CREATE INDEX idx_triage_sessions_issue ON triage_sessions(repo_owner, repo_name, issue_number);

-- Issue workflows table
CREATE TABLE issue_workflows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  repo_owner TEXT NOT NULL,
  repo_name TEXT NOT NULL,
  issue_number INTEGER NOT NULL,
  workflow_status TEXT NOT NULL DEFAULT 'new' CHECK (workflow_status IN ('new', 'triaged', 'processing', 'awaiting_instructions', 'pr', 'failed')),
  triage_session_id TEXT,
  triage_session_url TEXT,
  pr_session_id TEXT,
  pr_session_url TEXT,
  pr_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (repo_owner, repo_name, issue_number)
);

CREATE INDEX idx_issue_workflows_repo ON issue_workflows (repo_owner, repo_name);
CREATE INDEX idx_issue_workflows_status ON issue_workflows (workflow_status);

-- User settings table
CREATE TABLE user_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL,
  auto_triage_enabled BOOLEAN DEFAULT true NOT NULL,
  auto_pr_enabled BOOLEAN DEFAULT true NOT NULL,
  pr_confidence_threshold TEXT DEFAULT 'high' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_user_settings_user_id ON user_settings(user_id);
```

## Getting Started

First install all dependencies: 

```bash
npm install
```

run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.
