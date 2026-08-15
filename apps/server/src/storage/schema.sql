CREATE TABLE IF NOT EXISTS matches (
  match_id text PRIMARY KEY,
  game_name text NOT NULL,
  metadata jsonb NOT NULL,
  state jsonb NOT NULL,
  initial_state jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS matches_game_updated_idx
  ON matches (game_name, updated_at DESC);

CREATE TABLE IF NOT EXISTS match_logs (
  match_id text NOT NULL REFERENCES matches(match_id) ON DELETE CASCADE,
  sequence_no bigint NOT NULL,
  entry jsonb NOT NULL,
  PRIMARY KEY (match_id, sequence_no)
);
