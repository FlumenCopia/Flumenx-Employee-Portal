from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.db import models
from datetime import datetime, timedelta

DEPARTMENT_CHOICES = [
    ("Web Development", "Web Development"),
    ("Video Editing", "Video Editing"),
    ("Design", "Design"),
    ("Digital Marketing", "Digital Marketing"),
    ("Accountant", "Accountant"),
    ("HR", "HR"),
    ("Operations", "Operations"),
]


class UserRole(models.Model):
    ROLES = [
        ("HR", "HR"),
        ("ADMIN", "Admin"),
        ("ACCOUNTANT", "Accountant"),
        ("BDE", "BDE"),
        ("TEAM_LEAD", "Team Lead"),
        ("EMPLOYEE", "Employee"),
    ]
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="portal_profile")
    role = models.CharField(max_length=20, choices=ROLES)

    def __str__(self):
        return f"{self.user.username} · {self.role}"

class Employee(models.Model):
    DEPARTMENTS = DEPARTMENT_CHOICES
    STATUS = [("Active", "Active"), ("On Leave", "On Leave"), ("Inactive", "Inactive")]
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="employee", null=True, blank=True)
    employee_code = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=120)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=20)
    department = models.CharField(max_length=50, choices=DEPARTMENTS)
    designation = models.CharField(max_length=100)
    joining_date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS, default="Active")
    avatar = models.URLField(blank=True)
    location = models.CharField(max_length=100, blank=True)
    team_lead = models.ForeignKey("self", on_delete=models.SET_NULL, null=True, blank=True, related_name="team_members")

    class Meta:
        ordering = ["name"]

    def clean(self):
        super().clean()
        if self.team_lead_id and self.pk and self.team_lead_id == self.pk:
            raise ValidationError({"team_lead": "Employee cannot be assigned as their own team lead."})

    def save(self, *args, **kwargs):
        if self.team_lead_id and self.pk and self.team_lead_id == self.pk:
            raise ValidationError({"team_lead": "Employee cannot be assigned as their own team lead."})
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.employee_code} · {self.name}"

class Client(models.Model):
    name = models.CharField(max_length=160, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def clean(self):
        super().clean()
        self.name = self.name.strip()
        if not self.name:
            raise ValidationError({"name": "Client name is required."})
        duplicate = Client.objects.filter(name__iexact=self.name)
        if self.pk:
            duplicate = duplicate.exclude(pk=self.pk)
        if duplicate.exists():
            raise ValidationError({"name": "Client name must be unique."})

    def save(self, *args, **kwargs):
        self.name = self.name.strip()
        if not self.name:
            raise ValidationError({"name": "Client name is required."})
        duplicate = Client.objects.filter(name__iexact=self.name)
        if self.pk:
            duplicate = duplicate.exclude(pk=self.pk)
        if duplicate.exists():
            raise ValidationError({"name": "Client name must be unique."})
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class WorkAssignment(models.Model):
    PRIORITIES = [
        ("Low", "Low"),
        ("Normal", "Normal"),
        ("High", "High"),
        ("Urgent", "Urgent"),
    ]
    STATUSES = [
        ("Pending", "Pending"),
        ("In Progress", "In Progress"),
        ("Blocked", "Blocked"),
        ("Completed", "Completed"),
    ]

    employee = models.ForeignKey(Employee, on_delete=models.PROTECT, related_name="work_assignments")
    client = models.ForeignKey(Client, on_delete=models.PROTECT, related_name="work_assignments")
    title = models.CharField(max_length=180)
    description = models.TextField(blank=True)
    priority = models.CharField(max_length=20, choices=PRIORITIES, default="Normal")
    assigned_date = models.DateField()
    due_date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUSES, default="Pending")
    progress = models.PositiveSmallIntegerField(default=0)
    assigned_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="assigned_work")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["due_date", "employee__name", "title"]
        constraints = [
            models.CheckConstraint(
                check=models.Q(progress__gte=0, progress__lte=100),
                name="work_progress_between_0_and_100",
            ),
            models.CheckConstraint(
                check=models.Q(due_date__gte=models.F("assigned_date")),
                name="work_due_date_on_or_after_assigned_date",
            ),
        ]

    def clean(self):
        super().clean()
        self.title = self.title.strip()
        if not self.title:
            raise ValidationError({"title": "Work title is required."})
        if self.due_date and self.assigned_date and self.due_date < self.assigned_date:
            raise ValidationError({"due_date": "Due date cannot be before assigned date."})
        if self.progress < 0 or self.progress > 100:
            raise ValidationError({"progress": "Progress must be between 0 and 100."})
        if self.status == "Completed" and self.progress != 100:
            raise ValidationError({"progress": "Completed work must have 100 progress."})
        if self.status != "Completed" and self.progress == 100:
            raise ValidationError({"progress": "Only completed work can have 100 progress."})

    def save(self, *args, **kwargs):
        self.title = self.title.strip()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.title} Â· {self.employee}"


class LeaveRequest(models.Model):
    TYPES = [("Annual", "Annual"), ("Sick", "Sick"), ("Personal", "Personal"), ("Unpaid", "Unpaid")]
    STATUSES = [("Pending", "Pending"), ("Approved", "Approved"), ("Rejected", "Rejected")]
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="leaves")
    leave_type = models.CharField(max_length=30, choices=TYPES)
    start_date = models.DateField()
    end_date = models.DateField()
    reason = models.TextField()
    status = models.CharField(max_length=20, choices=STATUSES, default="Pending")
    admin_note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

class SalarySlip(models.Model):
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="salary_slips")
    month = models.PositiveSmallIntegerField()
    year = models.PositiveSmallIntegerField()
    file = models.FileField(upload_to="salary_slips/", blank=True)
    gross_salary = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    net_salary = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-year", "-month"]
        constraints = [models.UniqueConstraint(fields=["employee", "month", "year"], name="unique_employee_salary_month")]

class Meeting(models.Model):
    title = models.CharField(max_length=160)
    date = models.DateField()
    time = models.TimeField()
    description = models.TextField(blank=True)
    department = models.CharField(max_length=50, blank=True, default="All Employees")
    location = models.CharField(max_length=120, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        ordering = ["date", "time"]

class Announcement(models.Model):
    PRIORITIES = [("Normal", "Normal"), ("Important", "Important"), ("Urgent", "Urgent")]
    title = models.CharField(max_length=160)
    message = models.TextField()
    date = models.DateField(auto_now_add=True)
    priority = models.CharField(max_length=20, choices=PRIORITIES, default="Normal")
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        ordering = ["-date", "-id"]

class AttendancePolicy(models.Model):
    office_start_time = models.TimeField(default="09:30")
    grace_period_minutes = models.PositiveSmallIntegerField(default=5)
    office_end_time = models.TimeField(default="18:30")
    half_day_hours = models.DecimalField(max_digits=4, decimal_places=2, default=4)
    full_day_hours = models.DecimalField(max_digits=4, decimal_places=2, default=8)
    office_latitude = models.DecimalField(max_digits=9, decimal_places=6, default="12.971599")
    office_longitude = models.DecimalField(max_digits=9, decimal_places=6, default="77.594566")
    allowed_radius_meters = models.PositiveIntegerField(default=250)
    active_qr_reference = models.CharField(max_length=120, default="FLUMENX-HQ")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "Attendance policy"

    @classmethod
    def current(cls):
        policy, _ = cls.objects.get_or_create(pk=1)
        return policy

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

class AttendanceRecord(models.Model):
    STATUSES = [
        ("Present", "Present"),
        ("Present (Late)", "Present (Late)"),
        ("Present (Early Exit)", "Present (Early Exit)"),
        ("Present (Late + Early Exit)", "Present (Late + Early Exit)"),
        ("Absent", "Absent"),
        ("Half Day", "Half Day"),
        ("Leave", "Leave"),
    ]
    CHECK_IN_STATUSES = [("On Time", "On Time"), ("Grace Period", "Grace Period"), ("Late", "Late")]
    SOURCES = [("Manual", "Manual"), ("QR", "QR"), ("QR + Location", "QR + Location"), ("Admin", "Admin")]

    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="attendance_records")
    attendance_date = models.DateField()
    check_in_time = models.TimeField(null=True, blank=True)
    check_out_time = models.TimeField(null=True, blank=True)
    check_in_status = models.CharField(max_length=20, choices=CHECK_IN_STATUSES, blank=True)
    attendance_status = models.CharField(max_length=40, choices=STATUSES, default="Absent")
    is_late = models.BooleanField(default=False)
    late_minutes = models.PositiveIntegerField(default=0)
    is_early_exit = models.BooleanField(default=False)
    early_exit_minutes = models.PositiveIntegerField(default=0)
    working_hours = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    source = models.CharField(max_length=20, choices=SOURCES, default="Manual")
    qr_reference = models.CharField(max_length=120, blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    location_verified = models.BooleanField(default=False)
    notes = models.CharField(max_length=240, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-attendance_date", "employee__name"]
        constraints = [models.UniqueConstraint(fields=["employee", "attendance_date"], name="unique_employee_attendance_date")]

    @staticmethod
    def minutes(value):
        return value.hour * 60 + value.minute

    def calculate(self):
        if self.attendance_status in ("Absent", "Leave") and not self.check_in_time:
            self.check_in_status = ""
            self.is_late = self.is_early_exit = False
            self.late_minutes = self.early_exit_minutes = 0
            self.working_hours = 0
            return

        policy = AttendancePolicy.current()
        start = self.minutes(policy.office_start_time)
        grace_end = start + policy.grace_period_minutes
        end = self.minutes(policy.office_end_time)

        if self.check_in_time:
            check_in = self.minutes(self.check_in_time)
            self.is_late = check_in > grace_end
            self.late_minutes = max(0, check_in - grace_end)
            if check_in < start:
                self.check_in_status = "On Time"
            elif check_in <= grace_end:
                self.check_in_status = "Grace Period"
            else:
                self.check_in_status = "Late"

        if self.check_out_time:
            check_out = self.minutes(self.check_out_time)
            self.is_early_exit = check_out < end
            self.early_exit_minutes = max(0, end - check_out)
            if self.check_in_time:
                worked = check_out - self.minutes(self.check_in_time)
                if worked < 0:
                    worked += 24 * 60
                self.working_hours = round(worked / 60, 2)

        if self.check_in_time:
            if self.check_out_time and float(self.working_hours) < float(policy.half_day_hours):
                self.attendance_status = "Half Day"
            elif self.is_late:
                self.attendance_status = "Half Day"
            elif self.is_early_exit:
                self.attendance_status = "Present (Early Exit)"
            else:
                self.attendance_status = "Present"

    def save(self, *args, **kwargs):
        self.calculate()
        super().save(*args, **kwargs)

class AttendanceCorrection(models.Model):
    STATUSES = [("Pending", "Pending"), ("Approved", "Approved"), ("Rejected", "Rejected")]
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="attendance_corrections")
    attendance_record = models.ForeignKey(AttendanceRecord, on_delete=models.CASCADE, related_name="corrections")
    requested_check_in = models.TimeField(null=True, blank=True)
    requested_check_out = models.TimeField(null=True, blank=True)
    reason = models.TextField()
    status = models.CharField(max_length=20, choices=STATUSES, default="Pending")
    admin_note = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

class Notification(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="notifications")
    title = models.CharField(max_length=160)
    message = models.TextField()
    category = models.CharField(max_length=40, default="General")
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

class AuditLog(models.Model):
    actor = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    action = models.CharField(max_length=120)
    entity_type = models.CharField(max_length=80)
    entity_id = models.CharField(max_length=80, blank=True)
    details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
