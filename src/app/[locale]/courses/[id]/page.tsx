"use client";

import { useTranslations } from "next-intl";
import useSWR from "swr";
import { Navigation } from "@/components/Navigation";
import { Loader2 } from "lucide-react";
import { use, useState, useEffect } from "react";
import dynamic from "next/dynamic";

const FileBrowser = dynamic(
  () => import("@/components/FileBrowser").then((mod) => mod.FileBrowser),
  {
    loading: () => (
      <div className="flex justify-center py-10">
        <Loader2 className="animate-spin w-8 h-8 text-blue-500" />
      </div>
    ),
    ssr: false,
  },
);

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function CoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params); // Unwrap params in Client Component
  const {
    data: resources,
    error,
    isLoading,
  } = useSWR(`/api/courses/${id}/resources`, fetcher);

  // Transform resources into FileBrowser props
  // Phase 1 Scraper returns: { ElementId, Title, ElementType, IconUrl, ContentUrl }
  // FileBrowser expects: { id, customName, webUrl, isExamRelevant... }

  const files = Array.isArray(resources)
    ? resources.map((r: any) => ({
        id: r.ElementId,
        customName: r.Title,
        type: r.ElementType === "Folder" ? "folder" : "file",
        webUrl: r.ContentUrl || "#",
        isExamRelevant: false, // Default for now
        isAP1: false,
        isAP2: false,
        uploadedAt: undefined,
      }))
    : [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        <header className="mb-4">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Course Resources
          </h1>
          <Navigation />
        </header>

        {isLoading && <div className="text-gray-500">Loading resources...</div>}
        {error && <div className="text-red-500">Failed to load resources.</div>}

        {files.length > 0 && <FileBrowser files={files} />}
        {!isLoading && files.length === 0 && (
          <p className="text-gray-500">No resources found.</p>
        )}
      </div>
    </div>
  );
}
