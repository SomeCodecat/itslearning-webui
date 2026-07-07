import { NextResponse } from "next/server";
import {
  getScraperForSession,
  isAuthSessionError,
} from "@/lib/userScraper";

// The signed-in person: profile plus capability flags (CanAccessCalendar,
// CanAccessMessageSystem, ...) the UI can use to hide unavailable features.
export async function GET() {
  try {
    const scraperService = await getScraperForSession();
    const person = await scraperService.getPerson();

    return NextResponse.json(person);
  } catch (error) {
    console.error("Failed to fetch person:", error);

    if (isAuthSessionError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Failed to fetch person" },
      { status: 500 },
    );
  }
}
