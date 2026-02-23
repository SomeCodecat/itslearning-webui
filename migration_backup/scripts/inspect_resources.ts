import "dotenv/config";
import { ScraperService } from "../src/services/ScraperService";

async function main() {
  const username = process.env.ITSLEARNING_USERNAME;
  const password = process.env.ITSLEARNING_PASSWORD;
  const instance =
    process.env.ITSLEARNING_INSTANCE || "https://sdu.itslearning.com";
  const courseId = 4273; // FI24-BFKO

  if (!username || !password) {
    process.exit(1);
  }

  const scraper = new ScraperService(instance);

  try {
    await scraper.authenticate(username, password);
    console.log("Authenticated!");

    // Check HTML Content for metadata
    const elementId = 316613;
    // Try appending token to URL for SSO-like access
    const contentUrl = `https://kreisrastatt.itslearning.com/LearningToolElement/ViewLearningToolElement.aspx?LearningToolElementId=316613&access_token=${scraper["accessToken"]}`;
    console.log(`\n--- Inspecting HTML Content for Element ${elementId} ---`);
    console.log(`Testing URL with token...`);
    try {
      const html = await scraper.getPageContent(contentUrl);
      console.log("HTML Content (First 2000 chars):");
      console.log(html.substring(0, 2000));

      // Simple regex checks for common patterns
      const addedByMatch =
        html.match(/Added by:?\s*<[^>]+>([^<]+)/i) ||
        html.match(/Hinzugefügt von:?\s*<[^>]+>([^<]+)/i);
      if (addedByMatch) console.log("Found Author:", addedByMatch[1]);

      const dateMatch = html.match(/\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2}/);
      if (dateMatch) console.log("Found Date:", dateMatch[0]);
    } catch (e: any) {
      console.log(`Failed to fetch HTML: ${e.message}`);
    }

    // Check specific element details for 316613
    // const elementId = 316613; // Moved up for HTML content check
    console.log(`\n--- Inspecting Details for Element ${elementId} ---`);

    const detailTests = [
      `/restapi/personal/resources/${elementId}/v1`,
      `/restapi/personal/courses/${courseId}/resources/${elementId}/v1`,
      `/restapi/personal/elements/${elementId}/v1`,
      `/restapi/personal/courses/${courseId}/elements/${elementId}/v1`,
    ];

    for (const url of detailTests) {
      try {
        console.log(`Testing: ${url}`);
        const res = await scraper.apiClient.get(url, {
          headers: { Authorization: `Bearer ${scraper["accessToken"]}` },
        });
        console.log(`SUCCESS ${url}`);
        console.dir(res.data, { depth: null });
      } catch (e: any) {
        console.log(`FAILED ${url}: ${e.message}`);
      }
    }

    console.log(`Inspecting Resources for Course ${courseId}...`);
    const res = await scraper.apiClient.get(
      `/restapi/personal/courses/${courseId}/resources/v1`,
      {
        headers: { Authorization: `Bearer ${scraper["accessToken"]}` },
        params: { pageSize: 5 }, // Just need a few to check metadata
      },
    );

    if (res.data.Resources?.EntityArray) {
      // Log the first non-folder item to see properties
      const file = res.data.Resources.EntityArray.find(
        (r: any) => r.ElementType !== "Folder",
      );
      if (file) {
        console.log("File Resource Sample:");
        console.dir(file, { depth: null });
      } else {
        console.log("No file resources found in first batch.");
        console.dir(res.data.Resources.EntityArray[0], { depth: null });
      }
    }
  } catch (err) {
    console.error("Fatal error:", err);
  }
}

main();
