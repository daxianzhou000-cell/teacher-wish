import { notFound } from "next/navigation";

import { StudentDetailPage } from "@/components/student-detail-page";
import { getStudentDetail } from "@/lib/repositories/student-progress";

export const dynamic = "force-dynamic";

export default async function StudentDetailRoute({
  params,
}: {
  params: { id: string };
}) {
  const detail = await getStudentDetail(params.id);

  if (!detail) {
    notFound();
  }

  return <StudentDetailPage {...detail} />;
}
