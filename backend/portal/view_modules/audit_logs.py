from rest_framework import viewsets

from portal.models import AuditLog
from portal.permissions import IsPortalAdmin
from portal.serializers import AuditLogSerializer


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AuditLogSerializer
    permission_classes = [IsPortalAdmin]
    queryset = AuditLog.objects.select_related("actor")
