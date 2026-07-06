import { describe, expect, it } from "vitest";
import { groupFiles } from "../groupFiles";

describe("groupFiles helper", () => {
  const dummyFiles = [
    { id: 1, customName: "File 1", topic: "B-Topic", courseTitle: "Maths" },
    { id: 2, customName: "File 2", planTitle: "A-Plan", courseTitle: "Physics" },
    {
      id: 3,
      customName: "File 3",
      folderPath: "C-Folder",
      courseTitle: "Maths",
    },
    { id: 4, customName: "File 4", courseTitle: "Chemistry" },
    { id: 5, customName: "File 5" },
  ];

  it("returns flat list correctly", () => {
    const result = groupFiles(dummyFiles, "flat", "Ungrouped");
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe("flat");
    expect(result[0].files).toEqual(dummyFiles);
  });

  it("groups by topic with correct precedence and sorts alphabetically, Ungrouped last", () => {
    const result = groupFiles(dummyFiles, "topic", "Nicht gruppiert");
    // Precedences:
    // File 1: topic "B-Topic"
    // File 2: planTitle "A-Plan" (no topic) -> group "A-Plan"
    // File 3: folderPath "C-Folder" (no topic/planTitle) -> group "C-Folder"
    // File 4: ungrouped -> group "Nicht gruppiert"
    // File 5: ungrouped -> group "Nicht gruppiert"
    // Sorted alphabetically: A-Plan, B-Topic, C-Folder, Nicht gruppiert last.
    expect(result).toHaveLength(4);
    expect(result[0].label).toBe("A-Plan");
    expect(result[0].files).toEqual([dummyFiles[1]]);
    expect(result[1].label).toBe("B-Topic");
    expect(result[1].files).toEqual([dummyFiles[0]]);
    expect(result[2].label).toBe("C-Folder");
    expect(result[2].files).toEqual([dummyFiles[2]]);
    expect(result[3].key).toBe("ungrouped");
    expect(result[3].label).toBe("Nicht gruppiert");
    expect(result[3].files).toEqual([dummyFiles[3], dummyFiles[4]]);
  });

  it("groups by courseTitle, Ungrouped last, sorted alphabetically", () => {
    const result = groupFiles(dummyFiles, "course", "Ungrouped");
    // File 1: Maths
    // File 2: Physics
    // File 3: Maths
    // File 4: Chemistry
    // File 5: Ungrouped
    // Sorted alphabetically: Chemistry, Maths, Physics, Ungrouped last.
    expect(result).toHaveLength(4);
    expect(result[0].label).toBe("Chemistry");
    expect(result[0].files).toEqual([dummyFiles[3]]);
    expect(result[1].label).toBe("Maths");
    expect(result[1].files).toEqual([dummyFiles[0], dummyFiles[2]]);
    expect(result[2].label).toBe("Physics");
    expect(result[2].files).toEqual([dummyFiles[1]]);
    expect(result[3].key).toBe("ungrouped");
    expect(result[3].label).toBe("Ungrouped");
    expect(result[3].files).toEqual([dummyFiles[4]]);
  });
});
