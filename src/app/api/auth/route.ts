import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ScraperService } from "@/lib/services/ScraperService";
import { CryptoService } from "@/lib/services/CryptoService";

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const userIdCookie = cookieStore.get("auth_session");

    if (!userIdCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = parseInt(userIdCookie.value, 10);

    if (!Number.isInteger(userId)) {
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
    let { username: itslearningUser, password, organizationUrl } = body;

    const allowCustom = process.env.ALLOW_CUSTOM_INSTANCE !== "false";
    const defaultInstance =
      process.env.DEFAULT_INSTANCE_URL || "https://sdu.itslearning.com";

    if (!allowCustom || !organizationUrl) {
      organizationUrl = defaultInstance;
    }

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
    } catch (error) {
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
  } catch (error: any) {
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
