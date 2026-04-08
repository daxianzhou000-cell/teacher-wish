import { PackageLibraryPage } from "@/components/package-library-page";
import { listStudents, listTutoringRecords } from "@/lib/repositories/student-progress";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const [students, records] = await Promise.all([listStudents(), listTutoringRecords()]);

  return <PackageLibraryPage students={students} records={records} />;
}
