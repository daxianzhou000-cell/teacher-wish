import { StudentDetailRoutePage } from "@/components/student-detail-route-page";

export default function StudentDetailRoute({
  params,
}: {
  params: { id: string };
}) {
  return <StudentDetailRoutePage studentId={params.id} />;
}
