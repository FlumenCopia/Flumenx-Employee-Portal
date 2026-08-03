from django.contrib import admin
from .models import Announcement, AttendanceCorrection, AttendancePolicy, AttendanceRecord, AuditLog, Employee, LeaveRequest, Meeting, Notification, SalarySlip, UserRole

admin.site.register([UserRole, Employee, LeaveRequest, SalarySlip, Meeting, Announcement, AttendancePolicy, AttendanceRecord, AttendanceCorrection, Notification, AuditLog])
 