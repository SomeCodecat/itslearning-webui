import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import { ScraperService } from "@/lib/services/ScraperService";
import { CryptoService } from "@/lib/services/CryptoService";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    let { email: itslearningUser, password, organizationUrl } = body;

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

    // 1. Authenticate with ITSLearning directly
    const scraper = new ScraperService(
      organizationUrl || "https://sdu.itslearning.com",
    );
    try {
      await scraper.authenticate(itslearningUser, password);
    } catch (e) {
      return NextResponse.json(
        { error: "Invalid ITSLearning credentials" },
        { status: 401 },
      );
    }

    // 2. Encrypt credentials for background syncing
    const { encrypted, iv } = CryptoService.encrypt(password);

    // 3. Upsert User in Database
    const user = await prisma.user.upsert({
      where: { itslearningUser },
      update: {
        itslearningPwd: encrypted,
        itslearningIv: iv,
        itslearningAccessToken: scraper.getAccessToken(),
        itslearningTokenExpiresAt: new Date(Date.now() + 1000 * 60 * 50),
        itslearningUrl: organizationUrl || "https://sdu.itslearning.com",
      },
      create: {
        itslearningUser,
        itslearningPwd: encrypted,
        itslearningIv: iv,
        itslearningAccessToken: scraper.getAccessToken(),
        itslearningTokenExpiresAt: new Date(Date.now() + 1000 * 60 * 50),
        itslearningUrl: organizationUrl || "https://sdu.itslearning.com",
      },
    });

    // 4. Set Session Cookie
    const cookieStore = await cookies();
    cookieStore.set("auth_session", user.id.toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: "/",
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Login failed:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
