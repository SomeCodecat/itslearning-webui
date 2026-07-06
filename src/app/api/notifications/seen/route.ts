import { NextResponse } from "next/server";
import {
  getScraperForSession,
  isAuthSessionError,
} from "@/lib/userScraper";

// Mark all notifications as seen (clears the "unseen" nav badge). Benign write;
// the upstream endpoint returns 2xx with no meaningful body.
export async function POST() {
  try {
    const scraperService = await getScraperForSession();
    await scraperService.markAllNotificationsSeen();

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to mark notifications as seen:", error);

    if (isAuthSessionError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Failed to mark notifications as seen" },
      { status: 500 },
    );
  }
}
