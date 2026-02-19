CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  sprint_label TEXT,
  vote_limit INTEGER NOT NULL DEFAULT 5 CHECK (vote_limit BETWEEN 1 AND 20),
  created_by_participant_id UUID NOT NULL,
  phase TEXT NOT NULL CHECK (phase IN ('collecting', 'discussing', 'finished')),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS participants (
  id UUID PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_admin BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS entry_groups (
  id UUID PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('went_right', 'went_wrong')),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS entries (
  id UUID PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  author_participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('went_right', 'went_wrong')),
  content TEXT NOT NULL,
  group_id UUID NULL REFERENCES entry_groups(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS action_items (
  id UUID PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  created_by_participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS votes (
  id UUID PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  entry_id UUID NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  value SMALLINT NOT NULL CHECK (value = 1),
  created_at TIMESTAMPTZ NOT NULL,
  UNIQUE (session_id, entry_id, participant_id)
);

CREATE TABLE IF NOT EXISTS happiness_checks (
  id UUID PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 10),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (session_id, participant_id)
);

CREATE TABLE IF NOT EXISTS navigation (
  session_id UUID PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
  active_section TEXT NOT NULL CHECK (active_section IN ('retro', 'discussion', 'actions', 'happiness', 'done')),
  discussion_entry_id UUID NULL REFERENCES entries(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_participants_session_id ON participants(session_id);
CREATE INDEX IF NOT EXISTS idx_entries_session_id ON entries(session_id);
CREATE INDEX IF NOT EXISTS idx_entries_group_id ON entries(group_id);
CREATE INDEX IF NOT EXISTS idx_votes_entry_id ON votes(entry_id);
CREATE INDEX IF NOT EXISTS idx_votes_session_participant ON votes(session_id, participant_id);
CREATE INDEX IF NOT EXISTS idx_happiness_session_id ON happiness_checks(session_id);
CREATE INDEX IF NOT EXISTS idx_action_items_session_id ON action_items(session_id);
