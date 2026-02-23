import { ScraperService } from "./services/ScraperService";

// Singleton instance to preserve session/cookies in a long-running process (like local Docker).
// In a serverless environment, we would need to serialize/deserialize the CookieJar.
export const scraperService = new ScraperService();
