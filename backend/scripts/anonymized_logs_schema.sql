-- Source video URL (anonymized, only video_id stored)
-- Generated clip metadata (viral_title, caption, hashtags)
-- Task timing (start, end, total_seconds)
-- User IP (anonymized: hashed with rotating salt)
-- User agent (browser, OS, version)
-- Result status (ok / fail / error type)

CREATE TABLE IF NOT EXISTS anonymized_pipeline_logs (
    id BIGSERIAL PRIMARY KEY,
    task_id TEXT NOT NULL,
    video_id TEXT NOT NULL,        -- from URL, no PII
    source_domain TEXT,            -- e.g. "youtube.com"
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    result_status TEXT NOT NULL,  -- 'success' | 'error' | 'rate_limited'
    error_type TEXT,               -- e.g. 'youtube_block', 'timeout', 'oom'
    ip_hash TEXT,                  -- SHA-256 of IP + rotating daily salt
    user_agent_family TEXT,        -- 'Chrome', 'Safari', etc.
    user_agent_os TEXT,            -- 'iOS', 'Android', 'Windows', etc.
    clip_count INTEGER DEFAULT 0,
    total_output_bytes BIGINT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- No email, no name, no URL beyond the domain, no full user agent
-- IP is hashed, salt rotates daily
-- 90-day retention (auto-purge via pg_cron or app-level scheduler)

CREATE INDEX IF NOT EXISTS idx_anonymized_logs_created ON anonymized_pipeline_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_anonymized_logs_video ON anonymized_pipeline_logs(video_id);
CREATE INDEX IF NOT EXISTS idx_anonymized_logs_status ON anonymized_pipeline_logs(result_status);

COMMENT ON TABLE anonymized_pipeline_logs IS
'Privacy-respecting task log. No PII. IP hashed with daily salt. 90-day retention.';
