-- +goose Up
UPDATE teams SET invite_code = lower(hex(randomblob(8))) WHERE invite_code IS NULL;

-- +goose Down