import "dotenv/config";
import { ScraperService } from "../src/services/ScraperService";
import fs from "fs";

interface Report {
  timestamp: string;
  courses: any[]; // You might want to define a more specific interface for CourseData
  tasks?: any[]; // You might want to define a more specific interface for Task
}

async function main() {
  console.log("Starting Proof of Concept...");

  const username = process.env.ITSLEARNING_USERNAME;
  const password = process.env.ITSLEARNING_PASSWORD;
  const instance =
    process.env.ITSLEARNING_INSTANCE || "https://sdu.itslearning.com";

  if (!username || !password) {
    console.error(
      "Error: ITSLEARNING_USERNAME or ITSLEARNING_PASSWORD not set in .env",
    );
    process.exit(1);
  }

  const scraper = new ScraperService(instance);
  const report: any = {
    timestamp: new Date().toISOString(),
    courses: [],
  };

  try {
    console.log("Authenticating...");
    await scraper.authenticate(username, password);
    console.log("Authenticated!");

    console.log("Fetching courses...");
    const courses = await scraper.getCourses();
    console.log(`Found ${courses.length} courses.`);

    for (const course of courses) {
      console.log(`  Processing course: ${course.Title} (${course.CourseId})`);

      const courseData: any = {
        id: course.CourseId,
        title: course.Title,
        resources: [],
        extractedAssignments: [],
      };

      try {
        const resources = await scraper.getResources(course.CourseId);
        console.log(`    Found ${resources.length} resources.`);

        for (const res of resources) {
          const deepLink = scraper.getDeepLink(res.ElementId);
          const resourceEntry: any = {
            id: res.ElementId,
            title: res.Title,
            type: res.ElementType,
            deepLink: deepLink,
          };

          // Heuristic Strategy:
          // Try to fetch Assignment details for EVERY resource.
          // If the API returns data, it's an assignment.
          // This allows us to discover 1) what ElementType assignments actually use, and 2) get the data.
          try {
            const assignmentDetails = await scraper.getAssignmentDetails(
              res.ElementId,
            );

            // API returns { StatusScale, AssessmentScale } for almost everything (generic mixins).
            // Real assignments should have specific fields like 'Deadline' or 'Title'.
            if (assignmentDetails && "Deadline" in assignmentDetails) {
              console.log(
                `      [CONFIRMED ASSIGNMENT] ${res.Title} (ID: ${res.ElementId})`,
              );
              resourceEntry.assignmentDetails = assignmentDetails;
              courseData.extractedAssignments.push({
                ...resourceEntry,
                ...assignmentDetails,
              });
            } else if (
              assignmentDetails &&
              Object.keys(assignmentDetails).length > 2
            ) {
              // Fallback: If it has more than just the 2 generic keys, log it as interesting
              console.log(
                `      [POSSIBLE ASSIGNMENT] ${res.Title} (ID: ${res.ElementId}) keys: ${Object.keys(assignmentDetails).join(", ")}`,
              );
            }
          } catch (err) {
            // Ignore - just means it's not an assignment
          }

          courseData.resources.push(resourceEntry);
        }

        // RSS Feed (Activity Stream)
        // Fetching specific RSS for this course
        try {
          // console.log(`      Fetching RSS Feed...`);
          const rssItems = await scraper.getCourseUpdatesRSS(course.CourseId);
          if (rssItems.length > 0) {
            console.log(`      Found ${rssItems.length} RSS activity items.`);
            courseData.rssActivity = rssItems.slice(0, 3); // Store first 3 for brevity
          }
        } catch (rssErr) {
          /* ignore */
        }

        // --- fetch Tasks (Assignments) for this course ---
        // Since getTasks is global, we might filter them locally or check if we can pass a LocationId filter.
        // The API returns LocationId, so we can filter client-side.
      } catch (err) {
        console.error(
          `    Failed to fetch resources for course ${course.CourseId}`,
          err,
        );
        courseData.error = String(err);
      }

      report.courses.push(courseData);
    }

    // FETCH GLOBAL TASKS (Assignments)
    console.log("Fetching Tasks (Assignments) - Active & Past...");
    try {
      const allTasks = await scraper.getTasks("All");
      console.log(`Found ${allTasks.length} total tasks.`);

      // Add tasks to report separately or merge into courses
      report.tasks = allTasks.map((t: any) => ({
        id: t.ElementId,
        title: t.Title,
        course: t.LocationTitle,
        status: t.Status,
        deadline: t.Deadline,
        url: t.ContentUrl,
      }));
    } catch (taskErr) {
      console.error("Failed to fetch tasks", taskErr);
    }

    fs.writeFileSync("report.json", JSON.stringify(report, null, 2));
    console.log("Done! Report saved to report.json");
  } catch (err) {
    console.error("Fatal error:", err);
  }
}

main();
