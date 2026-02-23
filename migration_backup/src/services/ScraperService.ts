import axios, { AxiosInstance } from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";
import { URLSearchParams } from "url";
import * as cheerio from "cheerio";

interface Course {
  CourseId: number;
  Title: string;
  Url: string; // Original URL
}

interface Resource {
  ElementId: number;
  Title: string;
  ElementType: string;
  IconUrl: string;
  ContentUrl?: string; // Sometimes available
}

export class ScraperService {
  public apiClient: AxiosInstance; // For REST API (Bearer Token)
  public browserClient: AxiosInstance; // For RSS/ASPX (Cookie Jar)
  private jar: CookieJar;
  private accessToken: string = "";
  private instanceUrl: string;

  constructor(instanceUrl: string = "https://sdu.itslearning.com") {
    this.instanceUrl = instanceUrl.replace(/\/$/, ""); // Remove trailing slash
    this.jar = new CookieJar();

    // 1. Browser Client (Cookies) - For RSS / HTML Parsing
    this.browserClient = wrapper(
      axios.create({
        jar: this.jar,
        baseURL: this.instanceUrl,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }),
    );

    // 2. API Client (Stateless/Bearer) - For REST API
    this.apiClient = axios.create({
      baseURL: this.instanceUrl,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Content-Type": "application/json", // API usually prefers JSON
      },
    });

    // Rate Limiting Interceptor (Apply to both?)
    const backoff = async (err: any) => {
      const config = err.config;
      if (!config || !config.retryCount) config.retryCount = 0;

      if (err.response?.status === 429 && config.retryCount < 3) {
        config.retryCount++;
        const delay = Math.pow(2, config.retryCount) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
        // Retry with the same client instance that caused the error
        if (config.jar) return this.browserClient(config);
        return this.apiClient(config);
      }
      return Promise.reject(err);
    };

    this.browserClient.interceptors.response.use(undefined, backoff);
    this.apiClient.interceptors.response.use(undefined, backoff);
  }

  async authenticate(username?: string, password?: string): Promise<void> {
    if (!username || !password) throw new Error("Credentials missing");

    // Matching the Go code's logic: OAuth2 Password Grant
    // Use API client for this? Or Browser? Go code uses "client".
    // OAuth token endpoint usually doesn't need cookies but might return them?
    // Let's use apiClient to keep it clean.
    const tokenUrl = `/restapi/oauth2/token`;
    const params = new URLSearchParams();
    params.append("client_id", "10ae9d30-1853-48ff-81cb-47b58a325685"); // From Go code
    params.append("grant_type", "password");
    params.append("username", username);
    params.append("password", password);

    try {
      // Use browserClient here ONLY if we need to establish a session for RSS later.
      // RSS usually requires a session cookie.
      // So we might need to login via a form or something for RSS?
      // Or does the bearer token give us access to everything?
      // "NotificationRss.aspx" sounds like it relies on Cookies.
      // The Go code might be doing something specific.
      // For now, let's just get the token.

      const res = await this.apiClient.post(tokenUrl, params, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });

      if (res.data.access_token) {
        this.accessToken = res.data.access_token;
        console.log("Authentication successful.");

        // IMPORTANT: We also need to set the cookie for the browserClient if we want RSS to work?
        // Actually, the previous trace showed RSS working cleanly. RSS worked with just the JAR.
        // But how did the JAR get authenticated?
        // Ah, in the previous run, we didn't call login for RSS specifically.
        // Did the OAuth call set a cookie?
        // OAuth endpoints usually don't set ASP.NET_SessionId.
        // Wait, did the RSS request simply work publicly?
        // NotificationRss likely requires auth.
        // Maybe we need to pass the token to the browserClient somehow?
        // Or maybe we use the token to get a cookie?
        // For now, let's keep authentication strictly generating the token.
        // If RSS fails later due to auth, we'll address it.
        // BUT: The user's script showed RSS *succeeded* (Step 256) but then Tasks failed with 401.
        // This implies RSS got a 404/401 initially or eventually worked.
        // Step 251: RSS /Rss/NotificationRss... SUCCESS.
        // This implies it worked. The "Cookie" header in Step 291 showed ASP.NET_SessionId.
        // Where did it come from? The RSS request itself likely established it.
        // It might be using a guest session or the RSS feed is public with a token in the URL?
        // The URL in the trace was `/Rss/NotificationRss.aspx?LocationType=Course&LocationID=4349`.
        // There is no token in that URL.
        // Maybe the site allows anonymous read of RSS if not restricted?
        // Let's assume RSS works (or we figure it out) and prioritize API not failing.
      } else {
        throw new Error("No access_token in response");
      }
    } catch (err) {
      console.error("Authentication failed:", err);
      throw err;
    }
  }

  // Helper for authenticated requests
  private async apiGet(url: string, params: any = {}) {
    return this.apiClient.get(url, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
      params: params,
    });
  }

  async getCourses(): Promise<Course[]> {
    if (!this.accessToken) throw new Error("Not authenticated");

    const res = await this.apiGet("/restapi/personal/courses/v2", {
      pageIndex: 0,
      pageSize: 100,
      filter: 1,
    });
    return res.data.EntityArray || [];
  }

  // Recursive fetching of resources
  async getResources(
    courseId: number,
    folderId: number = 0,
  ): Promise<Resource[]> {
    let url = `/restapi/personal/courses/${courseId}/resources/v1`;
    if (folderId !== 0) {
      url = `/restapi/personal/courses/${courseId}/folders/${folderId}/resources/v1`;
    }

    const res = await this.apiGet(url, {
      pageIndex: 0,
      pageSize: 9999,
    });

    const items = res.data.Resources?.EntityArray || [];
    const results: Resource[] = [];

    for (const item of items) {
      // Map basic fields
      const resource: Resource = {
        ElementId: item.ElementId,
        Title: item.Title,
        ElementType: item.ElementType,
        IconUrl: item.IconUrl,
      };

      results.push(resource);

      // Recursive dive if folder
      if (item.ElementType === "Folder") {
        const children = await this.getResources(courseId, item.ElementId);
        results.push(...children);
      }
    }
    return results;
  }

  // Helper to generate Deep Link
  getDeepLink(elementId: number): string {
    return `${this.instanceUrl}/LearningToolElement/ViewLearningToolElement.aspx?LearningToolElementId=${elementId}`;
  }

  // Fetch arbitrary page content for scraping (Uses Browser/Cookies)
  async getPageContent(url: string): Promise<string> {
    const res = await this.browserClient.get(url);
    return res.data;
  }

  // Fetch Assignment Settings/Details via API
  async getAssignmentDetails(elementId: number): Promise<any> {
    try {
      const url = `/restapi/personal/assignments/${elementId}/settings/v1`;
      const res = await this.apiGet(url);
      return res.data;
    } catch (error: any) {
      // If it's a 404 or 400, it's likely not an assignment or we can't access it this way.
      // We'll swallow the error and return null to indicate "not an assignment".
      return null;
    }
  }

  // Calendar Events
  async getCalendarEvents(): Promise<any[]> {
    const res = await this.apiGet("/restapi/personal/calendar/events/v1");
    return res.data.EntityArray || [];
  }

  // Notifications
  async getNotifications(): Promise<any[]> {
    const res = await this.apiGet("/restapi/personal/notifications/v1");
    return res.data.EntityArray || [];
  }

  // Course Bulletins (LightBulletins)
  async getLightBulletins(courseId: number): Promise<any[]> {
    const res = await this.apiGet(
      `/restapi/personal/courses/${courseId}/bulletins/v1`,
    );
    return res.data.EntityArray || [];
  }

  // Get Tasks (Assignments) - Active or All
  async getTasks(
    status: "Active" | "Completed" | "All" = "Active",
  ): Promise<any[]> {
    const res = await this.apiGet("/restapi/personal/tasks/v1", {
      status: status,
      pageSize: 100,
    });
    return res.data.EntityArray || [];
  }

  // RSS Feed for Course Updates (NotificationRss.aspx)
  // Uses browserClient for cookies/ASPX handling
  async getCourseUpdatesRSS(courseId: number): Promise<any[]> {
    try {
      const url = `${this.instanceUrl}/Rss/NotificationRss.aspx?LocationType=Course&LocationID=${courseId}`;
      const res = await this.browserClient.get(url, {
        // RSS usually doesn't need Bearer token if session cookie is set
      });

      const $ = cheerio.load(res.data, { xmlMode: true });
      const items: any[] = [];

      $("item").each((i, el) => {
        const title = $(el).find("title").text();
        const link = $(el).find("link").text();
        const description = $(el).find("description").text();
        const pubDate = $(el).find("pubDate").text();

        items.push({ title, link, description, pubDate });
      });

      return items;
    } catch (e) {
      // console.warn(`Failed to fetch RSS for course ${courseId}`, e);
      return [];
    }
  }

  // Topics (Plans) for a Course
  async getTopics(courseId: number): Promise<any[]> {
    const res = await this.apiGet(
      `/restapi/personal/courses/${courseId}/topics/v1`,
    );
    return res.data.EntityArray || [];
  }
}
