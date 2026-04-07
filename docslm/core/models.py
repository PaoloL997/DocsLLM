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
