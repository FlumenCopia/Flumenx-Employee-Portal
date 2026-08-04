from datetime import timedelta
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from portal.models import Client, ClientWorkShareLink, Employee, UserRole, WorkAssignment, WorkDeliverable
from portal.services.share_link_service import ShareLinkService

User = get_user_model()


class ShareLinkTestCase(TestCase):
    def setUp(self):
        self.client_api = APIClient()

        # Users & Profiles
        self.admin_user = User.objects.create_user(username="admin_user", email="admin@flumenx.com", password="password")
        UserRole.objects.create(user=self.admin_user, role="ADMIN")

        self.hr_user = User.objects.create_user(username="hr_user", email="hr@flumenx.com", password="password")
        UserRole.objects.create(user=self.hr_user, role="HR")

        self.bde_user = User.objects.create_user(username="bde_user", email="bde@flumenx.com", password="password")
        UserRole.objects.create(user=self.bde_user, role="BDE")

        self.tl_user = User.objects.create_user(username="tl_user", email="tl@flumenx.com", password="password")
        UserRole.objects.create(user=self.tl_user, role="TEAM_LEAD")
        self.tl_emp = Employee.objects.create(
            user=self.tl_user, employee_code="EMP-001", name="TL Employee", email="tl@flumenx.com",
            department="Web Development", designation="Team Lead", joining_date=timezone.localdate()
        )

        self.emp_user = User.objects.create_user(username="emp_user", email="emp@flumenx.com", password="password")
        UserRole.objects.create(user=self.emp_user, role="EMPLOYEE")
        self.emp = Employee.objects.create(
            user=self.emp_user, employee_code="EMP-002", name="John Developer", email="emp@flumenx.com",
            department="Web Development", designation="Senior Dev", joining_date=timezone.localdate()
        )

        # Other department employee
        self.other_emp_user = User.objects.create_user(username="other_emp", email="other@flumenx.com", password="password")
        UserRole.objects.create(user=self.other_emp_user, role="EMPLOYEE")
        self.other_emp = Employee.objects.create(
            user=self.other_emp_user, employee_code="EMP-003", name="Video Editor", email="other@flumenx.com",
            department="Video Editing", designation="Editor", joining_date=timezone.localdate()
        )



        # Clients
        self.client_a = Client.objects.create(name="Acme Corp")
        self.client_b = Client.objects.create(name="Beta LLC")

        # Work Assignments
        self.wa_1 = WorkAssignment.objects.create(
            employee=self.emp, client=self.client_a, title="Website Redesign",
            description="Internal brief for website", assigned_date=timezone.localdate(),
            due_date=timezone.localdate() + timedelta(days=10), status="In Progress", progress=50,
            assigned_quantity=10, completed_quantity=5, unit="pages"
        )

        self.wa_2 = WorkAssignment.objects.create(
            employee=self.other_emp, client=self.client_b, title="Video Promo",
            description="Video editing brief", assigned_date=timezone.localdate(),
            due_date=timezone.localdate() + timedelta(days=5), status="Pending", progress=0,
            assigned_quantity=1, completed_quantity=0, unit="video"
        )

        # Deliverables
        self.d_1 = WorkDeliverable.objects.create(
            assignment=self.wa_1, client=self.client_a, title="Homepage Layout",
            brief="Internal secret brief for layout", work_type="Design",
            due_date=timezone.localdate() + timedelta(days=5), status="Completed"
        )

    def test_token_uniqueness_and_generation(self):
        token_1 = ShareLinkService.generate_token()
        token_2 = ShareLinkService.generate_token()
        self.assertNotEqual(token_1, token_2)
        self.assertGreater(len(token_1), 30)

    def test_valid_public_access_sanitized_dto(self):
        link = ShareLinkService.create_share_link(client=self.client_a, public_update="Phase 1 delivered")
        response = self.client_api.get(f"/api/public/work-progress/{link.token}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.json()
        self.assertEqual(data["client_name"], "Acme Corp")
        self.assertEqual(data["public_update"], "Phase 1 delivered")
        self.assertEqual(len(data["assignments"]), 1)
        self.assertEqual(data["assignments"][0]["title"], "Website Redesign")

        # Verify absolute absence of PII, KPI, employee names, internal briefs
        raw_text = str(data)
        self.assertNotIn("John Developer", raw_text)
        self.assertNotIn("emp@flumenx.com", raw_text)
        self.assertNotIn("Internal secret brief for layout", raw_text)
        self.assertNotIn("Internal brief for website", raw_text)

    def test_expired_token_returns_404(self):
        past_time = timezone.now() - timedelta(days=1)
        link = ShareLinkService.create_share_link(client=self.client_a, expires_at=past_time)
        response = self.client_api.get(f"/api/public/work-progress/{link.token}/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_revoked_token_returns_404(self):
        link = ShareLinkService.create_share_link(client=self.client_a)
        ShareLinkService.revoke_share_link(link)
        response = self.client_api.get(f"/api/public/work-progress/{link.token}/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_assignment_scoped_link_exposes_only_that_assignment(self):
        # Create second assignment for client_a
        wa_extra = WorkAssignment.objects.create(
            employee=self.emp, client=self.client_a, title="Logo Refinement",
            assigned_date=timezone.localdate(), due_date=timezone.localdate() + timedelta(days=2),
            status="Completed", progress=100
        )
        link = ShareLinkService.create_share_link(client=self.client_a, assignment=self.wa_1)
        response = self.client_api.get(f"/api/public/work-progress/{link.token}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.json()
        self.assertEqual(len(data["assignments"]), 1)
        self.assertEqual(data["assignments"][0]["title"], "Website Redesign")
        self.assertNotIn("Logo Refinement", str(data))

    def test_cross_client_access_prevention(self):
        link = ShareLinkService.create_share_link(client=self.client_a)
        response = self.client_api.get(f"/api/public/work-progress/{link.token}/")
        data = response.json()
        self.assertNotIn("Beta LLC", str(data))
        self.assertNotIn("Video Promo", str(data))

    def test_role_permissions_for_creating_share_link(self):
        # Admin can create
        self.client_api.force_authenticate(user=self.admin_user)
        res = self.client_api.post("/api/work-share-links/", {"client_id": self.client_a.id})
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        # HR can create
        self.client_api.force_authenticate(user=self.hr_user)
        res = self.client_api.post("/api/work-share-links/", {"client_id": self.client_a.id})
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        # BDE can create
        self.client_api.force_authenticate(user=self.bde_user)
        res = self.client_api.post("/api/work-share-links/", {"client_id": self.client_a.id})
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        # Employee CANNOT create
        self.client_api.force_authenticate(user=self.emp_user)
        res = self.client_api.post("/api/work-share-links/", {"client_id": self.client_a.id})
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_team_lead_scope_restriction(self):
        self.client_api.force_authenticate(user=self.tl_user)

        # Team lead can create link for team member assignment (wa_1 in Web Development)
        res = self.client_api.post("/api/work-share-links/", {
            "client_id": self.client_a.id,
            "assignment_id": self.wa_1.id
        })
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        # Team lead CANNOT create link for wa_2 (belonging to Video Editing employee)
        res = self.client_api.post("/api/work-share-links/", {
            "client_id": self.client_b.id,
            "assignment_id": self.wa_2.id
        })
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_revoke_and_regenerate_flow(self):
        self.client_api.force_authenticate(user=self.admin_user)
        link = ClientWorkShareLink.objects.create(token="token123", client=self.client_a)

        # Revoke
        res_revoke = self.client_api.post(f"/api/work-share-links/{link.id}/revoke/")
        self.assertEqual(res_revoke.status_code, status.HTTP_200_OK)
        self.assertTrue(res_revoke.json()["is_revoked"])

        # Regenerate
        res_regen = self.client_api.post(f"/api/work-share-links/{link.id}/regenerate/")
        self.assertEqual(res_regen.status_code, status.HTTP_201_CREATED)
        self.assertNotEqual(res_regen.json()["token"], "token123")
        self.assertTrue(res_regen.json()["is_valid"])
