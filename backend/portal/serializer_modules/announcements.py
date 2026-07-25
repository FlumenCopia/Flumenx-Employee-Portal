from rest_framework import serializers

from portal.models import Announcement


class AnnouncementSerializer(serializers.ModelSerializer):
    class Meta:
        model = Announcement
        fields = "__all__"
        read_only_fields = ["created_by", "date"]
