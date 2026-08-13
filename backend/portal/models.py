from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone
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


class Department(models.Model):
    name = models.CharField(max_length=100, unique=True)
    code = models.CharField(max_length=50, unique=True)
    description = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)
    display_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["display_order", "name"]

    def __str__(self):
        return f"{self.name} [{self.code}]"


class PortalPage(models.Model):
    title = models.CharField(max_length=100)
    route_path = models.CharField(max_length=200, unique=True)
    module_code = models.CharField(max_length=50, unique=True)
    icon = models.CharField(max_length=50, default="LayoutDashboard")
    sidebar_order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sidebar_order", "title"]

    def __str__(self):
        return f"{self.title} ({self.route_path})"


class DynamicRole(models.Model):
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=50, unique=True)
    description = models.TextField(blank=True, default="")
    is_superadmin_wildcard = models.BooleanField(default=False)
    is_system_role = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} [{self.code}]"


class RolePermission(models.Model):
    role = models.ForeignKey(DynamicRole, on_delete=models.CASCADE, related_name="permissions")
    page = models.ForeignKey(PortalPage, on_delete=models.CASCADE, related_name="role_permissions")
    can_view = models.BooleanField(default=False)
    can_create = models.BooleanField(default=False)
    can_edit = models.BooleanField(default=False)
    can_delete = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("role", "page")
        ordering = ["page__sidebar_order", "page__title"]

    def __str__(self):
        return f"{self.role.code} -> {self.page.module_code} (V:{self.can_view}, C:{self.can_create}, E:{self.can_edit}, D:{self.can_delete})"


class UserRole(models.Model):
    ROLES = [
        ("SUPER_ADMIN", "Super Admin"),
        ("HR", "HR"),
        ("ADMIN", "Admin"),
        ("ACCOUNTANT", "Accountant"),
        ("BDE", "BDE"),
        ("TEAM_LEAD", "Team Lead"),
        ("EMPLOYEE", "Employee"),
        ("OPERATIONS", "Operations"),
        ("OPERATIONS_HEAD", "Operations Head"),
    ]
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="portal_profile")
    role = models.CharField(max_length=20, choices=ROLES)
    dynamic_role = models.ForeignKey(DynamicRole, on_delete=models.SET_NULL, null=True, blank=True, related_name="user_roles")

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
    department_ref = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True, related_name="employees")
    designation = models.CharField(max_length=100)
    joining_date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS, default="Active")
    avatar = models.URLField(blank=True)
    location = models.CharField(max_length=100, blank=True)
    team_lead = models.ForeignKey("self", on_delete=models.SET_NULL, null=True, blank=True, related_name="team_members")

    class Meta:
        ordering = ["name"]
        indexes = [
            models.Index(fields=["status", "name"], name="employee_status_name_idx"),
            models.Index(fields=["department", "status"], name="employee_dept_status_idx"),
        ]

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
        ("Assigned", "Assigned"),
        ("Pending", "Pending"),
        ("In Progress", "In Progress"),
        ("Ongoing", "Ongoing"),
        ("Blocked", "Blocked"),
        ("In Review", "In Review"),
        ("Changes Requested", "Changes Requested"),
        ("Rejected", "Rejected"),
        ("Approved", "Approved"),
        ("Completed", "Completed"),
        ("Published", "Published"),
    ]

    employee = models.ForeignKey(Employee, on_delete=models.SET_NULL, null=True, blank=True, related_name="work_assignments")
    client = models.ForeignKey(Client, on_delete=models.PROTECT, related_name="work_assignments")
    title = models.CharField(max_length=180)
    description = models.TextField(blank=True)
    priority = models.CharField(max_length=20, choices=PRIORITIES, default="Normal")
    assigned_date = models.DateField()
    due_date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUSES, default="Assigned")
    progress = models.PositiveSmallIntegerField(default=0)
    assigned_quantity = models.PositiveIntegerField(default=100)
    completed_quantity = models.PositiveIntegerField(default=0)
    unit = models.CharField(max_length=30, default="%")
    completed_at = models.DateTimeField(null=True, blank=True)
    assigned_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="assigned_work")
    reviewer = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="reviewed_work_assignments")
    reviewer_name = models.CharField(max_length=120, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)



    class Meta:
        ordering = ["due_date", "employee__name", "title"]
        indexes = [
            models.Index(fields=["due_date", "status"], name="work_due_status_idx"),
            models.Index(fields=["status", "priority"], name="work_status_priority_idx"),
        ]
        constraints = [
            models.CheckConstraint(
                check=models.Q(progress__gte=0, progress__lte=100),
                name="work_progress_between_0_and_100",
            ),
            models.CheckConstraint(
                check=models.Q(assigned_quantity__gt=0),
                name="work_assigned_quantity_positive",
            ),
            models.CheckConstraint(
                check=models.Q(completed_quantity__gte=0),
                name="work_completed_quantity_not_negative",
            ),
            models.CheckConstraint(
                check=models.Q(completed_quantity__lte=models.F("assigned_quantity")),
                name="work_completed_quantity_lte_assigned",
            ),
            models.CheckConstraint(
                check=models.Q(due_date__gte=models.F("assigned_date")),
                name="work_due_date_on_or_after_assigned_date",
            ),
        ]

    @property
    def remaining_quantity(self):
        return max(0, self.assigned_quantity - self.completed_quantity)

    def has_deliverables(self):
        return bool(self.pk) and self.deliverables.exists()

    def derived_progress(self):
        if not self.assigned_quantity:
            return 0
        return round((self.completed_quantity / self.assigned_quantity) * 100)

    def derived_status(self):
        if self.status == "Blocked" and self.completed_quantity < self.assigned_quantity:
            return "In Progress"
        if not self.assigned_quantity or self.assigned_quantity <= 0 or self.completed_quantity <= 0:
            return "Assigned"
        if self.completed_quantity >= self.assigned_quantity:
            return "Completed"
        return "In Progress"

    def sync_quantity_state(self):
        completed_statuses = ("Completed", "Approved", "Published")
        review_statuses = ("In Review", "Changes Requested", "Rejected") + completed_statuses
        if self.status in review_statuses:
            if self.status in completed_statuses:
                self.progress = 100
                if self.assigned_quantity:
                    self.completed_quantity = self.assigned_quantity
                if not self.completed_at:
                    self.completed_at = timezone.now()
            elif self.status in ("In Review", "Changes Requested", "Rejected"):
                if self.assigned_quantity and self.assigned_quantity > 0:
                    self.progress = max(0, min(100, round((self.completed_quantity / self.assigned_quantity) * 100)))
            return

        was_completed = self.status in completed_statuses

        if self.completed_quantity > 0 and self.status in ("Assigned", "Pending"):
            self.status = self.derived_status()

        if self.assigned_quantity and self.assigned_quantity > 0 and self.completed_quantity >= self.assigned_quantity and self.status not in ("Assigned", "Pending"):
            if self.status not in completed_statuses:
                self.status = "Completed"

        if self.status in ("Assigned", "Pending"):
            if self.assigned_quantity and self.assigned_quantity > 0 and self.completed_quantity > 0:
                self.progress = max(0, min(100, round((self.completed_quantity / self.assigned_quantity) * 100)))
            else:
                self.progress = 0
            self.completed_at = None
        elif self.status == "In Progress":
            self.progress = 25
            if self.assigned_quantity:
                self.completed_quantity = max(0, round(0.25 * self.assigned_quantity))
            self.completed_at = None
        elif self.status == "Ongoing":
            self.progress = 75
            if self.assigned_quantity:
                self.completed_quantity = max(0, round(0.75 * self.assigned_quantity))
            self.completed_at = None
        elif self.status in completed_statuses:
            self.progress = 100
            if self.assigned_quantity:
                self.completed_quantity = self.assigned_quantity
            if not self.completed_at:
                self.completed_at = timezone.now()
        elif self.status == "Blocked":
            if self.completed_quantity >= self.assigned_quantity and self.assigned_quantity > 0:
                self.status = "Completed"
                self.progress = 100
                if not self.completed_at:
                    self.completed_at = timezone.now()
            else:
                if not self.assigned_quantity:
                    self.progress = 0
                else:
                    self.progress = max(0, min(100, round((self.completed_quantity / self.assigned_quantity) * 100)))
                if (self.completed_at or was_completed):
                    self.completed_at = None

    def sync_from_deliverables(self, save=False):
        if not self.pk:
            return
        rows = list(self.deliverables.all())
        if not rows:
            return
        assigned = len(rows)
        completed_statuses = ("Completed", "Approved", "Published")
        completed = sum(1 for row in rows if row.status in completed_statuses)

        statuses = {row.status for row in rows}
        self.assigned_quantity = assigned
        self.completed_quantity = completed
        self.unit = "items"
        self.progress = round((completed / assigned) * 100) if assigned > 0 else 0
        if assigned > 0 and completed == assigned:
            if self.status not in completed_statuses:
                self.status = "Completed"
            if not self.completed_at:
                self.completed_at = timezone.now()
        else:
            if self.completed_at:
                self.completed_at = None
            if self.status in ("In Progress", "In Review", "Approved", "Published"):
                pass
            elif "Blocked" in statuses:
                self.status = "Blocked"
            elif any(s in statuses for s in ("In Progress", "Ongoing", "Completed", "Approved", "Published")):
                self.status = "In Progress"
            else:
                self.status = "Assigned"
        if save:
            self.save(update_fields=["assigned_quantity", "completed_quantity", "unit", "progress", "status", "completed_at", "updated_at"])



    def clean(self):
        super().clean()
        self.title = self.title.strip()
        self.unit = self.unit.strip()
        if not self.title:
            raise ValidationError({"title": "Work title is required."})
        if not self.unit:
            raise ValidationError({"unit": "Unit is required."})
        if self.due_date and self.assigned_date and self.due_date < self.assigned_date:
            raise ValidationError({"due_date": "Due date cannot be before assigned date."})
        if self.assigned_quantity <= 0:
            raise ValidationError({"assigned_quantity": "Assigned quantity must be greater than 0."})
        if self.completed_quantity < 0:
            raise ValidationError({"completed_quantity": "Completed quantity cannot be negative."})
        if self.completed_quantity > self.assigned_quantity:
            raise ValidationError({"completed_quantity": "Completed quantity cannot exceed assigned quantity."})
        if self.has_deliverables():
            self.sync_from_deliverables()
        else:
            self.sync_quantity_state()

    def save(self, *args, **kwargs):
        self.title = self.title.strip()
        self.unit = self.unit.strip()
        self.clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.title} Â· {self.employee}"


class WorkDeliverable(models.Model):
    STATUSES = WorkAssignment.STATUSES

    assignment = models.ForeignKey(WorkAssignment, on_delete=models.CASCADE, related_name="deliverables")
    client = models.ForeignKey(Client, on_delete=models.PROTECT, related_name="work_deliverables")
    title = models.CharField(max_length=180)
    brief = models.TextField(blank=True)
    work_type = models.CharField(max_length=80)
    due_date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUSES, default="Assigned")
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["due_date", "client__name", "title"]
        indexes = [
            models.Index(fields=["assignment", "status"], name="deliver_assignment_status_idx"),
            models.Index(fields=["client", "due_date"], name="deliver_client_due_idx"),
            models.Index(fields=["status", "due_date"], name="deliver_status_due_idx"),
        ]

    @property
    def is_overdue(self):
        return self.status not in ("Completed", "Approved", "Published") and self.due_date < timezone.localdate()

    def clean(self):
        super().clean()
        self.title = self.title.strip()
        self.work_type = self.work_type.strip()
        if not self.title:
            raise ValidationError({"title": "Deliverable title is required."})
        if not self.work_type:
            raise ValidationError({"work_type": "Work type is required."})
        if self.assignment_id and self.due_date and self.assignment.assigned_date and self.due_date < self.assignment.assigned_date:
            raise ValidationError({"due_date": "Deliverable due date cannot be before assignment date."})
        completed_statuses = ("Completed", "Approved", "Published")
        if self.status in completed_statuses and not self.completed_at:
            self.completed_at = timezone.now()
        elif self.status not in completed_statuses and self.completed_at:
            self.completed_at = None

    def save(self, *args, **kwargs):
        self.title = self.title.strip()
        self.work_type = self.work_type.strip()
        self.clean()
        super().save(*args, **kwargs)
        self.assignment.sync_from_deliverables(save=True)

    def delete(self, *args, **kwargs):
        assignment = self.assignment
        result = super().delete(*args, **kwargs)
        assignment.sync_from_deliverables(save=True)
        return result

    def __str__(self):
        return f"{self.title} · {self.assignment}"


class ClientWorkShareLink(models.Model):
    token = models.CharField(max_length=64, unique=True, db_index=True)
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name="share_links")
    assignment = models.ForeignKey(WorkAssignment, on_delete=models.CASCADE, null=True, blank=True, related_name="share_links")
    public_update = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    is_revoked = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["token", "is_revoked"], name="sharelink_token_revoked_idx"),
            models.Index(fields=["client", "is_revoked"], name="sharelink_client_revoked_idx"),
        ]

    def is_valid(self):
        if self.is_revoked:
            return False
        if self.expires_at and self.expires_at < timezone.now():
            return False
        return True

    def __str__(self):
        scope = f"Assignment #{self.assignment_id}" if self.assignment_id else f"Client {self.client.name}"
        return f"ShareLink · {scope} · Token: {self.token[:8]}..."



class LeaveRequest(models.Model):
    TYPES = [("Annual", "Annual"), ("Sick", "Sick"), ("Personal", "Personal"), ("Unpaid", "Unpaid")]
    STATUSES = [("Pending", "Pending"), ("Approved", "Approved"), ("Rejected", "Rejected")]
    employee = models.ForeignKey(Employee, on_delete=models.SET_NULL, null=True, blank=True, related_name="leaves")
    leave_type = models.CharField(max_length=30, choices=TYPES)
    start_date = models.DateField()
    end_date = models.DateField()
    reason = models.TextField()
    status = models.CharField(max_length=20, choices=STATUSES, default="Pending")
    admin_note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "created_at"], name="leave_status_created_idx"),
        ]

class SalarySlip(models.Model):
    employee = models.ForeignKey(Employee, on_delete=models.SET_NULL, null=True, blank=True, related_name="salary_slips")
    month = models.PositiveSmallIntegerField()
    year = models.PositiveSmallIntegerField()
    file = models.FileField(upload_to="salary_slips/", blank=True)
    gross_salary = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    net_salary = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-year", "-month"]

    def clean(self):
        super().clean()
        if self.employee_id and self.month and self.year:
            qs = SalarySlip.objects.filter(employee_id=self.employee_id, month=self.month, year=self.year)
            if self.pk:
                qs = qs.exclude(pk=self.pk)
            if qs.exists():
                raise ValidationError({"month": "Salary slip already exists for this employee, month, and year."})

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

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
        indexes = [
            models.Index(fields=["date", "time"], name="meeting_date_time_idx"),
            models.Index(fields=["department", "date", "time"], name="meeting_dept_date_time_idx"),
        ]

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

    employee = models.ForeignKey(Employee, on_delete=models.SET_NULL, null=True, blank=True, related_name="attendance_records")
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
        indexes = [
            models.Index(fields=["attendance_date"], name="attendance_date_idx"),
            models.Index(fields=["attendance_status"], name="attendance_status_idx"),
        ]

    def clean(self):
        super().clean()
        if self.employee_id and self.attendance_date:
            qs = AttendanceRecord.objects.filter(employee_id=self.employee_id, attendance_date=self.attendance_date)
            if self.pk:
                qs = qs.exclude(pk=self.pk)
            if qs.exists():
                raise ValidationError({"attendance_date": "Attendance record already exists for this employee and date."})

    @staticmethod
    def minutes(value):
        if not value:
            return 0
        if isinstance(value, str):
            parts = [int(p) for p in value.split(":")[:2]]
            return parts[0] * 60 + parts[1]
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
        self.clean()
        self.calculate()
        super().save(*args, **kwargs)

class AttendanceCorrection(models.Model):
    STATUSES = [("Pending", "Pending"), ("Approved", "Approved"), ("Rejected", "Rejected")]
    employee = models.ForeignKey(Employee, on_delete=models.SET_NULL, null=True, blank=True, related_name="attendance_corrections")
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
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="notifications")
    title = models.CharField(max_length=160)
    message = models.TextField()
    category = models.CharField(max_length=40, default="General")
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "is_read", "created_at"], name="notif_user_read_created_idx"),
        ]

class AuditLog(models.Model):
    actor = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    action = models.CharField(max_length=120)
    entity_type = models.CharField(max_length=80)
    entity_id = models.CharField(max_length=80, blank=True)
    details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class EmployeeKPIRating(models.Model):
    employee = models.ForeignKey(Employee, on_delete=models.SET_NULL, null=True, blank=True, related_name="kpi_ratings")
    month = models.PositiveSmallIntegerField()
    year = models.PositiveSmallIntegerField()
    rating = models.DecimalField(max_digits=3, decimal_places=2, default=5.0)
    notes = models.TextField(blank=True)
    rated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-year", "-month"]

    def clean(self):
        super().clean()
        if self.employee_id and self.month and self.year:
            qs = EmployeeKPIRating.objects.filter(employee_id=self.employee_id, month=self.month, year=self.year)
            if self.pk:
                qs = qs.exclude(pk=self.pk)
            if qs.exists():
                raise ValidationError({"month": "KPI rating already exists for this employee, month, and year."})
        if self.rating is not None and (float(self.rating) < 1.0 or float(self.rating) > 5.0):
            raise ValidationError({"rating": "Rating must be between 1.0 and 5.0."})

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.employee.name} · {self.year}-{self.month:02d} · Rating: {self.rating}"
