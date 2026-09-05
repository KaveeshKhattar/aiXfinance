import { NextResponse } from "next/server";
import { getAccount, getBroker } from "@/lib/store";
import {elevenConfigured,elevenModel} from '@/lib/elevenlabs';
import {prismConfigured} from '@/lib/prism';

export async function GET() {
  const priya = await getBroker("priya");
  const acme = await getAccount("acme");
  return NextResponse.json({
    ready: true,
    elevenlabs: elevenConfigured(),
    model: elevenModel(),
    prism: prismConfigured(),
    demoBroker: priya,
    demoAccount: acme,
    dataNote: "Seeded transcripts are synthetic insurance roleplays.",
  });
}
