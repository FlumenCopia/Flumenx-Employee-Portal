"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/ui";

export function AttendanceSettingsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/attendance");
  }, [router]);

  return <EmptyState title="Attendance settings moved" text="Opening the attendance register." />;
}
