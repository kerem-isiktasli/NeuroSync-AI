"use client";

import React, { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Activity, AlertCircle, CheckCircle, Scan, FileText, Lock } from "lucide-react";
import { useDiagnosis } from "../context/DiagnosisContext";
import { useSettings } from "../../../context/SettingsContext";
import { useCredits } from "../../../context/CreditsContext";
import { usePatient } from "@/context/PatientContext";

interface UploadZoneProps {
  canAnalyze?: boolean;
  onUploadSuccess?: () => void;
}

export default function UploadZone({ canAnalyze = true, onUploadSuccess }: UploadZoneProps) {
  const {
    analyzeFiles,
    isAnalyzing,
    error,
    diagnosisResult,
    addLog,
    resetDiagnosis,
    analysisStreamProgress,
  } = useDiagnosis();
  const { t, language } = useSettings();
  const { canUpload, profileComplete, intakeComplete } = usePatient();
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [localIsAnalyzing, setLocalIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStep, setAnalysisStep] = useState("");

  const uploadAllowed = canAnalyze && canUpload;

  useEffect(() => {
    if (diagnosisResult) {
      setFiles([]);
    }
  }, [diagnosisResult]);

  /** Drive the bar from live SSE (`/api/analyze`); local state was stuck at 5% until completion. */
  useEffect(() => {
    if (!analysisStreamProgress) return;
    setAnalysisProgress((prev) =>
      Math.max(prev, analysisStreamProgress.percent)
    );
    if (analysisStreamProgress.message) {
      setAnalysisStep(analysisStreamProgress.message);
    }
  }, [analysisStreamProgress]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (uploadAllowed) setIsDragging(true);
  }, [uploadAllowed]);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const startAnalysis = async (uploadedFiles: File[]) => {
    resetDiagnosis();
    setAnalysisProgress(0);
    setAnalysisStep("");
    setFiles(uploadedFiles);
    setUploadProgress(0);

    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 10;
      });
    }, 100);

    setTimeout(async () => {
      clearInterval(interval);
      setUploadProgress(100);
      setLocalIsAnalyzing(true);
      setAnalysisProgress(5);
      setAnalysisStep(language === "tr" ? "Görüntü gönderiliyor..." : "Sending images...");
      addLog(t('scan_received'));

      try {
        const ok = await analyzeFiles(uploadedFiles);
        if (ok) {
          setAnalysisProgress(100);
          setAnalysisStep(language === "tr" ? "Tamamlandı!" : "Complete!");
          setTimeout(() => {
            setAnalysisProgress(0);
            setAnalysisStep("");
          }, 1000);
          onUploadSuccess?.();
        } else {
          setAnalysisProgress(0);
          setAnalysisStep("");
        }
      } finally {
        setLocalIsAnalyzing(false);
        setUploadProgress(0);
      }
    }, 1200);
  };

  const processFiles = async (uploadedFiles: File[]) => {
    if (!uploadAllowed) return;
    startAnalysis(uploadedFiles);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!uploadAllowed) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  }, [uploadAllowed]);

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!uploadAllowed) return;
    if (e.target.files && e.target.files.length > 0) {
      processFiles(Array.from(e.target.files));
    }
  };

  const gateMessage = !profileComplete
    ? "Complete your medical profile first"
    : !intakeComplete
    ? "Answer all report questions first"
    : !canAnalyze
    ? t('insufficient_credits')
    : null;

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="flex justify-between items-center mb-2 w-full">
         <h3 className="text-xl font-bold text-theme-text-primary flex items-center gap-2 tracking-wide min-w-0">
           <Activity className="text-theme-accent flex-shrink-0" />
           <span className="text-theme-text-primary truncate block">
             {t('diagnostic_hub')}
           </span>
         </h3>
         <div className="flex items-center gap-2 flex-shrink-0">
           <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-theme-accent opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-theme-accent"></span>
            </span>
           <span className="text-xs font-mono text-theme-accent tracking-widest hidden sm:inline-block">
             {t('vita_3_online')}
           </span>
         </div>
      </div>

      <motion.div
        className={`
          relative rounded-2xl md:rounded-3xl overflow-hidden group transition-all duration-300
          ${isDragging ? "ring-2 ring-theme-accent ring-offset-2 ring-offset-theme-bg scale-[1.01]" : ""}
        `}
      >
        <div 
          className={`relative z-10 flex flex-col items-center justify-center text-center min-h-[220px] md:min-h-[280px] rounded-2xl md:rounded-3xl bg-theme-surface-elevated border border-theme-border transition-colors duration-200 p-6 md:p-10 ${uploadAllowed ? "hover:border-theme-accent/40" : "opacity-75"}`}
          onDragOver={uploadAllowed ? onDragOver : undefined}
          onDragLeave={uploadAllowed ? onDragLeave : undefined}
          onDrop={uploadAllowed ? onDrop : undefined}
        >
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 mix-blend-overlay"></div>
          <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_80%)]"></div>

          <AnimatePresence>
            {uploadProgress > 0 && !isAnalyzing && !localIsAnalyzing && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-theme-surface-elevated/95 backdrop-blur-md"
              >
                 <div className="w-64 space-y-4">
                    <div className="flex justify-between text-xs font-mono text-theme-accent">
                      <span>{t('uploading_scan')}</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="h-2 w-full bg-theme-surface rounded-full overflow-hidden border border-theme-border">
                       <motion.div 
                         className="h-full bg-theme-accent"
                         initial={{ width: 0 }}
                         animate={{ width: `${uploadProgress}%` }}
                         transition={{ ease: "linear" }}
                       />
                    </div>
                    <p className="text-xs text-theme-text-secondary text-center animate-pulse">
                      {t('encrypting_transmitting')}
                    </p>
                 </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {!isAnalyzing && !diagnosisResult && !error && uploadProgress === 0 && (
              <motion.div 
                key="idle"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col items-center relative z-20"
              >
                <div className="w-24 h-24 rounded-2xl bg-theme-surface flex items-center justify-center mb-8 border border-theme-border group-hover:border-theme-accent/50 transition-all duration-500 relative overflow-hidden group/icon">
                  <div className="absolute inset-0 bg-gradient-to-tr from-theme-accent/20 to-transparent opacity-0 group-hover/icon:opacity-100 transition-opacity"></div>
                  {uploadAllowed ? (
                    <Upload className="w-10 h-10 text-theme-text-muted group-hover/icon:text-theme-accent transition-colors" />
                  ) : (
                    <Lock className="w-10 h-10 text-theme-text-muted" />
                  )}
                </div>
                
                <h4 className="text-3xl font-bold text-theme-text-primary mb-3 tracking-tight">
                  {uploadAllowed ? t('upload_medical_scan') : "Upload Locked"}
                </h4>
                <div className="flex flex-col gap-y-4 items-center">
                  {uploadAllowed ? (
                    <p className="text-theme-text-secondary mb-4 max-w-sm leading-relaxed text-sm">
                      {t('drag_drop_dicom')} <br />
                      <span className="text-theme-text-muted">{t('supports_formats')}</span>
                    </p>
                  ) : (
                    <p className="text-amber-400 mb-4 max-w-sm leading-relaxed text-sm font-medium">
                      {gateMessage}
                    </p>
                  )}
                </div>

                {!canAnalyze && profileComplete && intakeComplete && (
                  <div className="flex flex-col items-center gap-2 mb-4 pointer-events-auto">
                    <p className="text-theme-warning text-sm font-medium">{t('insufficient_credits')}</p>
                  </div>
                )}
                <label className={`relative overflow-hidden font-bold px-10 py-4 rounded-xl transition-all shadow-lg group/btn ${uploadAllowed ? "cursor-pointer bg-theme-accent hover:bg-theme-accent/90 text-theme-accent-foreground hover:scale-105 active:scale-95" : "cursor-not-allowed bg-theme-surface-elevated text-theme-text-muted border border-theme-border pointer-events-none"}`}>
                  <span className="relative z-10 flex items-center gap-2 text-lg">
                    {uploadAllowed ? <Scan className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                    {uploadAllowed ? t('select_file') : "Locked"}
                  </span>
                  <input 
                    type="file" 
                    className="hidden" 
                    onChange={onFileSelect}
                    multiple
                    accept=".dcm,.png,.jpg,.jpeg,.pdf,application/pdf"
                    disabled={!uploadAllowed}
                  />
                </label>
              </motion.div>
            )}

            {(isAnalyzing || localIsAnalyzing) && (
              <motion.div 
                key="analyzing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full flex flex-col items-center relative z-20"
              >
                <div className="relative w-40 h-40 mb-8">
                   {[...Array(2)].map((_, i) => (
                     <motion.div 
                       key={i}
                       className="absolute inset-0 border border-theme-accent/30 rounded-full"
                       style={{ borderTopColor: "transparent", borderBottomColor: "transparent" }}
                       animate={{ rotate: 360 }}
                       transition={{ duration: 2 + i, repeat: Infinity, ease: "linear" }}
                     />
                   ))}
                   <div className="absolute inset-0 flex items-center justify-center">
                     <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-theme-accent/10 flex items-center justify-center border border-theme-accent/20">
                        <Activity className="w-8 h-8 md:w-10 md:h-10 text-theme-accent animate-pulse" />
                     </div>
                   </div>
                </div>
                <h4 className="text-2xl font-bold text-theme-text-primary mb-2">{t('analyzing_anatomy')}</h4>
                <div className="flex items-center gap-2 text-sm text-theme-text-muted mb-6 font-mono bg-theme-surface px-3 py-1 rounded-lg border border-theme-border max-w-[280px]">
                  <FileText className="w-3 h-3 shrink-0" />
                  <span className="truncate">
                    {files.length === 1 ? files[0]?.name : `${files.length} files`}
                  </span>
                </div>
                <div className="w-full max-w-sm space-y-2 mb-4">
                  {analysisStep && (
                    <p className="text-xs font-mono text-center animate-pulse"
                      style={{ color: "#7a8aa0" }}>
                      {analysisStep}
                    </p>
                  )}
                  <div className="flex justify-between text-xs font-mono mb-1"
                    style={{ color: "#7a8aa0" }}>
                    <span>{language === "tr" ? "Analiz" : "Analysis"}</span>
                    {analysisProgress > 0 && (
                      <span style={{ color: "#00d4ff" }}>
                        {analysisProgress}%
                      </span>
                    )}
                  </div>
                  <div className="h-2 w-full rounded-full overflow-hidden"
                    style={{ background: "rgba(255,255,255,0.08)" }}>
                    {analysisProgress > 0 ? (
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.max(5, analysisProgress)}%`,
                          background: "linear-gradient(90deg, #00d4ff, #00ff88)",
                        }} />
                    ) : (
                      <motion.div
                        className="h-full rounded-full"
                        style={{ 
                          width: "40%",
                          background: "linear-gradient(90deg, #00d4ff, #00ff88)",
                        }}
                        animate={{ x: ["0%", "150%"] }}
                        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                      />
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {diagnosisResult && (
               <motion.div 
                key="complete"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center relative z-20"
              >
                <div className="w-24 h-24 rounded-full bg-theme-success/10 flex items-center justify-center mb-6 border border-theme-success/20">
                  <CheckCircle className="w-12 h-12 text-theme-success" />
                </div>
                <h4 className="text-3xl font-bold text-theme-text-primary mb-2">{t('scan_complete')}</h4>
                <p className="text-theme-text-secondary mb-8 text-center max-w-sm">
                  {t('scan_success_message')}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    resetDiagnosis();
                    setFiles([]);
                    setAnalysisProgress(0);
                    setAnalysisStep("");
                  }}
                  className="px-6 py-3 rounded-xl text-sm font-bold flex items-center gap-2 transition-all"
                  style={{
                    background: "linear-gradient(135deg, #00d4ff, #0099cc)",
                    color: "#001a2e",
                  }}
                >
                  <Scan className="w-4 h-4" />
                  {language === "tr" ? "Yeni Analiz Başlat" : "Start New Analysis"}
                </button>
                <button 
                  onClick={() => document.getElementById("file-input-retry")?.click()}
                  className="mt-2 px-6 py-3 rounded-xl bg-theme-surface-elevated hover:bg-theme-surface border border-theme-border text-sm text-theme-text-secondary font-medium flex items-center gap-2 transition-all"
                >
                  <Upload className="w-4 h-4" />
                  {t('upload_new_scan')}
                  <input 
                    id="file-input-retry"
                    type="file" 
                    className="hidden" 
                    onChange={onFileSelect}
                    multiple
                    accept=".dcm,.png,.jpg,.jpeg,.pdf,application/pdf"
                  />
                </button>
              </motion.div>
            )}

             {error && (
               <motion.div 
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center relative z-20"
              >
                <div className="w-24 h-24 rounded-full bg-theme-danger/10 flex items-center justify-center mb-6 border border-theme-danger/20">
                  <AlertCircle className="w-12 h-12 text-theme-danger" />
                </div>
                <h4 className="text-2xl font-bold text-theme-text-primary mb-2">{t('analysis_failed')}</h4>
                <p className="text-theme-text-secondary mb-8 text-center max-w-xs">
                  {error}
                </p>
                <button 
                  onClick={() => {
                    if (files.length > 0) processFiles(files);
                    else document.getElementById("file-input-retry-err")?.click();
                  }}
                  className="bg-theme-surface-elevated hover:bg-theme-surface text-theme-text-primary px-8 py-3 rounded-xl transition-colors font-medium border border-theme-border"
                >
                  {t('retry_analysis')}
                  <input
                    id="file-input-retry-err"
                    type="file"
                    className="hidden"
                    onChange={onFileSelect}
                    multiple
                    accept=".dcm,.png,.jpg,.jpeg,.pdf,application/pdf"
                  />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
