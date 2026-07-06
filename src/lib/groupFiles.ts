export interface FileGroup<T> {
  key: string;
  label: string;
  files: T[];
}

export function groupFiles<
  T extends {
    topic?: string | null;
    planTitle?: string | null;
    folderPath?: string | null;
    courseTitle?: string | null;
  },
>(
  files: T[],
  mode: "flat" | "topic" | "course",
  ungroupedLabel: string,
): FileGroup<T>[] {
  if (mode === "flat") {
    return [
      {
        key: "flat",
        label: "",
        files,
      },
    ];
  }

  const groupsMap = new Map<string, T[]>();

  for (const file of files) {
    let groupKey = "";

    if (mode === "topic") {
      const topicLabel =
        file.topic?.trim() ||
        file.planTitle?.trim() ||
        file.folderPath?.trim();
      if (topicLabel) {
        groupKey = topicLabel;
      } else {
        groupKey = "ungrouped";
      }
    } else if (mode === "course") {
      const courseLabel = file.courseTitle?.trim();
      if (courseLabel) {
        groupKey = courseLabel;
      } else {
        groupKey = "ungrouped";
      }
    }

    if (!groupsMap.has(groupKey)) {
      groupsMap.set(groupKey, []);
    }
    groupsMap.get(groupKey)!.push(file);
  }

  const groups: FileGroup<T>[] = [];
  groupsMap.forEach((filesInGroup, key) => {
    const label = key === "ungrouped" ? ungroupedLabel : key;
    groups.push({
      key,
      label,
      files: filesInGroup,
    });
  });

  groups.sort((a, b) => {
    if (a.key === "ungrouped") return 1;
    if (b.key === "ungrouped") return -1;
    return a.label.localeCompare(b.label);
  });

  return groups;
}
