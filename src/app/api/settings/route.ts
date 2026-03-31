import { NextResponse } from "next/server";
import { getSettings, saveSettings } from "@/lib/server-db";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await getSettings();
  return NextResponse.json({ data: settings });
}

export async function PUT(request: Request) {
  const body = await request.json();
  const settings = await saveSettings(body);
  return NextResponse.json({ data: settings });
}
