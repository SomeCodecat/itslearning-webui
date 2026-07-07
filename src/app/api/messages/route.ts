import { NextResponse } from "next/server";
import {
  getScraperForSession,
  isAuthSessionError,
} from "@/lib/userScraper";

// Instant-message threads (inbox), read-only. Empty if the account has no
// access to the instant-message system.
export async function GET() {
  try {
    const scraperService = await getScraperForSession();
    const threads = await scraperService.getMessageThreads();

    return NextResponse.json(threads);
  } catch (error) {
    console.error("Failed to fetch message threads:", error);

    if (isAuthSessionError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 },
    );
  }
}
