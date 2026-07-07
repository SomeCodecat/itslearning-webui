export interface TopicGroup<T> {
  topicKey: string;
  topicLabel: string;
  files: T[];
}

export interface CourseTopicGroup<T> {
  courseKey: string;
  courseLabel: string;
  fileCount: number;
  topics: TopicGroup<T>[];
}

interface GroupableFile {
  courseTitle?: string | null;
  topic?: string | null;
  planTitle?: string | null;
  folderPath?: string | null;
}

const UNGROUPED = "__ungrouped__";

function topicLabelFor(file: GroupableFile): string | null {
  return (
    file.topic?.trim() ||
    file.planTitle?.trim() ||
    file.folderPath?.trim() ||
    null
  );
}

/**
 * Build the two-level Plans hierarchy: course → topic → files. Files with no
 * course or no topic fall into an "ungrouped" bucket that always sorts last, so
 * everything remains reachable rather than silently dropped.
 */
export function groupByCourseTopic<T extends GroupableFile>(
  files: T[],
  ungroupedLabel: string,
): CourseTopicGroup<T>[] {
  // courseKey -> (topicKey -> files)
  const courses = new Map<string, Map<string, T[]>>();
  const courseLabels = new Map<string, string>();

  for (const file of files) {
    const courseLabel = file.courseTitle?.trim();
    const courseKey = courseLabel || UNGROUPED;
    courseLabels.set(courseKey, courseLabel || ungroupedLabel);

    const topicLabel = topicLabelFor(file);
    const topicKey = topicLabel || UNGROUPED;

    if (!courses.has(courseKey)) courses.set(courseKey, new Map());
    const topics = courses.get(courseKey)!;
    if (!topics.has(topicKey)) topics.set(topicKey, []);
    topics.get(topicKey)!.push(file);
  }

  const sortLabels = (a: string, b: string, aKey: string, bKey: string) => {
    if (aKey === UNGROUPED) return 1;
    if (bKey === UNGROUPED) return -1;
    return a.localeCompare(b);
  };

  const result: CourseTopicGroup<T>[] = [];
  courses.forEach((topics, courseKey) => {
    const topicGroups: TopicGroup<T>[] = [];
    topics.forEach((filesInTopic, topicKey) => {
      topicGroups.push({
        topicKey,
        topicLabel: topicKey === UNGROUPED ? ungroupedLabel : topicKey,
        files: filesInTopic,
      });
    });
    topicGroups.sort((a, b) =>
      sortLabels(a.topicLabel, b.topicLabel, a.topicKey, b.topicKey),
    );

    result.push({
      courseKey,
      courseLabel: courseLabels.get(courseKey) || ungroupedLabel,
      fileCount: topicGroups.reduce((n, g) => n + g.files.length, 0),
      topics: topicGroups,
    });
  });

  result.sort((a, b) =>
    sortLabels(a.courseLabel, b.courseLabel, a.courseKey, b.courseKey),
  );

  return result;
}
