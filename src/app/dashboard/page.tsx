"use client";

import React, { useEffect, useState, useCallback } from "react";
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
  CheckCircle, ClipboardList, User, Upload
} from "lucide-react";
import { motion, AnimatePresence, Variants } from "framer-motion";

type View = 'dashboard' | 'chat' | 'records' | 'subscription' | 'settings' | 'support';

export default function DashboardPage() {
  const router = useRouter();
  const { t } = useSettings();
  const { billing } = useBilling();
  const { credits, canAnalyze, deductForAnalysis } = useCredits();
  const { openReport, activeReportId, setActiveReportId } = useReports();
  const { diagnosisResult, loadSavedResult, currentReportId } = useDiagnosis();
  const { profileComplete, intakeComplete, canUpload, resetIntake } = usePatient();
  const { language } = useSettings();
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [termsCheckLoading, setTermsCheckLoading] = useState(true);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsAccepting, setTermsAccepting] = useState(false);

  const [activeView, setActiveView] = useState<View>('dashboard');
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

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

  const handleUploadSuccess = () => {
    deductForAnalysis();
  };

  const showTermsGate = !loading && !termsCheckLoading && !termsAccepted;

  if (loading || termsCheckLoading) {
    return (
      <div className="min-h-screen bg-theme-surface flex items-center justify-center transition-colors">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-theme-accent/30 border-t-theme-accent rounded-full animate-spin" />
          <p className="text-theme-text-secondary font-mono text-sm tracking-widest animate-pulse">
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
      className={`w-full flex items-center gap-3 py-2.5 rounded-xl transition-all duration-200 group ${isSidebarExpanded ? 'px-3' : 'px-0 justify-center'} ${active ? 'bg-theme-accent/10 text-theme-text-primary font-medium' : 'text-theme-text-secondary hover:bg-theme-surface hover:text-theme-text-primary'}`}
    >
      <Icon size={20} className={`shrink-0 ${active ? "text-theme-accent" : "text-theme-text-muted group-hover:text-theme-text-primary"}`} />
      {isSidebarExpanded && <span className="whitespace-nowrap text-sm">{label}</span>}
    </button>
  );

  return (
      <div className="min-h-screen bg-theme-bg text-theme-text-primary flex font-sans selection:bg-theme-accent/30 overflow-hidden relative transition-colors duration-300">
        {/* Noise Texture */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 mix-blend-overlay pointer-events-none"></div>

        {/* ─── Left Sidebar ─── */}
        <motion.aside 
          onHoverStart={() => setIsSidebarExpanded(true)}
          onHoverEnd={() => setIsSidebarExpanded(false)}
          className={`fixed left-0 top-0 h-full z-50 bg-theme-bg border-r border-theme-border flex flex-col justify-between py-5 transition-all duration-300 ease-out ${isSidebarExpanded ? "w-60 pl-4 pr-4 shadow-xl shadow-black/5" : "w-[72px] pl-3 pr-2 items-center"}`}
        >
          <div className="w-full flex flex-col gap-6">
            {/* Brand */}
            <div className={`flex items-center gap-3 ${isSidebarExpanded ? "px-1" : "justify-center"}`}>
              <div className="w-9 h-9 rounded-xl bg-theme-accent/10 border border-theme-accent/20 flex items-center justify-center shrink-0">
                <Activity size={18} className="text-theme-accent" />
              </div>
              {isSidebarExpanded && (
                <div className="flex flex-col min-w-0">
                  <span className="font-semibold text-sm text-theme-text-primary tracking-tight">RapiMed</span>
                  <span className="text-caption">Report Assistant</span>
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
                  className={`w-full flex items-center gap-3 py-2.5 rounded-xl transition-all duration-200 group text-theme-text-muted hover:bg-theme-surface hover:text-theme-text-primary ${isSidebarExpanded ? 'px-3' : 'px-0 justify-center'}`}
                >
                  <Shield size={20} className="shrink-0 text-theme-text-muted group-hover:text-theme-text-primary" />
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
                 className="p-3 rounded-xl bg-theme-surface border border-theme-border"
               >
                 <div className="flex items-center justify-between gap-2 mb-2">
                   <span className="text-caption">{t('credits')}</span>
                   <span className="text-sm font-semibold text-theme-text-primary tabular-nums">{credits}</span>
                 </div>
                 <button
                   type="button"
                   onClick={handleBuyCredits}
                   title={t('manage_plan')}
                   className="w-full py-2 bg-theme-accent hover:bg-theme-accent/90 text-theme-accent-foreground text-xs font-semibold rounded-lg transition-all duration-200 active:scale-[0.98]"
                 >
                   {t('upgrade')}
                 </button>
               </motion.div>
             )}

             <div className={`flex items-center gap-2.5 ${isSidebarExpanded ? "px-1" : "justify-center"} pt-3 border-t border-theme-border`}>
               <div className="w-8 h-8 rounded-full bg-theme-accent/20 border border-theme-accent/30 shrink-0 flex items-center justify-center">
                 <span className="text-xs font-bold text-theme-accent">{userEmail?.slice(0, 1).toUpperCase()}</span>
               </div>
               {isSidebarExpanded && (
                 <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate text-theme-text-primary">{userEmail?.split('@')[0]}</p>
                  <p className="text-caption truncate capitalize">{billing.plan}</p>
                </div>
              )}
               {isSidebarExpanded && (
                 <button type="button" onClick={handleLogout} className="p-1.5 rounded-lg text-theme-text-muted hover:text-theme-danger hover:bg-theme-surface transition-colors" title="Log out">
                   <LogOut size={16} />
                 </button>
               )}
             </div>
          </div>
        </motion.aside>

        {/* ─── Main Content ─── */}
        <main className={`flex-1 p-4 md:p-6 lg:p-8 h-screen overflow-hidden transition-[margin] duration-300 ease-out ${isSidebarExpanded ? 'ml-60' : 'ml-[72px]'}`}>
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
                 <motion.header variants={itemVariants} className="mb-4 md:mb-6 shrink-0">
                   <h1 className="text-display">Report center</h1>
                   <p className="text-body mt-1 max-w-xl">Upload a scan for AI-assisted interpretation. Your data is encrypted and private.</p>
                 </motion.header>

                 {/* Step indicator */}
                 <motion.div variants={itemVariants} className="mb-4 shrink-0">
                   <div className="flex items-center gap-3 text-sm">
                     <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${profileComplete ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-amber-500/10 border-amber-500/30 text-amber-400"}`}>
                       {profileComplete ? <CheckCircle size={14} /> : <User size={14} />}
                       <span className="font-medium">1. Profile</span>
                     </div>
                     <div className="w-6 h-px bg-theme-border" />
                     <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${intakeComplete ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : profileComplete ? "bg-amber-500/10 border-amber-500/30 text-amber-400" : "bg-theme-surface border-theme-border text-theme-text-muted"}`}>
                       {intakeComplete ? <CheckCircle size={14} /> : <ClipboardList size={14} />}
                       <span className="font-medium">2. Questions</span>
                     </div>
                     <div className="w-6 h-px bg-theme-border" />
                     <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${canUpload ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-theme-surface border-theme-border text-theme-text-muted"}`}>
                       <Upload size={14} />
                       <span className="font-medium">3. Upload</span>
                     </div>
                     <div className="w-6 h-px bg-theme-border" />
                     <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${diagnosisResult ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-theme-surface border-theme-border text-theme-text-muted"}`}>
                       <Activity size={14} />
                       <span className="font-medium">4. Results</span>
                     </div>
                   </div>
                 </motion.div>

                 <div className={`flex-1 flex min-h-0 overflow-y-auto pb-24 ${diagnosisResult ? "flex-row gap-4 md:gap-6" : "flex-col"}`}>
                 {/* Workflow Column — stage-owned layout: Questions own page when active */}
                 <motion.section 
                   variants={itemVariants}
                   className={`flex flex-col shrink-0 ${
                     diagnosisResult ? "w-full lg:w-[42%] lg:max-w-xl gap-4 md:gap-6" 
                     : intakeComplete ? "w-full max-w-2xl mx-auto gap-4" 
                     : "w-full max-w-5xl mx-auto gap-8"
                   }`}
                 >
                   {/* Gate 1: Profile completion */}
                   {!profileComplete && (
                     <div className="luxo-card p-5 md:p-6">
                       <div className="flex items-center gap-2 mb-3">
                         <User size={18} className="text-amber-400" />
                         <h3 className="text-lg font-bold text-theme-text-primary">
                           {language === "tr" ? "Profil Tamamlama" : "Complete Your Profile"}
                         </h3>
                       </div>
                       <p className="text-sm text-theme-text-secondary mb-4">
                         {language === "tr"
                           ? "Yükleme yapabilmek için temel bilgilerinizi doldurun."
                           : "Fill in your basic information before uploading."}
                       </p>
                       <ProfileForm language={(language as "tr" | "en") ?? "en"} compact />
                     </div>
                   )}

                   {/* Gate 2: Report Questions — page-native when active, collapsed when complete */}
                   {profileComplete && (
                     <>
                       {!intakeComplete ? (
                         /* Questions active: form is main page content, no bounding card */
                         <div className="flex flex-col">
                           <div className="mb-6">
                             <h2 className="text-xl font-bold text-theme-text-primary flex items-center gap-2">
                               <ClipboardList size={20} className="text-amber-400" />
                               {language === "tr" ? "Rapor Soruları" : "Report Questions"}
                             </h2>
                             <p className="text-sm text-theme-text-secondary mt-1">
                               {language === "tr"
                                 ? "Tüm soruları yanıtlayın, ardından yükleme açılacak."
                                 : "Answer all questions, then upload will unlock."}
                             </p>
                           </div>
                           <ReportIntakeForm language={(language as "tr" | "en") ?? "en"} compact={false} />
                           <div className="mt-8 py-3 px-4 rounded-lg bg-theme-surface/60 border border-theme-border/50 flex items-center gap-2 text-theme-text-muted text-sm">
                             <Upload size={14} className="opacity-60 shrink-0" />
                             {language === "tr" ? "Yükleme, sorular tamamlandığında açılır." : "Upload unlocks when questions are complete."}
                           </div>
                         </div>
                       ) : (
                         /* Questions complete: compact summary + upload primary */
                         <>
                           <div className="luxo-card p-4 flex items-center justify-between">
                             <div className="flex items-center gap-2">
                               <CheckCircle size={18} className="text-emerald-400" />
                               <span className="text-sm font-medium text-theme-text-primary">
                                 {language === "tr" ? "Sorular tamamlandı" : "Questions complete"}
                               </span>
                             </div>
                             <button
                               type="button"
                               onClick={resetIntake}
                               className="text-xs text-theme-accent hover:underline"
                             >
                               {language === "tr" ? "Düzenle" : "Edit"}
                             </button>
                           </div>
                           <div className="luxo-card flex flex-col justify-center min-h-[320px]">
                             <div className="w-full p-5 md:p-6">
                               <UploadZone canAnalyze={canAnalyze} onUploadSuccess={handleUploadSuccess} />
                             </div>
                           </div>
                         </>
                       )}
                     </>
                   )}

                   {/* Privacy notice */}
                   <div className="flex items-start gap-2 px-4 py-3 rounded-lg bg-theme-surface/50 border border-theme-border/50">
                     <Shield size={14} className="text-theme-accent mt-0.5 flex-shrink-0" />
                     <p className="text-xs text-theme-text-muted leading-relaxed">
                       {language === "tr"
                         ? "Kayıtlı profiliniz ve rapor cevaplarınız yalnızca analiz kalitesini artırmak, doğru işleme yöntemini seçmek ve RapiMed içinde daha iyi açıklamalar sunmak için kullanılır. Bu bilgiler gelecek analizleriniz için saklanır ve profil/ayarlarınızdan düzenlenebilir."
                         : "Your saved profile and report answers are used only to improve analysis quality, choose the correct processing method, and provide better explanations inside RapiMed. This information is stored for your future analyses and can be edited from your profile/settings."}
                     </p>
                   </div>
                 </motion.section>

                 {/* Right Column: Report — only when results exist */}
                 {diagnosisResult && (
                   <section className="flex-1 flex flex-col min-w-0 min-h-[420px]">
                     <motion.div
                       variants={itemVariants}
                       initial={{ opacity: 0, x: 12 }}
                       animate={{ opacity: 1, x: 0 }}
                       className="flex-1 luxo-card flex flex-col overflow-hidden min-h-[380px]"
                     >
                       <div className="shrink-0 pt-5 px-5 md:pt-6 md:px-6 pb-2 border-b border-theme-border">
                         <h2 className="text-h2 flex items-center gap-2">
                           <Activity size={18} className="text-theme-accent" />
                           Report interpretation
                         </h2>
                         <p className="text-caption mt-1">AI-assisted analysis. Not a diagnosis — always consult a physician.</p>
                       </div>
                       <div className="flex-1 min-h-0 overflow-hidden flex flex-col pt-4 pb-6 px-5 md:px-6">
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
                <div className="flex-1 luxo-card overflow-hidden relative shadow-sm">
                  {activeView === 'chat' && <ChatView onBuyCredits={() => setActiveView('subscription')} />}
                  {activeView === 'records' && <MyReportsView onOpenReport={handleOpenReportFromList} />}
                   {activeView === 'subscription' && <SubscriptionView />}
                   {activeView === 'settings' && <SettingsView />}
                   {activeView === 'support' && <SupportView />}
                 </div>
               </motion.div>
             )}
           </AnimatePresence>
        </main>
      </div>
  );
}
