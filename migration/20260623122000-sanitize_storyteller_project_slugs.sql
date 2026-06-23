-- +migrate Up
UPDATE `storyteller_projects`
SET `slug` = TRIM(BOTH '_' FROM REGEXP_REPLACE(`slug`, '[^[:alnum:]一-龥ぁ-んァ-ン._~-]+', '_'))
WHERE `slug` IS NOT NULL
  AND `slug` REGEXP '[^[:alnum:]一-龥ぁ-んァ-ン._~-]';

UPDATE `storyteller_projects`
SET `slug` = REGEXP_REPLACE(`slug`, '_+', '_')
WHERE `slug` IS NOT NULL
  AND `slug` LIKE '%__%';

UPDATE `storyteller_projects`
SET `slug` = `public_id`
WHERE `slug` IS NULL
   OR `slug` = '';

-- +migrate Down
-- Slug sanitization is not reversible without the original values.
