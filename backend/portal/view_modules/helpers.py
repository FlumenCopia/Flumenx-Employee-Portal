from math import asin, cos, radians, sin, sqrt

from django.db.models import Count, Q

from portal.models import AuditLog


def log_action(user, action, entity, entity_id="", details=None):
    AuditLog.objects.create(actor=user, action=action, entity_type=entity, entity_id=str(entity_id), details=details or {})


def location_distance_meters(lat1, lon1, lat2, lon2):
    radius = 6371000
    dlat, dlon = radians(float(lat2) - float(lat1)), radians(float(lon2) - float(lon1))
    value = sin(dlat / 2) ** 2 + cos(radians(float(lat1))) * cos(radians(float(lat2))) * sin(dlon / 2) ** 2
    return radius * 2 * asin(sqrt(value))


def attendance_summary(queryset, total_employees=None):
    counts = queryset.aggregate(
        total=Count("id"),
        present=Count("id", filter=Q(attendance_status__startswith="Present")),
        late=Count("id", filter=Q(is_late=True)),
        early_exits=Count("id", filter=Q(is_early_exit=True)),
        absent=Count("id", filter=Q(attendance_status="Absent")),
        half_days=Count("id", filter=Q(attendance_status="Half Day")),
        leave=Count("id", filter=Q(attendance_status="Leave")),
    )
    present = counts["present"]
    half_days = counts["half_days"]
    denominator = total_employees if total_employees is not None else counts["total"]
    return {
        "present": present,
        "late": counts["late"],
        "early_exits": counts["early_exits"],
        "absent": counts["absent"],
        "half_days": half_days,
        "leave": counts["leave"],
        "attendance_percentage": round(((present + half_days * .5) / denominator * 100), 1) if denominator else 0,
    }
