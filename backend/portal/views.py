from django.db.models import Count, Q
from django.utils.timezone import localdate, localtime
from calendar import monthrange
from math import asin, cos, radians, sin, sqrt
from django.http import HttpResponse
from django.utils import timezone
import csv
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken, TokenError
from rest_framework import serializers
from .models import Announcement, AttendancePolicy, AttendanceRecord, Employee, LeaveRequest, Meeting, SalarySlip
from .permissions import IsAdminOrAccountant, IsAdminOrHR, IsAdminOrHRWriteReadOnly, IsPortalAdmin, portal_role
from .models import AttendanceCorrection, AuditLog, Notification
from .serializers import AttendanceCorrectionSerializer, AuditLogSerializer, NotificationSerializer, RegisterSerializer

def log_action(user, action, entity, entity_id="", details=None):
    AuditLog.objects.create(actor=user, action=action, entity_type=entity, entity_id=str(entity_id), details=details or {})

def location_distance_meters(lat1, lon1, lat2, lon2):
    radius = 6371000
    dlat, dlon = radians(float(lat2) - float(lat1)), radians(float(lon2) - float(lon1))
    value = sin(dlat / 2) ** 2 + cos(radians(float(lat1))) * cos(radians(float(lat2))) * sin(dlon / 2) ** 2
    return radius * 2 * asin(sqrt(value))
from .serializers import AnnouncementSerializer, AttendancePolicySerializer, AttendanceRecordSerializer, EmployeeSerializer, LeaveSerializer, MeetingSerializer, ProfileSerializer, SalarySlipSerializer

def attendance_summary(queryset, total_employees=None):
    present = queryset.filter(attendance_status__startswith="Present").count()
    half_days = queryset.filter(attendance_status="Half Day").count()
    absent = queryset.filter(attendance_status="Absent").count()
    leave = queryset.filter(attendance_status="Leave").count()
    denominator = total_employees if total_employees is not None else queryset.count()
    return {
        "present": present,
        "late": queryset.filter(is_late=True).count(),
        "early_exits": queryset.filter(is_early_exit=True).count(),
        "absent": absent,
        "half_days": half_days,
        "leave": leave,
        "attendance_percentage": round(((present + half_days * .5) / denominator * 100), 1) if denominator else 0,
    }

class FlumenxTokenSerializer(TokenObtainPairSerializer):
    portal_role = serializers.ChoiceField(choices=("HR", "ADMIN", "ACCOUNTANT", "BDO", "EMPLOYEE"), write_only=True)

    def validate(self, attrs):
        selected_role = attrs.pop("portal_role")
        data = super().validate(attrs)
        actual_role = ProfileSerializer(self.user).data["portal_role"]
        if selected_role != actual_role:
            raise serializers.ValidationError({"portal_role": "The selected role does not match this account."})
        data["user"] = ProfileSerializer(self.user).data
        return data

class LoginView(TokenObtainPairView):
    permission_classes = [AllowAny]
    serializer_class = FlumenxTokenSerializer

@api_view(["POST"])
@permission_classes([AllowAny])
def register(request):
    serializer = RegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.save()
    return Response({"message": "Account created successfully.", "user": ProfileSerializer(user).data}, status=201)

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout(request):
    refresh = request.data.get("refresh")
    if not refresh:
        return Response({"refresh": ["This field is required."]}, status=400)
    try:
        RefreshToken(refresh).blacklist()
    except TokenError:
        return Response({"refresh": ["Token is invalid or already revoked."]}, status=400)
    return Response(status=204)

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    return Response(ProfileSerializer(request.user).data)

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def dashboard(request):
    today = localdate()
    role = portal_role(request.user)
    base = {
        "upcoming_meetings": MeetingSerializer(Meeting.objects.filter(date__gte=today)[:4], many=True).data,
        "announcements": AnnouncementSerializer(Announcement.objects.all()[:4], many=True).data,
    }
    if role in ("ADMIN", "HR", "ACCOUNTANT"):
        today_records = AttendanceRecord.objects.filter(attendance_date=today)
        base.update({
            "total_employees": Employee.objects.count(),
            "active_employees": Employee.objects.filter(status="Active").count(),
            "pending_leaves": LeaveRequest.objects.filter(status="Pending").count(),
            "salary_slips": SalarySlip.objects.count(),
            "recent_leaves": LeaveSerializer(LeaveRequest.objects.all()[:5], many=True).data,
            "attendance": attendance_summary(today_records, Employee.objects.filter(status="Active").count()),
        })
    else:
        employee = getattr(request.user, "employee", None)
        if not employee:
            return Response(base)
        base.update({
            "profile": EmployeeSerializer(employee).data,
            "leaves": LeaveSerializer(employee.leaves.all()[:4], many=True).data,
            "salary_slips": SalarySlipSerializer(employee.salary_slips.all()[:4], many=True).data,
            "attendance": employee_attendance_dashboard(employee, today),
        })
    return Response(base)

class EmployeeViewSet(viewsets.ModelViewSet):
    serializer_class = EmployeeSerializer
    permission_classes = [IsAdminOrHR]

    def get_queryset(self):
        qs = Employee.objects.all()
        search = self.request.query_params.get("search")
        department = self.request.query_params.get("department")
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(employee_code__icontains=search) | Q(email__icontains=search))
        if department:
            qs = qs.filter(department=department)
        return qs

class LeaveViewSet(viewsets.ModelViewSet):
    serializer_class = LeaveSerializer

    def get_queryset(self):
        if portal_role(self.request.user) in ("ADMIN", "HR"):
            return LeaveRequest.objects.select_related("employee")
        return LeaveRequest.objects.filter(employee__user=self.request.user)

    def perform_create(self, serializer):
        if portal_role(self.request.user) in ("ADMIN", "HR") and self.request.data.get("employee"):
            serializer.save(employee_id=self.request.data["employee"])
        else:
            serializer.save(employee=self.request.user.employee)

    @action(detail=True, methods=["post"], permission_classes=[IsAdminOrHR])
    def decide(self, request, pk=None):
        leave = self.get_object()
        decision = request.data.get("status")
        if decision not in ("Approved", "Rejected"):
            return Response({"detail": "Status must be Approved or Rejected."}, status=status.HTTP_400_BAD_REQUEST)
        leave.status = decision
        leave.admin_note = request.data.get("admin_note", "")
        leave.save()
        Notification.objects.create(user=leave.employee.user, title=f"Leave {decision}", message=f"Your {leave.leave_type.lower()} leave request was {decision.lower()}.", category="Leave")
        log_action(request.user, f"Leave {decision}", "LeaveRequest", leave.id)
        return Response(self.get_serializer(leave).data)

class SalarySlipViewSet(viewsets.ModelViewSet):
    serializer_class = SalarySlipSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated()]
        return [IsAdminOrAccountant()]

    def get_queryset(self):
        qs = SalarySlip.objects.select_related("employee")
        return qs if portal_role(self.request.user) in ("ADMIN", "ACCOUNTANT") else qs.filter(employee__user=self.request.user)

class MeetingViewSet(viewsets.ModelViewSet):
    serializer_class = MeetingSerializer
    permission_classes = [IsAdminOrHRWriteReadOnly]

    def get_queryset(self):
        qs = Meeting.objects.all()
        if portal_role(self.request.user) in ("ADMIN", "HR"):
            return qs
        department = getattr(getattr(self.request.user, "employee", None), "department", "")
        return qs.filter(Q(department="All Employees") | Q(department=department))

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

class AnnouncementViewSet(viewsets.ModelViewSet):
    serializer_class = AnnouncementSerializer
    permission_classes = [IsAdminOrHRWriteReadOnly]
    queryset = Announcement.objects.all()

    def perform_create(self, serializer):
        instance = serializer.save(created_by=self.request.user)
        for employee in Employee.objects.exclude(user=None):
            Notification.objects.create(user=employee.user, title=instance.title, message=instance.message, category="Announcement")
        log_action(self.request.user, "Created announcement", "Announcement", instance.id)

def employee_attendance_dashboard(employee, today):
    month_records = AttendanceRecord.objects.filter(
        employee=employee, attendance_date__year=today.year, attendance_date__month=today.month
    )
    today_record = month_records.filter(attendance_date=today).first()
    return {
        "today": AttendanceRecordSerializer(today_record).data if today_record else None,
        "monthly": attendance_summary(month_records),
        "late_count": month_records.filter(is_late=True).count(),
        "early_exit_count": month_records.filter(is_early_exit=True).count(),
    }

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
        if portal_role(self.request.user) not in ("ADMIN", "HR", "ACCOUNTANT"):
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
        employee = getattr(request.user, "employee", None)
        if portal_role(request.user) in ("ADMIN", "HR") and request.data.get("employee"):
            employee = Employee.objects.get(pk=request.data["employee"])
        if not employee:
            return Response({"detail": "Employee profile is required."}, status=400)
        policy = AttendancePolicy.current()
        latitude, longitude = request.data.get("latitude"), request.data.get("longitude")
        qr_reference = request.data.get("qr_reference", "")
        if latitude is None or longitude is None:
            return Response({"detail": "Location permission is required for attendance."}, status=400)
        distance = location_distance_meters(policy.office_latitude, policy.office_longitude, latitude, longitude)
        if distance > policy.allowed_radius_meters:
            return Response({"detail": f"You are {round(distance)}m from the office. Allowed radius is {policy.allowed_radius_meters}m."}, status=400)
        if not qr_reference.startswith(policy.active_qr_reference):
            return Response({"detail": "This QR attendance code is invalid or expired."}, status=400)
        now = localtime()
        record, created = AttendanceRecord.objects.get_or_create(
            employee=employee, attendance_date=localdate(),
            defaults={"check_in_time": now.time().replace(microsecond=0)}
        )
        if not created and record.check_in_time:
            return Response({"detail": "Already checked in.", "record": self.get_serializer(record).data}, status=409)
        record.check_in_time = now.time().replace(microsecond=0)
        record.source = request.data.get("source", "QR + Location")
        record.qr_reference = qr_reference
        record.latitude = latitude
        record.longitude = longitude
        record.location_verified = True
        record.save()
        log_action(request.user, "Attendance check-in", "AttendanceRecord", record.id, {"distance_meters": round(distance)})
        return Response(self.get_serializer(record).data, status=201)

    @action(detail=False, methods=["post"], url_path="check-out")
    def check_out(self, request):
        employee = getattr(request.user, "employee", None)
        if portal_role(request.user) in ("ADMIN", "HR") and request.data.get("employee"):
            employee = Employee.objects.get(pk=request.data["employee"])
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
        total = Employee.objects.filter(status="Active").count() if portal_role(request.user) in ("ADMIN", "HR", "ACCOUNTANT") else None
        return Response(attendance_summary(qs, total))

    @action(detail=False, methods=["get"], url_path="monthly-statistics")
    def monthly_statistics(self, request):
        month = request.query_params.get("month", localdate().strftime("%Y-%m"))
        year, month_number = map(int, month.split("-"))
        qs = self.get_queryset().filter(attendance_date__year=year, attendance_date__month=month_number)
        days = []
        for day in range(1, monthrange(year, month_number)[1] + 1):
            daily = qs.filter(attendance_date__day=day)
            if daily.exists():
                days.append({"day": day, **attendance_summary(daily, Employee.objects.filter(status="Active").count() if portal_role(request.user) in ("ADMIN", "HR", "ACCOUNTANT") else None)})
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

class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = NotificationSerializer

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)

    @action(detail=True, methods=["post"])
    def read(self, request, pk=None):
        notification = self.get_object()
        notification.is_read = True
        notification.save(update_fields=["is_read"])
        return Response(self.get_serializer(notification).data)

class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AuditLogSerializer
    permission_classes = [IsPortalAdmin]
    queryset = AuditLog.objects.select_related("actor")

