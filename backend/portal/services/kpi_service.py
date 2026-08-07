import csv
import io
from datetime import date
from django.db import models
from django.utils import timezone
from portal.models import (
    Employee, WorkAssignment, AttendanceRecord, LeaveRequest, EmployeeKPIRating
)


def get_kpi_grade(score: float) -> str:
    if score >= 95.0:
        return "Outstanding"
    elif score >= 85.0:
        return "Excellent"
    elif score >= 75.0:
        return "Good"
    elif score >= 60.0:
        return "Needs Improvement"
    else:
        return "Critical"


class KPIService:
    @staticmethod
    def calculate_employee_kpi(employee: Employee, month: int, year: int) -> dict:
        # 1. Work Completion (40%)
        assignments = list(WorkAssignment.objects.filter(
            employee=employee,
            assigned_date__year=year,
            assigned_date__month=month
        ) | WorkAssignment.objects.filter(
            employee=employee,
            due_date__year=year,
            due_date__month=month
        ))
        # Deduplicate list of assignments
        assignment_map = {wa.id: wa for wa in assignments}
        assignments = list(assignment_map.values())

        if assignments:
            sum_assigned = sum(wa.assigned_quantity for wa in assignments if wa.assigned_quantity > 0)
            sum_completed = sum(wa.completed_quantity for wa in assignments)
            work_comp_ratio = (sum_completed / sum_assigned) if sum_assigned > 0 else 0.0
        else:
            sum_assigned = 0
            sum_completed = 0
            work_comp_ratio = 0.0

        work_completion_ratio = min(1.0, max(0.0, work_comp_ratio))
        work_completion_score = round(work_completion_ratio * 40.0, 2)
        work_completion_pct = round(work_completion_ratio * 100.0, 1)
        is_evaluated = bool(assignments)

        # 2. Attendance (20%)
        attendance_records = AttendanceRecord.objects.filter(
            employee=employee,
            attendance_date__year=year,
            attendance_date__month=month
        )
        total_att_records = attendance_records.count()
        present_count = attendance_records.filter(
            attendance_status__in=["Present", "Present (Late)", "Present (Early Exit)", "Present (Late + Early Exit)"]
        ).count()
        half_day_count = attendance_records.filter(attendance_status="Half Day").count()
        absent_count = attendance_records.filter(attendance_status="Absent").count()
        leave_count = attendance_records.filter(attendance_status="Leave").count()

        effective_present = present_count + (half_day_count * 0.5)
        effective_total = total_att_records - leave_count

        if total_att_records > 0 and effective_total > 0:
            att_ratio = min(1.0, max(0.0, effective_present / effective_total))
        else:
            att_ratio = 0.0

        attendance_score = round(att_ratio * 20.0, 2)
        attendance_pct = round(att_ratio * 100.0, 1)

        # 3. On-Time Delivery (15%)
        due_assignments = [wa for wa in assignments if wa.due_date and wa.due_date.year == year and wa.due_date.month == month]
        if due_assignments:
            on_time_count = 0
            for wa in due_assignments:
                if wa.status == "Completed":
                    if wa.completed_at and wa.completed_at.date() <= wa.due_date:
                        on_time_count += 1
                    elif not wa.completed_at:
                        on_time_count += 1
            ontime_ratio = min(1.0, max(0.0, on_time_count / len(due_assignments)))
        else:
            on_time_count = 0
            ontime_ratio = 0.0

        ontime_score = round(ontime_ratio * 15.0, 2)
        ontime_pct = round(ontime_ratio * 100.0, 1)

        # 4. Leave Discipline (10%)
        leave_requests = LeaveRequest.objects.filter(
            employee=employee,
            start_date__year=year,
            start_date__month=month
        )
        rejected_leaves = leave_requests.filter(status="Rejected").count()
        approved_leaves = leave_requests.filter(status="Approved").count()
        pending_leaves = leave_requests.filter(status="Pending").count()

        # Unapproved absences = absent count without approved leave
        unapproved_absences = max(0, absent_count - approved_leaves)

        leave_deduction = (unapproved_absences * 2.0) + (rejected_leaves * 1.0)
        leave_discipline_score = max(0.0, round(10.0 - leave_deduction, 2))
        leave_discipline_pct = round((leave_discipline_score / 10.0) * 100.0, 1)

        # 5. Work Quality (10%) - Manager rating from 1 to 5
        rating_obj = EmployeeKPIRating.objects.filter(
            employee=employee, month=month, year=year
        ).first()

        if rating_obj:
            quality_rating = float(rating_obj.rating)
            rating_notes = rating_obj.notes
            rated_by_name = rating_obj.rated_by.get_full_name() or rating_obj.rated_by.username if rating_obj.rated_by else ""
        else:
            quality_rating = 0.0
            rating_notes = ""
            rated_by_name = ""

        quality_score = round((quality_rating / 5.0) * 10.0, 2)

        # 6. Consistency (5%)
        consistency_ratio = (att_ratio * 0.5) + (ontime_ratio * 0.5)
        consistency_score = round(min(1.0, max(0.0, consistency_ratio)) * 5.0, 2)
        consistency_pct = round(consistency_ratio * 100.0, 1)

        # Final Score
        final_score = round(
            work_completion_score + attendance_score + ontime_score + leave_discipline_score + quality_score + consistency_score,
            1
        )
        final_score = min(100.0, max(0.0, final_score))
        score_out_of_10 = round(final_score / 10.0, 1)
        grade = get_kpi_grade(final_score) if is_evaluated else "Not Evaluated"

        return {
            "employee_id": employee.id,
            "employee_code": employee.employee_code,
            "employee_name": employee.name,
            "department": employee.department,
            "designation": employee.designation,
            "month": month,
            "year": year,
            "final_score": final_score,
            "score_out_of_10": score_out_of_10,
            "is_evaluated": is_evaluated,
            "grade": grade,
            "components": {
                "work_completion": {
                    "score": work_completion_score,
                    "max_score": 40.0,
                    "percentage": work_completion_pct,
                    "assigned_quantity": sum_assigned,
                    "completed_quantity": sum_completed,
                    "total_assignments": len(assignments)
                },
                "attendance": {
                    "score": attendance_score,
                    "max_score": 20.0,
                    "percentage": attendance_pct,
                    "total_days": total_att_records,
                    "present_days": present_count,
                    "half_days": half_day_count,
                    "absent_days": absent_count,
                    "leave_days": leave_count
                },
                "on_time_delivery": {
                    "score": ontime_score,
                    "max_score": 15.0,
                    "percentage": ontime_pct,
                    "total_due": len(due_assignments) if due_assignments else 0,
                    "on_time_count": on_time_count if due_assignments else 0
                },
                "leave_discipline": {
                    "score": leave_discipline_score,
                    "max_score": 10.0,
                    "percentage": leave_discipline_pct,
                    "approved_leaves": approved_leaves,
                    "rejected_leaves": rejected_leaves,
                    "pending_leaves": pending_leaves,
                    "unapproved_absences": unapproved_absences
                },
                "work_quality": {
                    "score": quality_score,
                    "max_score": 10.0,
                    "quality_rating": quality_rating,
                    "notes": rating_notes,
                    "rated_by": rated_by_name
                },
                "consistency": {
                    "score": consistency_score,
                    "max_score": 5.0,
                    "percentage": consistency_pct
                }
            }
        }

    @classmethod
    def get_employee_monthly_history(cls, employee: Employee, months_count: int = 6) -> list:
        today = timezone.localdate()
        history = []
        cur_year = today.year
        cur_month = today.month

        for i in range(months_count):
            m = cur_month - i
            y = cur_year
            while m <= 0:
                m += 12
                y -= 1
            data = cls.calculate_employee_kpi(employee, m, y)
            history.append({
                "month": m,
                "year": y,
                "period": f"{date(y, m, 1).strftime('%b %Y')}",
                "final_score": data["final_score"],
                "score_out_of_10": data["score_out_of_10"],
                "is_evaluated": data["is_evaluated"],
                "grade": data["grade"],
                "quality_rating": data["components"]["work_quality"]["quality_rating"],
                "work_completion_pct": data["components"]["work_completion"]["percentage"],
                "attendance_pct": data["components"]["attendance"]["percentage"]
            })
        return history

    @classmethod
    def get_dashboard(
        cls,
        month: int = None,
        year: int = None,
        department: str = None,
        grade: str = None,
        min_score: float = None,
        max_score: float = None,
        search: str = None
    ) -> dict:
        today = timezone.localdate()
        if not month:
            month = today.month
        if not year:
            year = today.year

        employees = Employee.objects.all()
        if search:
            employees = employees.filter(
                models.Q(name__icontains=search) |
                models.Q(employee_code__icontains=search) |
                models.Q(department__icontains=search)
            )

        kpi_list = []
        dept_scores = {}
        dept_counts = {}

        for emp in employees:
            kpi_data = cls.calculate_employee_kpi(emp, month, year)

            # Apply filters
            if department and department.strip() and kpi_data["department"] != department.strip():
                continue
            if grade and grade.strip() and kpi_data["grade"] != grade.strip():
                continue
            if min_score is not None and kpi_data["final_score"] < float(min_score):
                continue
            if max_score is not None and kpi_data["final_score"] > float(max_score):
                continue

            kpi_list.append(kpi_data)

            if kpi_data["is_evaluated"]:
                dept = kpi_data["department"]
                dept_scores[dept] = dept_scores.get(dept, 0.0) + kpi_data["final_score"]
                dept_counts[dept] = dept_counts.get(dept, 0) + 1

        total_employees = len(kpi_list)
        evaluated_kpis = [item for item in kpi_list if item["is_evaluated"]]
        evaluated_count = len(evaluated_kpis)
        if evaluated_count > 0:
            avg_kpi = round(sum(item["final_score"] for item in evaluated_kpis) / evaluated_count, 1)
            avg_kpi_out_of_10 = round(avg_kpi / 10.0, 1)
            top_performer = max(evaluated_kpis, key=lambda x: x["final_score"])
            critical_performers = [item for item in evaluated_kpis if item["grade"] == "Critical" or item["final_score"] < 60.0]
        else:
            avg_kpi = 0.0
            avg_kpi_out_of_10 = 0.0
            top_performer = None
            critical_performers = []

        department_averages = [
            {
                "department": dept,
                "average_score": round(dept_scores[dept] / dept_counts[dept], 1),
                "average_score_out_of_10": round((dept_scores[dept] / dept_counts[dept]) / 10.0, 1),
                "employee_count": dept_counts[dept]
            }
            for dept in sorted(dept_scores.keys())
        ]

        # Calculate monthly trend for past 6 months (overall company average)
        monthly_trend = []
        all_active_employees = list(Employee.objects.filter(status="Active"))
        for i in range(5, -1, -1):
            m = month - i
            y = year
            while m <= 0:
                m += 12
                y -= 1
            scores = []
            if all_active_employees:
                month_kpis = [cls.calculate_employee_kpi(e, m, y) for e in all_active_employees]
                scores = [item["final_score"] for item in month_kpis if item["is_evaluated"]]
            if scores:
                month_avg = round(sum(scores) / len(scores), 1)
                month_avg_out_of_10 = round(month_avg / 10.0, 1)
            else:
                month_avg = 0.0
                month_avg_out_of_10 = 0.0
            monthly_trend.append({
                "month": m,
                "year": y,
                "period": f"{date(y, m, 1).strftime('%b %Y')}",
                "average_score": month_avg,
                "average_score_out_of_10": month_avg_out_of_10
            })

        return {
            "selected_month": month,
            "selected_year": year,
            "total_employees": total_employees,
            "evaluated_employees": evaluated_count,
            "average_kpi": avg_kpi,
            "average_kpi_out_of_10": avg_kpi_out_of_10,
            "top_performer": {
                "id": top_performer["employee_id"],
                "name": top_performer["employee_name"],
                "department": top_performer["department"],
                "score": top_performer["final_score"],
                "score_out_of_10": top_performer["score_out_of_10"],
                "grade": top_performer["grade"]
            } if top_performer else None,
            "critical_performers_count": len(critical_performers),
            "critical_performers": [
                {
                    "id": p["employee_id"],
                    "name": p["employee_name"],
                    "department": p["department"],
                    "score": p["final_score"],
                    "score_out_of_10": p["score_out_of_10"],
                    "grade": p["grade"]
                } for p in critical_performers
            ],
            "department_averages": department_averages,
            "monthly_trend": monthly_trend,
            "employees": kpi_list
        }

    @classmethod
    def generate_csv(
        cls,
        month: int = None,
        year: int = None,
        department: str = None,
        grade: str = None,
        min_score: float = None,
        max_score: float = None,
        search: str = None
    ) -> str:
        data = cls.get_dashboard(
            month=month, year=year, department=department, grade=grade,
            min_score=min_score, max_score=max_score, search=search
        )
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "Employee Code", "Name", "Department", "Designation",
            "Month/Year", "Work Completion (40)", "Attendance (20)",
            "On-Time Delivery (15)", "Leave Discipline (10)",
            "Quality Rating (1-5)", "Quality Score (10)", "Consistency (5)",
            "KPI Score (10)", "Final Score (100)", "Grade"
        ])

        for emp in data["employees"]:
            comp = emp["components"]
            writer.writerow([
                emp["employee_code"],
                emp["employee_name"],
                emp["department"],
                emp["designation"],
                f"{emp['month']:02d}/{emp['year']}",
                comp["work_completion"]["score"],
                comp["attendance"]["score"],
                comp["on_time_delivery"]["score"],
                comp["leave_discipline"]["score"],
                comp["work_quality"]["quality_rating"],
                comp["work_quality"]["score"],
                comp["consistency"]["score"],
                emp["score_out_of_10"],
                emp["final_score"],
                emp["grade"]
            ])

        return output.getvalue()
