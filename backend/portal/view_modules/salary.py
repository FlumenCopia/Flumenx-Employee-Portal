from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from portal.models import SalarySlip
from portal.permissions import IsAdminOrAccountant, portal_role
from portal.serializers import SalarySlipSerializer


class SalarySlipViewSet(viewsets.ModelViewSet):
    serializer_class = SalarySlipSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated()]
        return [IsAdminOrAccountant()]

    def get_queryset(self):
        qs = SalarySlip.objects.select_related("employee")
        return qs if portal_role(self.request.user) in ("ADMIN", "ACCOUNTANT") else qs.filter(employee__user=self.request.user)
