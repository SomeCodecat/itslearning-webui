"use client";

import React, { useState, useCallback } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { useSWRConfig } from "swr";
import { ChevronDown, ChevronRight, FileX, FolderOpen } from "lucide-react";
import { FileCard } from "./FileCard";
import { EmptyState } from "./ui/EmptyState";
import { groupByCourseTopic } from "@/lib/groupByCourseTopic";

interface TagItem {
  id: number;
  name: string;
}

interface FileItem {
  id: number;
  customName: string;
  isExamRelevant?: boolean;
  isAP1?: boolean;
  isAP2?: boolean;
  uploadedAt?: string;
  size?: string | null;
  courseTitle?: string | null;
  type?: string | null;
  webUrl?: string;
  tags?: TagItem[];
  folderPath?: string | null;
  topic?: string | null;
  planTitle?: string | null;
}

interface PlansBrowserProps {
  files: FileItem[];
  /** SWR cache key the parent revalidates against after flag/tag edits. */
  cacheKey?: string;
}

export function PlansBrowser({ files, cacheKey }: PlansBrowserProps) {
  const t = useTranslations("Plans");
  const fb = useTranslations("FileBrowser");
  const format = useFormatter();
  const { mutate } = useSWRConfig();

  // Courses start expanded (topic list visible); topics start collapsed so the
  // page reads as a browsable outline rather than a wall of files.
  const [collapsedCourses, setCollapsedCourses] = useState<
    Record<string, boolean>
  >({});
  const [expandedTopics, setExpandedTopics] = useState<Record<string, boolean>>(
    {},
  );

  const groups = React.useMemo(
    () => groupByCourseTopic(files, fb("ungrouped")),
    [files, fb],
  );

  const handleFlagsChange = useCallback(
    (
      fileId: number,
      updated: { isExamRelevant: boolean; isAP1: boolean; isAP2: boolean },
    ) => {
      if (!cacheKey) return;
      mutate(
        cacheKey,
        (current: FileItem[] | undefined) =>
          current?.map((f) => (f.id === fileId ? { ...f, ...updated } : f)),
        { revalidate: false },
      );
    },
    [cacheKey, mutate],
  );

  const handleTagsChange = useCallback(
    (fileId: number, updatedTags: TagItem[]) => {
      if (!cacheKey) return;
      mutate(
        cacheKey,
        (current: FileItem[] | undefined) =>
          current?.map((f) =>
            f.id === fileId ? { ...f, tags: updatedTags } : f,
          ),
        { revalidate: false },
      );
    },
    [cacheKey, mutate],
  );

  if (files.length === 0) {
    return <EmptyState icon={<FileX size={20} />} title={t("empty")} />;
  }

  const renderFile = (file: FileItem) => (
    <FileCard
      key={file.id}
      id={file.id}
      fileName={file.customName || fb("unnamedFile")}
      webUrl={file.webUrl || "#"}
      isExamRelevant={file.isExamRelevant}
      isAP1={file.isAP1}
      isAP2={file.isAP2}
      fileSize={
        file.size != null && !isNaN(Number(file.size))
          ? String(file.size)
          : undefined
      }
      courseTitle={file.courseTitle ?? undefined}
      fileType={file.type ?? undefined}
      date={
        file.uploadedAt
          ? format.dateTime(new Date(file.uploadedAt), { dateStyle: "medium" })
          : undefined
      }
      tags={file.tags ?? []}
      persistable
      onFlagsChange={(updated) => handleFlagsChange(file.id, updated)}
      onTagsChange={(updatedTags) => handleTagsChange(file.id, updatedTags)}
    />
  );

  return (
    <div className="space-y-4">
      {groups.map((course) => {
        const courseCollapsed = !!collapsedCourses[course.courseKey];
        const courseContentId = `plans-course-${course.courseKey}`;
        return (
          <section key={course.courseKey} className="space-y-2">
            <button
              type="button"
              onClick={() =>
                setCollapsedCourses((prev) => ({
                  ...prev,
                  [course.courseKey]: !prev[course.courseKey],
                }))
              }
              aria-expanded={!courseCollapsed}
              aria-controls={courseContentId}
              className="flex w-full items-center justify-between gap-3 rounded-card border border-line bg-card px-4 py-3 text-left transition-colors hover:border-line-strong"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <FolderOpen className="h-4 w-4 flex-none text-accent-text" />
                <span className="truncate text-sm font-semibold text-text-primary">
                  {course.courseLabel}
                </span>
                <span className="rounded-full bg-elevated px-2 py-0.5 font-mono text-xs font-semibold text-text-tertiary">
                  {course.fileCount}
                </span>
              </span>
              {courseCollapsed ? (
                <ChevronRight className="h-4 w-4 flex-none text-text-tertiary" />
              ) : (
                <ChevronDown className="h-4 w-4 flex-none text-text-tertiary" />
              )}
            </button>

            {!courseCollapsed && (
              <div id={courseContentId} className="space-y-2 pl-2">
                {course.topics.map((topic) => {
                  const topicId = `${course.courseKey}:${topic.topicKey}`;
                  const topicOpen = !!expandedTopics[topicId];
                  const topicContentId = `plans-topic-${topicId}`;
                  return (
                    <div
                      key={topic.topicKey}
                      className="border-l border-line pl-2"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedTopics((prev) => ({
                            ...prev,
                            [topicId]: !prev[topicId],
                          }))
                        }
                        aria-expanded={topicOpen}
                        aria-controls={topicContentId}
                        className="flex w-full items-center justify-between gap-2 rounded-control px-3 py-2 text-left text-sm text-text-secondary transition-colors hover:bg-elevated"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          {topicOpen ? (
                            <ChevronDown className="h-3.5 w-3.5 flex-none text-text-tertiary" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 flex-none text-text-tertiary" />
                          )}
                          <span className="truncate font-medium">
                            {topic.topicLabel}
                          </span>
                        </span>
                        <span className="rounded-full bg-elevated px-2 py-0.5 font-mono text-xs font-semibold text-text-tertiary">
                          {topic.files.length}
                        </span>
                      </button>

                      {topicOpen && (
                        <div
                          id={topicContentId}
                          className="mt-2 flex flex-col gap-3 pl-2"
                        >
                          {topic.files.map(renderFile)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
