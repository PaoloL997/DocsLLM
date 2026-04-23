from django.conf import settings
from django.db import models


class UserProfile(models.Model):
    """Extended profile attached to Django's built-in User."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='profile',
    )
    job_title = models.CharField(max_length=100, blank=True, default='')

    def __str__(self) -> str:
        return f"{self.user.username} — {self.job_title}"


class CollectionTask(models.Model):
    """Tracks the async processing state of a Milvus collection."""

    STATUS_CHOICES = [
        ('pending', 'In attesa'),
        ('processing', 'In elaborazione'),
        ('ready', 'Pronto'),
        ('error', 'Errore'),
    ]

    commessa = models.CharField(max_length=200)
    collection_name = models.CharField(max_length=200)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    task_id = models.CharField(max_length=255, blank=True, null=True)
    files = models.JSONField(default=list)
    files_done = models.IntegerField(default=0)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='collection_tasks',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self) -> str:
        return f"{self.commessa}/{self.collection_name} — {self.status}"


class Report(models.Model):
    """Tracks the async generation of a report (batch Q&A over a collection)."""

    STATUS_CHOICES = [
        ('pending', 'In attesa'),
        ('processing', 'In elaborazione'),
        ('ready', 'Pronto'),
        ('error', 'Errore'),
    ]

    MODE_CHOICES = [
        ('veloce', 'Veloce'),
        ('ragionamento', 'Ragionamento'),
    ]

    commessa = models.CharField(max_length=200)
    collection_name = models.CharField(max_length=200)
    report_name = models.CharField(max_length=255)
    mode = models.CharField(max_length=20, choices=MODE_CHOICES, default='veloce')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    task_id = models.CharField(max_length=255, blank=True, null=True)
    total_queries = models.IntegerField(default=0)
    done_queries = models.IntegerField(default=0)
    error_message = models.TextField(blank=True, default='')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='reports',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['commessa', 'collection_name', 'report_name'],
                name='unique_report_name_per_collection',
            ),
        ]

    def __str__(self) -> str:
        return f"{self.commessa}/{self.collection_name}/{self.report_name} — {self.status}"


class ReportItem(models.Model):
    """Single Q/A pair of a Report with extracted references."""

    report = models.ForeignKey(
        Report, on_delete=models.CASCADE, related_name='items',
    )
    order = models.IntegerField(default=0)
    query = models.TextField()
    response = models.TextField(blank=True, default='')
    references = models.JSONField(default=list)

    class Meta:
        ordering = ['order']

    def __str__(self) -> str:
        return f"{self.report_id}#{self.order}"
