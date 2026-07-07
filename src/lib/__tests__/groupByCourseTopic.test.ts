import { describe, expect, it } from "vitest";
import { groupByCourseTopic } from "../groupByCourseTopic";

describe("groupByCourseTopic", () => {
  const files = [
    { id: 1, customName: "A", courseTitle: "Maths", topic: "Algebra" },
    { id: 2, customName: "B", courseTitle: "Maths", topic: "Algebra" },
    { id: 3, customName: "C", courseTitle: "Maths", planTitle: "Geometry" },
    { id: 4, customName: "D", courseTitle: "Physics", folderPath: "Optics/W1" },
    { id: 5, customName: "E", courseTitle: "Maths" }, // no topic -> ungrouped topic
    { id: 6, customName: "F" }, // no course -> ungrouped course
  ];

  it("builds a course -> topic -> files hierarchy", () => {
    const groups = groupByCourseTopic(files, "Ungrouped");
    const maths = groups.find((g) => g.courseKey === "Maths")!;
    expect(maths.fileCount).toBe(4);
    const algebra = maths.topics.find((t) => t.topicKey === "Algebra")!;
    expect(algebra.files.map((f) => f.id)).toEqual([1, 2]);
    // folderPath is used as the topic label when topic/planTitle are absent
    const physics = groups.find((g) => g.courseKey === "Physics")!;
    expect(physics.topics[0].topicLabel).toBe("Optics/W1");
  });

  it("sorts courses and topics alphabetically with ungrouped last", () => {
    const groups = groupByCourseTopic(files, "Ungrouped");
    // Courses: Maths, Physics, then the no-course bucket last
    expect(groups.map((g) => g.courseLabel)).toEqual([
      "Maths",
      "Physics",
      "Ungrouped",
    ]);
    // Within Maths: Algebra, Geometry, then the no-topic bucket last
    const maths = groups.find((g) => g.courseKey === "Maths")!;
    expect(maths.topics.map((t) => t.topicLabel)).toEqual([
      "Algebra",
      "Geometry",
      "Ungrouped",
    ]);
  });

  it("labels the ungrouped buckets with the provided label", () => {
    const groups = groupByCourseTopic(files, "Sonstige");
    const noCourse = groups[groups.length - 1];
    expect(noCourse.courseLabel).toBe("Sonstige");
    expect(noCourse.topics[0].topicLabel).toBe("Sonstige");
  });
});
