"""Celery application and task configuration"""
from celery import Celery
from celery.schedules import crontab
from app.config import settings

# Create Celery app
celery_app = Celery(
    "academic_cv_saas",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "app.tasks.latex_tasks",
        "app.tasks.sync_tasks",
        "app.tasks.email_tasks",
    ]
)

# Celery configuration
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=300,  # 5 minutes
    task_soft_time_limit=240,  # 4 minutes
    worker_prefetch_multiplier=4,
    worker_max_tasks_per_child=1000,
)

# Periodic tasks configuration
celery_app.conf.beat_schedule = {
    # Sync Google Scholar every week
    "sync-google-scholar-weekly": {
        "task": "app.tasks.sync_tasks.sync_all_google_scholar",
        "schedule": crontab(hour=2, minute=0, day_of_week=1),  # Every Monday at 2 AM
    },
    # Sync ORCID every week
    "sync-orcid-weekly": {
        "task": "app.tasks.sync_tasks.sync_all_orcid",
        "schedule": crontab(hour=3, minute=0, day_of_week=1),  # Every Monday at 3 AM
    },
    # Send CV update reminders every month
    "send-cv-reminders-monthly": {
        "task": "app.tasks.email_tasks.send_cv_update_reminders",
        "schedule": crontab(hour=10, minute=0, day_of_month=1),  # 1st of every month at 10 AM
    },
    # Cleanup old temp files daily
    "cleanup-temp-files-daily": {
        "task": "app.tasks.latex_tasks.cleanup_temp_files",
        "schedule": crontab(hour=1, minute=0),  # Every day at 1 AM
    },
}


@celery_app.task(bind=True)
def debug_task(self):
    """Debug task for testing Celery"""
    print(f"Request: {self.request!r}")
    return "Celery is working!"
