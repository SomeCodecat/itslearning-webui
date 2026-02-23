import axios, { AxiosInstance } from "axios";
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
  public apiClient: AxiosInstance; // For REST API and file downloads (Bearer Token)
  private accessToken: string = "";
  private instanceUrl: string;

  public onAuthFailure?: () => Promise<void>;

  constructor(instanceUrl: string = "https://sdu.itslearning.com") {
    this.instanceUrl = instanceUrl.replace(/\/$/, ""); // Remove trailing slash

    // 1. API Client (Stateless/Bearer) - For REST API
    this.apiClient = axios.create({
      baseURL: this.instanceUrl,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Content-Type": "application/json", // API usually prefers JSON
      },
    });

    // Rate Limiting & Auth Interceptor
    const handleError = async (err: any) => {
      const config = err.config;
      if (!config) return Promise.reject(err);

      if (!config.retryCount) config.retryCount = 0;

      if (err.response?.status === 429 && config.retryCount < 3) {
        config.retryCount++;
        const delay = Math.pow(2, config.retryCount) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.apiClient(config);
      }

      if (err.response?.status === 401 && !config._retryAuth) {
        // Prevent infinite loop if the auth request itself returns 401
        if (config.url?.includes("/oauth2/token")) {
          return Promise.reject(err);
        }

        config._retryAuth = true;
        if (this.onAuthFailure) {
          await this.onAuthFailure();
          config.headers.Authorization = `Bearer ${this.accessToken}`;
          return this.apiClient(config);
        }
      }

      return Promise.reject(err);
    };

    this.apiClient.interceptors.response.use(undefined, handleError);
  }

  public getAccessToken(): string {
    return this.accessToken;
  }

  public setAccessToken(token: string) {
    this.accessToken = token;
  }

  public setInstanceUrl(url: string) {
    this.instanceUrl = url.replace(/\/$/, "");
    this.apiClient.defaults.baseURL = this.instanceUrl;
  }

  async authenticate(username?: string, password?: string): Promise<void> {
    if (!username || !password) throw new Error("Credentials missing");

    const tokenUrl = `/restapi/oauth2/token`;
    const params = new URLSearchParams();
    params.append("client_id", "10ae9d30-1853-48ff-81cb-47b58a325685"); // From Go code
    params.append("grant_type", "password");
    params.append("username", username);
    params.append("password", password);

    try {
      const res = await this.apiClient.post(tokenUrl, params, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });

      if (res.data.access_token) {
        this.accessToken = res.data.access_token;
        console.log("Authentication successful.");
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

  // Fetch arbitrary page content for scraping (Uses API/Bearer Token)
  async getPageContent(url: string): Promise<string> {
    const res = await this.apiClient.get(url, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });
    return res.data;
  }

  // Fetch Assignment Settings/Details via API
  async getAssignmentDetails(elementId: number): Promise<any> {
    try {
      const url = `/restapi/personal/assignments/${elementId}/settings/v1`;
      const res = await this.apiGet(url);
      return res.data;
    } catch (error: any) {
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
  async getCourseUpdatesRSS(courseId: number): Promise<any[]> {
    try {
      const url = `${this.instanceUrl}/Rss/NotificationRss.aspx?LocationType=Course&LocationID=${courseId}`;
      const res = await this.apiClient.get(url, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
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
      return [];
    }
  }

  // Download a file (Uses API Client / Bearer token)
  async downloadFile(url: string): Promise<{
    filename: string;
    buffer: Buffer;
    mimeType: string;
  }> {
    const res = await this.apiClient.get(url, {
      responseType: "arraybuffer",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    let filename = "downloaded_file";
    const contentDisposition = res.headers["content-disposition"];
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(
        /filename\*?=['\"]?(?:utf-8'')?([^'\";]+)['\"]?/i,
      );
      if (filenameMatch && filenameMatch[1]) {
        filename = decodeURIComponent(filenameMatch[1]);
      } else {
        const legacyMatch = contentDisposition.match(
          /filename=['\"]?([^'\";]+)['\"]?/i,
        );
        if (legacyMatch && legacyMatch[1]) {
          filename = legacyMatch[1];
        }
      }
    }

    return {
      filename,
      buffer: Buffer.from(res.data),
      mimeType: res.headers["content-type"] || "application/octet-stream",
    };
  }

  // Topics (Plans) for a Course
  async getTopics(courseId: number): Promise<any[]> {
    const res = await this.apiGet(
      `/restapi/personal/courses/${courseId}/topics/v1`,
    );
    return res.data.EntityArray || [];
  }
}
