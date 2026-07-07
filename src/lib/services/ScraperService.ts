import axios, {
  AxiosError,
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
import { wrapper } from "axios-cookiejar-support";
import * as cheerio from "cheerio";
import { CookieJar } from "tough-cookie";

type ApiQueryParams = Record<string, string | number | boolean | undefined>;

const DESKTOP_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

export function buildSsoTargetUrl(instanceUrl: string, webUrl: string): string {
  const baseUrl = instanceUrl.replace(/\/+$/, "");
  const targetUrl = new URL(webUrl, `${baseUrl}/`);
  targetUrl.pathname = targetUrl.pathname.replace(/\/{2,}/g, "/");
  return targetUrl.toString();
}

interface EntityArrayResponse<T> {
  EntityArray?: T[];
}

interface RetriableRequestConfig extends InternalAxiosRequestConfig<unknown> {
  retryCount?: number;
  _retryAuth?: boolean;
}

interface OAuthTokenResponse {
  access_token?: string;
}

export interface Course {
  CourseId: number;
  Title: string;
  Url?: string; // Original URL
  Code?: string | null;
  // Richer fields from courses/v3 (optional; absent on older endpoints).
  FriendlyName?: string | null;
  CourseColor?: string | null;
  CourseFillColor?: string | null;
  TaskCount?: number;
  FollowUpTaskCount?: number;
  Role?: string | null;
}

// A course "card" as returned by courses/cards/{starred,unstarred}/v1.
// Best source for the favourite flag plus card imagery. Field names differ
// from courses/vN (e.g. CourseColorClass, NumberOfTasks, IsFavouriteCourse).
export interface CourseCard {
  CourseId: number;
  Title: string;
  FriendlyName?: string | null;
  TeacherName?: string | null;
  CourseColorClass?: string | null;
  NumberOfAnnouncements?: number;
  NumberOfTasks?: number;
  NumberOfFollowUpTasks?: number;
  CourseCardImageUrl?: string | null;
  LastUpdated?: string | null;
  IsFavouriteCourse?: boolean;
}

// person/v1 — the signed-in person, incl. capability flags the UI can use to
// hide features the account cannot access.
export interface Person {
  PersonId: number;
  FirstName?: string;
  LastName?: string;
  FullName?: string;
  Language?: string | null;
  ProfileImageUrl?: string | null;
  iCalUrl?: string | null;
  iCalFavoriteOnlyUrl?: string | null;
  TimeZoneId?: string | null;
  Use12HTimeFormat?: boolean;
  CanAccessMessageSystem?: boolean;
  CanAccessCalendar?: boolean;
  CanAccessPersonalSettings?: boolean;
  CanAccessInstantMessageSystem?: boolean;
  CanAccessCourses?: boolean;
}

// courses/{id}/participants/v3 item — a person enrolled in a course.
export interface Participant {
  PersonId: number;
  FullName?: string;
  Role?: string | null;
  RoleId?: number;
  PictureUrl?: string | null;
  LastVisited?: string | null;
  LastVisitedRelative?: string | null;
  CompletedTasks?: number;
  TotalTasks?: number;
  CanHaveTasks?: boolean;
  Groups?: unknown;
}

// instantmessages/messagethreads/v1 item — one conversation thread.
export interface MessageThread {
  InstantMessageThreadId: number;
  Name?: string | null;
  Type?: string | null;
  Created?: string | null;
  CreatedBy?: string | null;
  CreatedByTeacher?: boolean;
  LastMessage?: unknown;
  Messages?: unknown;
  Participants?: unknown;
  ParticipantsCount?: number;
  LastReadInstantMessageId?: number | null;
  IsBlocked?: boolean;
}

// courses/{id}/bulletins/v1 item (LightBulletin).
export interface LightBulletin {
  LightBulletinId: number;
  Text?: string | null;
  EmbedUrl?: string | null;
  Pinned?: boolean;
  AllowComments?: boolean;
  HasResources?: boolean;
  AttachedImages?: unknown;
  ResourcesCount?: number;
  CommentsCount?: number;
  ActiveFromDate?: string | null;
  ActiveToDate?: string | null;
  IsSubscribed?: boolean;
  PublishedDate?: string | null;
  PublishedBy?: string | null;
}

// notifications/v2 item.
export interface Notification {
  NotificationId: number;
  Text: string;
  PublishedDate?: string | null;
  PublishedBy?: string | null;
  Type?: string | null;
  Url?: string | null;
  ContentUrl?: string | null;
  IsRead?: boolean;
  IsAnonymous?: boolean;
}

export interface Resource {
  ElementId: number;
  Title: string;
  ElementType: string;
  LearningToolId?: number;
  IconUrl?: string;
  ContentUrl?: string; // Sometimes available
  // Breadcrumb from the API, e.g. " / FI24-BFKO / Programmieren in Java 1".
  // The segment after the course title is the topic (Planner) the file lives
  // under, so the sync uses it to group files by topic.
  Path?: string;
}

// 5009 = File tool, 5006 = uploaded audio; verified against live instance 2026-07.
export const FILE_LEARNING_TOOL_IDS = new Set([5009, 5006]);

export function isFileResource(res: Resource): boolean {
  return (
    res.ElementType === "LearningToolElement" &&
    res.LearningToolId !== undefined &&
    FILE_LEARNING_TOOL_IDS.has(res.LearningToolId)
  );
}

export interface GradeItem {
  ElementId: number;
  Title?: string;
  GradeString?: string;
  Score?: number;
  Feedback?: string;
  Url?: string;
}

export interface TaskItem {
  TaskId: number;
  LocationId?: number;
  Title?: string;
  Status?: string;
  Deadline?: string | null;
  Url?: string | null;
}

// Shape returned by /restapi/personal/courses/{id}/topics/v1. The Planner
// ("Topics") lists each topic's display name in `TopicName` and the id of the
// resource folder backing it in `FolderId`. (The older `Title`/`Name`/embedded
// `Resources` fields this code once expected are not part of the response.)
export interface TopicItem {
  TopicId: number;
  TopicName?: string | null;
  FolderId?: number;
}

export interface RssItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
}

interface ResourcesResponse {
  Resources?: EntityArrayResponse<Resource>;
}

// Normalize a user-entered instance URL: prepend https:// when no http(s)://
// scheme is present, and strip trailing slashes. A scheme-less value (e.g.
// "kreisrastatt.itslearning.com") would otherwise become an invalid axios
// baseURL and every request — including the OAuth token call — would fail.
export function normalizeInstanceUrl(raw: string): string {
  const trimmed = (raw || "").trim();
  if (!trimmed) return trimmed;
  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  return withScheme.replace(/\/+$/, "");
}

export class ScraperService {
  public apiClient: AxiosInstance; // For REST API and file downloads (Bearer Token)
  private accessToken: string = "";
  private instanceUrl: string;

  public onAuthFailure?: () => Promise<void>;

  constructor(instanceUrl: string = "https://sdu.itslearning.com") {
    this.instanceUrl = normalizeInstanceUrl(instanceUrl);

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
    const handleError = async (err: AxiosError<unknown, unknown>) => {
      const config = err.config as RetriableRequestConfig | undefined;
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
          config.headers.setAuthorization(`Bearer ${this.accessToken}`);
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
    this.instanceUrl = normalizeInstanceUrl(url);
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
      const res = await this.apiClient.post<OAuthTokenResponse>(
        tokenUrl,
        params,
        {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        },
      );

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
  private async apiGet<TData>(
    url: string,
    params: ApiQueryParams = {},
  ): Promise<AxiosResponse<TData>> {
    return this.apiClient.get(url, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
      params: params,
    });
  }

  async getCourses(): Promise<Course[]> {
    if (!this.accessToken) throw new Error("Not authenticated");

    // v3 is the richest course list: v2 fields plus per-course TaskCount /
    // FollowUpTaskCount / Role (v4 drops the counts). Fall back to v2 if the
    // instance does not expose v3.
    try {
      const res = await this.apiGet<EntityArrayResponse<Course>>(
        "/restapi/personal/courses/v3",
        {
          pageIndex: 0,
          pageSize: 100,
          filter: 1,
        },
      );
      return res.data.EntityArray || [];
    } catch (err) {
      if (
        axios.isAxiosError(err) &&
        (err.response?.status === 404 || err.response?.status === 400)
      ) {
        const res = await this.apiGet<EntityArrayResponse<Course>>(
          "/restapi/personal/courses/v2",
          {
            pageIndex: 0,
            pageSize: 100,
            filter: 1,
          },
        );
        return res.data.EntityArray || [];
      }
      throw err;
    }
  }

  // Course cards (starred + unstarred) with imagery and the favourite flag.
  // Each card carries IsFavouriteCourse; we also tag it from the list it came
  // from so callers do not have to trust a possibly-missing field.
  async getCourseCards(): Promise<CourseCard[]> {
    if (!this.accessToken) throw new Error("Not authenticated");

    const fetchCards = async (
      url: string,
      favourite: boolean,
    ): Promise<CourseCard[]> => {
      try {
        const res = await this.apiGet<EntityArrayResponse<CourseCard>>(url, {
          pageIndex: 0,
          pageSize: 100,
        });
        return (res.data.EntityArray || []).map((c) => ({
          ...c,
          IsFavouriteCourse: c.IsFavouriteCourse ?? favourite,
        }));
      } catch (err) {
        if (
          axios.isAxiosError(err) &&
          (err.response?.status === 403 || err.response?.status === 404)
        ) {
          return [];
        }
        throw err;
      }
    };

    const [starred, unstarred] = await Promise.all([
      fetchCards("/restapi/personal/courses/cards/starred/v1", true),
      fetchCards("/restapi/personal/courses/cards/unstarred/v1", false),
    ]);
    return [...starred, ...unstarred];
  }

  // Toggle a course's favourite (starred) state. The endpoint is a stateful
  // flip returning 200 with an empty body, so callers must know the current
  // state to reach a desired one. Verified live against courses/{id}/toggleFavorite/v1.
  async toggleCourseFavorite(courseId: number): Promise<void> {
    if (!this.accessToken) throw new Error("Not authenticated");

    await this.apiClient.put(
      `/restapi/personal/courses/${courseId}/toggleFavorite/v1`,
      undefined,
      { headers: { Authorization: `Bearer ${this.accessToken}` } },
    );
  }

  // Ensure a course ends up in the desired favourite state. Because the API
  // only offers a toggle, we read the current cards first and flip only when
  // needed (idempotent from the caller's perspective).
  async setCourseFavorite(courseId: number, favourite: boolean): Promise<void> {
    const cards = await this.getCourseCards();
    const card = cards.find((c) => c.CourseId === courseId);
    const current = card?.IsFavouriteCourse ?? false;
    if (current !== favourite) {
      await this.toggleCourseFavorite(courseId);
    }
  }

  async getGrades(courseId: number): Promise<GradeItem[]> {
    if (!this.accessToken) throw new Error("Not authenticated");

    try {
      const res = await this.apiGet<EntityArrayResponse<GradeItem>>(
        `/restapi/personal/courses/${courseId}/usergrades/v1`,
        {
          pageIndex: 0,
          pageSize: 100,
        },
      );
      return res.data?.EntityArray || [];
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        return [];
      }
      throw err;
    }
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

    const res = await this.apiGet<ResourcesResponse>(url, {
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
        LearningToolId: item.LearningToolId,
        IconUrl: item.IconUrl,
        // Sync depends on ContentUrl to create UserFile stubs — keep it mapped.
        ContentUrl: item.ContentUrl,
        // Path carries the topic breadcrumb used for by-topic grouping.
        Path: item.Path,
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
    const res = await this.apiClient.get<string>(url, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });
    return res.data;
  }

  // Fetch Assignment Settings/Details via API
  async getAssignmentDetails(
    elementId: number,
  ): Promise<Record<string, unknown> | null> {
    try {
      const url = `/restapi/personal/assignments/${elementId}/settings/v1`;
      const res = await this.apiGet<Record<string, unknown>>(url);
      return res.data;
    } catch {
      return null;
    }
  }

  // Calendar Events
  async getCalendarEvents(fromDate?: Date, toDate?: Date): Promise<unknown[]> {
    const effectiveFromDate = fromDate ?? new Date();
    if (!fromDate) {
      effectiveFromDate.setUTCHours(0, 0, 0, 0);
    }
    const effectiveToDate =
      toDate ??
      new Date(effectiveFromDate.getTime() + 60 * 24 * 60 * 60 * 1000);

    const res = await this.apiGet<EntityArrayResponse<unknown>>(
      "/restapi/personal/calendar/events/v1",
      {
        fromDate: effectiveFromDate.toISOString(),
        toDate: effectiveToDate.toISOString(),
        PageSize: 100,
      },
    );
    return res.data.EntityArray || [];
  }

  // Notifications
  // notifications/v2 carries per-item read state and type (v1 does not), which
  // the UI needs to render read/unread styling. Falls back to v1 on 404/400.
  async getNotifications(): Promise<Notification[]> {
    try {
      const res = await this.apiGet<EntityArrayResponse<Notification>>(
        "/restapi/personal/notifications/v2",
        { pageSize: 50 },
      );
      return res.data.EntityArray || [];
    } catch (err) {
      if (
        axios.isAxiosError(err) &&
        (err.response?.status === 404 || err.response?.status === 400)
      ) {
        const res = await this.apiGet<EntityArrayResponse<Notification>>(
          "/restapi/personal/notifications/v1",
        );
        return res.data.EntityArray || [];
      }
      throw err;
    }
  }

  // Mark all notifications as seen (clears the "unseen" nav badge). This is a
  // benign, non-destructive write; the API returns 2xx with no meaningful body,
  // so we assert nothing about the response shape.
  async markAllNotificationsSeen(): Promise<void> {
    if (!this.accessToken) throw new Error("Not authenticated");

    await this.apiClient.post(
      "/restapi/personal/notifications/seenmark/all/v1",
      undefined,
      { headers: { Authorization: `Bearer ${this.accessToken}` } },
    );
  }

  // Unread/unseen counts for nav badges. Each endpoint returns a bare integer.
  // A subsystem the account cannot use (e.g. instant messages) returns 403/404
  // and is counted as 0; genuine auth/other errors propagate to the caller.
  async getUnreadCounts(): Promise<{
    unreadNotifications: number;
    unseenNotifications: number;
    unreadMessages: number;
  }> {
    const readCount = async (url: string): Promise<number> => {
      try {
        const res = await this.apiGet<number | { Count?: number }>(url);
        const data = res.data as unknown;
        if (typeof data === "number") return data;
        if (
          data &&
          typeof data === "object" &&
          typeof (data as { Count?: unknown }).Count === "number"
        ) {
          return (data as { Count: number }).Count;
        }
        return 0;
      } catch (err) {
        if (
          axios.isAxiosError(err) &&
          (err.response?.status === 403 || err.response?.status === 404)
        ) {
          return 0;
        }
        throw err;
      }
    };

    const [unreadNotifications, unseenNotifications, unreadMessages] =
      await Promise.all([
        readCount("/restapi/personal/notifications/unread/count/v1"),
        readCount("/restapi/personal/notifications/unseen/count/v1"),
        readCount(
          "/restapi/personal/instantmessages/messagethreads/unread/count/v1",
        ),
      ]);

    return { unreadNotifications, unseenNotifications, unreadMessages };
  }

  // The signed-in person (profile + capability flags).
  async getPerson(): Promise<Person> {
    if (!this.accessToken) throw new Error("Not authenticated");

    const res = await this.apiGet<Person>("/restapi/personal/person/v1");
    return res.data;
  }

  // Course roster with per-person task progress. 403/404 (e.g. no permission)
  // yields an empty list rather than an error.
  async getParticipants(courseId: number): Promise<Participant[]> {
    if (!this.accessToken) throw new Error("Not authenticated");

    try {
      const res = await this.apiGet<EntityArrayResponse<Participant>>(
        `/restapi/personal/courses/${courseId}/participants/v3`,
        { pageIndex: 0, pageSize: 200 },
      );
      return res.data.EntityArray || [];
    } catch (err) {
      if (
        axios.isAxiosError(err) &&
        (err.response?.status === 403 || err.response?.status === 404)
      ) {
        return [];
      }
      throw err;
    }
  }

  // Course Bulletins (LightBulletins)
  async getLightBulletins(courseId: number): Promise<LightBulletin[]> {
    const res = await this.apiGet<EntityArrayResponse<LightBulletin>>(
      `/restapi/personal/courses/${courseId}/bulletins/v1`,
    );
    return res.data.EntityArray || [];
  }

  // Instant-message threads (inbox). Read-only. The account may not have the
  // instant-message system enabled -> 403/404 yields an empty list.
  async getMessageThreads(): Promise<MessageThread[]> {
    if (!this.accessToken) throw new Error("Not authenticated");

    try {
      const res = await this.apiGet<EntityArrayResponse<MessageThread>>(
        "/restapi/personal/instantmessages/messagethreads/v1",
        { pageSize: 30 },
      );
      return res.data.EntityArray || [];
    } catch (err) {
      if (
        axios.isAxiosError(err) &&
        (err.response?.status === 403 || err.response?.status === 404)
      ) {
        return [];
      }
      throw err;
    }
  }

  // Get Tasks (Assignments) - Active or All
  async getTasks(
    status: "Active" | "Completed" | "All" = "Active",
  ): Promise<TaskItem[]> {
    const res = await this.apiGet<EntityArrayResponse<TaskItem>>(
      "/restapi/personal/tasks/v1",
      {
        status: status,
        pageSize: 100,
      },
    );
    return res.data.EntityArray || [];
  }

  // RSS Feed for Course Updates (NotificationRss.aspx)
  async getCourseUpdatesRSS(courseId: number): Promise<RssItem[]> {
    try {
      const url = `${this.instanceUrl}/Rss/NotificationRss.aspx?LocationType=Course&LocationID=${courseId}`;
      const res = await this.apiClient.get<string>(url, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      const $ = cheerio.load(res.data, { xmlMode: true });
      const items: RssItem[] = [];

      $("item").each((i, el) => {
        const title = $(el).find("title").text();
        const link = $(el).find("link").text();
        const description = $(el).find("description").text();
        const pubDate = $(el).find("pubDate").text();

        items.push({ title, link, description, pubDate });
      });

      return items;
    } catch {
      return [];
    }
  }

  // Download a file through ITSLearning's web SSO flow.
  async downloadFile(url: string): Promise<{
    filename: string;
    buffer: Buffer;
    mimeType: string;
  }> {
    const target = buildSsoTargetUrl(this.instanceUrl, url);
    const sso = await this.apiGet<{ Url?: string }>(
      "/restapi/personal/sso/url/v1",
      {
        url: target,
      },
    );

    if (!sso.data.Url) {
      throw new Error("File download failed: SSO URL response missing Url");
    }

    const jar = new CookieJar();
    const webClient = wrapper(
      axios.create({
        jar,
        maxRedirects: 10,
        validateStatus: () => true,
        headers: {
          "User-Agent": DESKTOP_USER_AGENT,
        },
      }),
    );

    const ssoPage = await webClient.get<string>(sso.data.Url);
    if (ssoPage.status >= 400) {
      throw new Error(
        `File download failed: SSO page returned HTTP ${ssoPage.status}`,
      );
    }

    const $ = cheerio.load(ssoPage.data);
    const iframeSrc = $("#ctl00_ContentPlaceHolder_ExtensionIframe").attr(
      "src",
    );
    if (!iframeSrc) {
      throw new Error(
        "File download failed: SSO page did not contain extension iframe",
      );
    }

    const ssoFinalUrl = ssoPage.request?.res?.responseUrl || target;
    const iframeUrl = new URL(iframeSrc, ssoFinalUrl).toString();
    const iframePage = await webClient.get<string>(iframeUrl);
    if (iframePage.status >= 400) {
      throw new Error(
        `File download failed: extension iframe returned HTTP ${iframePage.status}`,
      );
    }

    const iframeFinalUrl = iframePage.request?.res?.responseUrl || iframeUrl;
    const $$ = cheerio.load(iframePage.data);
    let downloadUrl: string | undefined;
    $$("a").each((i, el) => {
      const href = $$(el).attr("href");
      if (href?.includes("DownloadRedirect.ashx")) {
        downloadUrl = href;
      }
    });

    if (!downloadUrl) {
      throw new Error(
        "File download failed: extension iframe did not contain DownloadRedirect.ashx link",
      );
    }

    const absoluteDownloadUrl = new URL(downloadUrl, iframeFinalUrl).toString();
    const res = await webClient.get<ArrayBuffer>(absoluteDownloadUrl, {
      responseType: "arraybuffer",
    });

    const buffer = Buffer.from(res.data);
    const mimeType = res.headers["content-type"] || "application/octet-stream";
    if (buffer.length === 0) {
      throw new Error("File download failed: final response returned 0 bytes");
    }
    if (mimeType.toLowerCase().includes("html")) {
      throw new Error(
        "File download failed: final response returned HTML instead of file bytes",
      );
    }

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
      buffer,
      mimeType,
    };
  }

  // Topics (Plans) for a Course
  async getTopics(courseId: number): Promise<TopicItem[]> {
    const res = await this.apiGet<EntityArrayResponse<TopicItem>>(
      `/restapi/personal/courses/${courseId}/topics/v1`,
    );
    return res.data.EntityArray || [];
  }
}
