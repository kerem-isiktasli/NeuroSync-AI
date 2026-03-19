"use client";

import React, { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { validateDicomBatch } from "@/lib/dicom";
import { classifyUploadBatch, type UploadBatchType } from "@/lib/uploadClassifier";
import { computeRoutingDecision, inspectFiles } from "@/lib/intakeRouter";
import { usePatient } from "@/context/PatientContext";
import { useSettings } from "@/context/SettingsContext";
import { useReports } from "@/context/ReportsContext";
import {
  runFullDiagnosis,
  runFullDiagnosisBatch,
  runFullDiagnosisDicomBatch,
} from "@/services/core-bridge";
import type { RoutingDecision, AnalysisIntake, PatientProfile } from "@/types/intake";
import type { DiagnosisResult, DiagnosisState } from "@/types/diagnosis";

function buildExpandedRoutingContext(
  routingDecision: RoutingDecision,
  intake: AnalysisIntake,
  patientProfile: PatientProfile
): Record<string, unknown> {
  return {
    ...routingDecision,
    primaryConcern: intake.primaryConcern ?? "",
    bodyRegion: intake.bodyRegion ?? "",
    symptomDuration: intake.symptomDuration ?? "",
    symptomTrend: intake.symptomTrend ?? "",
    studyTimeline: intake.studyTimeline ?? "",
    hasWrittenReport: intake.hasWrittenReport === "yes",
    desiredOutput: Array.isArray(intake.desiredOutput) ? intake.desiredOutput.join(", ") : (intake.desiredOutput ?? ""),
    doctorReviewed: intake.doctorReviewed === "yes",
    doctorReviewSummary: intake.doctorReviewSummary ?? "",
    knownDiagnoses: patientProfile.knownDiagnoses ?? [],
    chronicConditions: patientProfile.chronicConditions ?? [],
    reportStyle: routingDecision.reportStyle ?? "full",
    safetyLevel: routingDecision.safetyLevel ?? "standard",
  };
}

function formatAnalysisError(raw: string, err: unknown): string {
  if (raw.includes("404") && (raw.toLowerCase().includes("model") || raw.toLowerCase().includes("not found"))) {
    return "The AI model is currently unavailable (404). Try setting VERTEX_MODEL=gemini-2.5-flash in your environment, or contact support.";
  }
  if (raw.toLowerCase().includes("permission") || raw.includes("403")) {
    return "Access to the AI service was denied. Check credentials and IAM permissions.";
  }
  if (raw.toLowerCase().includes("timeout")) {
    return "The analysis timed out. Please try again.";
  }
  if (raw.toLowerCase().includes("413") || raw.toLowerCase().includes("payload too large") || raw.toLowerCase().includes("body exceeded")) {
    return "Study size too large. Try fewer files or a smaller study.";
  }
  if (err instanceof Error && (err.name === "AbortError" || err.message?.toLowerCase().includes("aborted"))) {
    return "Upload was interrupted. Please try again.";
  }
  if (raw.toLowerCase().includes("failed to fetch") || raw.toLowerCase().includes("network error")) {
    return "Network error. Check your connection and try again.";
  }
  return raw;
}

interface DiagnosisContextType extends DiagnosisState {
  setSelectedOrgan: (organ: string | null) => void;
  analyzeFile: (file: File) => Promise<void>;
  analyzeFiles: (files: File[], reportFile?: File | null) => Promise<void>;
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
  const { profile, currentIntake, saveCurrentIntake } = usePatient();
  const { language } = useSettings();

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
      const fileInspection = inspectFiles([file]);
      const routingDecision = computeRoutingDecision({
        profile,
        intake: currentIntake,
        fileInspection,
      });
      const expandedContext = buildExpandedRoutingContext(routingDecision, currentIntake, profile);
      await runFullDiagnosis(file, {
        onLog: (msg) => addLog(msg),
        onResult: (result) => {
          setDiagnosisResult(result);
          setSelectedOrgan(result.affected_organ);
          if (reportId) markComplete(reportId, result);
        },
        onReport: (text) => setReportText(text),
        onDownloadUrl: (url) => setDownloadUrl(url),
      }, { language: language === "en" ? "en" : "tr", routingContext: JSON.stringify(expandedContext) });
    } catch (err) {
      const raw = err instanceof Error ? err.message : "An unknown error occurred during analysis.";
      const message = formatAnalysisError(raw, err);
      setError(message);
      if (reportId) markFailed(reportId, message);
      console.error("Analysis failed:", err);
    } finally {
      setIsAnalyzing(false);
    }
  }, [addLog, createNewReport, markProcessing, markComplete, markFailed, profile, currentIntake, language]);

  const analyzeFiles = useCallback(async (files: File[], reportFile?: File | null) => {
    setIsAnalyzing(true);
    setError(null);
    setDiagnosisResult(null);
    setReportText(null);
    setDownloadUrl(null);

    // ── Intake-aware routing ──
    const fileInspection = inspectFiles(files);
    const routingDecision: RoutingDecision = computeRoutingDecision({
      profile,
      intake: currentIntake,
      fileInspection,
    });

    // Legacy classifier still used for DICOM detection (battle-tested)
    const classified: UploadBatchType = classifyUploadBatch(files);

    // Log the routing decision
    if (process.env.NODE_ENV !== "production") {
      console.log("[Upload] Intake-aware routing:", {
        pipeline: routingDecision.pipeline,
        domain: routingDecision.domain,
        confidence: routingDecision.confidenceLevel,
        bodyRegionSource: routingDecision.bodyRegionSource,
        reportStyle: routingDecision.reportStyle,
        safetyLevel: routingDecision.safetyLevel,
        reasons: routingDecision.reasons,
        conflicts: routingDecision.conflicts,
        legacyClassified: classified,
      });
    }

    // Use routing decision to determine the actual pipeline
    const useDicom = classified === "dicom-study" || routingDecision.pipeline === "dicom-study";

    const primaryName = files[0]?.name ?? "Image";
    const primaryType = files[0]?.type || "image/jpeg";
    const reportId = await createNewReport(primaryName, primaryType);
    setCurrentReportId(reportId);
    if (reportId) {
      await markProcessing(reportId);
      await saveCurrentIntake(reportId);
    }

    addLog(
      routingDecision.confidenceLevel === "high"
        ? `Routing: ${routingDecision.pipeline} (${routingDecision.domain}) — high confidence`
        : `Routing: ${routingDecision.pipeline} (${routingDecision.domain}) — ${routingDecision.confidenceLevel} confidence`
    );

    const callbacks = {
      onLog: (msg: string) => addLog(msg),
      onResult: (result: DiagnosisResult) => {
        setDiagnosisResult(result);
        setSelectedOrgan(result.affected_organ);
        if (reportId) markComplete(reportId, result);
      },
      onReport: (text: string) => setReportText(text),
      onDownloadUrl: (url: string) => setDownloadUrl(url),
    };

    const expandedContext = buildExpandedRoutingContext(routingDecision, currentIntake, profile);

    try {
      if (useDicom) {
        await validateDicomBatch(files);
        await runFullDiagnosisDicomBatch(files, callbacks, {
          language: language === "en" ? "en" : "tr",
        });
      } else {
        await runFullDiagnosisBatch(files, callbacks, expandedContext, {
          language: language === "en" ? "en" : "tr",
          reportFile: reportFile ?? undefined,
        });
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : "An unknown error occurred during analysis.";
      const message = formatAnalysisError(raw, err);
      setError(message);
      if (reportId) markFailed(reportId, message);
      console.error("Analysis failed:", err);
    } finally {
      setIsAnalyzing(false);
    }
  }, [addLog, createNewReport, markProcessing, markComplete, markFailed, profile, currentIntake, saveCurrentIntake, language]);

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
