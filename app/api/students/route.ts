import { NextResponse } from "next/server";

import { parseCreateStudentInput } from "@/lib/domain/student-progress-input";
import { createStudent, listStudents } from "@/lib/repositories/student-progress";

export async function GET() {
  const data = await listStudents();
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  try {
    const input = parseCreateStudentInput(await request.json());

    if (!input) {
      return NextResponse.json({ error: "学生信息不完整。" }, { status: 400 });
    }

    const data = await createStudent(input);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "创建学生失败。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
