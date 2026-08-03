from django.conf import settings
from django.contrib.auth.models import User
from django.middleware.csrf import CsrfViewMiddleware, get_token
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import ensure_csrf_cookie
from django.utils.translation import gettext_lazy as _
from rest_framework import exceptions, serializers, status
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.exceptions import InvalidToken
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken, TokenError
from rest_framework_simplejwt.views import TokenObtainPairView

from .serializers import ProfileSerializer
from .view_modules.announcements import AnnouncementViewSet
from .view_modules.attendance import AttendancePolicyViewSet, AttendanceRecordViewSet
from .view_modules.audit_logs import AuditLogViewSet
from .view_modules.corrections import AttendanceCorrectionViewSet
from .view_modules.dashboard import dashboard
from .view_modules.employees import EmployeeViewSet
from .view_modules.leaves import LeaveViewSet
from .view_modules.meetings import MeetingViewSet
from .view_modules.notifications import NotificationViewSet
from .view_modules.salary import SalarySlipViewSet
from .view_modules.work import ClientViewSet, WorkAssignmentViewSet, WorkDeliverableViewSet, WorkEmployeeOptionsView


class FlumenxTokenSerializer(TokenObtainPairSerializer):
    username_field = "email"
    email = serializers.EmailField(write_only=True)
    password = serializers.CharField(write_only=True, style={"input_type": "password"})

    def validate(self, attrs):
        email = attrs.get("email", "").strip()
        password = attrs.get("password")
        invalid_credentials = _("No active account found with the given credentials")
        matches = list(User.objects.filter(email__iexact=email))
        if len(matches) != 1:
            raise InvalidToken(invalid_credentials)
        self.user = matches[0]
        if not self.user.check_password(password) or not self.user.is_active:
            raise InvalidToken(invalid_credentials)
        refresh = self.get_token(self.user)
        return {
            "refresh": str(refresh),
            "access": str(refresh.access_token),
            "user": ProfileSerializer(self.user).data,
        }


def set_token_cookies(response, access, refresh=None):
    access_lifetime = int(settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"].total_seconds())
    refresh_lifetime = int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds())
    response.set_cookie(
        settings.JWT_ACCESS_COOKIE_NAME, str(access), max_age=access_lifetime,
        httponly=True, secure=settings.JWT_COOKIE_SECURE,
        samesite=settings.JWT_COOKIE_SAMESITE, path="/api/",
    )
    if refresh is not None:
        response.set_cookie(
            settings.JWT_REFRESH_COOKIE_NAME, str(refresh), max_age=refresh_lifetime,
            httponly=True, secure=settings.JWT_COOKIE_SECURE,
            samesite=settings.JWT_COOKIE_SAMESITE, path="/api/auth/",
        )


def clear_token_cookies(response):
    response.delete_cookie(settings.JWT_ACCESS_COOKIE_NAME, path="/api/", samesite=settings.JWT_COOKIE_SAMESITE)
    response.delete_cookie(settings.JWT_REFRESH_COOKIE_NAME, path="/api/auth/", samesite=settings.JWT_COOKIE_SAMESITE)


def enforce_csrf(request):
    check = CsrfViewMiddleware(lambda req: None)
    check.process_request(request)
    reason = check.process_view(request, None, (), {})
    if reason:
        raise exceptions.PermissionDenied(f"CSRF Failed: {reason}")


class LoginView(TokenObtainPairView):
    permission_classes = [AllowAny]
    authentication_classes = []
    serializer_class = FlumenxTokenSerializer

    def post(self, request, *args, **kwargs):
        enforce_csrf(request)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        response = Response({"user": data["user"]}, status=status.HTTP_200_OK)
        set_token_cookies(response, data["access"], data["refresh"])
        get_token(request)
        return response


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
@ensure_csrf_cookie
@never_cache
def csrf(request):
    return Response({"csrfToken": get_token(request)})


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def refresh(request):
    enforce_csrf(request)
    raw_refresh = request.COOKIES.get(settings.JWT_REFRESH_COOKIE_NAME)
    if not raw_refresh:
        return Response({"detail": "Refresh cookie is required."}, status=401)
    try:
        refresh_token = RefreshToken(raw_refresh)
        access = refresh_token.access_token
        response = Response(status=204)
        if settings.SIMPLE_JWT.get("ROTATE_REFRESH_TOKENS"):
            if settings.SIMPLE_JWT.get("BLACKLIST_AFTER_ROTATION"):
                try:
                    refresh_token.blacklist()
                except AttributeError:
                    pass
            refresh_token.set_jti()
            refresh_token.set_exp()
            refresh_token.set_iat()
            set_token_cookies(response, access, refresh_token)
        else:
            set_token_cookies(response, access)
        return response
    except TokenError as exc:
        raise InvalidToken(exc.args[0])


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def register(request):
    return Response({"detail": "Public registration is disabled."}, status=403)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout(request):
    response = Response(status=204)
    raw_refresh = request.COOKIES.get(settings.JWT_REFRESH_COOKIE_NAME)
    if raw_refresh:
        try:
            RefreshToken(raw_refresh).blacklist()
        except TokenError:
            pass
    clear_token_cookies(response)
    return response


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    return Response(ProfileSerializer(request.user).data)
