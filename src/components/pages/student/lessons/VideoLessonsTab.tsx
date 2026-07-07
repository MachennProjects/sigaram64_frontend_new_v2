import React, { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { getDriveEmbedUrl } from "../../../../data/lessons/videoLessons";
import { Badge } from "../../../ui";
import { useAuth } from "../../../../context/AuthContext";
import { lessonApi } from "../../../../api";
import videoBannerImg from "../../../../assets/Images/learnBanner/videos lessions image .png";

const LEVEL_COLOR: Record<string, string> = {
  Beginner: "text-green-400 bg-green-900/30 border-green-700/30",
  Intermediate: "text-yellow-400 bg-yellow-900/30 border-yellow-700/30",
  Advanced: "text-red-400 bg-red-900/30 border-red-700/30",
};

export default function VideoLessonsTab() {
  const { user, refreshUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [lessons, setLessons] = useState<any[]>([]);
  const [completedLessonIds, setCompletedLessonIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const activeVideoId = searchParams.get("videoId");

  // Load lessons list and user completion records on mount
  useEffect(() => {
    async function loadData() {
      try {
        const list = await lessonApi.getVideoLessons();
        setLessons(list || []);

        if (user?.id) {
          const progressList = await lessonApi.getLessonProgress(user.id);
          const completedIds = progressList
            .filter((p: any) => p.lessonType === 'video')
            .map((p: any) => p.lessonId);
          setCompletedLessonIds(completedIds);
        }
      } catch (err) {
        console.error("Failed to load video lessons:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [user?.id]);

  // Derive active lesson from search parameters to persist across refreshes
  const activeLesson = useMemo(() => {
    if (!activeVideoId || lessons.length === 0) return null;
    return lessons.find((l) => l.id === activeVideoId) || null;
  }, [activeVideoId, lessons]);

  const handleSelectLesson = (lesson: any) => {
    setSearchParams({
      tab: "video",
      videoId: lesson.id,
    });
  };

  const handleBackToLibrary = () => {
    setSearchParams({ tab: "video" });
  };

  const handleMarkAsCompleted = async (lesson: any) => {
    if (user?.id && !completedLessonIds.includes(lesson.id)) {
      try {
        const res = await lessonApi.completeLesson(lesson.id, 'video');
        if (res) {
          setCompletedLessonIds((prev) => [...prev, lesson.id]);
          await refreshUser(); // Update XP Bar globally
        }
      } catch (err) {
        console.error("Failed to complete video lesson:", err);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="text-gold font-bold">Loading video lessons...</div>
      </div>
    );
  }

  // If a lesson is selected, show the player view
  if (activeLesson) {
    return (
      <div className="flex flex-col h-full animate-fadeIn">
        <button
          onClick={handleBackToLibrary}
          className="self-start text-gray-400 hover:text-white flex items-center gap-2 mb-4 text-sm font-semibold transition-colors"
        >
          <span className="text-lg">←</span> Back to Library
        </button>

        <div className="flex-1 flex flex-col lg:flex-row gap-6 w-full">
          {/* Main Video Area */}
          <div className="w-full lg:flex-1 flex flex-col gap-4">
            <div className="w-full bg-black rounded-2xl overflow-hidden shadow-2xl relative" style={{ aspectRatio: "16/9" }}>
              <iframe
                src={getDriveEmbedUrl(activeLesson.youtubeUrl)}
                allow="autoplay; encrypted-media; fullscreen"
                allowFullScreen
                className="absolute inset-0 w-full h-full border-0"
              />
              {/* Invisible overlay cover to prevent clicking Google Drive redirect / popout button in top right corner */}
              <div 
                className="absolute top-0 right-0 w-16 h-16 z-10 bg-transparent cursor-default pointer-events-auto"
                title="Video Player Control"
              />
            </div>
            
            <div className="bg-navy-mid rounded-2xl p-6 border border-divider">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-gold text-xs font-bold tracking-wider uppercase">
                  Chapter {activeLesson.order}
                </span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${LEVEL_COLOR[activeLesson.difficulty] || LEVEL_COLOR.Intermediate}`}>
                  {activeLesson.difficulty}
                </span>
                <span className="text-gray-400 text-xs font-mono ml-auto">
                  10:00
                </span>
              </div>
              <h2 className="text-2xl font-bold text-white mb-4">{activeLesson.title}</h2>
              <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-line mb-6">
                {activeLesson.description}
              </p>

              {/* Complete Video Lesson Section */}
              <div className="border-t border-divider pt-4 flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-xs">Completing this video awards <strong className="text-gold">10 XP</strong></p>
                </div>
                {completedLessonIds.includes(activeLesson.id) ? (
                  <div className="flex items-center gap-2 text-green-400 bg-green-950/40 border border-green-500/20 px-4 py-2 rounded-xl text-sm font-bold shadow-inner">
                    <span className="text-base">✓</span> Completed
                  </div>
                ) : (
                  <button
                    onClick={() => handleMarkAsCompleted(activeLesson)}
                    className="btn-gold px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                  >
                    🎉 Mark as Completed
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Up Next Sidebar */}
          <div className="w-full lg:w-80 flex flex-col gap-4">
            <h3 className="text-white font-semibold px-1">More Lessons</h3>
            <div className="flex flex-col gap-3">
              {lessons.filter((l) => l.id !== activeLesson.id).map((lesson) => {
                const isCompleted = completedLessonIds.includes(lesson.id);

                return (
                  <button
                    key={lesson.id}
                    onClick={() => handleSelectLesson(lesson)}
                    className="flex flex-col text-left bg-navy hover:bg-navy-mid border border-divider hover:border-gold/30 rounded-xl p-4 transition-all relative group"
                  >
                    <div className="flex items-center justify-between mb-1 w-full">
                      <p className="text-gold text-[10px] font-bold">Chapter {lesson.order}</p>
                      {isCompleted && <span className="text-green-500 text-[10px] font-bold">✓ Done</span>}
                    </div>
                    <h4 className="text-white text-sm font-semibold mb-2 line-clamp-2">{lesson.title}</h4>
                    <p className="text-gray-400 text-xs line-clamp-2 mb-3">{lesson.description}</p>
                    <div className="flex items-center justify-between mt-auto w-full">
                      <span className="text-gray-500 text-xs font-mono">10:00</span>
                      <span className="text-gold text-xs font-semibold group-hover:underline">Play ▶</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Grid view
  return (
    <div className="animate-fadeIn">
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h2 className="text-white font-bold text-xl mb-1">Queen's Gambit Declined Series</h2>
          <p className="text-gray-400 text-sm">Master the Classical Mainline with these comprehensive video lessons.</p>
        </div>
        <div className="shrink-0 whitespace-nowrap">
          <Badge variant="gold">{lessons.length} Lessons</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {lessons.map((lesson) => {
          const isCompleted = completedLessonIds.includes(lesson.id);

          return (
            <button
              key={lesson.id}
              onClick={() => handleSelectLesson(lesson)}
              className="flex flex-col text-left bg-navy hover:bg-navy-mid border border-divider hover:border-gold shadow-lg hover:shadow-gold/10 rounded-2xl overflow-hidden transition-all group relative"
            >
              {/* Completed Status Checkmark */}
              {isCompleted && (
                <div className="absolute top-3 left-3 bg-green-500 text-navy font-bold rounded-full w-6 h-6 flex items-center justify-center z-10 shadow-md">
                  ✓
                </div>
              )}

              {/* Thumbnail Image */}
              <div className="h-40 bg-gradient-to-br from-navy to-black relative flex items-center justify-center border-b border-divider group-hover:border-gold/30 w-full overflow-hidden">
                <img
                  src={videoBannerImg}
                  alt={lesson.title}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                {/* Play Button Overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/10">
                  <div className="w-12 h-12 bg-gold text-navy rounded-full flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                    <span className="text-xl ml-1">▶</span>
                  </div>
                </div>
                <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] font-mono px-1.5 py-0.5 rounded z-10">
                  10:00
                </div>
              </div>
              
              <div className="p-5 flex flex-col flex-1 w-full">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-gold text-[10px] font-bold tracking-wider uppercase">
                    Chapter {lesson.order}
                  </span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${LEVEL_COLOR[lesson.difficulty] || LEVEL_COLOR.Intermediate}`}>
                    {lesson.difficulty}
                  </span>
                </div>
                <h3 className="text-white font-semibold text-sm mb-2 line-clamp-2 leading-snug group-hover:text-gold transition-colors">
                  {lesson.title}
                </h3>
                <p className="text-gray-400 text-xs line-clamp-3 mb-4">
                  {lesson.description}
                </p>
                <div className="mt-auto pt-4 border-t border-divider flex items-center justify-end">
                  <span className="text-gold text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0">
                    Watch Now →
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
