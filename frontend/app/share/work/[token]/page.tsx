import { PublicWorkProgressPage } from "@/features/work/PublicWorkProgressPage";

export default async function PublicShareWorkPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <PublicWorkProgressPage token={token} />;
}
