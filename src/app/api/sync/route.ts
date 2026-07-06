import axios from "axios";
import { NextResponse } from "next/server";
import { isFileResource } from "@/lib/services/ScraperService";
import { getScraperForSession } from "@/lib/userScraper";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import fs from "fs/promises";
import path from "path";

// Removed in-memory rate limiting. Wait for Vercel KV or redis integration.

// Helper to sanitize filenames
function sanitize(name: string) {
  return name.replace(/[^a-z0-9\u00a0-\uffff\-_\.]/gi, "_");
}

function optionalText(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).trim();
  return text ? text : null;
}

function optionalScore(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().replace(",", ".");
  const numericText = normalized.endsWith("%")
    ? normalized.slice(0, -1)
    : normalized;

  if (!/^-?\d+(\.\d+)?$/.test(numericText)) {
    return null;
  }

  const score = Number(numericText);
  return Number.isFinite(score) ? score : null;
}

export async function POST() {
  try {
    const userId = await getSessionUserId();

    if (userId === null) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const scraperService = await getScraperForSession();

    // 1. Fetch High-Level Data
    const [courses, tasks] = await Promise.all([
      scraperService.getCourses(),
      scraperService.getTasks("All"),
    ]);

    // 2. Persist Courses and Download Files
    console.log(`Sync: Fetched ${courses.length} courses`);
    const filesBaseDir = path.join(process.cwd(), "files");
    let skipGradesForRun = false;

    // Ensure base directory exists
    try {
      await fs.mkdir(filesBaseDir, { recursive: true });
    } catch {}

    for (const course of courses) {
      if (!course.CourseId) continue;

      // Upsert Course
      const dbCourse = await prisma.course.upsert({
        where: { itslearningId: course.CourseId },
        update: {
          title: course.Title || "Untitled Course",
          code: course.Code || null,
          users: { connect: { id: userId } },
          updatedAt: new Date(),
        },
        create: {
          itslearningId: course.CourseId,
          title: course.Title || "Untitled Course",
          code: course.Code || null,
          users: { connect: { id: userId } },
        },
      });

      // --- 2a. Fetch and Sync Plans (Topics) ---
      const elementToPlanMap = new Map<number, number>(); // ElementID -> PlanID (DB ID)
      try {
        const topics = await scraperService.getTopics(course.CourseId);
        console.log(
          `Sync: Fetched ${topics.length} plans for course ${course.Title}`,
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
        console.warn(`Sync: Failed to fetch plans for ${course.Title}`, err);
      }
      // -----------------------------------------

      // --- 2b. File Sync Logic ---
      console.log(`Sync: Fetching resources for course ${course.Title}`);
      try {
        const resources = await scraperService.getResources(course.CourseId);
        const courseDir = path.join(filesBaseDir, sanitize(course.Title));
        await fs.mkdir(courseDir, { recursive: true });

        for (const res of resources) {
          if (res.ContentUrl && isFileResource(res)) {
            try {
              // Determine Plan
              const planId = elementToPlanMap.get(res.ElementId);

              // Upsert UserFile stub (no download yet)
              const userFile = await prisma.userFile.findFirst({
                where: { userId, elementId: res.ElementId, isArchived: false },
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
          `Sync: Failed to fetch resources for course ${course.Title}`,
          err,
        );
      }

      // --- 2c. Fetch and Sync Grades ---
      if (!skipGradesForRun) {
        console.log(`Sync: Fetching grades for course ${course.Title}`);
        try {
          const grades = await scraperService.getGrades(course.CourseId);
          console.log(
            `Sync: Fetched ${grades.length} grades for course ${course.Title}`,
          );

          for (const grade of grades) {
            if (!grade.ElementId) continue;

            let dbAssignment = await prisma.assignment.findUnique({
              where: {
                elementId_userId: { elementId: grade.ElementId, userId },
              },
            });

            if (!dbAssignment) {
              dbAssignment = await prisma.assignment.create({
                data: {
                  elementId: grade.ElementId,
                  userId,
                  title:
                    optionalText(grade.Title) || "Untitled Graded Assignment",
                  courseId: dbCourse.id,
                  status: "Completed",
                  webUrl: optionalText(grade.Url),
                },
              });
            }

            await prisma.grade.upsert({
              where: { assignmentId: dbAssignment.id },
              update: {
                gradeString: optionalText(grade.GradeString),
                score: optionalScore(grade.Score),
                feedback: optionalText(grade.Feedback),
                webUrl: optionalText(grade.Url),
                updatedAt: new Date(),
              },
              create: {
                assignmentId: dbAssignment.id,
                gradeString: optionalText(grade.GradeString),
                score: optionalScore(grade.Score),
                feedback: optionalText(grade.Feedback),
                webUrl: optionalText(grade.Url),
              },
            });
          }
        } catch (err) {
          if (axios.isAxiosError(err) && err.response) {
            const upstreamError = {
              status: err.response.status,
              data: err.response.data,
            };

            if (err.response.status === 401 || err.response.status === 403) {
              skipGradesForRun = true;
              console.warn(
                `Sync: Failed to sync grades for course ${course.Title}. Upstream auth error; skipping grades for remaining courses in this run.`,
                upstreamError,
              );
            } else {
              console.warn(
                `Sync: Failed to sync grades for course ${course.Title}. Skipping grades for this course only.`,
                upstreamError,
              );
            }
          } else {
            console.warn(
              `Sync: Failed to sync grades for course ${course.Title}. Skipping grades for this course only.`,
              err,
            );
          }
        }
      }
    }

    // 3. Persist Tasks
    console.log(`Sync: Fetched ${tasks.length} tasks`);
    for (const task of tasks) {
      if (!task.TaskId || !task.LocationId) continue;

      const course = await prisma.course.findUnique({
        where: { itslearningId: task.LocationId },
      });

      if (course) {
        await prisma.assignment.upsert({
          where: {
            elementId_userId: { elementId: task.TaskId, userId },
          },
          update: {
            title: task.Title || "Untitled Task",
            status: task.Status,
            deadline: task.Deadline ? new Date(task.Deadline) : null,
            webUrl: task.Url,
            course: { connect: { id: course.id } },
          },
          create: {
            elementId: task.TaskId,
            user: { connect: { id: userId } },
            title: task.Title || "Untitled Task",
            status: task.Status,
            deadline: task.Deadline ? new Date(task.Deadline) : null,
            webUrl: task.Url,
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
  } catch (error) {
    console.error("Sync failed:", error);
    if (error instanceof Error && error.message === "No active session") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to sync" }, { status: 500 });
  }
}
