from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from portal.models import Client, ClientWorkShareLink, WorkAssignment
from portal.permissions import CanManageShareLinks, portal_role
from portal.services.share_link_service import ShareLinkService


class WorkProgressPublicThrottle(AnonRateThrottle):
    rate = "100/hour"


def serialize_share_link(link: ClientWorkShareLink) -> dict:
    return {
        "id": link.id,
        "token": link.token,
        "client_id": link.client_id,
        "client_name": link.client.name,
        "assignment_id": link.assignment_id,
        "assignment_title": link.assignment.title if link.assignment else None,
        "public_update": link.public_update,
        "expires_at": link.expires_at,
        "is_revoked": link.is_revoked,
        "is_valid": link.is_valid(),
        "created_at": link.created_at,
        "created_by": link.created_by.username if link.created_by else None
    }


def verify_team_lead_access(user, assignment=None, client=None):
    role = portal_role(user)
    if role != "TEAM_LEAD":
        return True

    # TEAM_LEAD can only manage links for assignments belonging to their team members
    emp = getattr(user, "employee", None)
    if not emp:
        return False

    if assignment:
        # Check if assignment's employee belongs to same department / team
        return assignment.employee.department == emp.department

    if client:
        # Check if client has any work assignment in team lead's department
        return WorkAssignment.objects.filter(client=client, employee__department=emp.department).exists()

    return True


class ShareLinkListCreateView(APIView):
    permission_classes = [CanManageShareLinks]

    def get(self, request):
        client_id = request.query_params.get("client_id")
        assignment_id = request.query_params.get("assignment_id")

        qs = ClientWorkShareLink.objects.select_related("client", "assignment", "created_by").all()

        if client_id:
            qs = qs.filter(client_id=client_id)
        if assignment_id:
            qs = qs.filter(assignment_id=assignment_id)

        role = portal_role(request.user)
        if role == "TEAM_LEAD":
            emp = getattr(request.user, "employee", None)
            if emp:
                qs = qs.filter(
                    assignment__isnull=False,
                    assignment__employee__department=emp.department
                ) | qs.filter(
                    assignment__isnull=True,
                    client__work_assignments__employee__department=emp.department
                )
                qs = qs.distinct()

        links = [serialize_share_link(link) for link in qs]
        return Response(links, status=status.HTTP_200_OK)

    def post(self, request):
        client_id = request.data.get("client_id")
        assignment_id = request.data.get("assignment_id")
        public_update = request.data.get("public_update", "")
        days_valid = request.data.get("days_valid", 30)

        if not client_id:
            return Response({"client_id": "Client ID is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            client = Client.objects.get(pk=client_id)
        except Client.DoesNotExist:
            return Response({"client_id": "Client not found."}, status=status.HTTP_404_NOT_FOUND)

        assignment = None
        if assignment_id:
            try:
                assignment = WorkAssignment.objects.get(pk=assignment_id)
            except WorkAssignment.DoesNotExist:
                return Response({"assignment_id": "WorkAssignment not found."}, status=status.HTTP_404_NOT_FOUND)

            if assignment.client_id != client.id:
                return Response(
                    {"assignment_id": "WorkAssignment does not belong to the specified Client."},
                    status=status.HTTP_400_BAD_REQUEST
                )

        if not verify_team_lead_access(request.user, assignment=assignment, client=client):
            return Response(
                {"detail": "You do not have permission to manage share links for this assignment/client."},
                status=status.HTTP_403_FORBIDDEN
            )

        try:
            days_valid_int = int(days_valid) if days_valid else 30
        except (ValueError, TypeError):
            days_valid_int = 30

        link = ShareLinkService.create_share_link(
            client=client,
            assignment=assignment,
            created_by=request.user,
            days_valid=days_valid_int,
            public_update=public_update
        )

        return Response(serialize_share_link(link), status=status.HTTP_201_CREATED)


class ShareLinkRevokeView(APIView):
    permission_classes = [CanManageShareLinks]

    def post(self, request, pk):
        try:
            link = ClientWorkShareLink.objects.select_related("client", "assignment", "created_by").get(pk=pk)
        except ClientWorkShareLink.DoesNotExist:
            return Response({"detail": "Share link not found."}, status=status.HTTP_404_NOT_FOUND)

        if not verify_team_lead_access(request.user, assignment=link.assignment, client=link.client):
            return Response(
                {"detail": "You do not have permission to revoke this share link."},
                status=status.HTTP_403_FORBIDDEN
            )

        updated_link = ShareLinkService.revoke_share_link(link)
        return Response(serialize_share_link(updated_link), status=status.HTTP_200_OK)


class ShareLinkRegenerateView(APIView):
    permission_classes = [CanManageShareLinks]

    def post(self, request, pk):
        try:
            link = ClientWorkShareLink.objects.select_related("client", "assignment", "created_by").get(pk=pk)
        except ClientWorkShareLink.DoesNotExist:
            return Response({"detail": "Share link not found."}, status=status.HTTP_404_NOT_FOUND)

        if not verify_team_lead_access(request.user, assignment=link.assignment, client=link.client):
            return Response(
                {"detail": "You do not have permission to regenerate this share link."},
                status=status.HTTP_403_FORBIDDEN
            )

        new_link = ShareLinkService.regenerate_share_link(link, created_by=request.user)
        return Response(serialize_share_link(new_link), status=status.HTTP_201_CREATED)


class PublicWorkProgressView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [WorkProgressPublicThrottle]

    def get(self, request, token):
        link = ShareLinkService.get_valid_share_link(token)
        if not link:
            # Public invalid, expired, or revoked tokens must return HTTP 404 without revealing why
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        dto = ShareLinkService.get_sanitized_progress_dto(link)
        return Response(dto, status=status.HTTP_200_OK)
