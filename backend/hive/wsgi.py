import logging
import os
from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "hive.settings")
application = get_wsgi_application()
app = application

# Run pending migrations automatically on deployment startup
try:
    from django.core.management import call_command
    call_command("migrate", interactive=False)
except Exception as exc:
    logging.getLogger("django").error("Production auto-migration failed on WSGI init: %s", str(exc)) 