from django.contrib.auth.models import User

from portal.models import Notification


def unique_notification_recipients(users, exclude_user=None):
    recipients = []
    seen = set()
    exclude_id = getattr(exclude_user, "id", exclude_user)
    for user in users:
        if not user or not getattr(user, "id", None):
            continue
        if exclude_id and user.id == exclude_id:
            continue
        if user.id in seen:
            continue
        seen.add(user.id)
        recipients.append(user)
    return recipients


def create_notifications(users, title, message, category="General", exclude_user=None):
    recipients = unique_notification_recipients(users, exclude_user=exclude_user)
    notifications = [
        Notification(user=user, title=title, message=message, category=category)
        for user in recipients
    ]
    if notifications:
        Notification.objects.bulk_create(notifications)
    return notifications


def create_notifications_for_roles(roles, title, message, category="General", exclude_user=None):
    users = User.objects.filter(
        is_active=True,
        portal_profile__role__in=roles,
    ).select_related("portal_profile")
    return create_notifications(users, title, message, category=category, exclude_user=exclude_user)
