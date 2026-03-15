"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  type ReportDoc,
  type ReportStatus,
  createReport,
  updateReportStatus,
  updateReportWithResults,
  updateReportLastOpened,
  deleteReport as deleteReportService,
  subscribeToUserReports,
} from "@/services/reportService";
import type { DiagnosisResult } from "@/types/diagnosis";

interface ReportsContextType {
  reports: ReportDoc[];
  loading: boolean;
  reportsError: { code: string; message: string } | null;
  activeReportId: string | null;
  activeReport: ReportDoc | null;
  userId: string | null;
  setActiveReportId: (id: string | null) => void;
  createNewReport: (fileName: string, fileType: string) => Promise<string | null>;
  markProcessing: (reportId: string) => Promise<void>;
  markComplete: (reportId: string, result: DiagnosisResult) => Promise<void>;
  markFailed: (reportId: string, error: string) => Promise<void>;
  openReport: (reportId: string) => void;
  removeReport: (reportId: string) => Promise<void>;
}

const ReportsContext = createContext<ReportsContextType | undefined>(undefined);

export function ReportsProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [reports, setReports] = useState<ReportDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportsError, setReportsError] = useState<{ code: string; message: string } | null>(null);
  const [activeReportId, setActiveReportId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        setUserId(null);
        setReports([]);
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      setReportsError(null);
      return;
    }
    setLoading(true);
    setReportsError(null);
    const unsub = subscribeToUserReports(
      userId,
      (docs) => {
        setReports(docs);
        setReportsError(null);
        setLoading(false);
      },
      (err) => {
        setReportsError({ code: err.code, message: err.message });
        setReports([]);
        setLoading(false);
      }
    );
    return unsub;
  }, [userId]);

  const activeReport =
    reports.find((r) => r.reportId === activeReportId) ?? null;

  const createNewReport = useCallback(
    async (fileName: string, fileType: string): Promise<string | null> => {
      if (!userId) return null;
      try {
        const id = await createReport(userId, fileName, fileType);
        setActiveReportId(id);
        return id;
      } catch (err) {
        console.error("[Reports] Create failed:", err);
        return null;
      }
    },
    [userId]
  );

  const markProcessing = useCallback(async (reportId: string) => {
    try {
      await updateReportStatus(reportId, "processing" as ReportStatus);
    } catch (err) {
      console.error("[Reports] markProcessing:", err);
    }
  }, []);

  const markComplete = useCallback(
    async (reportId: string, result: DiagnosisResult) => {
      try {
        await updateReportWithResults(reportId, result);
      } catch (err) {
        console.error("[Reports] markComplete:", err);
      }
    },
    []
  );

  const markFailed = useCallback(async (reportId: string, error: string) => {
    try {
      await updateReportStatus(reportId, "failed" as ReportStatus, error);
    } catch (err) {
      console.error("[Reports] markFailed:", err);
    }
  }, []);

  const openReport = useCallback(
    (reportId: string) => {
      setActiveReportId(reportId);
      if (userId) updateReportLastOpened(reportId).catch(() => {});
    },
    [userId]
  );

  const removeReport = useCallback(
    async (reportId: string) => {
      try {
        await deleteReportService(reportId);
        if (activeReportId === reportId) setActiveReportId(null);
      } catch (err) {
        console.error("[Reports] Delete failed:", err);
      }
    },
    [activeReportId]
  );

  const value = React.useMemo(
    () => ({
      reports,
      loading,
      reportsError,
      activeReportId,
      activeReport,
      userId,
      setActiveReportId,
      createNewReport,
      markProcessing,
      markComplete,
      markFailed,
      openReport,
      removeReport,
    }),
    [
      reports,
      loading,
      reportsError,
      activeReportId,
      activeReport,
      userId,
      createNewReport,
      markProcessing,
      markComplete,
      markFailed,
      openReport,
      removeReport,
    ]
  );

  return (
    <ReportsContext.Provider value={value}>{children}</ReportsContext.Provider>
  );
}

export function useReports() {
  const ctx = useContext(ReportsContext);
  if (!ctx) throw new Error("useReports must be used within ReportsProvider");
  return ctx;
}
