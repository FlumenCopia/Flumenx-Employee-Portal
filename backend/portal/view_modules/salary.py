from django.http import FileResponse
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from portal.models import SalarySlip
from portal.permissions import IsAdminOrAccountant, portal_role
from portal.serializers import SalarySlipSerializer


class SalarySlipViewSet(viewsets.ModelViewSet):
    serializer_class = SalarySlipSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve", "download"):
            return [IsAuthenticated()]
        return [IsAdminOrAccountant()]

    def get_queryset(self):
        qs = SalarySlip.objects.select_related("employee")
        return qs if portal_role(self.request.user) in ("ADMIN", "ACCOUNTANT") else qs.filter(employee__user=self.request.user)

    @action(detail=True, methods=["get"])
    def download(self, request, pk=None):
        try:
            slip = SalarySlip.objects.select_related("employee", "employee__user").get(pk=pk)
        except SalarySlip.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        role = portal_role(request.user)
        if role not in ("ADMIN", "ACCOUNTANT") and slip.employee.user != request.user:
            return Response({"detail": "You do not have permission to download this salary slip."}, status=status.HTTP_403_FORBIDDEN)

        if not slip.file:
            return Response({"detail": "Salary slip file not found."}, status=status.HTTP_404_NOT_FOUND)

        response = FileResponse(slip.file.open("rb"), content_type="application/pdf")
        filename = slip.file.name.split("/")[-1]
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response
