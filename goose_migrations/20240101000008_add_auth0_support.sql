-- +goose Up
ALTER TABLE users ADD COLUMN auth0_id TEXT;
CREATE UNIQUE INDEX idx_users_auth0_id ON users(auth0_id) WHERE is_deleted = 0 AND auth0_id IS NOT NULL;

-- +goose Down
DROP INDEX IF EXISTS idx_users_auth0_id;
ALTER TABLE users DROP COLUMN auth0_id;