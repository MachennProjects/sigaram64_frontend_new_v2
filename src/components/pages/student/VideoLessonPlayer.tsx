import React from "react";
import { useSearchParams } from "react-router-dom";
import VideoLessonsTab from "./lessons/VideoLessonsTab";
import InteractiveLearnTab from "./lessons/InteractiveLearnTab";

type Tab = "interactive" | "video";

export default function VideoLessonPlayer() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get("tab") as Tab) || "interactive";

  // Derive deep view state directly from URL query parameters to avoid desync
  const isDeepView = activeTab === "interactive"
    ? !!searchParams.get("category")
    : !!searchParams.get("videoId");

  const handleTabChange = (tab: Tab) => {
    // Switch tab and clear sub-selections
    setSearchParams({ tab });
  };

  return (
    <div className="bg-dark-bg min-h-screen flex flex-col font-sans">
      {/* ── Header ── */}
      {!isDeepView && (
        <div className="px-4 sm:px-6 pt-6 sm:pt-8 pb-4 sm:pb-6 border-b border-divider sticky top-0 bg-dark-bg/90 backdrop-blur z-20">
          
          {/* Tab Navigation */}
          <div className="flex items-center gap-4 border-b border-divider pb-[-1px]">
            <button
              onClick={() => handleTabChange("interactive")}
              className={`pb-3 px-2 text-sm font-bold border-b-2 transition-all ${
                activeTab === "interactive"
                  ? "border-gold text-gold"
                  : "border-transparent text-gray-400 hover:text-white"
              }`}
            >
              Interactive Learn
            </button>
            <button
              onClick={() => handleTabChange("video")}
              className={`pb-3 px-2 text-sm font-bold border-b-2 transition-all ${
                activeTab === "video"
                  ? "border-gold text-gold"
                  : "border-transparent text-gray-400 hover:text-white"
              }`}
            >
              Video Lessons
            </button>
          </div>
        </div>
      )}

      {/* ── Content Area ── */}
      <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
        {activeTab === "interactive" ? (
          <InteractiveLearnTab />
        ) : (
          <VideoLessonsTab />
        )}
      </div>
    </div>
  );
}
