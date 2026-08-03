from datetime import datetime
from django.http import HttpResponse
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from portal.models import Employee, EmployeeKPIRating
from portal.permissions import CanManageKPIRating, CanViewKPIDashboard, can_manage_kpis
from portal.services.kpi_service import KPIService


class KPIDashboardView(APIView):
    permission_classes = [CanViewKPIDashboard]

    def get(self, request):
        month = request.query_params.get("month")
        year = request.query_params.get("year")
        department = request.query_params.get("department")
        grade = request.query_params.get("grade")
        min_score = request.query_params.get("min_score")
        max_score = request.query_params.get("max_score")
        search = request.query_params.get("search")

        m = int(month) if month and month.isdigit() else None
        y = int(year) if year and year.isdigit() else None
        min_s = float(min_score) if min_score else None
        max_s = float(max_score) if max_score else None

        dashboard_data = KPIService.get_dashboard(
            month=m,
            year=y,
            department=department,
            grade=grade,
            min_score=min_s,
            max_score=max_s,
            search=search
        )
        return Response(dashboard_data)


class EmployeeKPIDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, employee_id):
        try:
            employee = Employee.objects.get(pk=employee_id)
        except Employee.DoesNotExist:
            return Response({"detail": "Employee not found."}, status=status.HTTP_404_NOT_FOUND)

        # Permissions check: Admin/HR/Ops Head can view anyone; employee can only view self.
        user = request.user
        user_emp = getattr(user, "employee", None)

        if not can_manage_kpis(user):
            if not user_emp or user_emp.id != employee.id:
                return Response({"detail": "You do not have permission to view another employee's KPI data."}, status=status.HTTP_403_FORBIDDEN)

        month = request.query_params.get("month")
        year = request.query_params.get("year")
        m = int(month) if month and month.isdigit() else datetime.now().month
        y = int(year) if year and year.isdigit() else datetime.now().year

        kpi_data = KPIService.calculate_employee_kpi(employee, m, y)
        kpi_data["history"] = KPIService.get_employee_monthly_history(employee, months_count=6)

        return Response(kpi_data)


class MyKPIDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user_emp = getattr(request.user, "employee", None)
        if not user_emp:
            return Response({"detail": "No associated employee profile found."}, status=status.HTTP_400_BAD_REQUEST)

        month = request.query_params.get("month")
        year = request.query_params.get("year")
        m = int(month) if month and month.isdigit() else datetime.now().month
        y = int(year) if year and year.isdigit() else datetime.now().year

        kpi_data = KPIService.calculate_employee_kpi(user_emp, m, y)
        kpi_data["history"] = KPIService.get_employee_monthly_history(user_emp, months_count=6)

        return Response(kpi_data)


class KPIRatingView(APIView):
    permission_classes = [CanManageKPIRating]

    def post(self, request):
        employee_id = request.data.get("employee_id")
        month = request.data.get("month")
        year = request.data.get("year")
        rating = request.data.get("rating")
        notes = request.data.get("notes", "")

        if not employee_id or month is None or year is None or rating is None:
            return Response(
                {"detail": "employee_id, month, year, and rating are required fields."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            employee = Employee.objects.get(pk=employee_id)
        except Employee.DoesNotExist:
            return Response({"detail": "Employee not found."}, status=status.HTTP_404_NOT_FOUND)

        try:
            r_val = float(rating)
            if r_val < 1.0 or r_val > 5.0:
                raise ValueError()
        except (ValueError, TypeError):
            return Response({"detail": "Rating must be a number between 1.0 and 5.0."}, status=status.HTTP_400_BAD_REQUEST)

        m = int(month)
        y = int(year)

        rating_obj, _ = EmployeeKPIRating.objects.update_or_create(
            employee=employee,
            month=m,
            year=y,
            defaults={
                "rating": r_val,
                "notes": notes,
                "rated_by": request.user
            }
        )

        recalculated = KPIService.calculate_employee_kpi(employee, m, y)
        return Response({
            "message": "Quality rating saved successfully.",
            "rating_id": rating_obj.id,
            "rating": float(rating_obj.rating),
            "notes": rating_obj.notes,
            "recalculated_kpi": recalculated
        }, status=status.HTTP_200_OK)


class KPIExportCSVView(APIView):
    permission_classes = [CanViewKPIDashboard]

    def get(self, request):
        month = request.query_params.get("month")
        year = request.query_params.get("year")
        department = request.query_params.get("department")
        grade = request.query_params.get("grade")
        min_score = request.query_params.get("min_score")
        max_score = request.query_params.get("max_score")
        search = request.query_params.get("search")

        m = int(month) if month and month.isdigit() else None
        y = int(year) if year and year.isdigit() else None
        min_s = float(min_score) if min_score else None
        max_s = float(max_score) if max_score else None

        csv_content = KPIService.generate_csv(
            month=m,
            year=y,
            department=department,
            grade=grade,
            min_score=min_s,
            max_score=max_s,
            search=search
        )

        response = HttpResponse(csv_content, content_type="text/csv")
        filename = f"employee_kpi_{y or datetime.now().year}_{m or datetime.now().month:02d}.csv"
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response
