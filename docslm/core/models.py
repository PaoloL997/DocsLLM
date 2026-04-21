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
