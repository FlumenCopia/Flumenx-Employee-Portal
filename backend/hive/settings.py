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
            os.environ.setdefault(key.strip(), value.strip())

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "hive-demo-secret-key-change-in-production")
DEBUG = os.getenv("DJANGO_DEBUG", "True").lower() == "true"
ALLOWED_HOSTS = ["localhost", "127.0.0.1", "testserver"]

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

DB_ENGINE = os.getenv("DB_ENGINE", "sqlite").lower()
if DB_ENGINE == "mysql" or os.getenv("MYSQL_DATABASE"):
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.mysql",
            "NAME": os.getenv("MYSQL_DATABASE", "flumenx_portal"),
            "USER": os.getenv("MYSQL_USER", "root"),
            "PASSWORD": os.getenv("MYSQL_PASSWORD", ""),
            "HOST": os.getenv("MYSQL_HOST", "127.0.0.1"),
            "PORT": os.getenv("MYSQL_PORT", "3306"),
            "OPTIONS": {
                "charset": "utf8mb4",
                "init_command": "SET sql_mode='STRICT_TRANS_TABLES'",
                "ssl": False,
            },
            "CONN_MAX_AGE": 60,
        }
    }
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
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

CORS_ALLOWED_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"]
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"]
CSRF_COOKIE_SAMESITE = os.getenv("CSRF_COOKIE_SAMESITE", "Lax")
CSRF_COOKIE_SECURE = os.getenv("CSRF_COOKIE_SECURE", "False").lower() == "true"
JWT_COOKIE_SECURE = os.getenv("JWT_COOKIE_SECURE", "False").lower() == "true"
JWT_COOKIE_SAMESITE = os.getenv("JWT_COOKIE_SAMESITE", "Lax")
JWT_ACCESS_COOKIE_NAME = os.getenv("JWT_ACCESS_COOKIE_NAME", "flumenx_access")
JWT_REFRESH_COOKIE_NAME = os.getenv("JWT_REFRESH_COOKIE_NAME", "flumenx_refresh")
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ("portal.authentication.CookieJWTAuthentication",),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 50,
}
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
}
