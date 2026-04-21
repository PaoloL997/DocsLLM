import os

from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'docslm.settings')

app = Celery('docslm')
app.config_from_object('django.conf:settings', namespace='CELERY')

import services.process  # noqa: E402,F401 — register tasks with Celery
