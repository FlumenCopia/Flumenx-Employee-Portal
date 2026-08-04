from django.contrib.auth.models import User
from django.contrib.auth.tokens import default_token_generator
from django.core import mail
from django.urls import reverse
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework import status
from rest_framework.test import APITestCase


class PasswordResetTestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="resetuser",
            email="resetuser@flumenx.com",
            password="OldPassword123!",
            first_name="Reset",
            last_name="Tester",
        )
        self.request_url = reverse("password_reset_request")
        self.confirm_url = reverse("password_reset_confirm")

    def test_password_reset_request_valid_email(self):
        response = self.client.post(self.request_url, {"email": "resetuser@flumenx.com"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("If an account with that email exists", response.data["detail"])
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("resetuser@flumenx.com", mail.outbox[0].to)
        self.assertIn("/reset-password?uid=", mail.outbox[0].body)

    def test_password_reset_request_nonexistent_email_returns_generic_200(self):
        response = self.client.post(self.request_url, {"email": "nonexistent@flumenx.com"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("If an account with that email exists", response.data["detail"])
        self.assertEqual(len(mail.outbox), 0)

    def test_password_reset_confirm_success(self):
        uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        token = default_token_generator.make_token(self.user)

        response = self.client.post(
            self.confirm_url,
            {"uid": uid, "token": token, "new_password": "NewSecretPassword99!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("Your password has been reset successfully", response.data["detail"])

        # Verify old password fails and new password works
        self.user.refresh_from_db()
        self.assertFalse(self.user.check_password("OldPassword123!"))
        self.assertTrue(self.user.check_password("NewSecretPassword99!"))

    def test_password_reset_confirm_invalid_token(self):
        uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        invalid_token = "invalid-token-123"

        response = self.client.post(
            self.confirm_url,
            {"uid": uid, "token": invalid_token, "new_password": "NewSecretPassword99!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("invalid or has expired", response.data["error"])

    def test_password_reset_token_cannot_be_reused(self):
        uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        token = default_token_generator.make_token(self.user)

        # First use
        response1 = self.client.post(
            self.confirm_url,
            {"uid": uid, "token": token, "new_password": "NewSecretPassword99!"},
            format="json",
        )
        self.assertEqual(response1.status_code, status.HTTP_200_OK)

        # Second use with same token
        response2 = self.client.post(
            self.confirm_url,
            {"uid": uid, "token": token, "new_password": "AnotherNewPassword100!"},
            format="json",
        )
        self.assertEqual(response2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("invalid or has expired", response2.data["error"])
