import { NextResponse } from "next/server";
import { getScraperForSession } from "@/lib/userScraper";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

// Removed in-memory rate limiting. Wait for Vercel KV or redis integration.

// Helper to sanitize filenames
function sanitize(name: string) {
  return name.replace(/[^a-z0-9\u00a0-\uffff\-_\.]/gi, "_");
}

export async function POST() {
  try {
    const cookieStore = await cookies();
    const userIdCookie = cookieStore.get("auth_session");

    if (!userIdCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = parseInt(userIdCookie.value);

    const scraperService = await getScraperForSession();

    // 1. Fetch High-Level Data
    const [courses, tasks] = await Promise.all([
      scraperService.getCourses(),
      scraperService.getTasks("Active"),
    ]);

    // 2. Persist Courses and Download Files
    console.log(`Sync: Fetched ${courses.length} courses`);
    const filesBaseDir = path.join(process.cwd(), "files");

    // Ensure base directory exists
    try {
      await fs.mkdir(filesBaseDir, { recursive: true });
    } catch (e) {}

    for (const course of courses) {
      const c = course as any;
      if (!c.CourseId) continue;

      // Upsert Course
      const dbCourse = await prisma.course.upsert({
        where: { itslearningId: c.CourseId },
        update: {
          title: c.Title || "Untitled Course",
          code: c.Code || null,
          users: { connect: { id: userId } },
          updatedAt: new Date(),
        },
        create: {
          itslearningId: c.CourseId,
          title: c.Title || "Untitled Course",
          code: c.Code || null,
          users: { connect: { id: userId } },
        },
      });

      // --- 2a. Fetch and Sync Plans (Topics) ---
      const elementToPlanMap = new Map<number, number>(); // ElementID -> PlanID (DB ID)
      try {
        const topics = await scraperService.getTopics(c.CourseId);
        console.log(
          `Sync: Fetched ${topics.length} plans for course ${c.Title}`,
        );

        for (const topic of topics) {
          // Upsert Plan
          const dbPlan = await prisma.plan.upsert({
            where: { id: topic.TopicId }, // Assuming TopicId is the unique Planner ID
            update: {
              title: topic.Title || "Untitled Plan",
              topic: topic.Name || null,
            },
            create: {
              id: topic.TopicId,
              courseId: dbCourse.id,
              title: topic.Title || "Untitled Plan",
              topic: topic.Name || null,
            },
          });

          // Map resources in this plan
          if (topic.Resources && Array.isArray(topic.Resources.EntityArray)) {
            for (const res of topic.Resources.EntityArray) {
              elementToPlanMap.set(res.ElementId, dbPlan.id);
            }
          }
        }
      } catch (err) {
        console.warn(`Sync: Failed to fetch plans for ${c.Title}`, err);
      }
      // -----------------------------------------

      // --- 2b. File Sync Logic ---
      console.log(`Sync: Fetching resources for course ${c.Title}`);
      try {
        const resources = await scraperService.getResources(c.CourseId);
        const courseDir = path.join(filesBaseDir, sanitize(c.Title));
        await fs.mkdir(courseDir, { recursive: true });

        for (const res of resources) {
          if (res.ContentUrl && res.ElementType === "File") {
            try {
              // Determine Plan
              const planId = elementToPlanMap.get(res.ElementId);

              // Upsert UserFile stub (no download yet)
              const userFile = await prisma.userFile.findFirst({
                where: { userId, elementId: res.ElementId },
              });

              if (userFile) {
                await prisma.userFile.update({
                  where: { id: userFile.id },
                  data: {
                    planId: planId || null,
                    customName: res.Title,
                    webUrl: res.ContentUrl,
                  },
                });
              } else {
                await prisma.userFile.create({
                  data: {
                    userId,
                    elementId: res.ElementId,
                    customName: res.Title,
                    webUrl: res.ContentUrl,
                    planId: planId || null,
                    uploader: "System",
                  },
                });
              }
            } catch (err) {
              console.error(`Sync: Failed to download ${res.Title}`, err);
            }
          }
        }
      } catch (err) {
        console.error(
          `Sync: Failed to fetch resources for course ${c.Title}`,
          err,
        );
      }
    }

    // 3. Persist Tasks
    console.log(`Sync: Fetched ${tasks.length} tasks`);
    for (const task of tasks) {
      const t = task as any;
      if (!t.TaskId || !t.LocationId) continue;

      const course = await prisma.course.findUnique({
        where: { itslearningId: t.LocationId },
      });

      if (course) {
        await prisma.assignment.upsert({
          where: { elementId: t.TaskId },
          update: {
            title: t.Title || "Untitled Task",
            status: t.Status,
            deadline: t.Deadline ? new Date(t.Deadline) : null,
            webUrl: t.Url,
            course: { connect: { id: course.id } },
          },
          create: {
            elementId: t.TaskId,
            title: t.Title || "Untitled Task",
            status: t.Status,
            deadline: t.Deadline ? new Date(t.Deadline) : null,
            webUrl: t.Url,
            course: { connect: { id: course.id } },
          },
        });
      }
    }

    // 4. Update User Sync Time
    await prisma.user.update({
      where: { id: userId },
      data: { lastSyncedAt: new Date() },
    });

    return NextResponse.json({ success: true, timestamp: new Date() });
  } catch (error: any) {
    console.error("Sync failed:", error);
    if (error.message === "No active session") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to sync" }, { status: 500 });
  }
}
