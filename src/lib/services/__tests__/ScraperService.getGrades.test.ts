import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AxiosResponse } from "axios";
import { isFileResource, ScraperService } from "../ScraperService";

describe("ScraperService.getGrades", () => {
  let scraper: ScraperService;

  beforeEach(() => {
    vi.clearAllMocks();
    scraper = new ScraperService("https://school.example");
  });

  it("calls the course grades endpoint with bearer auth and paging params", async () => {
    scraper.setAccessToken("test-token");
    const payload = {
      EntityArray: [
        {
          ElementId: 123,
          GradeString: "A",
          Score: 95,
          Feedback: "Good work",
          Url: "https://school.example/grade",
        },
      ],
    };
    const response = {
      data: payload,
    } as AxiosResponse<typeof payload>;
    const getSpy = vi
      .spyOn(scraper.apiClient, "get")
      .mockResolvedValue(response);

    const grades = await scraper.getGrades(4273);

    expect(getSpy).toHaveBeenCalledWith(
      "/restapi/personal/courses/4273/usergrades/v1",
      {
        headers: {
          Authorization: "Bearer test-token",
        },
        params: {
          pageIndex: 0,
          pageSize: 100,
        },
      },
    );
    expect(grades).toEqual(payload.EntityArray);
  });

  it("requires authentication", async () => {
    await expect(scraper.getGrades(4273)).rejects.toThrow("Not authenticated");
  });

  it("returns an empty list when the course grades endpoint returns 404", async () => {
    scraper.setAccessToken("test-token");
    const error = Object.assign(new Error("Request failed"), {
      isAxiosError: true,
      response: { status: 404 },
    });
    vi.spyOn(scraper.apiClient, "get").mockRejectedValue(error);

    await expect(scraper.getGrades(4273)).resolves.toEqual([]);
  });

  it("throws when the course grades endpoint returns 500", async () => {
    scraper.setAccessToken("test-token");
    const error = Object.assign(new Error("Request failed"), {
      isAxiosError: true,
      response: { status: 500 },
    });
    vi.spyOn(scraper.apiClient, "get").mockRejectedValue(error);

    await expect(scraper.getGrades(4273)).rejects.toThrow("Request failed");
  });
});

describe("ScraperService.getCalendarEvents", () => {
  let scraper: ScraperService;

  beforeEach(() => {
    vi.clearAllMocks();
    scraper = new ScraperService("https://school.example");
  });

  it("calls the calendar events endpoint with fromDate, toDate, and PageSize params", async () => {
    scraper.setAccessToken("test-token");
    const payload = {
      EntityArray: [
        {
          EventId: 123,
          Title: "Project kickoff",
        },
      ],
    };
    const response = {
      data: payload,
    } as AxiosResponse<typeof payload>;
    const getSpy = vi
      .spyOn(scraper.apiClient, "get")
      .mockResolvedValue(response);

    const fromDate = new Date("2026-07-06T00:00:00.000Z");
    const toDate = new Date("2026-09-04T00:00:00.000Z");
    const events = await scraper.getCalendarEvents(fromDate, toDate);

    expect(getSpy).toHaveBeenCalledWith(
      "/restapi/personal/calendar/events/v1",
      {
        headers: {
          Authorization: "Bearer test-token",
        },
        params: {
          fromDate: "2026-07-06T00:00:00.000Z",
          toDate: "2026-09-04T00:00:00.000Z",
          PageSize: 100,
        },
      },
    );
    expect(events).toEqual(payload.EntityArray);
  });
});

describe("ScraperService.getResources", () => {
  let scraper: ScraperService;

  beforeEach(() => {
    vi.clearAllMocks();
    scraper = new ScraperService("https://school.example");
    scraper.setAccessToken("test-token");
  });

  it("maps LearningToolId from resource API items", async () => {
    const payload = {
      Resources: {
        EntityArray: [
          {
            ElementId: 317614,
            Title: "ESL-Brains-1162.pdf",
            ElementType: "LearningToolElement",
            IconUrl: "https://school.example/icon.png",
            ContentUrl:
              "https://school.example/LearningToolElement/ViewLearningToolElement.aspx?LearningToolElementId=317614",
            LearningToolId: 5009,
          },
        ],
      },
    };
    vi.spyOn(scraper.apiClient, "get").mockResolvedValue({
      data: payload,
    } as AxiosResponse<typeof payload>);

    await expect(scraper.getResources(4349)).resolves.toEqual([
      {
        ElementId: 317614,
        Title: "ESL-Brains-1162.pdf",
        ElementType: "LearningToolElement",
        IconUrl: "https://school.example/icon.png",
        ContentUrl:
          "https://school.example/LearningToolElement/ViewLearningToolElement.aspx?LearningToolElementId=317614",
        LearningToolId: 5009,
      },
    ]);
  });
});

describe("isFileResource", () => {
  it.each([5009, 5006])(
    "accepts LearningToolElement resources with file learning tool id %i",
    (LearningToolId) => {
      expect(
        isFileResource({
          ElementId: 1,
          Title: "Course file",
          ElementType: "LearningToolElement",
          LearningToolId,
        }),
      ).toBe(true);
    },
  );

  it("rejects folders", () => {
    expect(
      isFileResource({
        ElementId: 2,
        Title: "Folder",
        ElementType: "Folder",
        LearningToolId: 0,
      }),
    ).toBe(false);
  });

  it("rejects non-file learning tool ids", () => {
    expect(
      isFileResource({
        ElementId: 3,
        Title: "Note",
        ElementType: "LearningToolElement",
        LearningToolId: 5,
      }),
    ).toBe(false);
  });
});
