import { Suspense } from "react";

import { StudentsPage } from "@/components/students-page";

export const dynamic = "force-dynamic";

export default function StudentsRoute() {
  return (
    <Suspense fallback={<StudentsPage initialStudents={[]} />}>
      <StudentsPage initialStudents={[]} />
    </Suspense>
  );
}
