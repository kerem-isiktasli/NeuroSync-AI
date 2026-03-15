"use client";

import React, { createContext, useContext, useState, useCallback, type ReactNode } from "react";

function formatAnalysisError(raw: string, _err: unknown): string {
  if (raw.includes("404") && (raw.toLowerCase().includes("model") || raw.toLowerCase().includes("not found"))) {
    return "The AI model is currently unavailable (404). Try setting VERTEX_MODEL=gemini-2.0-flash-001 in your environment, or contact support.";
  }
  if (raw.toLowerCase().includes("permission") || raw.includes("403")) {
    return "Access to the AI service was denied. Check credentials and IAM permissions.";
  }
  if (raw.toLowerCase().includes("timeout")) {
    return "The analysis timed out. Please try again.";
  }
  return raw;
}
import { DiagnosisResult, DiagnosisState } from "@/types/diagnosis";
import { runFullDiagnosis, runFullDiagnosisBatch } from "@/services/core-bridge";
import { useReports } from "@/context/ReportsContext";

interface DiagnosisContextType extends DiagnosisState {
  setSelectedOrgan: (organ: string | null) => void;
  analyzeFile: (file: File) => Promise<void>;
  analyzeFiles: (files: File[]) => Promise<void>;
  resetDiagnosis: () => void;
  loadSavedResult: (result: DiagnosisResult) => void;
  logs: string[];
  addLog: (message: string) => void;
  downloadUrl: string | null;
  currentReportId: string | null;
}

const DiagnosisContext = createContext<DiagnosisContextType | undefined>(undefined);

export function DiagnosisProvider({ children }: { children: ReactNode }) {
  const [selectedOrgan, setSelectedOrgan] = useState<string | null>(null);
  const [diagnosisResult, setDiagnosisResult] = useState<DiagnosisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportText, setReportText] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [currentReportId, setCurrentReportId] = useState<string | null>(null);

  const { createNewReport, markProcessing, markComplete, markFailed } = useReports();

  const addLog = useCallback((message: string) => {
    setLogs((prev) => [message, ...prev]);
  }, []);

  const analyzeFile = useCallback(async (file: File) => {
    setIsAnalyzing(true);
    setError(null);
    setDiagnosisResult(null);
    setReportText(null);
    setDownloadUrl(null);

    const reportId = await createNewReport(file.name, file.type || "image/jpeg");
    setCurrentReportId(reportId);
    if (reportId) await markProcessing(reportId);

    try {
      await runFullDiagnosis(file, {
        onLog: (msg) => addLog(msg),
        onResult: (result) => {
          setDiagnosisResult(result);
          setSelectedOrgan(result.affected_organ);
          if (reportId) markComplete(reportId, result);
        },
        onReport: (text) => setReportText(text),
        onDownloadUrl: (url) => setDownloadUrl(url),
      });
    } catch (err) {
      const raw = err instanceof Error ? err.message : "An unknown error occurred during analysis.";
      const message = formatAnalysisError(raw, err);
      setError(message);
      if (reportId) markFailed(reportId, message);
      console.error("Analysis failed:", err);
    } finally {
      setIsAnalyzing(false);
    }
  }, [addLog, createNewReport, markProcessing, markComplete, markFailed]);

  const analyzeFiles = useCallback(async (files: File[]) => {
    setIsAnalyzing(true);
    setError(null);
    setDiagnosisResult(null);
    setReportText(null);
    setDownloadUrl(null);

    const primaryName = files[0]?.name ?? "Image";
    const primaryType = files[0]?.type || "image/jpeg";
    const reportId = await createNewReport(primaryName, primaryType);
    setCurrentReportId(reportId);
    if (reportId) await markProcessing(reportId);

    try {
      await runFullDiagnosisBatch(files, {
        onLog: (msg) => addLog(msg),
        onResult: (result) => {
          setDiagnosisResult(result);
          setSelectedOrgan(result.affected_organ);
          if (reportId) markComplete(reportId, result);
        },
        onReport: (text) => setReportText(text),
        onDownloadUrl: (url) => setDownloadUrl(url),
      });
    } catch (err) {
      const raw = err instanceof Error ? err.message : "An unknown error occurred during analysis.";
      const message = formatAnalysisError(raw, err);
      setError(message);
      if (reportId) markFailed(reportId, message);
      console.error("Analysis failed:", err);
    } finally {
      setIsAnalyzing(false);
    }
  }, [addLog, createNewReport, markProcessing, markComplete, markFailed]);

  const resetDiagnosis = useCallback(() => {
    setDiagnosisResult(null);
    setSelectedOrgan(null);
    setError(null);
    setLogs([]);
    setDownloadUrl(null);
    setCurrentReportId(null);
  }, []);

  const loadSavedResult = useCallback((result: DiagnosisResult) => {
    setDiagnosisResult(result);
    setSelectedOrgan(result.affected_organ);
    setError(null);
    setIsAnalyzing(false);
    setReportText(null);
    setDownloadUrl(null);
  }, []);

  const value = React.useMemo(
    () => ({
      selectedOrgan,
      diagnosisResult,
      isAnalyzing,
      error,
      setSelectedOrgan,
      analyzeFile,
      analyzeFiles,
      resetDiagnosis,
      loadSavedResult,
      reportText,
      logs,
      addLog,
      downloadUrl,
      currentReportId,
    }),
    [
      selectedOrgan,
      diagnosisResult,
      isAnalyzing,
      error,
      analyzeFile,
      analyzeFiles,
      resetDiagnosis,
      loadSavedResult,
      reportText,
      logs,
      addLog,
      downloadUrl,
      currentReportId,
    ]
  );

  return (
    <DiagnosisContext.Provider value={value}>{children}</DiagnosisContext.Provider>
  );
}

export function useDiagnosis() {
  const context = useContext(DiagnosisContext);
  if (context === undefined) {
    throw new Error("useDiagnosis must be used within a DiagnosisProvider");
  }
  return context;
}
