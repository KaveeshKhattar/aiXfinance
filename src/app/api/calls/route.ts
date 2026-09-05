import { NextResponse } from "next/server";
import { getCall, getCalls } from "@/lib/store";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (id) {
    const call = await getCall(id);
    if (!call) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ call });
  }
  const calls = await getCalls();
  return NextResponse.json({ calls });
}
