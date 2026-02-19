ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS vote_limit INTEGER;

UPDATE sessions
SET vote_limit = 5
WHERE vote_limit IS NULL;

ALTER TABLE sessions
  ALTER COLUMN vote_limit SET NOT NULL,
  ALTER COLUMN vote_limit SET DEFAULT 5;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sessions_vote_limit_check'
  ) THEN
    ALTER TABLE sessions
      ADD CONSTRAINT sessions_vote_limit_check CHECK (vote_limit BETWEEN 1 AND 20);
  END IF;
END $$;
