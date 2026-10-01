-- +migrate Up
ALTER TABLE `storyteller_oauth_grants`
    ADD COLUMN `access_token_encrypted` TEXT NOT NULL COMMENT 'Envelope-encrypted current access token, returned again when a client refreshes before it expires' AFTER `access_expires_at`,
    ADD COLUMN `access_token_data_key` VARCHAR(255) NOT NULL DEFAULT '' AFTER `access_token_encrypted`,
    ADD COLUMN `access_token_key_id` VARCHAR(64) NOT NULL DEFAULT '' AFTER `access_token_data_key`,
    ADD COLUMN `previous_refresh_token_hash` CHAR(64) NOT NULL DEFAULT '' COMMENT 'Refresh token hash replaced by the last rotation, used to audit reuse of a rotated token' AFTER `refresh_expires_at`,
    ADD KEY `idx_storyteller_oauth_grants_prev_refresh` (`previous_refresh_token_hash`);

-- +migrate Down
ALTER TABLE `storyteller_oauth_grants`
    DROP KEY `idx_storyteller_oauth_grants_prev_refresh`,
    DROP COLUMN `previous_refresh_token_hash`,
    DROP COLUMN `access_token_key_id`,
    DROP COLUMN `access_token_data_key`,
    DROP COLUMN `access_token_encrypted`;
