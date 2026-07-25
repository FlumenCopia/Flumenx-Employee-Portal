import { Shell } from "@/components/shell";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <Shell role="team-lead">{children}</Shell>;
}
