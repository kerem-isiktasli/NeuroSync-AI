"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSettings } from "@/context/SettingsContext";
import { useReports } from "@/context/ReportsContext";
import { useCredits } from "@/context/CreditsContext";
import { useDiagnosis } from "@/features/diagnosis/context/DiagnosisContext";
import { usePatient } from "@/context/PatientContext";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import {
  Send,
  Paperclip,
  CheckCheck,
  FileText,
  Activity,
  AlertTriangle,
  Shield,
  Info,
  Stethoscope,
  MessageSquarePlus,
  Sparkles,
  Clock,
  BarChart3,
  HelpCircle,
  Upload,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ───

interface Message {
  id: string;
  text: string;
  sender: "user" | "ai";
  timestamp: Date;
  status?: "sent" | "delivered" | "read";
  attachment?: { name: string; type: string };
}

// ─── Concern badge config ───

const CONCERN_BADGE: Record<string, { label: string; labelTr: string; color: string; icon: typeof Shield }> = {
  low:             { label: "Low",           labelTr: "Düşük",    color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", icon: Shield },
  moderate:        { label: "Moderate",      labelTr: "Orta",     color: "bg-amber-500/10 text-amber-400 border-amber-500/20",       icon: Info },
  high:            { label: "High",          labelTr: "Yüksek",   color: "bg-orange-500/10 text-orange-400 border-orange-500/20",    icon: AlertTriangle },
  "urgent-review": { label: "Urgent Review", labelTr: "Acil",     color: "bg-red-500/10 text-red-400 border-red-500/20",             icon: AlertTriangle },
};

function getConcernBadge(level: string | undefined, lang: string) {
  const cfg = CONCERN_BADGE[level ?? "moderate"] ?? CONCERN_BADGE.moderate;
  return { ...cfg, text: lang === "tr" ? cfg.labelTr : cfg.label };
}

// ─── Report context packet for chat API ───

type ReportDoc = import("@/services/reportService").ReportDoc;
type DiagnosisResult = import("@/types/diagnosis").DiagnosisResult;

function buildReportContextPacket(
  report: ReportDoc | null,
  result: DiagnosisResult | null,
  userQuestion: string
): import("@/app/api/report-chat/route").ReportContextPacket {
  const dr = report?.diagnosisResult ?? result;
  const rs = dr?.report_sections;
  const keyFindings = report?.keyFindings ?? result?.key_findings ?? [];
  const detailedFindings =
    rs?.detailed_findings ?? (Array.isArray(keyFindings) ? keyFindings : []);
  const interpretiveImpression = rs?.interpretive_impression ?? "";
  const limitations = rs?.limitations ?? [];
  const additionalDataRequested =
    dr?.additional_data_requested?.map((a) => ({
      item: a.item,
      reason: a.reason,
      priority: a.priority ?? "medium",
    })) ?? [];

  return {
    reportType: dr?.reportType,
    reportMode: dr?.reportMode,
    reportLabel: dr?.reportLabel,
    localizerReport: dr?.localizerReport,
    fileName: report?.fileName ?? result?.fileName ?? "",
    modality: report?.modality ?? result?.modality ?? dr?.modality ?? "",
    anatomicalRegion: report?.anatomicalRegion ?? result?.anatomical_region ?? dr?.anatomical_region ?? "",
    concernLevel: report?.concernLevel ?? result?.concern_level ?? dr?.concern_level ?? "moderate",
    summary: report?.summary ?? result?.diagnosis ?? dr?.diagnosis ?? "",
    keyFindings: Array.isArray(keyFindings) ? keyFindings : [String(keyFindings ?? "")],
    detailedFindings: Array.isArray(detailedFindings) ? detailedFindings : [],
    interpretiveImpression: interpretiveImpression ?? "",
    limitations: Array.isArray(limitations) ? limitations : [],
    additionalDataRequested,
    questionsForDoctor: report?.questionsForDoctor ?? result?.questions_for_doctor ?? dr?.questions_for_doctor ?? [],
    followUpConsiderations: report?.followUpConsiderations ?? result?.follow_up_considerations ?? dr?.follow_up_considerations ?? [],
    medicalDisclaimer: report?.medicalDisclaimer ?? result?.medical_disclaimer ?? dr?.medical_disclaimer ?? "",
    userQuestion,
    officialReportText: dr?.report_fusion?.report_text_summary,
    reportFusion: dr?.report_fusion,
    examOverview: rs?.exam_overview,
    technicalSummary: rs?.technical_summary,
    studyAdequacySummary: rs?.study_adequacy_summary,
    anatomicalSpecificitySummary: rs?.anatomical_specificity_summary,
    findingsByLevelSummary: rs?.findings_by_level_summary,
    whatCannotBeDetermined: rs?.what_cannot_be_determined,
    evidenceAgreementSummary: rs?.evidence_agreement_summary,
    differentialConsiderations: dr?.differential_considerations,
    redFlags: dr?.red_flags,
    importantTerms: report?.importantTerms ?? result?.important_terms ?? dr?.important_terms,
    nextSteps: rs?.next_steps,
    confidenceLevel: dr?.confidence_level,
    confidenceReasons: dr?.confidence_reasons,
  };
}

// ─── Component ───

export default function ChatView({ onBuyCredits }: { onBuyCredits?: () => void }) {
  const { t, language } = useSettings();
  const { toast } = useToast();
  const { balances, canChat, deductForChat } = useCredits();
  const { activeReport } = useReports();
  const { diagnosisResult, isAnalyzing } = useDiagnosis();
  const { profile, currentIntake } = usePatient();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const report = activeReport;
  const result = diagnosisResult;
  const hasReport = !!(report && report.status !== "uploaded");
  const isComplete = report?.status === "complete";

  type ChatMode = "report" | "general";
  const [chatMode, setChatMode] = useState<ChatMode>(() => (hasReport ? "report" : "general"));
  const [generalHistory, setGeneralHistory] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [generalMessages, setGeneralMessages] = useState<Message[]>(() => [
    {
      id: "general-welcome",
      text:
        language === "tr"
          ? "Merhaba! Tıbbi sorularınızı yanıtlamak için buradayım. Semptomlar, hastalıklar veya ne zaman doktora gitmeniz gerektiği hakkında sorabilirsiniz. Kesin tanı koymuyorum, ancak size doğru yönde yardımcı olmaya çalışırım."
          : "Hello! I'm here to help answer your medical questions. You can ask me about symptoms, conditions, medications, or when to see a doctor. I don't give diagnoses, but I'll help point you in the right direction.",
      sender: "ai",
      timestamp: new Date(),
      status: "read",
    },
  ]);

  useEffect(() => {
    setGeneralMessages((prev) => {
      if (prev.length === 0 || prev[0]?.id !== "general-welcome") return prev;
      const text =
        language === "tr"
          ? "Merhaba! Tıbbi sorularınızı yanıtlamak için buradayım. Semptomlar, hastalıklar veya ne zaman doktora gitmeniz gerektiği hakkında sorabilirsiniz. Kesin tanı koymuyorum, ancak size doğru yönde yardımcı olmaya çalışırım."
          : "Hello! I'm here to help answer your medical questions. You can ask me about symptoms, conditions, medications, or when to see a doctor. I don't give diagnoses, but I'll help point you in the right direction.";
      return [{ ...prev[0], text }, ...prev.slice(1)];
    });
  }, [language]);

  // Build contextual welcome message
  useEffect(() => {
    const welcomeText = hasReport
      ? language === "tr"
        ? `Merhaba. "${report!.fileName}" dosyanız için oluşturulan rapor bağlamında çalışıyorum. Bulgular, olası açıklamalar veya doktorunuza sormak isteyebileceğiniz konularda size yardımcı olabilirim.`
        : `Hello. I'm working in the context of the report generated for "${report!.fileName}". I can help you understand findings, possible explanations, or questions you may want to ask your doctor.`
      : t("ai_intro");

    setMessages((prev) => {
      const welcome: Message = {
        id: "welcome",
        text: welcomeText,
        sender: "ai",
        timestamp: new Date(),
        status: "read",
      };
      if (prev.length === 0) return [welcome];
      if (prev.length === 1 && prev[0].id === "welcome") return [welcome];
      return prev.map((m) => (m.id === "welcome" ? { ...m, text: welcomeText } : m));
    });
  }, [hasReport, report, language, t]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, generalMessages, chatMode]);

  const handleSendMessage = async (text?: string) => {
    const msg = (text ?? inputValue).trim();
    if (!msg) return;
    if (isTyping) return;

    if (!canChat || balances.agentTokens <= 0) {
      toast({
        variant: "destructive",
        title: t("insufficient_credits"),
        description: language === "tr" ? "Abonelik sayfasından kredi satın alın." : "Go to Subscription to buy more credits.",
        ...(onBuyCredits && {
          action: (
            <ToastAction altText={t("buy_credits")} onClick={onBuyCredits}>
              {t("buy_credits")}
            </ToastAction>
          ),
        }),
      });
      return;
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      text: msg,
      sender: "user",
      timestamp: new Date(),
      status: "sent",
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");

    setIsTyping(true);
    try {
      const context = buildReportContextPacket(report, result, msg);
      const patientContext = {
        knownDiagnoses: profile.knownDiagnoses,
        chronicConditions: profile.chronicConditions,
        priorSurgeries: profile.priorSurgeries,
        activeFollowUpDiagnoses: profile.activeFollowUpDiagnoses,
        primaryConcern: currentIntake.primaryConcern,
        bodyRegion: currentIntake.bodyRegion,
        fileType: currentIntake.fileType,
        symptomDuration: currentIntake.symptomDuration,
        symptomTrend: currentIntake.symptomTrend,
        studyTimeline: currentIntake.studyTimeline,
        uploadFormat: currentIntake.uploadFormat,
        desiredOutput: currentIntake.desiredOutput,
      };
      const payload = {
        context,
        language: language === "tr" ? "tr" as const : "en" as const,
        patientContext,
      };
      const res = await fetch("/api/report-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      let data: { text?: string; error?: string };
      try {
        const raw = await res.text();
        data = raw ? (JSON.parse(raw) as { text?: string; error?: string }) : {};
      } catch (parseErr) {
        console.error("[ChatView] response parse failed:", parseErr);
        console.error("[ChatView] response status:", res.status, res.statusText);
        throw new Error("Invalid response from assistant");
      }

      if (!res.ok) {
        console.error("[ChatView] report-chat error:", {
          status: res.status,
          statusText: res.statusText,
          error: data?.error,
          payloadKeys: Object.keys(payload.context || {}),
        });
      }

      const aiText =
        res.ok && data?.text
          ? data.text
          : (language === "tr"
              ? "Rapor asistanı geçici olarak kullanılamıyor. Lütfen daha sonra tekrar deneyin."
              : "The report assistant is temporarily unavailable. Please try again later.");

      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(),
        text: aiText,
        sender: "ai" as const,
        timestamp: new Date(),
        status: "read" as const,
      }]);

      if (res.ok && data?.text) {
        await deductForChat();
      }
    } catch (err) {
      console.error("[ChatView] report-chat failure:", err);
      console.error("[ChatView] error stack:", err instanceof Error ? err.stack : "(no stack)");
      const fallback =
        language === "tr"
          ? "Bağlantı hatası. Asistan geçici olarak kullanılamıyor."
          : "Connection error. Assistant temporarily unavailable.";
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          text: fallback,
          sender: "ai" as const,
          timestamp: new Date(),
          status: "read" as const,
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleGeneralMessage = async (text?: string) => {
    const msg = (text ?? inputValue).trim();
    if (!msg || isTyping) return;

    if (!canChat || balances.agentTokens <= 0) {
      toast({
        variant: "destructive",
        title: t("insufficient_credits"),
        description: language === "tr" ? "Abonelik sayfasından kredi satın alın." : "Go to Subscription to buy more credits.",
        ...(onBuyCredits && {
          action: (
            <ToastAction altText={t("buy_credits")} onClick={onBuyCredits}>
              {t("buy_credits")}
            </ToastAction>
          ),
        }),
      });
      return;
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      text: msg,
      sender: "user",
      timestamp: new Date(),
      status: "sent",
    };
    setGeneralMessages((prev) => [...prev, userMsg]);
    setGeneralHistory((prev) => [...prev, { role: "user", content: msg }]);
    setInputValue("");
    setIsTyping(true);

    try {
      const res = await fetch("/api/general-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          language: language === "tr" ? "tr" : "en",
          history: generalHistory,
        }),
      });

      const data = (await res.json()) as { text?: string; error?: string };

      const aiText =
        res.ok && data.text
          ? data.text
          : language === "tr"
            ? "Asistan geçici olarak kullanılamıyor."
            : "Assistant temporarily unavailable.";

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: aiText,
        sender: "ai",
        timestamp: new Date(),
        status: "read",
      };
      setGeneralMessages((prev) => [...prev, aiMsg]);

      if (res.ok && data.text) {
        setGeneralHistory((prev) => [...prev, { role: "assistant", content: data.text! }]);
        await deductForChat();
      }
    } catch (err) {
      console.error("[GeneralChat] error:", err);
      setGeneralMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          text: language === "tr" ? "Bağlantı hatası. Lütfen tekrar deneyin." : "Connection error. Please try again.",
          sender: "ai",
          timestamp: new Date(),
          status: "read",
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      const fileMsg: Message = {
        id: Date.now().toString(),
        text: `${language === "tr" ? "Yüklendi" : "Uploaded"}: ${file.name}`,
        sender: "user",
        timestamp: new Date(),
        attachment: { name: file.name, type: file.type },
        status: "sent",
      };
      setMessages((prev) => [...prev, fileMsg]);

      setIsTyping(true);
      setTimeout(() => {
        const ack: Message = {
          id: (Date.now() + 1).toString(),
          text: language === "tr"
            ? "Dosya alındı. Analiz için lütfen Dashboard'daki yükleme alanını kullanın — tam rapor ve PDF dışa aktarma orada oluşturulur."
            : "File received. For full analysis, please use the upload zone on the Dashboard — the complete report and PDF export are generated there.",
          sender: "ai",
          timestamp: new Date(),
          status: "read",
        };
        setMessages((prev) => [...prev, ack]);
        setIsTyping(false);
      }, 1000);
    }
  };

  const suggestedChips = isComplete
    ? language === "tr"
      ? [
          "Bulguları daha basit dille açıkla",
          "Doktoruma ne sormalıyım?",
          "Bu ne kadar acil?",
          "Daha fazla hangi verilere ihtiyaç var?",
          "Temel bulguları özetle",
        ]
      : [
          "Explain findings in simpler language",
          "What should I ask my doctor?",
          "How urgent is this?",
          "What more data do you need?",
          "Summarize the key findings",
        ]
    : [];

  const concern = getConcernBadge(report?.concernLevel || result?.concern_level, language);
  const ConcernIcon = concern.icon;

  const modality = report?.modality || result?.modality || "";
  const region = report?.anatomicalRegion || result?.anatomical_region || "";
  const fileName = report?.fileName || result?.fileName || "";
  const summary = report?.summary || result?.diagnosis || "";
  const kfCount = (report?.keyFindings?.length ?? result?.key_findings?.length) || 0;
  const qCount = (report?.questionsForDoctor?.length ?? result?.questions_for_doctor?.length) || 0;
  const fuCount = (report?.followUpConsiderations?.length ?? result?.follow_up_considerations?.length) || 0;

  return (
    <div
      className="h-full flex flex-col relative overflow-hidden"
      style={{ color: "#e8edf5", background: "#0d1424" }}
    >
      {/* Mode selector */}
      <div
        className="shrink-0 flex gap-1 p-1 mx-5 mt-4 mb-2 rounded-xl"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <button
          type="button"
          onClick={() => setChatMode("report")}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all"
          style={
            chatMode === "report"
              ? {
                  background: "rgba(0,212,255,0.12)",
                  border: "1px solid rgba(0,212,255,0.25)",
                  color: "#00d4ff",
                }
              : {
                  border: "1px solid transparent",
                  color: "#7a8aa0",
                }
          }
        >
          <FileText size={13} />
          {language === "tr" ? "Rapor Asistanı" : "Report Assistant"}
        </button>
        <button
          type="button"
          onClick={() => setChatMode("general")}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all"
          style={
            chatMode === "general"
              ? {
                  background: "rgba(0,255,136,0.08)",
                  border: "1px solid rgba(0,255,136,0.2)",
                  color: "#00ff88",
                }
              : {
                  border: "1px solid transparent",
                  color: "#7a8aa0",
                }
          }
        >
          <Stethoscope size={13} />
          {language === "tr" ? "Genel Tıbbi Soru" : "General Medical Chat"}
        </button>
      </div>

      {chatMode === "report" ? (
        <>
          {!report && !isAnalyzing ? (
            <div
              className="flex-1 flex flex-col items-center justify-center p-8 text-center"
              style={{ color: "#e8edf5" }}
            >
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
                style={{
                  background: "rgba(0,212,255,0.08)",
                  border: "1px solid rgba(0,212,255,0.2)",
                  boxShadow: "0 0 24px rgba(0,212,255,0.12)",
                }}
              >
                <MessageSquarePlus className="w-8 h-8" style={{ color: "#00d4ff" }} />
              </div>
              <h2 className="text-xl font-bold mb-2" style={{ color: "#e8edf5" }}>
                {language === "tr" ? "Aktif Rapor Yok" : "No Active Report"}
              </h2>
              <p className="text-sm max-w-md mb-6 font-mono" style={{ color: "#7a8aa0" }}>
                {language === "tr"
                  ? "Dashboard'dan yeni bir tarama yükleyin veya Raporlarım sayfasından mevcut bir raporu açın."
                  : "Upload a new scan from the Dashboard, or open an existing report from My Reports."}
              </p>
              <div className="flex gap-3">
                <div
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "#7a8aa0",
                  }}
                >
                  <Upload className="w-4 h-4" />
                  {language === "tr" ? "Dashboard → Yükle" : "Dashboard → Upload"}
                </div>
                <div
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "#7a8aa0",
                  }}
                >
                  <FileText className="w-4 h-4" />
                  {language === "tr" ? "Raporlarım → Aç" : "My Reports → Open"}
                </div>
              </div>
            </div>
          ) : (
            <>
      {/* ── REPORT HEADER CARD ── */}
      {report && (
        <div
          className="shrink-0 px-5 py-4"
          style={{
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(255,255,255,0.01)",
          }}
        >
          <div
            className="mb-3 px-4 py-3 rounded-xl flex items-start justify-between gap-3"
            style={{
              background: "rgba(0,212,255,0.04)",
              border: "1px solid rgba(0,212,255,0.12)",
            }}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2.5 mb-1">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    background: "rgba(0,212,255,0.08)",
                    border: "1px solid rgba(0,212,255,0.2)",
                  }}
                >
                  <FileText className="w-4 h-4" style={{ color: "#00d4ff" }} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold truncate" style={{ color: "#e8edf5" }}>
                    {report.title || fileName}
                  </h3>
                  <div className="flex items-center gap-2 text-[11px] font-mono" style={{ color: "#7a8aa0" }}>
                    {modality && <span>{modality}</span>}
                    {modality && region && <span className="opacity-40">|</span>}
                    {region && <span>{region}</span>}
                    {(modality || region) && <span className="opacity-40">|</span>}
                    <span>{new Date(report.updatedAt || report.createdAt).toLocaleDateString(language === "tr" ? "tr-TR" : "en-US")}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                style={{
                  background: "rgba(0,212,255,0.08)",
                  border: "1px solid rgba(0,212,255,0.2)",
                  color: "#00d4ff",
                }}
              >
                {report.status}
              </span>
              {isComplete && (
                <span
                  className="px-2.5 py-1 rounded-full text-[10px] font-bold border flex items-center gap-1"
                  style={{ borderColor: "rgba(255,255,255,0.1)", color: "#e8edf5" }}
                >
                  <ConcernIcon className="w-3 h-3" />
                  {concern.text}
                </span>
              )}
            </div>
          </div>

          {/* ── SUMMARY STRIP ── */}
          {isComplete && summary && (
            <div className="mt-2.5 pt-2.5 px-5" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-xs line-clamp-2 mb-2" style={{ color: "#7a8aa0" }}>
                {summary}
              </p>
              <div className="flex gap-4 text-[11px] font-mono" style={{ color: "#3d4f66" }}>
                <span className="flex items-center gap-1">
                  <Stethoscope className="w-3 h-3" />
                  {kfCount} {language === "tr" ? "bulgu" : "findings"}
                </span>
                <span className="flex items-center gap-1">
                  <HelpCircle className="w-3 h-3" />
                  {qCount} {language === "tr" ? "soru" : "questions"}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {fuCount} {language === "tr" ? "takip" : "follow-ups"}
                </span>
              </div>
            </div>
          )}

          {/* ── PROCESSING INDICATOR ── */}
          {(report.status === "processing" || isAnalyzing) && (
            <div className="mt-2.5 pt-2.5 px-5 flex items-center gap-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <Activity className="w-3.5 h-3.5 animate-pulse" style={{ color: "#00d4ff" }} />
              <span className="text-xs font-medium font-mono" style={{ color: "#00d4ff" }}>
                {language === "tr" ? "Analiz devam ediyor..." : "Analysis in progress..."}
              </span>
            </div>
          )}

          {/* ── FAILED INDICATOR ── */}
          {report.status === "failed" && (
            <div className="mt-2.5 pt-2.5 px-5 flex items-center gap-2" style={{ borderTop: "1px solid rgba(255,68,102,0.2)" }}>
              <AlertTriangle className="w-3.5 h-3.5" style={{ color: "#ff4466" }} />
              <span className="text-xs" style={{ color: "#ff4466" }}>
                {report.errorMessage || (language === "tr" ? "Analiz başarısız oldu" : "Analysis failed")}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── FILE ATTACHMENT CARD (if report exists but is new/processing) ── */}
      {report && !isComplete && report.status !== "failed" && (
        <div className="px-5 pt-3">
          <div
            className="flex items-center gap-3 p-3 rounded-xl"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
              style={{
                background: "rgba(0,212,255,0.08)",
                border: "1px solid rgba(0,212,255,0.2)",
              }}
            >
              <FileText className="w-5 h-5" style={{ color: "#00d4ff" }} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate" style={{ color: "#e8edf5" }}>
                {fileName}
              </p>
              <p className="text-[11px] font-mono" style={{ color: "#3d4f66" }}>
                {report.fileType || "image/jpeg"}
              </p>
            </div>
            {(report.status === "processing" || isAnalyzing) && (
              <div className="shrink-0">
                <div
                  className="w-5 h-5 border-2 rounded-full animate-spin"
                  style={{ borderColor: "rgba(0,212,255,0.3)", borderTopColor: "#00d4ff" }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Report-based label ── */}
      {isComplete && (
        <div className="shrink-0 px-4 py-1.5 border-b border-theme-border/50 flex items-center gap-2">
          <FileText className="w-3.5 h-3.5 text-theme-accent" />
          <span className="text-[11px] text-theme-text-muted">
            {language === "tr"
              ? "Yanıtlar aktif raporunuza dayanmaktadır"
              : "Answers based on active report"}
          </span>
        </div>
      )}

      {/* ── CHAT AREA ── */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed relative ${
                  msg.sender === "user" ? "rounded-tr-sm ml-auto" : "rounded-tl-sm"
                }`}
                style={
                  msg.sender === "user"
                    ? {
                        background: "rgba(0,212,255,0.1)",
                        border: "1px solid rgba(0,212,255,0.2)",
                        color: "#e8edf5",
                      }
                    : {
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.07)",
                        color: "#e8edf5",
                      }
                }
              >
                {msg.attachment && (
                  <div
                    className="flex items-center gap-2 mb-2 p-2 rounded-lg"
                    style={{ background: "rgba(0,0,0,0.15)" }}
                  >
                    <FileText size={14} />
                    <span className="text-xs font-medium truncate">{msg.attachment.name}</span>
                  </div>
                )}
                <p className="whitespace-pre-wrap">{msg.text}</p>
                <div className="flex items-center justify-end gap-1 mt-1">
                  <span className="text-[10px] font-mono" style={{ color: "#3d4f66" }}>
                    {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  {msg.sender === "user" && <CheckCheck size={12} style={{ color: "#3d4f66" }} />}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isTyping && chatMode === "report" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <div
              className="p-3.5 rounded-2xl rounded-tl-sm border flex gap-1.5"
              style={{
                background: "rgba(255,255,255,0.03)",
                borderColor: "rgba(255,255,255,0.07)",
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "#00d4ff", animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "#00d4ff", animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "#00d4ff", animationDelay: "300ms" }} />
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── SUGGESTED CHIPS ── */}
      {suggestedChips.length > 0 && messages.length <= 2 && (
        <div className="px-4 pb-2 flex gap-2 flex-wrap">
          {suggestedChips.map((chip, i) => (
            <button
              key={i}
              onClick={() => handleSendMessage(chip)}
              disabled={isTyping || !canChat}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-theme-surface-elevated border border-theme-border text-theme-text-secondary hover:text-theme-accent hover:border-theme-accent/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles className="w-3 h-3 inline mr-1 opacity-60" />
              {chip}
            </button>
          ))}
        </div>
      )}

      {/* ── INPUT AREA ── */}
      <div
        className="shrink-0 px-5 py-4 flex items-center gap-3"
        style={{
          borderTop: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(255,255,255,0.01)",
        }}
      >
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-2.5 rounded-full transition-colors hover:bg-white/5"
          style={{ color: "#7a8aa0" }}
        >
          <Paperclip size={18} />
          <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
        </button>

        <div className="flex-1 relative">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
            placeholder={
              hasReport
                ? language === "tr"
                  ? "Bu rapor hakkında bir soru sorun..."
                  : "Ask a question about this report..."
                : language === "tr"
                  ? "Bir soru sorun..."
                  : "Ask a question..."
            }
            className="w-full rounded-xl py-3 px-4 text-sm outline-none transition-all focus:border-[rgba(0,212,255,0.4)] placeholder:text-[#3d4f66] font-sans"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#e8edf5",
            }}
          />
        </div>

        <div className="flex items-center gap-2">
          {!canChat && (
            <span className="text-xs whitespace-nowrap font-mono" style={{ color: "#ffaa00" }}>
              {t("insufficient_credits")}
            </span>
          )}
          <button
            onClick={() => handleSendMessage()}
            disabled={!inputValue.trim() || !canChat || isTyping}
            className="p-3 rounded-xl transition-all disabled:cursor-not-allowed"
            style={
              !inputValue.trim() || !canChat || isTyping
                ? {
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    color: "#3d4f66",
                  }
                : {
                    background: "rgba(0,212,255,0.15)",
                    border: "1px solid rgba(0,212,255,0.3)",
                    color: "#00d4ff",
                  }
            }
          >
            <Send size={18} />
          </button>
        </div>
      </div>
            </>
          )}
        </>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            <AnimatePresence initial={false}>
              {generalMessages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className="rounded-2xl px-4 py-3 text-sm leading-relaxed max-w-[85%]"
                    style={
                      msg.sender === "user"
                        ? {
                            background: "rgba(0,212,255,0.1)",
                            border: "1px solid rgba(0,212,255,0.2)",
                            color: "#e8edf5",
                            borderRadius: "18px 18px 4px 18px",
                          }
                        : {
                            background: "rgba(255,255,255,0.03)",
                            border: "1px solid rgba(255,255,255,0.07)",
                            color: "#e8edf5",
                            borderRadius: "18px 18px 18px 4px",
                          }
                    }
                  >
                    {msg.text}
                  </div>
                </motion.div>
              ))}
              {isTyping && chatMode === "general" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                  <div
                    className="px-4 py-3 rounded-2xl flex gap-1.5 items-center"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.07)",
                    }}
                  >
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="w-1.5 h-1.5 rounded-full animate-bounce"
                        style={{
                          background: "#00d4ff",
                          animationDelay: `${i * 150}ms`,
                        }}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>

          {generalMessages.length <= 1 && (
            <div className="px-5 pb-2 flex flex-wrap gap-2">
              {(language === "tr"
                ? [
                    "Baş ağrısı ne zaman ciddidir?",
                    "Kan değerlerimi nasıl yorumlarım?",
                    "Ne zaman acile gitmeliyim?",
                    "Stres belirtileri nelerdir?",
                  ]
                : [
                    "When is a headache serious?",
                    "How do I read my blood test results?",
                    "When should I go to the ER?",
                    "What are signs of high blood pressure?",
                  ]
              ).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => handleGeneralMessage(q)}
                  className="px-3 py-1.5 rounded-full text-xs transition-all"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    color: "#7a8aa0",
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          <div
            className="shrink-0 px-5 py-4"
            style={{
              borderTop: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div className="flex gap-3 items-end">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleGeneralMessage();
                  }
                }}
                placeholder={language === "tr" ? "Tıbbi sorunuzu yazın..." : "Ask your medical question..."}
                className="flex-1 px-4 py-3 rounded-xl text-sm outline-none transition-all placeholder:text-[#3d4f66]"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#e8edf5",
                }}
                disabled={isTyping}
              />
              <button
                type="button"
                onClick={() => void handleGeneralMessage()}
                disabled={!inputValue.trim() || isTyping}
                className="p-3 rounded-xl transition-all shrink-0"
                style={
                  inputValue.trim() && !isTyping
                    ? {
                        background: "rgba(0,255,136,0.12)",
                        border: "1px solid rgba(0,255,136,0.3)",
                        color: "#00ff88",
                      }
                    : {
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.06)",
                        color: "#3d4f66",
                      }
                }
              >
                <Send size={16} />
              </button>
            </div>
            <p className="text-[10px] font-mono mt-2 text-center" style={{ color: "#3d4f66" }}>
              {language === "tr"
                ? "Bu sohbet tanı değildir. Kişisel tıbbi tavsiye için doktorunuza başvurun."
                : "This is not a diagnosis. Consult a doctor for personal medical advice."}
            </p>
          </div>
        </>
      )}
    </div>
  );
}

