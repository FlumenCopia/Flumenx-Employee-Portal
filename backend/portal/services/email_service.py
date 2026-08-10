import logging
import traceback
from django.conf import settings
from django.core.mail import send_mail
from rest_framework import serializers

logger = logging.getLogger(__name__)


def send_onboarding_email(recipient_name: str, recipient_email: str, temporary_password: str):
    """
    Shared service function to send welcome/onboarding login details to new users.
    Reused by Employee creation and Super Admin Add User.
    """
    login_url = f"{settings.FRONTEND_URL}/login"
    subject = "FLUMENX Portal - Your Login Details"
    message = (
        f"Hello {recipient_name},\n\n"
        f"Your FLUMENX Employee Portal account has been created.\n\n"
        f"Login URL: {login_url}\n"
        f"Email: {recipient_email}\n"
        f"Temporary password: {temporary_password}\n\n"
        f"Please sign in with these details and reset your password after your first login.\n\n"
        f"Regards,\nFLUMENX Team"
    )
    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[recipient_email],
            fail_silently=False,
        )
    except Exception as mail_exc:
        logger.error(
            "Onboarding email delivery failed: [%s] %s\n%s",
            mail_exc.__class__.__name__,
            str(mail_exc),
            traceback.format_exc(),
        )
        raise serializers.ValidationError({
            "email": "Could not send login details email. Please try again later or contact your admin."
        })
