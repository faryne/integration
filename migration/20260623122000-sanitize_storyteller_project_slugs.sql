-- +migrate Up
UPDATE `storyteller_projects`
SET `slug` = TRIM(BOTH '_' FROM `slug`)
WHERE `slug` IS NOT NULL;

UPDATE `storyteller_projects` SET `slug` = REPLACE(`slug`, '/', '_') WHERE `slug` IS NOT NULL;
UPDATE `storyteller_projects` SET `slug` = REPLACE(`slug`, CHAR(92), '_') WHERE `slug` IS NOT NULL;
UPDATE `storyteller_projects` SET `slug` = REPLACE(`slug`, ' ', '_') WHERE `slug` IS NOT NULL;
UPDATE `storyteller_projects` SET `slug` = REPLACE(`slug`, CHAR(9), '_') WHERE `slug` IS NOT NULL;
UPDATE `storyteller_projects` SET `slug` = REPLACE(`slug`, CHAR(10), '_') WHERE `slug` IS NOT NULL;
UPDATE `storyteller_projects` SET `slug` = REPLACE(`slug`, CHAR(13), '_') WHERE `slug` IS NOT NULL;
UPDATE `storyteller_projects` SET `slug` = REPLACE(`slug`, '?', '_') WHERE `slug` IS NOT NULL;
UPDATE `storyteller_projects` SET `slug` = REPLACE(`slug`, '#', '_') WHERE `slug` IS NOT NULL;
UPDATE `storyteller_projects` SET `slug` = REPLACE(`slug`, '%', '_') WHERE `slug` IS NOT NULL;
UPDATE `storyteller_projects` SET `slug` = REPLACE(`slug`, '&', '_') WHERE `slug` IS NOT NULL;
UPDATE `storyteller_projects` SET `slug` = REPLACE(`slug`, '=', '_') WHERE `slug` IS NOT NULL;
UPDATE `storyteller_projects` SET `slug` = REPLACE(`slug`, '+', '_') WHERE `slug` IS NOT NULL;
UPDATE `storyteller_projects` SET `slug` = REPLACE(`slug`, ':', '_') WHERE `slug` IS NOT NULL;
UPDATE `storyteller_projects` SET `slug` = REPLACE(`slug`, ';', '_') WHERE `slug` IS NOT NULL;
UPDATE `storyteller_projects` SET `slug` = REPLACE(`slug`, ',', '_') WHERE `slug` IS NOT NULL;
UPDATE `storyteller_projects` SET `slug` = REPLACE(`slug`, '<', '_') WHERE `slug` IS NOT NULL;
UPDATE `storyteller_projects` SET `slug` = REPLACE(`slug`, '>', '_') WHERE `slug` IS NOT NULL;
UPDATE `storyteller_projects` SET `slug` = REPLACE(`slug`, '"', '_') WHERE `slug` IS NOT NULL;
UPDATE `storyteller_projects` SET `slug` = REPLACE(`slug`, '''', '_') WHERE `slug` IS NOT NULL;
UPDATE `storyteller_projects` SET `slug` = REPLACE(`slug`, '`', '_') WHERE `slug` IS NOT NULL;
UPDATE `storyteller_projects` SET `slug` = REPLACE(`slug`, '!', '_') WHERE `slug` IS NOT NULL;
UPDATE `storyteller_projects` SET `slug` = REPLACE(`slug`, '@', '_') WHERE `slug` IS NOT NULL;
UPDATE `storyteller_projects` SET `slug` = REPLACE(`slug`, '$', '_') WHERE `slug` IS NOT NULL;
UPDATE `storyteller_projects` SET `slug` = REPLACE(`slug`, '^', '_') WHERE `slug` IS NOT NULL;
UPDATE `storyteller_projects` SET `slug` = REPLACE(`slug`, '*', '_') WHERE `slug` IS NOT NULL;
UPDATE `storyteller_projects` SET `slug` = REPLACE(`slug`, '(', '_') WHERE `slug` IS NOT NULL;
UPDATE `storyteller_projects` SET `slug` = REPLACE(`slug`, ')', '_') WHERE `slug` IS NOT NULL;
UPDATE `storyteller_projects` SET `slug` = REPLACE(`slug`, '[', '_') WHERE `slug` IS NOT NULL;
UPDATE `storyteller_projects` SET `slug` = REPLACE(`slug`, ']', '_') WHERE `slug` IS NOT NULL;
UPDATE `storyteller_projects` SET `slug` = REPLACE(`slug`, '{', '_') WHERE `slug` IS NOT NULL;
UPDATE `storyteller_projects` SET `slug` = REPLACE(`slug`, '}', '_') WHERE `slug` IS NOT NULL;
UPDATE `storyteller_projects` SET `slug` = REPLACE(`slug`, '|', '_') WHERE `slug` IS NOT NULL;
UPDATE `storyteller_projects` SET `slug` = REPLACE(`slug`, '。', '_') WHERE `slug` IS NOT NULL;
UPDATE `storyteller_projects` SET `slug` = REPLACE(`slug`, '、', '_') WHERE `slug` IS NOT NULL;
UPDATE `storyteller_projects` SET `slug` = REPLACE(`slug`, '，', '_') WHERE `slug` IS NOT NULL;
UPDATE `storyteller_projects` SET `slug` = REPLACE(`slug`, '？', '_') WHERE `slug` IS NOT NULL;

UPDATE `storyteller_projects`
SET `slug` = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
    REPLACE(REPLACE(`slug`, '__', '_'), '__', '_'), '__', '_'), '__', '_'),
    '__', '_'), '__', '_'), '__', '_'), '__', '_'), '__', '_'), '__', '_')
WHERE `slug` IS NOT NULL
  AND `slug` LIKE '%__%';

UPDATE `storyteller_projects`
SET `slug` = TRIM(BOTH '_' FROM `slug`)
WHERE `slug` IS NOT NULL;

UPDATE `storyteller_projects`
SET `slug` = `public_id`
WHERE `slug` IS NULL
   OR `slug` = '';

-- +migrate Down
-- Slug sanitization is not reversible without the original values.
