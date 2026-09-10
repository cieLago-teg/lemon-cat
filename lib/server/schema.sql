CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY, email text NOT NULL UNIQUE, password_hash text NOT NULL,
  credits integer NOT NULL DEFAULT 0 CHECK (credits >= 0), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS assets (
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), object_key text NOT NULL UNIQUE,
  content_type text NOT NULL, size integer NOT NULL, sha256 text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS pets (
  id text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), data jsonb NOT NULL,
  version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS backend text NOT NULL DEFAULT 'local';
CREATE INDEX IF NOT EXISTS assets_owner_hash ON assets(user_id,sha256);
CREATE INDEX IF NOT EXISTS pets_owner ON pets(user_id);
CREATE TABLE IF NOT EXISTS generation_jobs (
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), kind text NOT NULL CHECK (kind IN ('extract','generate','animate')),
  idempotency_key text NOT NULL, input_hash text NOT NULL, input jsonb NOT NULL,
  state text NOT NULL DEFAULT 'queued', upstream_id text, result jsonb,
  attempts integer NOT NULL DEFAULT 0, next_run timestamptz NOT NULL DEFAULT now(),
  locked_by uuid, lease_until timestamptz, error text, request_id text NOT NULL,
  cost integer NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS job_queue ON generation_jobs(state, next_run, lease_until);
CREATE TABLE IF NOT EXISTS usage_ledger (
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), job_id uuid NOT NULL REFERENCES generation_jobs(id),
  delta integer NOT NULL, reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(job_id, reason)
);
CREATE TABLE IF NOT EXISTS worker_heartbeats (id uuid PRIMARY KEY, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS rate_limits (key text PRIMARY KEY, count integer NOT NULL DEFAULT 0, expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS image_feedback (
  user_id uuid NOT NULL REFERENCES users(id), asset_id uuid NOT NULL REFERENCES assets(id),
  job_id uuid NOT NULL REFERENCES generation_jobs(id), data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,asset_id)
);
