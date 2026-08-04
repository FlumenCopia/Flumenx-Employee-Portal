import secrets
from datetime import timedelta
from django.utils import timezone

from portal.models import Client, ClientWorkShareLink, WorkAssignment, WorkDeliverable


class ShareLinkService:
    @staticmethod
    def generate_token() -> str:
        while True:
            token = secrets.token_urlsafe(32)
            if not ClientWorkShareLink.objects.filter(token=token).exists():
                return token

    @classmethod
    def create_share_link(
        cls,
        client: Client,
        assignment: WorkAssignment = None,
        created_by=None,
        expires_at=None,
        days_valid: int = 30,
        public_update: str = ""
    ) -> ClientWorkShareLink:
        if assignment and assignment.client_id != client.id:
            raise ValueError("WorkAssignment does not belong to the specified Client.")

        token = cls.generate_token()
        if not expires_at:
            expires_at = timezone.now() + timedelta(days=days_valid)

        return ClientWorkShareLink.objects.create(
            token=token,
            client=client,
            assignment=assignment,
            public_update=public_update.strip() if public_update else "",
            created_by=created_by,
            expires_at=expires_at,
            is_revoked=False
        )

    @staticmethod
    def revoke_share_link(link: ClientWorkShareLink) -> ClientWorkShareLink:
        link.is_revoked = True
        link.save(update_fields=["is_revoked", "updated_at"])
        return link

    @classmethod
    def regenerate_share_link(cls, link: ClientWorkShareLink, created_by=None) -> ClientWorkShareLink:
        # Revoke existing link
        cls.revoke_share_link(link)
        # Create fresh link with same scope & settings
        return cls.create_share_link(
            client=link.client,
            assignment=link.assignment,
            created_by=created_by or link.created_by,
            public_update=link.public_update,
            days_valid=30
        )

    @staticmethod
    def get_valid_share_link(token: str) -> ClientWorkShareLink | None:
        if not token or not isinstance(token, str):
            return None

        link = ClientWorkShareLink.objects.filter(
            token=token,
            is_revoked=False
        ).select_related("client", "assignment").first()

        if not link or not link.is_valid():
            return None

        return link

    @classmethod
    def get_sanitized_progress_dto(cls, link: ClientWorkShareLink) -> dict:
        if link.assignment:
            assignments_qs = WorkAssignment.objects.filter(pk=link.assignment_id, client=link.client)
        else:
            assignments_qs = WorkAssignment.objects.filter(client=link.client)

        assignments_qs = assignments_qs.prefetch_related("deliverables")

        sanitized_assignments = []
        max_updated_at = link.updated_at

        for wa in assignments_qs:
            if wa.updated_at and wa.updated_at > max_updated_at:
                max_updated_at = wa.updated_at

            deliverables = []
            for d in wa.deliverables.all():
                if d.updated_at and d.updated_at > max_updated_at:
                    max_updated_at = d.updated_at
                deliverables.append({
                    "title": d.title,
                    "work_type": d.work_type,
                    "status": d.status,
                    "due_date": d.due_date,
                    "completed_at": d.completed_at
                })

            sanitized_assignments.append({
                "title": wa.title,
                "status": wa.status,
                "priority": wa.priority,
                "progress": wa.progress,
                "assigned_quantity": wa.assigned_quantity,
                "completed_quantity": wa.completed_quantity,
                "remaining_quantity": wa.remaining_quantity,
                "unit": wa.unit,
                "assigned_date": wa.assigned_date,
                "due_date": wa.due_date,
                "completed_at": wa.completed_at,
                "deliverables": deliverables
            })


        # Calculate overall progress across assignments
        total_assigned = sum(a["assigned_quantity"] for a in sanitized_assignments if a["assigned_quantity"] > 0)
        total_completed = sum(a["completed_quantity"] for a in sanitized_assignments)
        overall_progress = round((total_completed / total_assigned) * 100) if total_assigned > 0 else 100

        return {
            "client_name": link.client.name,
            "public_update": link.public_update,
            "scope": "assignment" if link.assignment_id else "client",
            "overall_progress": min(100, max(0, overall_progress)),
            "expires_at": link.expires_at,
            "last_updated": max_updated_at,
            "assignments": sanitized_assignments
        }
