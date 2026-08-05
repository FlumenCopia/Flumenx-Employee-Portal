import logging
import traceback
from django.conf import settings
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import OutstandingToken, BlacklistedToken

logger = logging.getLogger(__name__)


class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        try:
            email = (request.data.get("email") or "").strip().lower()
            generic_response = Response(
                {"detail": "If an account with that email exists, a password reset link has been sent."},
                status=status.HTTP_200_OK,
            )

            if not email:
                return Response(
                    {"email": ["Work email address is required."]},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Lookup matching users case-insensitively
            users = list(User.objects.filter(email__iexact=email, is_active=True))
            if not users:
                # Prevent email enumeration by returning generic success response
                return generic_response

            user = users[0]
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)

            reset_link = f"{settings.FRONTEND_URL}/reset-password?uid={uid}&token={token}"

            subject = "FLUMENX Portal - Reset Your Password"
            message = (
                f"Hello {user.first_name or user.username},\n\n"
                f"We received a request to reset the password for your FLUMENX Employee Portal account.\n\n"
                f"Click the link below to set a new password:\n{reset_link}\n\n"
                f"This link will expire in 1 hour.\n"
                f"If you did not request a password reset, please ignore this email.\n\n"
                f"Regards,\nFLUMENX Security Team"
            )

            try:
                send_mail(
                    subject=subject,
                    message=message,
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[user.email],
                    fail_silently=False,
                )
            except Exception as mail_exc:
                logger.error(
                    "Password reset email delivery failed: [%s] %s\n%s",
                    mail_exc.__class__.__name__,
                    str(mail_exc),
                    traceback.format_exc(),
                )
                return Response(
                    {"error": "Could not send password reset email. Please try again later or contact your admin."},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

            return generic_response

        except Exception as exc:
            logger.error(
                "Unhandled error in PasswordResetRequestView: [%s] %s\n%s",
                exc.__class__.__name__,
                str(exc),
                traceback.format_exc(),
            )
            return Response(
                {"error": "Could not send password reset email. Please try again later or contact your admin."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )



class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        uidb64 = (request.data.get("uid") or "").strip()
        token = (request.data.get("token") or "").strip()
        new_password = request.data.get("new_password") or ""

        if not uidb64 or not token:
            return Response(
                {"error": "Invalid or missing reset token parameters."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not new_password:
            return Response(
                {"new_password": ["New password is required."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(pk=uid, is_active=True)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            return Response(
                {"error": "This password reset link is invalid or has expired."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not default_token_generator.check_token(user, token):
            return Response(
                {"error": "This password reset link is invalid or has expired."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            validate_password(new_password, user=user)
        except ValidationError as err:
            return Response(
                {"new_password": list(err.messages)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Update password
        user.set_password(new_password)
        user.save()

        # Invalidate existing JWT refresh tokens for this user
        try:
            outstanding_tokens = OutstandingToken.objects.filter(user=user)
            for ot in outstanding_tokens:
                BlacklistedToken.objects.get_or_create(token=ot)
        except Exception:
            pass

        return Response(
            {"detail": "Your password has been reset successfully. You can now log in with your new password."},
            status=status.HTTP_200_OK,
        )
