import { StudentsPage } from "@/components/students-page";
import { listStudents } from "@/lib/repositories/student-progress";

export const dynamic = "force-dynamic";

export default async function StudentsRoute() {
  const students = await listStudents();
  return <StudentsPage initialStudents={students} />;
}
