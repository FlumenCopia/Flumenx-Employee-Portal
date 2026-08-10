from django.db import migrations
from django.core.management import call_command


def seed_rbac_data(apps, schema_editor):
    call_command("seed_rbac")


def reverse_seed_rbac_data(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("portal", "0019_dynamicrole_portalpage_alter_userrole_role_and_more"),
    ]

    operations = [
        migrations.RunPython(seed_rbac_data, reverse_code=reverse_seed_rbac_data),
    ]
