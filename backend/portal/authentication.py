from django.conf import settings
from django.middleware.csrf import CsrfViewMiddleware
from rest_framework import exceptions
from rest_framework_simplejwt.authentication import JWTAuthentication


class CookieJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        header = self.get_header(request)
        if header is not None:
            return super().authenticate(request)

        raw_token = request.COOKIES.get(settings.JWT_ACCESS_COOKIE_NAME)
        if raw_token is None:
            return None

        if request.method not in ("GET", "HEAD", "OPTIONS", "TRACE"):
            self.enforce_csrf(request)

        validated_token = self.get_validated_token(raw_token)
        return self.get_user(validated_token), validated_token

    def enforce_csrf(self, request):
        check = CsrfViewMiddleware(lambda req: None)
        check.process_request(request)
        reason = check.process_view(request, None, (), {})
        if reason:
            raise exceptions.PermissionDenied(f"CSRF Failed: {reason}")
