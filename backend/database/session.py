import os
from pathlib import Path
from dotenv import load_dotenv

# Ensure .env is loaded from project root even if session.py is imported first
_root_env = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(_root_env)
load_dotenv()

import urllib.parse
from fastapi import HTTPException
from sqlalchemy import make_url, text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

def sanitize_db_url(url: str) -> str:
    """Safely URL-encode special characters in the password (e.g. '@', '#')."""
    if "://" in url and "@" in url:
        prefix, _, rest = url.partition("://")
        userinfo, _, hostinfo = rest.rpartition("@")
        if ":" in userinfo:
            user, _, password = userinfo.partition(":")
            encoded_password = urllib.parse.quote(urllib.parse.unquote(password))
            return f"{prefix}://{user}:{encoded_password}@{hostinfo}"
    return url

DATABASE_URL = sanitize_db_url(os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://relativ_admin:relativ_secure_pass@localhost:5432/relativ_db"
))



_database_url = make_url(DATABASE_URL)
if _database_url.drivername in ("postgres", "postgresql"):
    _database_url = _database_url.set(drivername="postgresql+asyncpg")
# Supabase dashboard connection strings typically use libpq's sslmode query
# parameter. asyncpg expects the equivalent `ssl` parameter instead.
_database_query = dict(_database_url.query)
if "sslmode" in _database_query and "ssl" not in _database_query:
    _database_query["ssl"] = _database_query.pop("sslmode")
    _database_url = _database_url.set(query=_database_query)
DATABASE_URL = _database_url.render_as_string(hide_password=False)

engine = create_async_engine(DATABASE_URL, echo=False, pool_size=5, max_overflow=10)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

_DB_AVAILABLE = False


async def get_session() -> AsyncSession:
    if not _DB_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="Database unavailable — running in memory-only mode"
        )
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    global _DB_AVAILABLE
    from .models import Base
    from ..caching.models import VideoCacheModel
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Additive bridge columns let existing app records link to Supabase
        # identities without replacing user IDs or marketplace foreign keys.
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_user_id VARCHAR(36)"))
        await conn.execute(text(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS credit_balance INTEGER NOT NULL DEFAULT 400"
        ))
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS credit_unit_version INTEGER NOT NULL DEFAULT 1"))
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_tier VARCHAR(20) NOT NULL DEFAULT 'free'"))
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false"))
        await conn.execute(text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS user_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL"))
        # One-time denomination migration: old credits represented clips; v2
        # represents 1/200th of a clip. The version flag makes this idempotent.
        await conn.execute(text("UPDATE users SET credit_balance = credit_balance * 200, credit_unit_version = 2 WHERE credit_unit_version = 1"))
        await conn.execute(text("ALTER TABLE users ALTER COLUMN credit_balance SET DEFAULT 400"))
        await conn.execute(text("ALTER TABLE users ALTER COLUMN credit_unit_version SET DEFAULT 2"))
        await conn.execute(text("UPDATE users SET is_admin = true WHERE lower(email) = 'deeprajsharma592@gmail.com'"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_tasks_user_id ON tasks(user_id)"))
        await conn.execute(text(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_tasks_one_active_per_user "
            "ON tasks (user_id) WHERE user_id IS NOT NULL AND status IN ('queued', 'processing')"
        ))
        await conn.execute(text("ALTER TABLE users ALTER COLUMN hashed_password DROP NOT NULL"))
        await conn.execute(text("ALTER TABLE clips ADD COLUMN IF NOT EXISTS caption_words JSONB"))
        await conn.execute(text("ALTER TABLE clips ADD COLUMN IF NOT EXISTS caption_style JSONB"))
        await conn.execute(text("ALTER TABLE clips ADD COLUMN IF NOT EXISTS caption_layout JSONB"))
        await conn.execute(text("ALTER TABLE clips ADD COLUMN IF NOT EXISTS subject_track JSONB"))
        await conn.execute(text(
            "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_auth_user_id "
            "ON users (auth_user_id)"
        ))

        # Supabase's auth.users trigger mirrors identities into the existing
        # application profile table, so the admin panel and business models
        # remain SQLAlchemy-backed on Supabase Postgres.
        from ..services.supabase_auth import is_supabase_auth_configured
        if is_supabase_auth_configured():
            try:
                has_auth_users = (await conn.execute(text(
                    "SELECT to_regclass('auth.users') IS NOT NULL"
                ))).scalar_one()
                if has_auth_users:
                    await conn.execute(text(r"""
                        CREATE OR REPLACE FUNCTION public.sync_relativ_auth_user()
                        RETURNS trigger
                        LANGUAGE plpgsql
                        SECURITY DEFINER
                        SET search_path = public
                        AS $$
                        DECLARE
                            app_user_id VARCHAR(36);
                        BEGIN
                            SELECT id INTO app_user_id
                            FROM public.users
                            WHERE lower(email) = lower(NEW.email)
                            LIMIT 1;

                            IF app_user_id IS NOT NULL THEN
                                UPDATE public.users
                                SET auth_user_id = NEW.id::text,
                                    email = lower(NEW.email),
                                    name = COALESCE(NULLIF(NEW.raw_user_meta_data->>'name', ''), name),
                                    hashed_password = NULL,
                                    is_verified = (NEW.email_confirmed_at IS NOT NULL),
                                    email_verified_at = NEW.email_confirmed_at,
                                    updated_at = now()
                                WHERE id = app_user_id
                                  AND (auth_user_id IS NULL OR auth_user_id = NEW.id::text);
                            ELSE
                                INSERT INTO public.users (
                                    id, auth_user_id, email, hashed_password, role, name,
                                    is_active, is_verified, credit_balance, credit_unit_version,
                                    is_admin, created_at, updated_at, email_verified_at
                                ) VALUES (
                                    NEW.id::text, NEW.id::text, lower(NEW.email), NULL, 'creator',
                                    COALESCE(NULLIF(NEW.raw_user_meta_data->>'name', ''), split_part(NEW.email, '@', 1)),
                                    true, (NEW.email_confirmed_at IS NOT NULL), 400, 2,
                                    (lower(NEW.email) = 'deeprajsharma592@gmail.com'),
                                    COALESCE(NEW.created_at, now()), now(), NEW.email_confirmed_at
                                )
                                ON CONFLICT (auth_user_id) DO UPDATE SET
                                    email = EXCLUDED.email,
                                    is_verified = EXCLUDED.is_verified,
                                    email_verified_at = EXCLUDED.email_verified_at,
                                    updated_at = now()
                                RETURNING id INTO app_user_id;
                            END IF;

                            RETURN NEW;
                        END;
                        $$
                    """))
                    await conn.execute(text("DROP TRIGGER IF EXISTS relativ_auth_user_sync ON auth.users"))
                    await conn.execute(text(r"""
                        CREATE TRIGGER relativ_auth_user_sync
                        AFTER INSERT OR UPDATE OF email, email_confirmed_at, raw_user_meta_data
                        ON auth.users
                        FOR EACH ROW EXECUTE FUNCTION public.sync_relativ_auth_user()
                    """))
            except Exception as trigger_e:
                # In managed Supabase, trigger creation on auth.users requires elevated permissions.
                # Auth router syncs users in Python on sign-in, so this is safe to pass.
                print(f"[DB] Note: auth.users trigger setup skipped: {trigger_e}")

            try:
                # The browser uses Supabase only for Auth. All business-table reads
                # and writes go through FastAPI, so the public Data API gets no
                # implicit access to app records.
                await conn.execute(text(r"""
                    DO $$
                    DECLARE relation record;
                    BEGIN
                        FOR relation IN
                            SELECT tablename FROM pg_tables WHERE schemaname = 'public'
                        LOOP
                            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', relation.tablename);
                        END LOOP;
                    END;
                    $$
                """))
            except Exception as rls_e:
                print(f"[DB] Note: RLS enable skipped: {rls_e}")

    _DB_AVAILABLE = True


async def close_db():
    global _DB_AVAILABLE
    _DB_AVAILABLE = False
    await engine.dispose()
