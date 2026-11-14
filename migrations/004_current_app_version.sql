-- The current Android production candidate is versionCode 34.
-- Never lower a value already set by an operator.
UPDATE app_config
SET latest_version_code = GREATEST(latest_version_code, 34),
    updated_at = now()
WHERE id = 1;
