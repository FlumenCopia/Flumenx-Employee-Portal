import csv

from django.db.models import Count, Q
from django.http import HttpResponse
from django.utils.timezone import localdate, localtime
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from portal.models import AttendancePolicy, AttendanceRecord, Employee
from portal.permissions import IsAdminOrHR, portal_role
from portal.serializers import AttendancePolicySerializer, AttendanceRecordSerializer
from .helpers import attendance_summary, log_action


class AttendancePolicyViewSet(viewsets.ViewSet):
    permission_classes = [IsAdminOrHR]

    def list(self, request):
        return Response(AttendancePolicySerializer(AttendancePolicy.current()).data)

    def update(self, request, pk=None):
        policy = AttendancePolicy.current()
        serializer = AttendancePolicySerializer(policy, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class AttendanceRecordViewSet(viewsets.ModelViewSet):
    serializer_class = AttendanceRecordSerializer

    def get_permissions(self):
        if self.action in ("check_in", "check_out", "list", "retrieve", "summary", "monthly_statistics"):
            return [IsAuthenticated()]
        return [IsAdminOrHR()]

    def get_queryset(self):
        qs = AttendanceRecord.objects.select_related("employee")
        if portal_role(self.request.user) not in ("ADMIN", "HR"):
            qs = qs.filter(employee__user=self.request.user)
        params = self.request.query_params
        if params.get("date"):
            qs = qs.filter(attendance_date=params["date"])
        if params.get("month"):
            year, month = map(int, params["month"].split("-"))
            qs = qs.filter(attendance_date__year=year, attendance_date__month=month)
        if params.get("employee"):
            qs = qs.filter(employee_id=params["employee"])
        if params.get("report") == "late":
            qs = qs.filter(is_late=True)
        if params.get("report") == "early-exit":
            qs = qs.filter(is_early_exit=True)
        return qs

    @action(detail=False, methods=["post"], url_path="check-in")
    def check_in(self, request):
        role = portal_role(request.user)
        if role not in ("EMPLOYEE", "BDE", "ACCOUNTANT"):
            return Response({"detail": "Only employee workspace users can mark attendance."}, status=403)
        employee = getattr(request.user, "employee", None)
        if not employee:
            return Response({"detail": "Employee profile is required."}, status=400)
        now = localtime()
        record, created = AttendanceRecord.objects.get_or_create(
            employee=employee, attendance_date=localdate(),
            defaults={"check_in_time": now.time().replace(microsecond=0)}
        )
        if not created and record.check_in_time:
            return Response({"detail": "Already checked in.", "record": self.get_serializer(record).data}, status=409)
        record.check_in_time = now.time().replace(microsecond=0)
        record.source = "Manual"
        record.qr_reference = ""
        record.latitude = None
        record.longitude = None
        record.location_verified = False
        record.save()
        log_action(request.user, "Attendance office entry", "AttendanceRecord", record.id)
        return Response(self.get_serializer(record).data, status=201)

    @action(detail=False, methods=["post"], url_path="check-out")
    def check_out(self, request):
        role = portal_role(request.user)
        if role not in ("EMPLOYEE", "BDE", "ACCOUNTANT"):
            return Response({"detail": "Only employee workspace users can mark attendance."}, status=403)
        employee = getattr(request.user, "employee", None)
        if not employee:
            return Response({"detail": "Employee profile is required."}, status=400)
        record = AttendanceRecord.objects.filter(employee=employee, attendance_date=localdate()).first()
        if not record or not record.check_in_time:
            return Response({"detail": "Check-in is required before checkout."}, status=400)
        if record.check_out_time:
            return Response({"detail": "Already checked out.", "record": self.get_serializer(record).data}, status=409)
        record.check_out_time = localtime().time().replace(microsecond=0)
        record.save()
        log_action(request.user, "Attendance check-out", "AttendanceRecord", record.id)
        return Response(self.get_serializer(record).data)

    @action(detail=False, methods=["get"])
    def summary(self, request):
        today = localdate()
        qs = self.get_queryset()
        if not request.query_params.get("date") and not request.query_params.get("month"):
            qs = qs.filter(attendance_date=today)
        total = Employee.objects.filter(status="Active").count() if portal_role(request.user) in ("ADMIN", "HR") else None
        return Response(attendance_summary(qs, total))

    @action(detail=False, methods=["get"], url_path="monthly-statistics")
    def monthly_statistics(self, request):
        month = request.query_params.get("month", localdate().strftime("%Y-%m"))
        year, month_number = map(int, month.split("-"))
        qs = self.get_queryset()
        if not request.query_params.get("month"):
            qs = qs.filter(attendance_date__year=year, attendance_date__month=month_number)

        total = Employee.objects.filter(status="Active").count() if portal_role(request.user) in ("ADMIN", "HR") else None
        days = []
        daily_counts = qs.values("attendance_date").annotate(
            total=Count("id"),
            present=Count("id", filter=Q(attendance_status__startswith="Present")),
            late=Count("id", filter=Q(is_late=True)),
            early_exits=Count("id", filter=Q(is_early_exit=True)),
            absent=Count("id", filter=Q(attendance_status="Absent")),
            half_days=Count("id", filter=Q(attendance_status="Half Day")),
            leave=Count("id", filter=Q(attendance_status="Leave")),
        ).order_by("attendance_date")
        for counts in daily_counts:
            day = counts["attendance_date"].day
            denominator = total if total is not None else counts["total"]
            days.append({
                "day": day,
                "present": counts["present"],
                "late": counts["late"],
                "early_exits": counts["early_exits"],
                "absent": counts["absent"],
                "half_days": counts["half_days"],
                "leave": counts["leave"],
                "attendance_percentage": round(((counts["present"] + counts["half_days"] * .5) / denominator * 100), 1) if denominator else 0,
            })
        return Response({"month": month, "summary": attendance_summary(qs), "days": days})

    @action(detail=False, methods=["get"])
    def export(self, request):
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="flumenx-attendance.csv"'
        writer = csv.writer(response)
        writer.writerow(["Employee", "Code", "Date", "Check In", "Check Out", "Status", "Late Minutes", "Early Exit Minutes", "Working Hours"])
        for record in self.get_queryset():
            writer.writerow([record.employee.name, record.employee.employee_code, record.attendance_date, record.check_in_time or "", record.check_out_time or "", record.attendance_status, record.late_minutes, record.early_exit_minutes, record.working_hours])
        return response
