import { describe, expect, it } from "vitest";
import { buildSsoTargetUrl } from "../ScraperService";

describe("buildSsoTargetUrl", () => {
  it("normalizes an absolute web URL when the instance URL has a trailing slash", () => {
    expect(
      buildSsoTargetUrl(
        "https://school.example/",
        "https://school.example//LearningToolElement/ViewLearningToolElement.aspx?LearningToolElementId=317614",
      ),
    ).toBe(
      "https://school.example/LearningToolElement/ViewLearningToolElement.aspx?LearningToolElementId=317614",
    );
  });

  it("leaves an already clean absolute web URL unchanged", () => {
    expect(
      buildSsoTargetUrl(
        "https://school.example",
        "https://school.example/LearningToolElement/ViewLearningToolElement.aspx?LearningToolElementId=317614",
      ),
    ).toBe(
      "https://school.example/LearningToolElement/ViewLearningToolElement.aspx?LearningToolElementId=317614",
    );
  });
});
