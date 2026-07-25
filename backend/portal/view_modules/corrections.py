from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from portal.models import AttendanceCorrection, Notification
from portal.permissions import IsAdminOrHR, portal_role
from portal.serializers import AttendanceCorrectionSerializer
from .helpers import log_action


class AttendanceCorrectionViewSet(viewsets.ModelViewSet):
    serializer_class = AttendanceCorrectionSerializer

    def get_queryset(self):
        qs = AttendanceCorrection.objects.select_related("employee", "attendance_record")
        return qs if portal_role(self.request.user) in ("ADMIN", "HR") else qs.filter(employee__user=self.request.user)

    def perform_create(self, serializer):
        correction = serializer.save(employee=self.request.user.employee)
        log_action(self.request.user, "Requested attendance correction", "AttendanceCorrection", correction.id)

    @action(detail=True, methods=["post"], permission_classes=[IsAdminOrHR])
    def decide(self, request, pk=None):
        correction = self.get_object()
        decision = request.data.get("status")
        if decision not in ("Approved", "Rejected"):
            return Response({"detail": "Status must be Approved or Rejected."}, status=400)
        correction.status = decision
        correction.admin_note = request.data.get("admin_note", "")
        correction.reviewed_by = request.user
        correction.reviewed_at = timezone.now()
        correction.save()
        if decision == "Approved":
            record = correction.attendance_record
            if correction.requested_check_in:
                record.check_in_time = correction.requested_check_in
            if correction.requested_check_out:
                record.check_out_time = correction.requested_check_out
            record.notes = f"Corrected via request #{correction.id}"
            record.save()
        Notification.objects.create(user=correction.employee.user, title=f"Attendance correction {decision}", message=f"Your correction for {correction.attendance_record.attendance_date} was {decision.lower()}.", category="Attendance")
        log_action(request.user, f"Attendance correction {decision}", "AttendanceCorrection", correction.id)
        return Response(self.get_serializer(correction).data)
