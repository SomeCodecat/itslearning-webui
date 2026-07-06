import axios from "axios";
import { NextResponse } from "next/server";
import {
  getScraperForSession,
  isAuthSessionError,
} from "@/lib/userScraper";

function parseOptionalDate(value: string | null): Date | undefined {
  if (!value) return undefined;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${value}`);
  }

  return date;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fromDate = parseOptionalDate(searchParams.get("from"));
    const toDate = parseOptionalDate(searchParams.get("to"));

    const scraperService = await getScraperForSession();
    const events = await scraperService.getCalendarEvents(fromDate, toDate);
    return NextResponse.json(events);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Invalid date:")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (axios.isAxiosError(error) && error.response) {
      console.error("Failed to fetch calendar events:", {
        status: error.response.status,
        data: error.response.data,
      });
    } else {
      console.error("Failed to fetch calendar events:", error);
    }

    if (isAuthSessionError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Failed to fetch events" },
      { status: 500 },
    );
  }
}
