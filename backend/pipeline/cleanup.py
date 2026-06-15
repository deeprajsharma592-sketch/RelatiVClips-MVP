from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from pathlib import Path
from ..utils.config import OUTPUTS_DIR, TEMP_DIR, CLEANUP_INTERVAL_HOURS, FILE_RETENTION_HOURS


scheduler = BackgroundScheduler()


def cleanup_outputs() -> dict:
    """
    Scheduled job to clean up old output files.

    WHY HOURLY CHECKS INSTEAD OF DAILY:
    - Files created at 11pm would survive until next day's check = 23+ hours
    - Hourly = max 1 hour of "stray" files
    - 24 checks/day vs 1 check/day = negligible CPU cost

    WHY NOT CRON:
    - APScheduler runs inside Python process
    - No external crontab setup needed
    - Easy to pause/stop with app lifecycle
    - Can add cleanup hooks to FastAPI startup/shutdown

    Returns:
        dict: {deleted_count, deleted_files, errors}
    """
    from .renderer import cleanup_old_files

    deleted_files = cleanup_old_files(OUTPUTS_DIR, FILE_RETENTION_HOURS)
    temp_deleted = cleanup_temp_files()

    return {
        "deleted_count": len(deleted_files) + len(temp_deleted),
        "deleted_files": deleted_files + temp_deleted,
        "errors": []
    }


def cleanup_temp_files() -> list:
    """
    Clean up temporary files.

    WHY THIS IS NEEDED:
    - temp/ holds WAV files, transcripts, downloaded video segments
    - These can be 50-100MB per task (especially vidseg + specvid)
    - Stale segments from crashed tasks pile up (saw 226MB once)

    BUGFIX 2026-06-15: previously deleted EVERYTHING in temp/ every hour,
    which wiped in-flight downloads (renderer or surgical.py mid-write).
    Now: only delete files older than 2 hours, so in-flight work is safe.
    With CLEANUP_INTERVAL_HOURS=6 and 2h grace = max 8h lifetime for
    a stale file (vs 1h before, which was destructive).

    Returns:
        List of deleted file paths
    """
    from datetime import datetime, timedelta
    deleted = []
    cutoff = datetime.now() - timedelta(hours=2)

    for file_path in TEMP_DIR.glob("*"):
        if not file_path.is_file():
            continue
        try:
            mtime = datetime.fromtimestamp(file_path.stat().st_mtime)
            if mtime < cutoff:
                file_path.unlink()
                deleted.append(str(file_path))
        except Exception:
            pass

    return deleted


def start_cleanup_scheduler():
    """
    Start the periodic cleanup scheduler.

    WHY THIS RUNS AT APP START:
    - Ensures cleanup runs even if no requests come in
    - Handles edge case of app running but no videos processed
    - Prevents temp/ from accumulating between test runs
    """
    if not scheduler.running:
        scheduler.add_job(
            cleanup_outputs,
            trigger=IntervalTrigger(hours=CLEANUP_INTERVAL_HOURS),
            id="cleanup_job",
            name="Clean up files older than 24 hours",
            replace_existing=True
        )
        scheduler.start()


def stop_cleanup_scheduler():
    """Stop the cleanup scheduler on app shutdown."""
    if scheduler.running:
        scheduler.shutdown(wait=False)


def get_scheduler_status() -> dict:
    """
    Get current scheduler status.

    Returns:
        dict: {running, next_run, jobs}
    """
    if scheduler.running:
        jobs = scheduler.get_jobs()
        return {
            "running": True,
            "job_count": len(jobs),
            "next_run": str(jobs[0].next_run_time) if jobs else None
        }

    return {
        "running": False,
        "job_count": 0,
        "next_run": None
    }