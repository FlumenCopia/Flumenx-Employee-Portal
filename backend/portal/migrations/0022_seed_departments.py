from django.core.management import call_command
from django.db import migrations


def seed_departments(apps, schema_editor):
    call_command("seed_rbac")


def reverse_seed_departments(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("portal", "0021_department_employee_department_ref"),
    ]

    operations = [
        migrations.RunPython(seed_departments, reverse_code=reverse_seed_departments),
    ]
