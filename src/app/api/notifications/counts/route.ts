import { NextResponse } from "next/server";
import { getScraperForSession, isAuthSessionError } from "@/lib/userScraper";

// Unread/unseen counts for nav badges (notifications + instant messages).
export async function GET() {
  try {
    const scraperService = await getScraperForSession();
    const counts = await scraperService.getUnreadCounts();

    return NextResponse.json(counts);
  } catch (error) {
    console.error("Failed to fetch notification counts:", error);

    if (isAuthSessionError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Failed to fetch notification counts" },
      { status: 500 },
    );
  }
}
