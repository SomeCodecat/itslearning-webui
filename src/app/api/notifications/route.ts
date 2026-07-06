import { NextResponse } from "next/server";
import {
  getScraperForSession,
  isAuthSessionError,
} from "@/lib/userScraper";

export async function GET() {
  try {
    const scraperService = await getScraperForSession();
    const notifications = await scraperService.getNotifications();

    return NextResponse.json(notifications);
  } catch (error: any) {
    console.error("Failed to fetch notifications:", error);

    if (isAuthSessionError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Failed to fetch notifications" },
      { status: 500 },
    );
  }
}
