-- Migration 044: Signup credit repair and publication archive master-data backfill
-- Grants missed free signup credits to accounts created after the credits migration
-- and ensures approved publications exist in user_entries so new CVs inherit them.

INSERT IGNORE INTO credit_transactions (
    user_id,
    amount,
    balance_after,
    type,
    source,
    reference_type,
    reference_id,
    idempotency_key,
    metadata
)
SELECT
    u.id,
    50,
    COALESCE(u.credit_balance, 0) + 50,
    'grant',
    'signup_bonus',
    'user',
    CAST(u.id AS CHAR),
    CONCAT('signup_bonus_user_', u.id),
    JSON_OBJECT('reason', 'backfill_missing_signup_bonus')
FROM users u
WHERE NOT EXISTS (
    SELECT 1
    FROM credit_transactions ct
    WHERE ct.user_id = u.id
      AND ct.source IN ('initial_migration', 'signup_bonus')
);

UPDATE users u
JOIN (
    SELECT user_id, SUM(amount) AS balance
    FROM credit_transactions
    GROUP BY user_id
) ct ON ct.user_id = u.id
SET u.credit_balance = COALESCE(ct.balance, 0);

INSERT INTO user_entries (user_id, section_key, entry_order, data, created_at, updated_at)
SELECT
    p.user_id,
    'publications',
    COALESCE((
        SELECT MAX(ue.entry_order)
        FROM user_entries ue
        WHERE ue.user_id = p.user_id AND ue.section_key = 'publications'
    ), 0) + ROW_NUMBER() OVER (PARTITION BY p.user_id ORDER BY COALESCE(p.year, 0) DESC, p.title ASC),
    JSON_OBJECT(
        'title', COALESCE(p.title, ''),
        'authors', COALESCE(p.authors, ''),
        'year', COALESCE(CAST(p.year AS CHAR), ''),
        'venue', COALESCE(p.venue, ''),
        'doi', COALESCE(p.doi, ''),
        'url', COALESCE(p.url, '')
    ),
    p.created_at,
    p.updated_at
FROM publications p
WHERE p.is_verified = 1
  AND p.is_included = 1
  AND NOT EXISTS (
      SELECT 1
      FROM user_entries ue
      WHERE ue.user_id = p.user_id
        AND ue.section_key = 'publications'
        AND (
            (COALESCE(JSON_UNQUOTE(JSON_EXTRACT(ue.data, '$.doi')), '') <> '' AND COALESCE(p.doi, '') <> ''
             AND LOWER(TRIM(JSON_UNQUOTE(JSON_EXTRACT(ue.data, '$.doi')))) = LOWER(TRIM(p.doi)))
            OR LOWER(TRIM(JSON_UNQUOTE(JSON_EXTRACT(ue.data, '$.title')))) = LOWER(TRIM(p.title))
        )
  );