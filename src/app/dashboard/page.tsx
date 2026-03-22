"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import UploadZone from "@/features/diagnosis/components/UploadZone";
import AIReport from "@/features/diagnosis/components/AIReport";
import { useSettings } from "@/context/SettingsContext";
import { useReports } from "@/context/ReportsContext";
import { useDiagnosis } from "@/features/diagnosis/context/DiagnosisContext";
import { usePatient } from "@/context/PatientContext";
import ProfileForm from "@/features/intake/ProfileForm";
import ReportIntakeForm from "@/features/intake/ReportIntakeForm";
import SettingsView from "@/features/dashboard/components/SettingsView";
import SubscriptionView from "@/features/dashboard/components/SubscriptionView";
import ChatView from "@/features/dashboard/components/ChatView";
import MyReportsView from "@/features/dashboard/components/MyReportsView";
import SupportView from "@/features/dashboard/components/SupportView";
import TermsModal from "@/features/dashboard/components/TermsModal";
import { useBilling } from "@/context/BillingContext";
import { useCredits } from "@/context/CreditsContext";
import {
  getTermsAcceptance,
  setTermsAcceptance,
  hasAcceptedCurrentTerms,
} from "@/lib/termsFirestore";
import {
  LogOut, MessageSquarePlus, CreditCard,
  Settings, LayoutDashboard, Activity, FileText, LifeBuoy, Shield,
  CheckCircle, ClipboardList, User, Upload, Zap, HeartPulse
} from "lucide-react";
import { EMPTY_ANALYSIS_INTAKE } from "@/types/intake";
import { motion, AnimatePresence, Variants } from "framer-motion";

type View = 'dashboard' | 'chat' | 'records' | 'subscription' | 'settings' | 'support';

export default function DashboardPage() {
  const router = useRouter();
  const { t, language, defaultLandingView } = useSettings();
  const { billing } = useBilling();
  const { balances, canAnalyze, deductForAnalysis } = useCredits();
  const { openReport, activeReportId, setActiveReportId } = useReports();
  const { diagnosisResult, loadSavedResult, currentReportId } = useDiagnosis();
  const {
    profileComplete,
    intakeComplete,
    canUpload,
    resetIntake,
    currentIntake,
    patchIntake,
    quickModeSelected,
    setQuickModeSelected,
    profile,
  } = usePatient();
  const [intakeMode, setIntakeMode] = useState<"quick" | "detailed" | null>(null);

  const hasIntakeData =
    !!currentIntake?.fileType ||
    !!currentIntake?.bodyRegion ||
    (!!currentIntake?.primaryConcern && currentIntake.primaryConcern.trim().length >= 3);

  useEffect(() => {
    if (profileComplete && !intakeComplete && hasIntakeData && intakeMode === null) {
      setIntakeMode("detailed");
    }
  }, [profileComplete, intakeComplete, hasIntakeData, intakeMode]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [termsCheckLoading, setTermsCheckLoading] = useState(true);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsAccepting, setTermsAccepting] = useState(false);

  const [activeView, setActiveView] = useState<View>('dashboard');
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const defaultLandingAppliedRef = useRef(false);

  useEffect(() => {
    if (defaultLandingAppliedRef.current || loading || termsCheckLoading || !termsAccepted) return;
    defaultLandingAppliedRef.current = true;
    if (defaultLandingView === "records") setActiveView("records");
    else if (defaultLandingView === "chat") setActiveView("chat");
    else setActiveView("dashboard");
  }, [loading, termsCheckLoading, termsAccepted, defaultLandingView]);

  const handleBuyCredits = () => {
    setActiveView('subscription');
  };

  const handleAcceptTerms = async () => {
    if (termsAccepting) return;
    setTermsAccepting(true);
    setTermsAccepted(true);
    try {
      if (userId) await setTermsAcceptance(userId);
    } catch (e) {
      console.error("Failed to save terms acceptance", e);
    } finally {
      setTermsAccepting(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserEmail(user.email ?? null);
        setUserId(user.uid);
        setLoading(false);
      } else {
        router.push("/login");
      }
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (loading || userEmail === null || !userId) return;
    let cancelled = false;
    setTermsCheckLoading(true);
    (async () => {
      try {
        const result = await getTermsAcceptance(userId);
        if (!cancelled) setTermsAccepted(hasAcceptedCurrentTerms(result));
      } catch {
        if (!cancelled) setTermsAccepted(false);
      } finally {
        if (!cancelled) setTermsCheckLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [loading, userEmail, userId]);

  useEffect(() => {
    if (loading || !userId) return;
    let cancelled = false;
    (async () => {
      try {
        const user = auth.currentUser;
        if (!user || cancelled) return;
        const token = await user.getIdToken(true);
        if (!token || cancelled) return;
        const res = await fetch("/api/admin/verify", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!cancelled) setIsAdmin(data.admin === true);
      } catch {
        if (!cancelled) setIsAdmin(false);
      }
    })();
    return () => { cancelled = true; };
  }, [loading, userId]);

  // When a new analysis completes on dashboard, sync the active report
  useEffect(() => {
    if (currentReportId && currentReportId !== activeReportId) {
      setActiveReportId(currentReportId);
    }
  }, [currentReportId, activeReportId, setActiveReportId]);

  useEffect(() => {
    const handler = () => {
      setIntakeMode("detailed");
      setQuickModeSelected(false);
    };
    document.addEventListener("switch-to-detailed", handler);
    return () => document.removeEventListener("switch-to-detailed", handler);
  }, []);

  const handleOpenReportFromList = useCallback((reportId: string) => {
    openReport(reportId);
    setActiveView('chat');
  }, [openReport]);

  // When opening a saved report, load its diagnosis result into DiagnosisContext
  const { activeReport } = useReports();
  useEffect(() => {
    if (activeView === 'chat' && activeReport?.diagnosisResult && !diagnosisResult) {
      loadSavedResult(activeReport.diagnosisResult);
    }
  }, [activeView, activeReport, diagnosisResult, loadSavedResult]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error", error);
    }
    router.push("/login");
  };

  const handleUploadSuccess = async () => {
    await deductForAnalysis();
  };

  const showTermsGate = !loading && !termsCheckLoading && !termsAccepted;

  if (loading || termsCheckLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0f1e" }}>
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-12 h-12 border-4 border-white/10 rounded-full animate-spin"
            style={{
              borderTopColor: "#00d4ff",
              boxShadow: "0 0 20px rgba(0,212,255,0.3)",
            }}
          />
          <p className="font-mono text-sm tracking-widest animate-pulse" style={{ color: "#7a8aa0" }}>
            {termsCheckLoading ? "Checking terms…" : t("verifying_neural_link")}
          </p>
        </div>
      </div>
    );
  }

  if (showTermsGate) {
    return (
      <TermsModal
        onAccept={handleAcceptTerms}
        onLogout={handleLogout}
        isAccepting={termsAccepting}
      />
    );
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
  };

  const SidebarItem = ({ icon: Icon, label, active = false, onClick }: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; id?: string; active?: boolean; onClick: () => void }) => (
    <button
      onClick={onClick}
      type="button"
      style={
        active
          ? {
              background: "rgba(0,212,255,0.08)",
              border: "1px solid rgba(0,212,255,0.2)",
            }
          : undefined
      }
      className={`w-full flex items-center gap-3 py-2.5 rounded-xl transition-all duration-200 group ${isSidebarExpanded ? "px-2.5" : "px-0 justify-center"} ${active ? "font-medium" : "hover:bg-white/5"}`}
    >
      <Icon size={20} className={`shrink-0 ${active ? "text-[#00d4ff]" : "text-[#7a8aa0]"}`} />
      {isSidebarExpanded && (
        <span className="whitespace-nowrap text-sm" style={{ color: active ? "#e8edf5" : "#7a8aa0" }}>
          {label}
        </span>
      )}
    </button>
  );

  return (
      <div
        className="min-h-screen text-[#e8edf5] flex font-sans overflow-hidden relative"
        style={{ background: "#0a0f1e" }}
      >
        <div
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            backgroundImage: `linear-gradient(
        rgba(0,212,255,0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(0,212,255,0.03) 
        1px, transparent 1px)`,
            backgroundSize: "50px 50px",
          }}
        />

        {/* ─── Left Sidebar ─── */}
        <motion.aside
          onHoverStart={() => setIsSidebarExpanded(true)}
          onHoverEnd={() => setIsSidebarExpanded(false)}
          style={{
            background: "rgba(10,15,30,0.95)",
            borderRight: "1px solid rgba(255,255,255,0.06)",
            backdropFilter: "blur(20px)",
          }}
          className={`fixed left-0 top-0 h-full z-50 flex flex-col justify-between py-5 transition-all duration-300 ease-out ${isSidebarExpanded ? "w-60 pl-4 pr-4 shadow-xl shadow-black/20" : "w-[72px] pl-3 pr-2 items-center"}`}
        >
          <div className="w-full flex flex-col gap-6">
            {/* Brand */}
            <div className={`flex items-center gap-3 ${isSidebarExpanded ? "px-1" : "justify-center"}`}>
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: "rgba(0,212,255,0.08)",
                  border: "1px solid rgba(0,212,255,0.2)",
                  boxShadow: "0 0 15px rgba(0,212,255,0.1)",
                }}
              >
                <img src="/logo.png" alt="RapiMed" className="w-5 h-5 object-contain" />
              </div>
              {isSidebarExpanded && (
                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-sm tracking-tight" style={{ color: "#e8edf5" }}>
                    RapiMed
                  </span>
                  <span className="text-[10px] font-mono" style={{ color: "#7a8aa0" }}>
                    Report Assistant
                  </span>
                </div>
              )}
            </div>

            {/* Navigation */}
            <nav className="flex flex-col gap-1 w-full">
              <SidebarItem 
                icon={LayoutDashboard} 
                label={t('dashboard')} 
                active={activeView === 'dashboard'} 
                onClick={() => setActiveView('dashboard')}
              />
              <SidebarItem 
                icon={MessageSquarePlus} 
                label={t('new_analysis')} 
                active={activeView === 'chat'} 
                onClick={() => setActiveView('chat')}
              />
              <SidebarItem 
                icon={FileText} 
                label={t('my_reports')} 
                active={activeView === 'records'} 
                onClick={() => setActiveView('records')}
              />
              <SidebarItem 
                icon={CreditCard} 
                label={t('subscription')} 
                active={activeView === 'subscription'} 
                onClick={() => setActiveView('subscription')}
              />
              <SidebarItem 
                icon={Settings} 
                label={t('settings')} 
                active={activeView === 'settings'} 
                onClick={() => setActiveView('settings')}
              />
              <SidebarItem 
                icon={LifeBuoy} 
                label={t('support')} 
                active={activeView === 'support'} 
                onClick={() => setActiveView('support')}
              />
              {isAdmin && (
                <Link
                  href="/admin"
                  className={`w-full flex items-center gap-3 py-2.5 rounded-xl transition-all duration-200 group hover:bg-white/5 ${isSidebarExpanded ? "px-2.5" : "px-0 justify-center"}`}
                  style={{ color: "#7a8aa0" }}
                >
                  <Shield size={20} className="shrink-0 group-hover:text-[#e8edf5]" />
                  {isSidebarExpanded && <span className="whitespace-nowrap text-sm">Admin</span>}
                </Link>
              )}
            </nav>
          </div>

          {/* Bottom: Credits & User */}
          <div className="w-full flex flex-col gap-3">
             {isSidebarExpanded && (
               <motion.div
                 initial={{ opacity: 0 }}
                 animate={{ opacity: 1 }}
                 className="p-3 rounded-xl"
                 style={{
                   background: "rgba(255,255,255,0.02)",
                   border: "1px solid rgba(255,255,255,0.07)",
                 }}
               >
                 <div className="mb-2">
                   <span className="text-[10px] font-mono uppercase block mb-1.5" style={{ color: "#7a8aa0" }}>
                     {t("credits")}
                   </span>
                   <div className="flex flex-col gap-0.5">
                     <div className="flex items-center gap-1.5 text-[10px] font-mono" style={{ color: "#7a8aa0" }}>
                       <span style={{ color: "#00d4ff" }}>{balances.reportTokens}</span> report
                     </div>
                     <div className="flex items-center gap-1.5 text-[10px] font-mono" style={{ color: "#7a8aa0" }}>
                       <span style={{ color: "#00ff88" }}>{balances.agentTokens}</span> agent
                     </div>
                     <div className="flex items-center gap-1.5 text-[10px] font-mono" style={{ color: "#7a8aa0" }}>
                       <span style={{ color: "#ffaa00" }}>{balances.supportTokens}</span> support
                     </div>
                   </div>
                 </div>
                 <button
                   type="button"
                   onClick={handleBuyCredits}
                   title={t("manage_plan")}
                   className="w-full py-2 text-xs font-semibold rounded-lg transition-all duration-200 active:scale-[0.98]"
                   style={{
                     background: "linear-gradient(135deg, #00d4ff, #0099cc)",
                     color: "#001a2e",
                   }}
                 >
                   {t("upgrade")}
                 </button>
               </motion.div>
             )}

             <div
               className={`flex items-center gap-2.5 ${isSidebarExpanded ? "px-1" : "justify-center"} pt-4 mt-4`}
               style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
             >
               <div
                 className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center overflow-hidden"
                 style={{
                   background: "rgba(0,212,255,0.12)",
                   border: "1px solid rgba(0,212,255,0.25)",
                 }}
               >
                 {profile.avatarUrl ? (
                   // eslint-disable-next-line @next/next/no-img-element
                   <img
                     src={profile.avatarUrl}
                     alt=""
                     className="w-full h-full object-cover"
                   />
                 ) : (
                   <span className="text-xs font-bold" style={{ color: "#00d4ff" }}>
                     {(profile.nickname?.[0] || userEmail?.[0] || "?").toUpperCase()}
                   </span>
                 )}
               </div>
               {isSidebarExpanded && (
                 <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: "#e8edf5" }}>
                    {profile.nickname?.trim() || userEmail?.split("@")[0] || "—"}
                  </p>
                  <p className="text-xs font-mono truncate capitalize" style={{ color: "#3d4f66" }}>
                    {billing.plan}
                  </p>
                </div>
              )}
               {isSidebarExpanded && (
                 <button
                   type="button"
                   onClick={handleLogout}
                   className="p-2 transition-colors hover:text-[#ff4466]"
                   style={{ color: "#7a8aa0" }}
                   title="Log out"
                 >
                   <LogOut size={16} />
                 </button>
               )}
             </div>
          </div>
        </motion.aside>

        {/* ─── Main Content ─── */}
        <main
          className={`flex-1 flex flex-col overflow-hidden h-screen transition-[margin] duration-300 ease-out relative z-[1] p-4 md:p-6 lg:p-8 ${isSidebarExpanded ? "ml-60" : "ml-[72px]"}`}
        >
           <AnimatePresence mode="wait">
             {activeView === 'dashboard' ? (
               <motion.div 
                 key="dashboard"
                 variants={containerVariants}
                 initial="hidden"
                 animate="visible"
                 exit={{ opacity: 0, y: -12 }}
                 transition={{ duration: 0.25 }}
                 className="h-full flex flex-col max-w-[1600px] mx-auto"
               >
                 {/* Page heading */}
                 <motion.header
                   variants={itemVariants}
                   className="shrink-0 px-0 py-4 mb-0 flex flex-col gap-4"
                   style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                 >
                   <div>
                     <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#e8edf5" }}>
                       Report center
                     </h1>
                     <p className="text-sm font-mono mt-1 max-w-xl" style={{ color: "#7a8aa0" }}>
                       Upload a scan for AI-assisted interpretation. Your data is encrypted and private.
                     </p>
                   </div>
                   <div className="flex items-center gap-3 text-sm flex-wrap">
                     <div
                       className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono"
                       style={
                         profileComplete
                           ? {
                               background: "rgba(0,255,136,0.08)",
                               border: "1px solid rgba(0,255,136,0.2)",
                               color: "#00ff88",
                             }
                           : {
                               background: "rgba(255,170,0,0.08)",
                               border: "1px solid rgba(255,170,0,0.2)",
                               color: "#ffaa00",
                             }
                       }
                     >
                       {profileComplete ? <CheckCircle size={14} /> : <User size={14} />}
                       <span className="font-medium">1. Profile</span>
                     </div>
                     <div className="w-6 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
                     <div
                       className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono"
                       style={
                         intakeComplete
                           ? {
                               background: "rgba(0,255,136,0.08)",
                               border: "1px solid rgba(0,255,136,0.2)",
                               color: "#00ff88",
                             }
                           : profileComplete
                             ? {
                                 background: "rgba(255,170,0,0.08)",
                                 border: "1px solid rgba(255,170,0,0.2)",
                                 color: "#ffaa00",
                               }
                             : {
                                 background: "rgba(255,255,255,0.03)",
                                 border: "1px solid rgba(255,255,255,0.06)",
                                 color: "#3d4f66",
                               }
                       }
                     >
                       {intakeComplete ? <CheckCircle size={14} /> : <ClipboardList size={14} />}
                       <span className="font-medium">2. Questions</span>
                     </div>
                     <div className="w-6 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
                     <div
                       className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono"
                       style={
                         canUpload
                           ? {
                               background: "rgba(0,255,136,0.08)",
                               border: "1px solid rgba(0,255,136,0.2)",
                               color: "#00ff88",
                             }
                           : {
                               background: "rgba(255,255,255,0.03)",
                               border: "1px solid rgba(255,255,255,0.06)",
                               color: "#3d4f66",
                             }
                       }
                     >
                       <Upload size={14} />
                       <span className="font-medium">3. Upload</span>
                     </div>
                     <div className="w-6 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
                     <div
                       className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono"
                       style={
                         diagnosisResult
                           ? {
                               background: "rgba(0,255,136,0.08)",
                               border: "1px solid rgba(0,255,136,0.2)",
                               color: "#00ff88",
                             }
                           : {
                               background: "rgba(255,255,255,0.03)",
                               border: "1px solid rgba(255,255,255,0.06)",
                               color: "#3d4f66",
                             }
                       }
                     >
                       <Activity size={14} />
                       <span className="font-medium">4. Results</span>
                     </div>
                   </div>
                 </motion.header>

                 <div
                   className={`flex-1 flex min-h-0 pb-24 ${diagnosisResult ? "overflow-hidden flex-row gap-4 md:gap-6 pt-3" : "overflow-y-auto flex-col"}`}
                 >
                 {/* Workflow Column — stage-owned layout: Questions own page when active */}
                 <motion.section 
                   variants={itemVariants}
                   className={`flex flex-col shrink-0 ${
                     diagnosisResult ? "w-full lg:w-[42%] lg:max-w-xl gap-4 md:gap-6 min-h-0" 
                     : intakeComplete ? "w-full max-w-2xl mx-auto gap-4" 
                     : "w-full max-w-5xl mx-auto gap-8"
                   }`}
                 >
                   {/* Gate 1: Profile completion */}
                   {!profileComplete && (
                     <div
                       className="rounded-2xl p-5 md:p-6"
                       style={{
                         background: "rgba(255,255,255,0.02)",
                         border: "1px solid rgba(255,255,255,0.07)",
                         backdropFilter: "blur(10px)",
                       }}
                     >
                       <div className="flex items-center gap-2 mb-3">
                         <User size={18} style={{ color: "#ffaa00" }} />
                         <h3 className="text-lg font-bold" style={{ color: "#e8edf5" }}>
                           {language === "tr" ? "Profil Tamamlama" : "Complete Your Profile"}
                         </h3>
                       </div>
                       <p className="text-sm mb-4" style={{ color: "#7a8aa0" }}>
                         {language === "tr"
                           ? "Yükleme yapabilmek için temel bilgilerinizi doldurun."
                           : "Fill in your basic information before uploading."}
                       </p>
                       <ProfileForm language={(language as "tr" | "en") ?? "en"} compact />
                     </div>
                   )}

                   {/* Gate 2: Intake mode selector (Quick vs Detailed) — or form when Detailed chosen */}
                   {profileComplete && (
                     <>
                       {!intakeComplete ? (
                         /* Step 2 active: show mode selector cards, optionally form below */
                         <div className="flex flex-col">
                           <div className="mb-6">
                             <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: "#e8edf5" }}>
                               <ClipboardList size={20} style={{ color: "#ffaa00" }} />
                               {language === "tr" ? "Nasıl ilerleyelim?" : "How would you like to proceed?"}
                             </h2>
                             <p className="text-sm mt-1" style={{ color: "#7a8aa0" }}>
                               {language === "tr"
                                 ? "Hızlı analiz için yükleyin veya daha kişiselleştirilmiş sonuçlar için soruları yanıtlayın."
                                 : "Upload for quick analysis, or answer questions for more personalized results."}
                             </p>
                           </div>

                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                             <button
                               type="button"
                               onClick={() => {
                                 setIntakeMode("quick");
                                 setQuickModeSelected(true);
                                 patchIntake({ ...EMPTY_ANALYSIS_INTAKE });
                               }}
                               className="flex flex-col items-start text-left p-5 rounded-xl transition-all h-full cursor-pointer hover:border-[rgba(0,212,255,0.2)]"
                               style={
                                 intakeMode === "quick"
                                   ? {
                                       background: "rgba(0,212,255,0.06)",
                                       border: "1px solid rgba(0,212,255,0.3)",
                                       boxShadow: "0 0 20px rgba(0,212,255,0.08)",
                                     }
                                   : {
                                       background: "rgba(255,255,255,0.02)",
                                       border: "1px solid rgba(255,255,255,0.07)",
                                     }
                               }
                             >
                               <span
                                 className="px-2 py-0.5 rounded text-xs font-medium mb-3"
                                 style={{
                                   background: "rgba(255,255,255,0.06)",
                                   border: "1px solid rgba(255,255,255,0.1)",
                                   color: "#7a8aa0",
                                 }}
                               >
                                 {language === "tr" ? "En Hızlı" : "Fastest"}
                               </span>
                               <div className="flex items-center gap-2 mb-2">
                                 <Zap size={20} style={{ color: "#00d4ff" }} />
                                 <h3 className="font-semibold" style={{ color: "#e8edf5" }}>
                                   {language === "tr" ? "Hızlı Analiz" : "Quick Analysis"}
                                 </h3>
                               </div>
                               <p className="text-sm mb-1" style={{ color: "#7a8aa0" }}>
                                 {language === "tr" ? "Şimdi yükleyin, ~60 saniyede sonuç alın" : "Upload now, get results in ~60 seconds"}
                               </p>
                               <p className="text-xs" style={{ color: "#3d4f66" }}>
                                 {language === "tr"
                                   ? "AI görüntünüzü genel tıbbi bilgiyle analiz eder. Kişisel bağlam yok."
                                   : "AI analyzes your image with general medical knowledge. No personal context."}
                               </p>
                             </button>

                             <button
                               type="button"
                               onClick={() => {
                                 setIntakeMode("detailed");
                                 setQuickModeSelected(false);
                               }}
                               className="flex flex-col items-start text-left p-5 rounded-xl transition-all h-full cursor-pointer hover:border-[rgba(0,212,255,0.2)]"
                               style={
                                 intakeMode === "detailed"
                                   ? {
                                       background: "rgba(0,212,255,0.06)",
                                       border: "1px solid rgba(0,212,255,0.3)",
                                       boxShadow: "0 0 20px rgba(0,212,255,0.08)",
                                     }
                                   : {
                                       background: "rgba(255,255,255,0.02)",
                                       border: "1px solid rgba(255,255,255,0.07)",
                                     }
                               }
                             >
                               <span
                                 className="px-2 py-0.5 rounded text-xs font-medium mb-3"
                                 style={{
                                   background: "rgba(0,212,255,0.12)",
                                   border: "1px solid rgba(0,212,255,0.3)",
                                   color: "#00d4ff",
                                 }}
                               >
                                 {language === "tr" ? "En Doğru" : "Most Accurate"}
                               </span>
                               <div className="flex items-center gap-2 mb-2">
                                 <ClipboardList size={20} style={{ color: "#00d4ff" }} />
                                 <h3 className="font-semibold" style={{ color: "#e8edf5" }}>
                                   {language === "tr" ? "Detaylı Rapor" : "Detailed Report"}
                                 </h3>
                               </div>
                               <p className="text-sm mb-1" style={{ color: "#7a8aa0" }}>
                                 {language === "tr" ? "~1 dakikalık form, daha kişiselleştirilmiş sonuçlar" : "~1 minute form, more personalized results"}
                               </p>
                               <p className="text-xs" style={{ color: "#3d4f66" }}>
                                 {language === "tr"
                                   ? "Semptomlarınızı ve geçmişinizi anlatın. AI bu bağlamı daha hedefli analiz için kullanır."
                                   : "Tell us about your symptoms and history. The AI uses this context for a more targeted analysis."}
                               </p>
                             </button>
                           </div>

                           {intakeMode === "detailed" && (
                             <div className="mt-4">
                               <div className="flex items-center justify-between mb-3">
                                 <h3 className="text-sm font-semibold text-theme-text-primary">
                                   {language === "tr" ? "Rapor Soruları" : "Report Questions"}
                                 </h3>
                                 <button
                                   type="button"
                                   onClick={() => setIntakeMode(null)}
                                   className="text-xs hover:underline"
                                   style={{ color: "#00d4ff" }}
                                 >
                                   {language === "tr" ? "Değiştir" : "Change"}
                                 </button>
                               </div>
                               <ReportIntakeForm language={(language as "tr" | "en") ?? "en"} compact={false} />
                               <div
                                 className="mt-6 py-3 px-4 rounded-lg flex items-center gap-2 text-sm"
                                 style={{
                                   background: "rgba(255,255,255,0.02)",
                                   border: "1px solid rgba(255,255,255,0.06)",
                                   color: "#7a8aa0",
                                 }}
                               >
                                 <Upload size={14} className="opacity-60 shrink-0" />
                                 {language === "tr" ? "Yükleme, sorular tamamlandığında açılır." : "Upload unlocks when questions are complete."}
                               </div>
                             </div>
                           )}

                         </div>
                       ) : (
                         /* Questions complete: compact summary + upload primary */
                         <>
                           <div
                             className="p-4 rounded-xl flex items-center justify-between"
                             style={{
                               background: "rgba(0,255,136,0.05)",
                               border: "1px solid rgba(0,255,136,0.15)",
                             }}
                           >
                             <div className="flex items-center gap-2">
                               <CheckCircle size={18} style={{ color: "#00ff88" }} />
                               <span className="text-sm font-medium" style={{ color: "#e8edf5" }}>
                                 {language === "tr" ? "Sorular tamamlandı" : "Questions complete"}
                               </span>
                             </div>
                             <button
                               type="button"
                               onClick={() => {
                                 resetIntake();
                                 setIntakeMode(null);
                               }}
                               className="text-xs hover:underline"
                               style={{ color: "#00d4ff" }}
                             >
                               {language === "tr" ? "Düzenle" : "Edit"}
                             </button>
                           </div>
                           <div className="w-full min-h-0">
                             <div className="w-full px-0 py-1 md:py-2">
                               <UploadZone
                                 canAnalyze={canAnalyze}
                                 onUploadSuccess={handleUploadSuccess}
                                 quickModeSelected={quickModeSelected}
                               />
                             </div>
                           </div>
                         </>
                       )}
                     </>
                   )}

                   {!diagnosisResult && (
                   <div
                     className="flex items-start gap-2 px-4 py-3 rounded-xl"
                     style={{
                       background: "rgba(0,212,255,0.03)",
                       border: "1px solid rgba(0,212,255,0.08)",
                     }}
                   >
                     <Shield size={14} className="mt-0.5 flex-shrink-0" style={{ color: "#00d4ff" }} />
                     <p className="text-xs leading-relaxed" style={{ color: "#7a8aa0" }}>
                       {language === "tr"
                         ? "Kayıtlı profiliniz ve rapor cevaplarınız yalnızca analiz kalitesini artırmak, doğru işleme yöntemini seçmek ve RapiMed içinde daha iyi açıklamalar sunmak için kullanılır. Bu bilgiler gelecek analizleriniz için saklanır ve profil/ayarlarınızdan düzenlenebilir."
                         : "Your saved profile and report answers are used only to improve analysis quality, choose the correct processing method, and provide better explanations inside RapiMed. This information is stored for your future analyses and can be edited from your profile/settings."}
                     </p>
                   </div>
                   )}
                 </motion.section>

                 {/* Right Column: Report — only when results exist */}
                 {diagnosisResult && (
                   <section className="flex-1 flex flex-col min-w-0 min-h-0">
                     <motion.div
                       variants={itemVariants}
                       initial={{ opacity: 0, x: 12 }}
                       animate={{ opacity: 1, x: 0 }}
                       className="flex-1 flex flex-col min-h-0 max-h-full rounded-2xl"
                       style={{
                         background: "rgba(255,255,255,0.02)",
                         border: "1px solid rgba(255,255,255,0.07)",
                         backdropFilter: "blur(10px)",
                       }}
                     >
                       <div className="shrink-0 pt-5 px-5 md:pt-6 md:px-6 pb-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                         <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: "#e8edf5" }}>
                           <Activity size={18} style={{ color: "#00d4ff" }} />
                           Report interpretation
                         </h2>
                         <p className="text-xs font-mono mt-1" style={{ color: "#3d4f66" }}>
                           AI-assisted analysis. Not a diagnosis — always consult a physician.
                         </p>
                       </div>
                       <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pt-4 pb-2 px-5 md:px-6">
                         <AIReport />
                       </div>
                     </motion.div>
                   </section>
                 )}
                 </div>
               </motion.div>
             ) : (
               <motion.div 
                 key={activeView}
                 initial={{ opacity: 0, scale: 0.95 }}
                 animate={{ opacity: 1, scale: 1 }}
                 exit={{ opacity: 0, scale: 1.05 }}
                 className="h-full flex flex-col max-w-5xl mx-auto"
              >
                <div
                  className="flex-1 overflow-hidden relative rounded-2xl"
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    backdropFilter: "blur(10px)",
                  }}
                >
                  {activeView === 'chat' && <ChatView onBuyCredits={() => setActiveView('subscription')} />}
                  {activeView === 'records' && <MyReportsView onOpenReport={handleOpenReportFromList} />}
                   {activeView === 'subscription' && <SubscriptionView />}
                   {activeView === 'settings' && (
                     <SettingsView onOpenSubscription={() => setActiveView('subscription')} />
                   )}
                   {activeView === 'support' && <SupportView />}
                 </div>
               </motion.div>
             )}
           </AnimatePresence>
        </main>
      </div>
  );
}
