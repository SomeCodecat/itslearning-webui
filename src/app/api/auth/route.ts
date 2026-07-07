import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  ScraperService,
  normalizeInstanceUrl,
} from "@/lib/services/ScraperService";
import { CryptoService } from "@/lib/services/CryptoService";
import { getSessionUserId } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId();

    if (userId === null) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      username: itslearningUser,
      password,
      organizationUrl: requestedOrganizationUrl,
    } = body;
    let organizationUrl = requestedOrganizationUrl;

    const allowCustom = process.env.ALLOW_CUSTOM_INSTANCE !== "false";
    const defaultInstance =
      process.env.DEFAULT_INSTANCE_URL || "https://sdu.itslearning.com";

    if (!allowCustom || !organizationUrl) {
      organizationUrl = defaultInstance;
    }

    // Accept a scheme-less link (e.g. "kreisrastatt.itslearning.com") by
    // defaulting to https:// and stripping trailing slashes.
    organizationUrl = normalizeInstanceUrl(organizationUrl);

    if (!itslearningUser || !password) {
      return NextResponse.json(
        { error: "ITSLearning Username and password are required" },
        { status: 400 },
      );
    }

    const scraper = new ScraperService(
      organizationUrl || "https://sdu.itslearning.com",
    );

    try {
      await scraper.authenticate(itslearningUser, password);
    } catch {
      return NextResponse.json(
        { error: "Invalid ITSLearning credentials" },
        { status: 401 },
      );
    }

    const { encrypted, iv } = CryptoService.encryptToString(password);

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        itslearningUser,
        itslearningPwd: encrypted,
        itslearningIv: iv,
        itslearningAccessToken: scraper.getAccessToken(),
        itslearningTokenExpiresAt: new Date(Date.now() + 1000 * 60 * 50),
        itslearningUrl: organizationUrl || "https://sdu.itslearning.com",
      },
      select: {
        itslearningUrl: true,
        itslearningUser: true,
        lastSyncedAt: true,
      },
    });

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "ITSLearning account is already connected to another user" },
        { status: 409 },
      );
    }

    console.error("Failed to connect ITSLearning account:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
