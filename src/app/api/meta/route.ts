import { NextResponse } from "next/server";
import { getAccount, getBroker } from "@/lib/store";

export async function GET() {
  const priya = await getBroker("priya");
  const acme = await getAccount("acme");
  return NextResponse.json({
    ready: true,
    demoBroker: priya,
    demoAccount: acme,
    dataNote: "Seeded transcripts are synthetic insurance roleplays.",
  });
}
