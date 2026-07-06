import { NextResponse } from "next/server";
import {
  getScraperForSession,
  isAuthSessionError,
} from "@/lib/userScraper";

export async function GET() {
  try {
    // Calendar events often require specific range parameters, but getCalendarEvents in service
    // currently fetches a default set (likely upcoming).
    // We might need to extend ScraperService to accept time ranges if the API demands it.
    // For now, mapping to the existing simplistic method.
    const scraperService = await getScraperForSession();
    const events = await scraperService.getCalendarEvents();
    return NextResponse.json(events);
  } catch (error) {
    console.error("Failed to fetch calendar events:", error);

    if (isAuthSessionError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Failed to fetch events" },
      { status: 500 },
    );
  }
}
