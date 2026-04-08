import { NextResponse } from "next/server";

import { parseUpdateStudentInput } from "@/lib/domain/student-progress-input";
import {
  deleteStudent,
  getStudentDetail,
  updateStudent,
} from "@/lib/repositories/student-progress";

export async function GET(
  _request: Request,
  context: { params: { id: string } },
) {
  const data = await getStudentDetail(context.params.id);

  if (!data) {
    return NextResponse.json({ error: "未找到该学生。" }, { status: 404 });
  }

  return NextResponse.json({ data });
}

export async function PATCH(
  request: Request,
  context: { params: { id: string } },
) {
  try {
    const input = parseUpdateStudentInput(await request.json());

    if (!input) {
      return NextResponse.json({ error: "学生信息不完整。" }, { status: 400 });
    }

    const data = await updateStudent(context.params.id, input);
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新学生失败。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: { id: string } },
) {
  try {
    await deleteStudent(context.params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "删除学生失败。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
