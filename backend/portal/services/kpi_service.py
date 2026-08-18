import csv
import io
from datetime import date
from django.db import models
from django.utils import timezone
from portal.models import (
    Employee, WorkAssignment, AttendanceRecord, LeaveRequest, EmployeeKPIRating
)


def get_kpi_grade(score: float) -> str:
    if score >= 9.5:
        return "Outstanding"
    elif score >= 8.5:
        return "Excellent"
    elif score >= 7.5:
        return "Good"
    elif score >= 6.0:
        return "Needs Improvement"
    else:
        return "Critical"


class KPIService:
    @staticmethod
    def calculate_employee_kpi(employee: Employee, month: int, year: int) -> dict:
        today = timezone.localdate()

        # 1. Fetch relevant assignments
        assignments = list(WorkAssignment.objects.filter(
            employee=employee,
            assigned_date__year=year,
            assigned_date__month=month
        ) | WorkAssignment.objects.filter(
            employee=employee,
            due_date__year=year,
            due_date__month=month
        ))
        assignment_map = {wa.id: wa for wa in assignments}
        assignments = list(assignment_map.values())
        is_evaluated = bool(assignments)

        # -------------------------------------------------------------
        # Factor 1: Attendance (Max 2.0 pts)
        # -------------------------------------------------------------
        attendance_records = AttendanceRecord.objects.filter(
            employee=employee,
            attendance_date__year=year,
            attendance_date__month=month
        )
        if employee.joining_date:
            attendance_records = attendance_records.filter(attendance_date__gte=employee.joining_date)

        total_att_records = attendance_records.count()
        present_count = attendance_records.filter(
            attendance_status__in=["Present", "Present (Late)", "Present (Early Exit)", "Present (Late + Early Exit)"]
        ).count()
        half_day_count = attendance_records.filter(attendance_status="Half Day").count()
        absent_count = attendance_records.filter(attendance_status="Absent").count()
        leave_count = attendance_records.filter(attendance_status="Leave").count()

        effective_present = present_count + (half_day_count * 0.5)
        eligible_att_days = max(0, total_att_records - leave_count)

        if total_att_records > 0 and eligible_att_days > 0:
            att_ratio = min(1.0, max(0.0, effective_present / eligible_att_days))
        else:
            att_ratio = 1.0 if is_evaluated else 0.0

        attendance_score = round(att_ratio * 2.0, 2)
        attendance_pct = round(att_ratio * 100.0, 1)

        # -------------------------------------------------------------
        # Factor 2: On-Time Delivery (Max 3.0 pts)
        # -------------------------------------------------------------
        due_assignments = [wa for wa in assignments if wa.due_date]
        evaluable_ontime_tasks = [
            wa for wa in due_assignments
            if wa.status in ("Published", "Completed") or wa.due_date <= today
        ]

        if evaluable_ontime_tasks:
            on_time_count = 0
            for wa in evaluable_ontime_tasks:
                if wa.status in ("Published", "Completed"):
                    if wa.completed_at and wa.completed_at.date() <= wa.due_date:
                        on_time_count += 1
                    elif not wa.completed_at:
                        on_time_count += 1
            ontime_ratio = min(1.0, max(0.0, on_time_count / len(evaluable_ontime_tasks)))
        else:
            on_time_count = 0
            ontime_ratio = 1.0 if is_evaluated else 0.0

        ontime_score = round(ontime_ratio * 3.0, 2)
        ontime_pct = round(ontime_ratio * 100.0, 1)

        # -------------------------------------------------------------
        # Factor 3: Pending Work (Max 2.0 pts)
        # -------------------------------------------------------------
        eligible_due_tasks = [wa for wa in assignments if wa.due_date and wa.due_date <= today]
        overdue_pending = [
            wa for wa in eligible_due_tasks
            if wa.status not in ("Published", "Completed")
        ]
        overdue_count = len(overdue_pending)
        active_count = len([wa for wa in assignments if wa.status not in ("Published", "Completed")])

        if eligible_due_tasks:
            pending_health_ratio = min(1.0, max(0.0, 1.0 - (overdue_count / len(eligible_due_tasks))))
        else:
            pending_health_ratio = 1.0 if is_evaluated else 0.0

        pending_score = round(pending_health_ratio * 2.0, 2)
        pending_pct = round(pending_health_ratio * 100.0, 1)

        # -------------------------------------------------------------
        # Factor 4: Rework / Correction (Max 2.0 pts)
        # -------------------------------------------------------------
        correction_tasks = [wa for wa in assignments if wa.status in ("Changes Requested", "Rejected")]
        correction_count = len(correction_tasks)

        if assignments:
            rework_ratio = min(1.0, max(0.0, 1.0 - (correction_count / len(assignments))))
        else:
            rework_ratio = 1.0 if is_evaluated else 0.0

        rework_score = round(rework_ratio * 2.0, 2)
        rework_pct = round(rework_ratio * 100.0, 1)

        # -------------------------------------------------------------
        # Factor 5: Work Completion (Max 1.0 pt)
        # -------------------------------------------------------------
        if assignments:
            sum_assigned = sum(wa.assigned_quantity for wa in assignments if wa.assigned_quantity > 0)
            sum_completed = sum(wa.completed_quantity for wa in assignments)
            work_comp_ratio = (sum_completed / sum_assigned) if sum_assigned > 0 else 0.0
        else:
            sum_assigned = 0
            sum_completed = 0
            work_comp_ratio = 0.0

        completion_ratio = min(1.0, max(0.0, work_comp_ratio))
        completion_score = round(completion_ratio * 1.0, 2)
        completion_pct = round(completion_ratio * 100.0, 1)

        # -------------------------------------------------------------
        # Final Score (Directly out of 10.0)
        # -------------------------------------------------------------
        if is_evaluated:
            raw_final = attendance_score + ontime_score + pending_score + rework_score + completion_score
            final_score = round(min(10.0, max(0.0, raw_final)), 1)
            grade = get_kpi_grade(final_score)
        else:
            final_score = 0.0
            grade = "Not Evaluated"

        return {
            "employee_id": employee.id,
            "employee_code": employee.employee_code,
            "employee_name": employee.name,
            "department": employee.department,
            "designation": employee.designation,
            "month": month,
            "year": year,
            "final_score": final_score,
            "score_out_of_10": final_score,
            "is_evaluated": is_evaluated,
            "grade": grade,
            "components": {
                "attendance": {
                    "score": attendance_score,
                    "max_score": 2.0,
                    "percentage": attendance_pct,
                    "total_days": total_att_records,
                    "eligible_days": eligible_att_days,
                    "present_days": present_count,
                    "half_days": half_day_count,
                    "absent_days": absent_count,
                    "leave_days": leave_count
                },
                "on_time_delivery": {
                    "score": ontime_score,
                    "max_score": 3.0,
                    "percentage": ontime_pct,
                    "total_due": len(evaluable_ontime_tasks),
                    "on_time_count": on_time_count
                },
                "pending_work": {
                    "score": pending_score,
                    "max_score": 2.0,
                    "percentage": pending_pct,
                    "overdue_count": overdue_count,
                    "active_count": active_count,
                    "total_due": len(eligible_due_tasks)
                },
                "rework": {
                    "score": rework_score,
                    "max_score": 2.0,
                    "percentage": rework_pct,
                    "correction_count": correction_count,
                    "total_tasks": len(assignments)
                },
                "work_completion": {
                    "score": completion_score,
                    "max_score": 1.0,
                    "percentage": completion_pct,
                    "assigned_quantity": sum_assigned,
                    "completed_quantity": sum_completed,
                    "total_assignments": len(assignments)
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
            avg_kpi_out_of_10 = avg_kpi
            top_performer = max(evaluated_kpis, key=lambda x: x["final_score"])
            critical_performers = [item for item in evaluated_kpis if item["grade"] == "Critical" or item["final_score"] < 6.0]
        else:
            avg_kpi = 0.0
            avg_kpi_out_of_10 = 0.0
            top_performer = None
            critical_performers = []

        department_averages = [
            {
                "department": dept,
                "average_score": round(dept_scores[dept] / dept_counts[dept], 1),
                "average_score_out_of_10": round(dept_scores[dept] / dept_counts[dept], 1),
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
                month_avg_out_of_10 = month_avg
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
            "Month/Year", "Attendance (2.0)", "On-Time Delivery (3.0)",
            "Pending Work (2.0)", "Rework/Correction (2.0)", "Work Completion (1.0)",
            "KPI Score (10.0)", "Grade"
        ])

        for emp in data["employees"]:
            comp = emp["components"]
            writer.writerow([
                emp["employee_code"],
                emp["employee_name"],
                emp["department"],
                emp["designation"],
                f"{emp['month']:02d}/{emp['year']}",
                comp["attendance"]["score"],
                comp["on_time_delivery"]["score"],
                comp["pending_work"]["score"],
                comp["rework"]["score"],
                comp["work_completion"]["score"],
                emp["final_score"],
                emp["grade"]
            ])

        return output.getvalue()
