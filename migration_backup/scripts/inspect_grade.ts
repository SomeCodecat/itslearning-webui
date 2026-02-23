import "dotenv/config";
import { ScraperService } from "../src/services/ScraperService";

async function main() {
  const username = process.env.ITSLEARNING_USERNAME;
  const password = process.env.ITSLEARNING_PASSWORD;
  const instance =
    process.env.ITSLEARNING_INSTANCE || "https://sdu.itslearning.com";

  // Graded Assignment ID
  const elementId = 396789;
  // Known Course ID (from previous logs)
  const courseId = 4273; // FI24-BFKO

  if (!username || !password) {
    console.error(
      "Error: ITSLEARNING_USERNAME or ITSLEARNING_PASSWORD not set in .env",
    );
    process.exit(1);
  }

  const scraper = new ScraperService(instance);

  try {
    console.log("Authenticating...");
    await scraper.authenticate(username, password);
    console.log("Authenticated!");

    // 1. Inspect The Graded Assignment
    console.log(`\n--- Inspecting Assignment ${elementId} ---`);
    const details = await scraper.getAssignmentDetails(elementId);
    console.log("Details:");
    console.dir(details, { depth: null });

    // 2. Check if Grade is in the Tasks list
    console.log(`\n--- Checking Tasks for Element ${elementId} ---`);
    try {
      const tasks = await scraper.getTasks("All");
      const task = tasks.find((t: any) => t.ElementId === elementId);
      if (task) {
        console.log("Found in Tasks!");
        console.dir(task, { depth: null });
      } else {
        console.log("Not found in Tasks list.");
      }
    } catch (e) {
      console.log("Failed to fetch tasks");
    }

    // 3. Investigate Planner API (New Guesses)
    console.log(`\n--- Inspecting Planner for Course ${courseId} ---`);
    const planTests = [
      `/restapi/personal/courses/${courseId}/planner/plans/v1`,
      `/restapi/personal/courses/${courseId}/plans`, // No version?
      `/restapi/personal/planner/plansinfo/v1?plansIds=94090`, // Test with known ID?
      `/restapi/personal/courses/${courseId}/topics/v1`, // Sometimes called topics
    ];

    for (const url of planTests) {
      try {
        console.log(`Testing: ${url}`);
        const res = await scraper.apiClient.get(url, {
          headers: { Authorization: `Bearer ${scraper["accessToken"]}` },
          params: { pageSize: 10 },
        });
        console.log(
          `SUCCESS ${url}: Total ${res.data.Total || res.data.EntityArray?.length}`,
        );
        if (res.data.EntityArray && res.data.EntityArray.length > 0) {
          console.log("Sample Plan:");
          console.dir(res.data.EntityArray[0], { depth: 2 });
        }
      } catch (e: any) {
        console.log(`FAILED ${url}: ${e.message}`); // Simplified error log
      }
    }

    // 4. Investigate Grades/Gradebook API
    console.log(
      `\n--- Inspecting Gradebook/UserGrades for Course ${courseId} ---`,
    );
    const gradeTests = [
      `/restapi/personal/courses/${courseId}/usergrades/v1`,
      `/restapi/personal/courses/${courseId}/gradebook/usergrades`,
      `/restapi/personal/courses/${courseId}/reports/usergrades`,
      `/restapi/personal/courses/${courseId}/students/grades`,
    ];

    for (const url of gradeTests) {
      try {
        console.log(`Testing: ${url}`);
        const res = await scraper.apiClient.get(url, {
          headers: { Authorization: `Bearer ${scraper["accessToken"]}` },
          params: { pageSize: 100 },
        });
        console.log(`SUCCESS ${url}`);
        console.dir(res.data, { depth: 2 });
      } catch (e: any) {
        console.log(`FAILED ${url}: ${e.message}`);
      }
    }
  } catch (err) {
    console.error("Fatal error:", err);
  }
}

main();
