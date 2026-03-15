"use client";

import React, { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Activity, AlertCircle, CheckCircle, Scan, FileText } from "lucide-react";
import { useDiagnosis } from "../context/DiagnosisContext";
import { useSettings } from "../../../context/SettingsContext";

interface UploadZoneProps {
  canAnalyze?: boolean;
  onUploadSuccess?: () => void;
}

export default function UploadZone({ canAnalyze = true, onUploadSuccess }: UploadZoneProps) {
  const { analyzeFiles, isAnalyzing, error, diagnosisResult, addLog, resetDiagnosis } = useDiagnosis();
  const { t } = useSettings();
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [localIsAnalyzing, setLocalIsAnalyzing] = useState(false);

  // Secure Cleanup: Remove file from memory when analysis is done/result is shown
  useEffect(() => {
    if (diagnosisResult) {
      setFiles([]);
    }
  }, [diagnosisResult]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const processFiles = async (uploadedFiles: File[]) => {
    if (!canAnalyze) return;
    // Immediate Reset of previous state and results
    resetDiagnosis();
    
    setFiles(uploadedFiles);
    setUploadProgress(0);
    
    // Simulate upload progress
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 10;
      });
    }, 100);

    // Wait for progress to finish before analyzing
    setTimeout(async () => {
      clearInterval(interval);
      setUploadProgress(100);
      console.log("File Uploaded");
      setLocalIsAnalyzing(true);
      addLog(t('scan_received'));
      
      await analyzeFiles(uploadedFiles);

      setLocalIsAnalyzing(false);
      setUploadProgress(0); // Reset after analysis starts
      if (onUploadSuccess) onUploadSuccess();
    }, 1200);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!canAnalyze) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  }, [canAnalyze]);

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canAnalyze) return;
    if (e.target.files && e.target.files.length > 0) {
      processFiles(Array.from(e.target.files));
    }
  };

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
          className={`relative z-10 flex flex-col items-center justify-center text-center min-h-[220px] md:min-h-[280px] rounded-2xl md:rounded-3xl bg-theme-surface-elevated border border-theme-border transition-colors duration-200 p-6 md:p-10 ${canAnalyze ? "hover:border-theme-accent/40" : "opacity-75 pointer-events-none"}`}
          onDragOver={canAnalyze ? onDragOver : undefined}
          onDragLeave={canAnalyze ? onDragLeave : undefined}
          onDrop={canAnalyze ? onDrop : undefined}
        >
          {/* Background Grid */}
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 mix-blend-overlay"></div>
          <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_80%)]"></div>

          {/* Upload Progress Bar */}
          <AnimatePresence>
            {uploadProgress > 0 && (
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
                  <Upload className="w-10 h-10 text-theme-text-muted group-hover/icon:text-theme-accent transition-colors" />
                </div>
                
                <h4 className="text-3xl font-bold text-theme-text-primary mb-3 tracking-tight">
                  {t('upload_medical_scan')}
                </h4>
                <div className="flex flex-col gap-y-4 items-center">
                  <p className="text-theme-text-secondary mb-4 max-w-sm leading-relaxed text-sm">
                    {t('drag_drop_dicom')} <br />
                    <span className="text-theme-text-muted">{t('supports_formats')}</span>
                  </p>
                </div>

                {!canAnalyze && (
                  <p className="text-theme-warning text-sm font-medium mb-4">{t('insufficient_credits')}</p>
                )}
                <label className={`relative overflow-hidden font-bold px-10 py-4 rounded-xl transition-all shadow-lg group/btn ${canAnalyze ? "cursor-pointer bg-theme-accent hover:bg-theme-accent/90 text-theme-accent-foreground hover:scale-105 active:scale-95" : "cursor-not-allowed bg-theme-surface-elevated text-theme-text-muted border border-theme-border"}`}>
                  <span className="relative z-10 flex items-center gap-2 text-lg">
                    <Scan className="w-5 h-5" />
                    {t('select_file')}
                  </span>
                  <input 
                    type="file" 
                    className="hidden" 
                    onChange={onFileSelect}
                    multiple
                    accept=".dcm,.png,.jpg,.jpeg,.pdf"
                    disabled={!canAnalyze}
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
                   {/* Complex Spinning Rings */}
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
                <div className="flex items-center gap-2 text-sm text-theme-text-muted mb-8 font-mono bg-theme-surface px-3 py-1 rounded-lg border border-theme-border">
                  <FileText className="w-3 h-3" />
                  {files.length === 1 ? files[0]?.name : `${files.length} dosya`}
                </div>
                
                {/* Advanced Progress Bar */}
                <div className="w-full max-w-sm h-1.5 bg-theme-surface rounded-full overflow-hidden relative mb-4">
                  <motion.div 
                    className="absolute inset-0 bg-theme-accent w-1/2 rounded-full"
                    animate={{ x: ["0%", "200%"] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                  />
                </div>
                <div className="flex justify-between w-full max-w-sm text-[10px] uppercase tracking-widest text-theme-text-muted font-bold">
                  <span>{t('preprocessing')}</span>
                  <span className="animate-pulse text-theme-accent">{t('ai_inference')}</span>
                  <span>{t('rendering')}</span>
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
                  onClick={() => document.getElementById("file-input-retry")?.click()}
                  className="px-6 py-3 rounded-xl bg-theme-surface-elevated hover:bg-theme-surface border border-theme-border text-sm text-theme-text-secondary font-medium flex items-center gap-2 transition-all"
                >
                  <Upload className="w-4 h-4" />
                  {t('upload_new_scan')}
                  <input 
                    id="file-input-retry"
                    type="file" 
                    className="hidden" 
                    onChange={onFileSelect}
                    multiple
                    accept=".dcm,.png,.jpg,.jpeg,.pdf"
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
                    else document.getElementById("file-input-retry")?.click();
                  }}
                  className="bg-theme-surface-elevated hover:bg-theme-surface text-theme-text-primary px-8 py-3 rounded-xl transition-colors font-medium border border-theme-border"
                >
                  {t('retry_analysis')}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
