from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from portal.models import AttendanceRecord, Employee, LeaveRequest, SalarySlip, WorkAssignment


class Command(BaseCommand):
    help = "Removes dummy seed employees from the database"

    def handle(self, *args, **options):
        dummy_emails = [
            "alice@flumenx.com",
            "bob@flumenx.com",
            "charlie@flumenx.com",
            "dave@flumenx.com",
            "eve@flumenx.com",
        ]

        dummy_emps = list(Employee.objects.filter(email__in=dummy_emails))
        if not dummy_emps:
            self.stdout.write(self.style.SUCCESS("No dummy employees found."))
            return

        for emp in dummy_emps:
            self.stdout.write(f"Deleting dummy employee: {emp.name} ({emp.email})")
            AttendanceRecord.objects.filter(employee=emp).delete()
            WorkAssignment.objects.filter(employee=emp).delete()
            LeaveRequest.objects.filter(employee=emp).delete()
            SalarySlip.objects.filter(employee=emp).delete()
            user = emp.user
            emp.delete()
            if user:
                user.delete()

        self.stdout.write(self.style.SUCCESS("Successfully removed all dummy employees!"))
