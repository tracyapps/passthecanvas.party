CREATE TABLE IF NOT EXISTS studio_profiles (
  user_id text PRIMARY KEY,
  id uuid NOT NULL UNIQUE,
  name text NOT NULL,
  bio text NOT NULL DEFAULT '',
  avatar jsonb NOT NULL,
  share boolean NOT NULL DEFAULT false,
  allow_requests boolean NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS studio_friendships (
  low_id text NOT NULL REFERENCES studio_profiles(user_id),
  high_id text NOT NULL REFERENCES studio_profiles(user_id),
  sender text NOT NULL REFERENCES studio_profiles(user_id),
  state text NOT NULL CHECK (state IN ('pending', 'accepted', 'declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (low_id, high_id),
  CHECK (low_id < high_id),
  CHECK (sender IN (low_id, high_id))
);
CREATE INDEX IF NOT EXISTS studio_friendships_high ON studio_friendships(high_id);
CREATE TABLE IF NOT EXISTS studio_scheduled_parties (
  id uuid PRIMARY KEY,
  host_id text NOT NULL REFERENCES studio_profiles(user_id),
  title text NOT NULL,
  starts_at timestamptz NOT NULL,
  time_zone text NOT NULL,
  duration_minutes integer NOT NULL CHECK (duration_minutes BETWEEN 15 AND 240),
  share_digest text NOT NULL UNIQUE,
  cancelled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS studio_scheduled_host ON studio_scheduled_parties(host_id, starts_at);
CREATE TABLE IF NOT EXISTS studio_party_invites (
  party_id uuid NOT NULL REFERENCES studio_scheduled_parties(id),
  user_id text NOT NULL REFERENCES studio_profiles(user_id),
  response text NOT NULL DEFAULT 'pending' CHECK (response IN ('pending', 'yes', 'no')),
  PRIMARY KEY (party_id, user_id)
);
CREATE INDEX IF NOT EXISTS studio_invites_user ON studio_party_invites(user_id);
-- Written only by a future verified party-completion adapter, never a browser.
CREATE TABLE IF NOT EXISTS studio_party_history (
  party_id uuid NOT NULL,
  user_id text NOT NULL REFERENCES studio_profiles(user_id),
  title text NOT NULL,
  ended_at timestamptz NOT NULL,
  artwork_count integer NOT NULL CHECK (artwork_count >= 0),
  PRIMARY KEY (party_id, user_id)
);
ALTER TABLE studio_profiles ADD COLUMN IF NOT EXISTS email_invites boolean NOT NULL DEFAULT false;
ALTER TABLE studio_profiles ADD COLUMN IF NOT EXISTS email_reminders boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS studio_mail_outbox (
  id uuid PRIMARY KEY,
  party_id uuid NOT NULL REFERENCES studio_scheduled_parties(id),
  user_id text NOT NULL REFERENCES studio_profiles(user_id),
  kind text NOT NULL CHECK (kind IN ('invitation','reminder')),
  due_at timestamptz NOT NULL,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','processing','sent','skipped','failed')),
  attempts integer NOT NULL DEFAULT 0,
  first_attempt_at timestamptz,
  lease_until timestamptz,
  provider_id text,
  UNIQUE(party_id,user_id,kind)
);
CREATE INDEX IF NOT EXISTS studio_mail_due ON studio_mail_outbox(state,due_at);
