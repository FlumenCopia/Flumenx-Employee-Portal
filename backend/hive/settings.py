from datetime import timedelta
from pathlib import Path
import os

BASE_DIR = Path(__file__).resolve().parent.parent

# Load local development variables without requiring an extra package.
env_file = BASE_DIR / ".env"
if env_file.exists():
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            val = value.strip()
            if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
                val = val[1:-1]
            os.environ.setdefault(key.strip(), val)

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "hive-demo-secret-key-change-in-production")
DEBUG = os.getenv("DJANGO_DEBUG", "True").lower() == "true"
allowed_hosts_env = os.getenv("DJANGO_ALLOWED_HOSTS")
if allowed_hosts_env:
    ALLOWED_HOSTS = list({host.strip() for host in allowed_hosts_env.split(",") if host.strip()} | {"localhost", "127.0.0.1", "testserver", ".vercel.app"})
else:
    ALLOWED_HOSTS = ["localhost", "127.0.0.1", "testserver", ".vercel.app"]

APPEND_SLASH = False
USE_X_FORWARDED_HOST = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "portal",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "hive.urls"
TEMPLATES = [{
    "BACKEND": "django.template.backends.django.DjangoTemplates",
    "DIRS": [],
    "APP_DIRS": True,
    "OPTIONS": {"context_processors": [
        "django.template.context_processors.request",
        "django.contrib.auth.context_processors.auth",
        "django.contrib.messages.context_processors.messages",
    ]},
}]
WSGI_APPLICATION = "hive.wsgi.application"

try:
    import dj_database_url
except ImportError:
    dj_database_url = None

database_url = os.getenv("DATABASE_URL") or os.getenv("POSTGRES_URL")

DB_ENGINE = os.getenv("DB_ENGINE", "sqlite").lower()
if database_url:
    cleaned_url = database_url.replace("postgresql://postgresql://", "postgresql://").replace("postgres://postgres://", "postgres://")
    if dj_database_url:
        DATABASES = {
            "default": dj_database_url.parse(
                cleaned_url,
                conn_max_age=60,
                conn_health_checks=True,
            )
        }
    else:
        from urllib.parse import urlparse
        url = urlparse(cleaned_url)
        DATABASES = {
            "default": {
                "ENGINE": "django.db.backends.postgresql",
                "NAME": url.path.lstrip("/"),
                "USER": url.username or "",
                "PASSWORD": url.password or "",
                "HOST": url.hostname or "localhost",
                "PORT": str(url.port or 5432),
                "CONN_MAX_AGE": 60,
            }
        }
elif DB_ENGINE == "mysql":
    mysql_host = os.getenv("MYSQL_HOST", "127.0.0.1")
    mysql_port = int(os.getenv("MYSQL_PORT", "3306"))
    use_mysql = True
    try:
        import socket
        with socket.create_connection((mysql_host, mysql_port), timeout=1.0):
            pass
    except Exception:
        use_mysql = False

    if use_mysql:
        DATABASES = {
            "default": {
                "ENGINE": "django.db.backends.mysql",
                "NAME": os.getenv("MYSQL_DATABASE", "flumenx_portal"),
                "USER": os.getenv("MYSQL_USER", "root"),
                "PASSWORD": os.getenv("MYSQL_PASSWORD", ""),
                "HOST": mysql_host,
                "PORT": str(mysql_port),
                "OPTIONS": {
                    "charset": "utf8mb4",
                    "init_command": "SET sql_mode='STRICT_TRANS_TABLES'",
                    "ssl": False,
                },
                "TEST": {
                    "NAME": "test_flumenx_portal",
                },
                "CONN_MAX_AGE": 60,
            }
        }
    else:
        DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": BASE_DIR / "db.sqlite3"}}
else:
    DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": BASE_DIR / "db.sqlite3"}}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]
LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Kolkata"
USE_I18N = True
USE_TZ = True
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "static"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Email & Password Reset Configuration
EMAIL_BACKEND = os.getenv(
    "EMAIL_BACKEND",
    "django.core.mail.backends.console.EmailBackend"
)
EMAIL_HOST = os.getenv("EMAIL_HOST", "")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", "587"))
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")
EMAIL_USE_TLS = os.getenv("EMAIL_USE_TLS", "True").lower() == "true"
DEFAULT_FROM_EMAIL = os.getenv(
    "DEFAULT_FROM_EMAIL",
    "FLUMENX Security <noreply@localhost>"
)
FRONTEND_URL = os.getenv(
    "FRONTEND_URL",
    "http://localhost:3000"
).rstrip("/")
PASSWORD_RESET_TIMEOUT = int(
    os.getenv("PASSWORD_RESET_TIMEOUT", "3600")
)



cors_origins_env = os.getenv("CORS_ALLOWED_ORIGINS")
if cors_origins_env:
    CORS_ALLOWED_ORIGINS = [origin.strip() for origin in cors_origins_env.split(",") if origin.strip()]
else:
    CORS_ALLOWED_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"]

CORS_ALLOW_CREDENTIALS = True

csrf_origins_env = os.getenv("CSRF_TRUSTED_ORIGINS")
if csrf_origins_env:
    CSRF_TRUSTED_ORIGINS = [origin.strip() for origin in csrf_origins_env.split(",") if origin.strip()]
else:
    CSRF_TRUSTED_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"]
raw_csrf_samesite = os.getenv("CSRF_COOKIE_SAMESITE", "Lax")
CSRF_COOKIE_SAMESITE = "None" if raw_csrf_samesite.lower() == "none" else raw_csrf_samesite.capitalize()
CSRF_COOKIE_SECURE = os.getenv("CSRF_COOKIE_SECURE", "False").lower() == "true"
JWT_COOKIE_SECURE = os.getenv("JWT_COOKIE_SECURE", "False").lower() == "true"
raw_jwt_samesite = os.getenv("JWT_COOKIE_SAMESITE", "Lax")
JWT_COOKIE_SAMESITE = "None" if raw_jwt_samesite.lower() == "none" else raw_jwt_samesite.capitalize()
JWT_ACCESS_COOKIE_NAME = os.getenv("JWT_ACCESS_COOKIE_NAME", "flumenx_access")
JWT_REFRESH_COOKIE_NAME = os.getenv("JWT_REFRESH_COOKIE_NAME", "flumenx_refresh")
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ("portal.authentication.CookieJWTAuthentication",),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
}
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
}
