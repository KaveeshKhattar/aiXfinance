import { NextResponse } from "next/server";
import { buildInsights } from "@/lib/insights";
import { getBrokers, getCalls } from "@/lib/store";

export async function GET() {
  const [calls, brokers] = await Promise.all([getCalls(), getBrokers()]);
  const insights = buildInsights(calls);
  return NextResponse.json({ insights, brokers });
}
