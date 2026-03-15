"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSettings } from "@/context/SettingsContext";
import { useReports } from "@/context/ReportsContext";
import { useCredits } from "@/context/CreditsContext";
import { useDiagnosis } from "@/features/diagnosis/context/DiagnosisContext";
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

const STATUS_COLORS: Record<string, string> = {
  uploaded: "bg-blue-500/10 text-blue-400",
  processing: "bg-amber-500/10 text-amber-400",
  complete: "bg-emerald-500/10 text-emerald-400",
  failed: "bg-red-500/10 text-red-400",
};

// ─── Report context packet for chat API ───

type ReportDoc = import("@/services/reportService").ReportDoc;
type DiagnosisResult = import("@/types/diagnosis").DiagnosisResult;

function buildReportContextPacket(
  report: ReportDoc | null,
  result: DiagnosisResult | null,
  userQuestion: string
): import("@/app/api/report-chat/route").ReportContextPacket {
  const dr = report?.diagnosisResult ?? result;
  const keyFindings = report?.keyFindings ?? result?.key_findings ?? [];
  const detailedFindings =
    dr?.report_sections?.detailed_findings ??
    (Array.isArray(keyFindings) ? keyFindings : []);
  const interpretiveImpression =
    dr?.report_sections?.interpretive_impression ?? "";
  const limitations =
    dr?.report_sections?.limitations ?? [];
  const additionalDataRequested =
    dr?.additional_data_requested?.map((a) => ({
      item: a.item,
      reason: a.reason,
      priority: a.priority ?? "medium",
    })) ?? [];

  return {
    fileName: report?.fileName ?? result?.fileName ?? "",
    modality: report?.modality ?? result?.modality ?? "",
    anatomicalRegion: report?.anatomicalRegion ?? result?.anatomical_region ?? "",
    concernLevel: report?.concernLevel ?? result?.concern_level ?? "moderate",
    summary: report?.summary ?? result?.diagnosis ?? "",
    keyFindings: Array.isArray(keyFindings) ? keyFindings : [String(keyFindings)],
    detailedFindings: Array.isArray(detailedFindings) ? detailedFindings : [],
    interpretiveImpression: interpretiveImpression ?? "",
    limitations: Array.isArray(limitations) ? limitations : [],
    additionalDataRequested,
    questionsForDoctor: report?.questionsForDoctor ?? result?.questions_for_doctor ?? [],
    followUpConsiderations: report?.followUpConsiderations ?? result?.follow_up_considerations ?? [],
    medicalDisclaimer: report?.medicalDisclaimer ?? result?.medical_disclaimer ?? "",
    userQuestion,
  };
}

// ─── Component ───

export default function ChatView({ onBuyCredits }: { onBuyCredits?: () => void }) {
  const { t, language } = useSettings();
  const { toast } = useToast();
  const { credits, canChat, deductForChat } = useCredits();
  const { activeReport } = useReports();
  const { diagnosisResult, isAnalyzing } = useDiagnosis();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const report = activeReport;
  const result = diagnosisResult;
  const hasReport = !!(report && report.status !== "uploaded");
  const isComplete = report?.status === "complete";

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
  }, [messages]);

  const handleSendMessage = async (text?: string) => {
    const msg = (text ?? inputValue).trim();
    if (!msg) return;
    if (isTyping) return;

    if (!canChat || credits <= 0) {
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
      const payload = { context, language: language === "tr" ? "tr" as const : "en" as const };
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
        deductForChat();
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

  // ─── EMPTY STATE (no report) ───
  if (!report && !isAnalyzing) {
    return (
      <div className="flex flex-col h-full bg-theme-surface items-center justify-center p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-theme-accent/10 border border-theme-accent/20 flex items-center justify-center mb-6">
          <MessageSquarePlus className="w-8 h-8 text-theme-accent" />
        </div>
        <h2 className="text-xl font-bold text-theme-text-primary mb-2">
          {language === "tr" ? "Aktif Rapor Yok" : "No Active Report"}
        </h2>
        <p className="text-sm text-theme-text-secondary max-w-md mb-6">
          {language === "tr"
            ? "Dashboard'dan yeni bir tarama yükleyin veya Raporlarım sayfasından mevcut bir raporu açın."
            : "Upload a new scan from the Dashboard, or open an existing report from My Reports."}
        </p>
        <div className="flex gap-3">
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-theme-surface-elevated border border-theme-border text-sm text-theme-text-muted">
            <Upload className="w-4 h-4" />
            {language === "tr" ? "Dashboard → Yükle" : "Dashboard → Upload"}
          </div>
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-theme-surface-elevated border border-theme-border text-sm text-theme-text-muted">
            <FileText className="w-4 h-4" />
            {language === "tr" ? "Raporlarım → Aç" : "My Reports → Open"}
          </div>
        </div>
      </div>
    );
  }

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
    <div className="flex flex-col h-full bg-theme-surface relative overflow-hidden transition-colors duration-300">
      {/* Background subtle pattern */}
      <div className="absolute inset-0 opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] pointer-events-none" />

      {/* ── REPORT HEADER CARD ── */}
      {report && (
        <div className="shrink-0 border-b border-theme-border bg-theme-surface-elevated/50 px-5 py-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2.5 mb-1">
                <div className="w-8 h-8 rounded-lg bg-theme-accent/10 border border-theme-accent/20 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-theme-accent" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-theme-text-primary truncate">{report.title || fileName}</h3>
                  <div className="flex items-center gap-2 text-[11px] text-theme-text-muted">
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
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${STATUS_COLORS[report.status] ?? STATUS_COLORS.uploaded}`}>
                {report.status}
              </span>
              {isComplete && (
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border flex items-center gap-1 ${concern.color}`}>
                  <ConcernIcon className="w-3 h-3" />
                  {concern.text}
                </span>
              )}
            </div>
          </div>

          {/* ── SUMMARY STRIP ── */}
          {isComplete && summary && (
            <div className="mt-2.5 pt-2.5 border-t border-theme-border/50">
              <p className="text-xs text-theme-text-secondary line-clamp-2 mb-2">{summary}</p>
              <div className="flex gap-4 text-[11px] text-theme-text-muted">
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
            <div className="mt-2.5 pt-2.5 border-t border-theme-border/50 flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-theme-accent animate-pulse" />
              <span className="text-xs text-theme-accent font-medium">
                {language === "tr" ? "Analiz devam ediyor..." : "Analysis in progress..."}
              </span>
            </div>
          )}

          {/* ── FAILED INDICATOR ── */}
          {report.status === "failed" && (
            <div className="mt-2.5 pt-2.5 border-t border-red-500/20 flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              <span className="text-xs text-red-400">{report.errorMessage || (language === "tr" ? "Analiz başarısız oldu" : "Analysis failed")}</span>
            </div>
          )}
        </div>
      )}

      {/* ── FILE ATTACHMENT CARD (if report exists but is new/processing) ── */}
      {report && !isComplete && report.status !== "failed" && (
        <div className="px-5 pt-3">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-theme-surface-elevated border border-theme-border">
            <div className="w-10 h-10 rounded-lg bg-theme-accent/10 border border-theme-accent/20 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-theme-accent" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-theme-text-primary truncate">{fileName}</p>
              <p className="text-[11px] text-theme-text-muted">{report.fileType || "image/jpeg"}</p>
            </div>
            {(report.status === "processing" || isAnalyzing) && (
              <div className="shrink-0">
                <div className="w-5 h-5 border-2 border-theme-accent/30 border-t-theme-accent rounded-full animate-spin" />
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
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[75%] rounded-2xl p-3.5 shadow-sm relative ${
                  msg.sender === "user"
                    ? "bg-theme-accent text-theme-accent-foreground rounded-tr-none"
                    : "bg-theme-surface-elevated text-theme-text-primary rounded-tl-none border border-theme-border"
                }`}
              >
                {msg.attachment && (
                  <div className="flex items-center gap-2 mb-2 p-2 rounded-lg bg-black/10">
                    <FileText size={14} />
                    <span className="text-xs font-medium truncate">{msg.attachment.name}</span>
                  </div>
                )}
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                <div className="flex items-center justify-end gap-1 mt-1 opacity-60">
                  <span className="text-[10px]">
                    {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  {msg.sender === "user" && <CheckCheck size={12} />}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isTyping && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <div className="bg-theme-surface-elevated p-3.5 rounded-2xl rounded-tl-none border border-theme-border flex gap-1">
              <span className="w-2 h-2 bg-theme-accent rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-2 h-2 bg-theme-accent rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-2 h-2 bg-theme-accent rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
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
      <div className="p-4 bg-theme-surface-elevated border-t border-theme-border flex items-center gap-3">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-2.5 rounded-full hover:bg-theme-surface text-theme-text-muted hover:text-theme-text-primary transition-colors"
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
            className="w-full bg-theme-surface border border-theme-border rounded-full py-2.5 px-5 text-sm text-theme-text-primary focus:outline-none focus:border-theme-focus-ring transition-all placeholder:text-theme-text-muted"
          />
        </div>

        <div className="flex items-center gap-2">
          {!canChat && (
            <span className="text-xs text-theme-warning whitespace-nowrap">{t("insufficient_credits")}</span>
          )}
          <button
            onClick={() => handleSendMessage()}
            disabled={!inputValue.trim() || !canChat || isTyping}
            className="p-2.5 rounded-full bg-theme-accent text-theme-accent-foreground hover:bg-theme-accent/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

