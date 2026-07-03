// SIGARAM64 — Student Manager (REST API Integrated)
import React, { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { studentApi } from "../../../api";
import { useAuth } from "../../../context/AuthContext";
import StudentList, { Student } from "./StudentList";

export default function StudentManager() {
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const { district } = useOutletContext<{ district: string }>();

  const isSubAdmin = user?.role === "sub_admin";

  const loadStudents = async () => {
    setLoadingData(true);
    try {
      const data = await studentApi.listStudents({
        district: !isSubAdmin && district !== "All Districts" ? district : undefined,
        limit: 1000,
      });
      // Map API response to Student interface
      const mapped = data.map((s: any) => ({
        id: s.id || s._id,
        name: s.name,
        email: s.email,
        gender: s.gender,
        studentClass: s.studentClass,
        rollNo: s.rollNo,
        contact: s.contact,
        school: s.school,
        active: s.active,
        elo: s.elo ?? 1000,
        gamesPlayed: s.gamesPlayed ?? 0
      }));
      setStudents(mapped);
    } catch (err) {
      console.error("Failed to load students list:", err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    loadStudents();
  }, [district]);

  return (
    <div className="min-h-screen bg-dark-bg font-sans">
      <div className="px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">Student Manager</h1>
            <p className="text-gray-400 text-xs mt-1">
              {loadingData ? "Loading…" : `${students.length} students found`}
            </p>
          </div>
        </div>

        <StudentList
          students={students}
          loadingData={loadingData}
          onRefresh={loadStudents}
          showStats={true}
          showAddImportButtons={true}
        />
      </div>
    </div>
  );
}
