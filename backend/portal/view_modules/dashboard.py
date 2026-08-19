from django.utils.timezone import localdate
from django.db.models import Count, Q
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from portal.models import Announcement, AttendanceRecord, Client, Employee, LeaveRequest, Meeting, SalarySlip, WorkAssignment
from portal.permissions import portal_role
from portal.serializers import AnnouncementSerializer, AttendanceRecordSerializer, EmployeeSerializer, LeaveSerializer, MeetingSerializer, SalarySlipSerializer
from .helpers import attendance_summary


def employee_attendance_dashboard(employee, today):
    month_records = AttendanceRecord.objects.filter(
        employee=employee, attendance_date__year=today.year, attendance_date__month=today.month
    )
    today_record = month_records.filter(attendance_date=today).first()
    monthly = attendance_summary(month_records)
    return {
        "today": AttendanceRecordSerializer(today_record).data if today_record else None,
        "monthly": monthly,
        "late_count": monthly["late"],
        "early_exit_count": monthly["early_exits"],
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
    if role in ("SUPER_ADMIN", "ADMIN", "HR", "ACCOUNTANT"):
        today_records = AttendanceRecord.objects.filter(attendance_date=today)
        employees = Employee.objects.aggregate(
            total=Count("id"),
            active=Count("id", filter=Q(status="Active")),
        )
        work = WorkAssignment.objects.aggregate(
            pending=Count("id", filter=Q(status="Pending")),
            overdue=Count("id", filter=Q(due_date__lt=today) & ~Q(status="Completed")),
        )
        pending_leaves_qs = LeaveRequest.objects.filter(status="Pending").select_related("employee")
        pending_leave_items = [
            {
                "id": l.id,
                "employee_name": l.employee.name if l.employee else "—",
                "employee_code": l.employee.employee_code if l.employee else "—",
                "leave_type": l.leave_type,
                "start_date": str(l.start_date),
                "end_date": str(l.end_date),
                "days": (l.end_date - l.start_date).days + 1 if (l.start_date and l.end_date) else 1,
                "reason": l.reason,
            }
            for l in pending_leaves_qs[:5]
        ]
        recent_work = WorkAssignment.objects.select_related("employee", "client").order_by("-id")[:5]
        recent_work_items = [
            {
                "id": w.id,
                "title": w.title,
                "employee_name": w.employee.name if w.employee else "—",
                "client_name": w.client.name if w.client else "—",
                "due_date": str(w.due_date) if w.due_date else "—",
                "status": w.status,
                "priority": w.priority,
            }
            for w in recent_work
        ]
        base.update({
            "total_employees": employees["total"],
            "active_employees": employees["active"],
            "pending_leaves": LeaveRequest.objects.filter(status="Pending").count(),
            "pending_leave_items": pending_leave_items,
            "pending_work": work["pending"],
            "overdue_work": work["overdue"],
            "recent_work_items": recent_work_items,
            "active_clients": Client.objects.count(),
            "salary_slips": SalarySlip.objects.count(),
            "attendance": attendance_summary(today_records, employees["active"]),
        })
    else:
        employee = getattr(request.user, "employee", None)
        if not employee:
            return Response(base)
        employee_work = WorkAssignment.objects.filter(employee=employee).select_related("client")
        work_summary = employee_work.aggregate(
            active=Count("id", filter=Q(status__in=["Assigned", "In Progress", "Ongoing", "Blocked", "In Review"])),
            completed=Count("id", filter=Q(status__in=["Completed", "Approved", "Published"])),
            overdue=Count("id", filter=Q(due_date__lt=today) & ~Q(status__in=["Completed", "Approved", "Published"])),
        )
        recent_tasks = [
            {
                "id": w.id,
                "title": w.title,
                "client_name": w.client.name if w.client else "—",
                "due_date": str(w.due_date) if w.due_date else "—",
                "status": w.status,
                "priority": w.priority,
            }
            for w in employee_work.order_by("-id")[:5]
        ]
        base.update({
            "profile": EmployeeSerializer(employee).data,
            "leaves": LeaveSerializer(employee.leaves.all()[:4], many=True).data,
            "salary_slips": SalarySlipSerializer(employee.salary_slips.all()[:4], many=True).data,
            "attendance": employee_attendance_dashboard(employee, today),
            "work_stats": {
                "active_tasks": work_summary["active"] or 0,
                "completed_tasks": work_summary["completed"] or 0,
                "overdue_tasks": work_summary["overdue"] or 0,
            },
            "recent_tasks": recent_tasks,
        })
    return Response(base)
