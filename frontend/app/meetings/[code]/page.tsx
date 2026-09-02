import { MeetingRoomPage } from "@/features/meetings/MeetingRoomPage";

export default async function MeetingsCodePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <MeetingRoomPage meetingCode={code} />;
}
