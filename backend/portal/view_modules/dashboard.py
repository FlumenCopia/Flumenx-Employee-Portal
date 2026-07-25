from django.utils.timezone import localdate
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from portal.models import Announcement, AttendanceRecord, Employee, LeaveRequest, Meeting, SalarySlip
from portal.permissions import portal_role
from portal.serializers import AnnouncementSerializer, AttendanceRecordSerializer, EmployeeSerializer, LeaveSerializer, MeetingSerializer, SalarySlipSerializer
from .helpers import attendance_summary


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
