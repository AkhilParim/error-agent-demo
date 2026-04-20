import { NextResponse } from "next/server";

const POSTHOG_HOST = "https://us.posthog.com";
const PROJECT_ID = process.env.POSTHOG_PROJECT_ID ?? "390064";
const PERSONAL_KEY = process.env.POSTHOG_PERSONAL_API_KEY;

export const revalidate = 0;

export async function GET() {
  if (!PERSONAL_KEY) {
    return NextResponse.json({ events: [], error: "No API key configured" });
  }

  try {
    const url = new URL(`${POSTHOG_HOST}/api/projects/${PROJECT_ID}/events/`);
    url.searchParams.set("event", "agent_status");
    url.searchParams.set("limit", "20");
    url.searchParams.set("orderBy", "-timestamp");

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${PERSONAL_KEY}` },
      next: { revalidate: 0 },
    });

    if (!res.ok) return NextResponse.json({ events: [], error: `PostHog error: ${res.status}` });

    const data = await res.json();
    const events = (data.results ?? []).map(
      (e: { timestamp: string; properties: Record<string, unknown> }) => ({
        timestamp: e.timestamp,
        status: e.properties.status ?? "info",
        message: e.properties.message ?? "",
        scene: e.properties.scene,
        files: e.properties.files,
        duration: e.properties.duration,
      })
    );

    return NextResponse.json({ events });
  } catch (err) {
    return NextResponse.json({ events: [], error: String(err) });
  }
}
