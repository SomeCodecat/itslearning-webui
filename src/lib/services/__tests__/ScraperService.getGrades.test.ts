import { beforeEach, describe, expect, it, vi } from "vitest";
import { ScraperService } from "../ScraperService";

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
    const getSpy = vi
      .spyOn(scraper.apiClient, "get")
      .mockResolvedValue({ data: payload } as any);

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
});
