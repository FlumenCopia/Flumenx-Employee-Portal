from django.db import migrations, models


def forwards_bdo_to_bde(apps, schema_editor):
    UserRole = apps.get_model("portal", "UserRole")
    UserRole.objects.filter(role="BDO").update(role="BDE")


def backwards_bde_to_bdo(apps, schema_editor):
    UserRole = apps.get_model("portal", "UserRole")
    UserRole.objects.filter(role="BDE").update(role="BDO")


class Migration(migrations.Migration):
    dependencies = [
        ("portal", "0005_alter_userrole_role"),
    ]

    operations = [
        migrations.RunPython(forwards_bdo_to_bde, backwards_bde_to_bdo),
        migrations.AlterField(
            model_name="userrole",
            name="role",
            field=models.CharField(
                choices=[
                    ("HR", "HR"),
                    ("ADMIN", "Admin"),
                    ("ACCOUNTANT", "Accountant"),
                    ("BDE", "BDE"),
                    ("EMPLOYEE", "Employee"),
                ],
                max_length=20,
            ),
        ),
    ]
