import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import { ScraperService } from "@/lib/services/ScraperService";
import { CryptoService } from "@/lib/services/CryptoService";
import { verifyPassword } from "@/lib/passwordHash";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      email: identifier,
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

    if (!identifier || !password) {
      return NextResponse.json(
        { error: "Username/email and password are required" },
        { status: 400 },
      );
    }

    // ── Local login path ─────────────────────────────────────────────────────
    // If the identifier matches an existing user's email AND that user has a
    // passwordHash, verify locally — no ITSLearning call needed.
    const localUser = await prisma.user.findUnique({
      where: { email: identifier },
      select: { id: true, passwordHash: true },
    });

    if (localUser?.passwordHash) {
      const valid = await verifyPassword(password, localUser.passwordHash);
      if (!valid) {
        return NextResponse.json(
          { error: "Invalid credentials" },
          { status: 401 },
        );
      }

      // Issue session cookie and return — ITSLearning can be linked later via Settings.
      const cookieStore = await cookies();
      cookieStore.set("auth_session", localUser.id.toString(), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
      });

      return NextResponse.json({ success: true });
    }

    // ── ITSLearning login path ────────────────────────────────────────────────
    // The identifier is treated as an ITSLearning username from here on.
    const itslearningUser = identifier;

    // 1. Authenticate with ITSLearning
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

    // 2. Encrypt credentials for background syncing
    const { encrypted, iv } = CryptoService.encryptToString(password);

    const itslearningData = {
      itslearningUser,
      itslearningPwd: encrypted,
      itslearningIv: iv,
      itslearningAccessToken: scraper.getAccessToken(),
      itslearningTokenExpiresAt: new Date(Date.now() + 1000 * 60 * 50),
      itslearningUrl: organizationUrl || "https://sdu.itslearning.com",
    };

    // 3. Determine which user row to update (4-step precedence):
    let userId: number;

    // Step 1: Active session cookie → link to that user
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("auth_session");
    if (sessionCookie) {
      const sessionUserId = parseInt(sessionCookie.value, 10);
      if (Number.isInteger(sessionUserId)) {
        const sessionUser = await prisma.user.findUnique({
          where: { id: sessionUserId },
          select: { id: true },
        });
        if (sessionUser) {
          // Verify the itslearningUser isn't already owned by a DIFFERENT user
          const existingOwner = await prisma.user.findUnique({
            where: { itslearningUser },
            select: { id: true },
          });
          if (existingOwner && existingOwner.id !== sessionUserId) {
            return NextResponse.json(
              {
                error:
                  "This ITSLearning account is already linked to a different user",
              },
              { status: 409 },
            );
          }
          await prisma.user.update({
            where: { id: sessionUserId },
            data: itslearningData,
          });
          userId = sessionUserId;

          cookieStore.set("auth_session", userId.toString(), {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            maxAge: 60 * 60 * 24 * 7,
            path: "/",
          });
          return NextResponse.json({ success: true });
        }
      }
    }

    // Step 2: A user with this itslearningUser already exists → update
    const byItslearning = await prisma.user.findUnique({
      where: { itslearningUser },
      select: { id: true },
    });
    if (byItslearning) {
      await prisma.user.update({
        where: { id: byItslearning.id },
        data: itslearningData,
      });
      userId = byItslearning.id;
    } else {
      // Step 3: Exactly one user with a passwordHash but no itslearningUser
      //         (the orphaned setup admin) → link to that account
      const orphanedAdmins = await prisma.user.findMany({
        where: {
          passwordHash: { not: null },
          itslearningUser: null,
        },
        select: { id: true },
      });

      if (orphanedAdmins.length === 1) {
        await prisma.user.update({
          where: { id: orphanedAdmins[0].id },
          data: itslearningData,
        });
        userId = orphanedAdmins[0].id;
      } else {
        // Step 4: Create a new user row
        const newUser = await prisma.user.create({
          data: itslearningData,
          select: { id: true },
        });
        userId = newUser.id;
      }
    }

    // 4. Set session cookie
    cookieStore.set("auth_session", userId.toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Login failed:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
