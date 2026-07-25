from rest_framework import viewsets

from portal.models import Announcement, Employee, Notification
from portal.permissions import IsAdminOrHRWriteReadOnly
from portal.serializers import AnnouncementSerializer
from .helpers import log_action


class AnnouncementViewSet(viewsets.ModelViewSet):
    serializer_class = AnnouncementSerializer
    permission_classes = [IsAdminOrHRWriteReadOnly]
    queryset = Announcement.objects.all()

    def perform_create(self, serializer):
        instance = serializer.save(created_by=self.request.user)
        for employee in Employee.objects.exclude(user=None):
            Notification.objects.create(user=employee.user, title=instance.title, message=instance.message, category="Announcement")
        log_action(self.request.user, "Created announcement", "Announcement", instance.id)
