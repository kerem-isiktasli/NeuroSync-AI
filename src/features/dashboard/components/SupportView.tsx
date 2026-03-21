"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSettings } from "@/context/SettingsContext";
import { useCredits } from "@/context/CreditsContext";
import { auth, db, storage } from "@/lib/firebase";
import { collection, doc, onSnapshot, query, orderBy, updateDoc, where } from "firebase/firestore";
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Send,
  Shield,
  ShieldOff,
  Stethoscope,
  CreditCard,
  HelpCircle,
  Clock,
  CheckCircle,
  AlertTriangle,
  ArrowLeft,
  Plus,
  Paperclip,
  X,
  File,
  Image,
  Bell,
} from "lucide-react";

type TicketStatus = "open" | "in-progress" | "resolved";

interface Attachment {
  url: string;
  name: string;
  type: string;
}

interface Ticket {
  ticketId: string;
  patientUid?: string;
  category: string;
  subject: string;
  message: string;
  status: TicketStatus;
  dataConsent: boolean;
  assignedTo: string | null;
  assignedEmail: string | null;
  patientUnread: number;
  createdAt: string;
  updatedAt: string;
}

interface Message {
  messageId: string;
  senderUid: string;
  senderRole: "patient" | "support";
  senderEmail: string;
  text: string;
  attachments?: Attachment[];
  createdAt: string;
}

interface Notification {
  id: string;
  type: string;
  ticketId: string;
  subject: string;
  preview: string;
  from: string;
  read: boolean;
  createdAt: string;
}

const CATEGORIES = [
  {
    id: "medical",
    icon: Stethoscope,
    label: "Medical Support",
    labelTr: "Tıbbi Destek",
    desc: "Questions about reports, findings, or medical terms",
    descTr: "Raporlar, bulgular veya tıbbi terimler hakkında",
  },
  {
    id: "account",
    icon: CreditCard,
    label: "Account Support",
    labelTr: "Hesap Desteği",
    desc: "Billing, credits, subscription or login issues",
    descTr: "Faturalama, kredi, abonelik veya giriş sorunları",
  },
  {
    id: "general",
    icon: HelpCircle,
    label: "General Questions",
    labelTr: "Genel Sorular",
    desc: "How to use RapiMed, privacy or other questions",
    descTr: "RapiMed kullanımı, gizlilik veya diğer sorular",
  },
];

const STATUS_CONFIG = {
  open: {
    label: "Open",
    labelTr: "Açık",
    color: "#00d4ff",
    bg: "rgba(0,212,255,0.08)",
    border: "rgba(0,212,255,0.2)",
    icon: Clock,
  },
  "in-progress": {
    label: "In Progress",
    labelTr: "İşlemde",
    color: "#ffaa00",
    bg: "rgba(255,170,0,0.08)",
    border: "rgba(255,170,0,0.2)",
    icon: AlertTriangle,
  },
  resolved: {
    label: "Resolved",
    labelTr: "Çözüldü",
    color: "#00ff88",
    bg: "rgba(0,255,136,0.08)",
    border: "rgba(0,255,136,0.2)",
    icon: CheckCircle,
  },
};

export default function SupportView() {
  const { language } = useSettings();
  const isTr = language === "tr";
  const { canSupport, deductForSupport, balances } = useCredits();

  const [userUid, setUserUid] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "new" | "thread">("list");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [sending, setSending] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<"category" | "form" | "consent">("category");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [dataConsent, setDataConsent] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [formFiles, setFormFiles] = useState<File[]>([]);

  const getToken = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) return null;
    return user.getIdToken();
  }, []);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      setUserUid(u?.uid ?? null);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!userUid) {
      setTickets([]);
      setLoadingTickets(false);
      return;
    }
    const q = query(
      collection(db, "supportTickets"),
      where("patientUid", "==", userUid),
      orderBy("updatedAt", "desc")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const all = snap.docs.map((d) => ({ ticketId: d.id, ...d.data() } as Ticket));
        setTickets(all);
        setLoadingTickets(false);
        setActiveTicket((prev) => {
          if (!prev) return prev;
          const updated = all.find((t) => t.ticketId === prev.ticketId);
          return updated ?? prev;
        });
      },
      () => setLoadingTickets(false)
    );
    return unsub;
  }, [userUid]);

  useEffect(() => {
    if (!activeTicket) return;
    const q = query(
      collection(db, "supportTickets", activeTicket.ticketId, "messages"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setMessages(
        snap.docs.map((d) => ({
          messageId: d.id,
          ...d.data(),
        })) as Message[]
      );
    });
    return unsub;
  }, [activeTicket?.ticketId]);

  useEffect(() => {
    if (!userUid) return;
    const q = query(collection(db, "notifications", userUid, "items"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setNotifications(
        snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Notification[]
      );
    });
    return unsub;
  }, [userUid]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!activeTicket || !userUid) return;
    if (activeTicket.patientUnread <= 0) return;
    let cancelled = false;
    void (async () => {
      const t = await auth.currentUser?.getIdToken();
      if (!t || cancelled) return;
      await fetch(`/api/support/tickets/${activeTicket.ticketId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${t}`,
        },
        body: JSON.stringify({ clearPatientUnread: true }),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTicket?.ticketId, userUid, activeTicket?.patientUnread]);

  const uploadFile = async (file: File, ticketId: string): Promise<Attachment> => {
    return new Promise((resolve, reject) => {
      const path = `support/${ticketId}/${Date.now()}_${file.name}`;
      const sRef = storageRef(storage, path);
      const task = uploadBytesResumable(sRef, file);
      task.on(
        "state_changed",
        (snapshot) => {
          setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        },
        reject,
        async () => {
          const url = await getDownloadURL(task.snapshot.ref);
          resolve({ url, name: file.name, type: file.type });
        }
      );
    });
  };

  const handleSendReply = async () => {
    if ((!replyText.trim() && !uploadFiles.length) || !activeTicket || sending) return;
    if (!canSupport) {
      setReplyText("");
      return;
    }
    const deducted = await deductForSupport();
    if (!deducted) {
      return;
    }
    setSending(true);
    setUploading(uploadFiles.length > 0);

    try {
      const token = await getToken();
      if (!token) return;

      let attachments: Attachment[] = [];
      if (uploadFiles.length > 0) {
        attachments = await Promise.all(uploadFiles.map((f) => uploadFile(f, activeTicket.ticketId)));
        setUploadFiles([]);
        setUploadProgress(0);
        setUploading(false);
      }

      await fetch(`/api/support/tickets/${activeTicket.ticketId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          text: replyText.trim(),
          attachments,
        }),
      });
      setReplyText("");
    } finally {
      setSending(false);
    }
  };

  const handleSubmitTicket = async () => {
    if (!selectedCategory || !subject.trim() || !message.trim() || dataConsent === null) {
      setSubmitError(isTr ? "Lütfen tüm alanları doldurun." : "Please fill all fields.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const token = await getToken();
      if (!token) return;

      const res = await fetch("/api/support/tickets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          category: selectedCategory,
          subject: subject.trim(),
          message: message.trim(),
          dataConsent,
          attachments: [],
        }),
      });

      if (!res.ok) {
        setSubmitError(isTr ? "Gönderilemedi. Tekrar deneyin." : "Could not submit. Please try again.");
        return;
      }

      const data = (await res.json()) as { ticketId?: string };
      const newId = data.ticketId;
      if (newId && formFiles.length > 0) {
        const attachments = await Promise.all(formFiles.map((f) => uploadFile(f, newId)));
        await fetch(`/api/support/tickets/${newId}/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            text: "",
            attachments,
          }),
        });
      }

      setSelectedCategory("");
      setSubject("");
      setMessage("");
      setDataConsent(null);
      setFormFiles([]);
      setStep("category");
      setView("list");
    } finally {
      setSubmitting(false);
    }
  };

  const handleFormFileAdd = (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files).slice(0, 3);
    setFormFiles((prev) => [...prev, ...arr]);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const faqs = [
    {
      q: isTr ? "Raporlarım güvende mi?" : "Are my reports safe?",
      a: isTr
        ? "Tüm verileriniz şifrelenmiş. Destek ekibi yalnızca açık onayınızla erişebilir."
        : "All data is encrypted. Support can only access it with your explicit consent.",
    },
    {
      q: isTr ? "Biletim ne kadar sürede yanıtlanır?" : "How quickly will my ticket be answered?",
      a: isTr
        ? "Tıbbi talepler 24 saat, hesap sorunları 48 saat içinde yanıtlanır."
        : "Medical requests within 24 hours, account issues within 48 hours.",
    },
    {
      q: isTr ? "Dosya ekleyebilir miyim?" : "Can I attach files?",
      a: isTr
        ? "Evet. Görüntü ve PDF dosyaları ekleyebilirsiniz (maks. 10 MB)."
        : "Yes. You can attach images and PDF files (max 10 MB each).",
    },
  ];

  if (view === "list") {
    return (
      <div className="h-full flex flex-col p-6 space-y-5" style={{ color: "#e8edf5" }}>
        <header className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold" style={{ color: "#e8edf5" }}>
              {isTr ? "Destek" : "Support"}
            </h2>
            <p className="text-sm font-mono mt-0.5" style={{ color: "#7a8aa0" }}>
              {isTr ? "Biletleriniz ve sorularınız" : "Your tickets and questions"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowNotifPanel((p) => !p)}
              className="relative p-2 rounded-xl transition-all"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <Bell size={16} style={{ color: "#7a8aa0" }} />
              {unreadCount > 0 && (
                <span
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center"
                  style={{
                    background: "#ff4466",
                    color: "#fff",
                  }}
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
            <button
              onClick={() => {
                setStep("category");
                setView("new");
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: "linear-gradient(135deg, #00d4ff, #0099cc)",
                color: "#001a2e",
              }}
            >
              <Plus size={15} />
              {isTr ? "Yeni Bilet" : "New Ticket"}
            </button>
          </div>
        </header>

        <AnimatePresence>
          {showNotifPanel && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="rounded-xl overflow-hidden"
              style={{
                background: "rgba(13,20,36,0.98)",
                border: "1px solid rgba(0,212,255,0.2)",
                boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
              }}
            >
              <div
                className="px-4 py-3 flex items-center justify-between"
                style={{
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <p className="text-xs font-mono uppercase tracking-wider" style={{ color: "#00d4ff" }}>
                  {isTr ? "Bildirimler" : "Notifications"}
                </p>
                <button type="button" onClick={() => setShowNotifPanel(false)} style={{ color: "#7a8aa0" }}>
                  <X size={14} />
                </button>
              </div>
              {notifications.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs font-mono" style={{ color: "#3d4f66" }}>
                  {isTr ? "Bildirim yok" : "No notifications"}
                </p>
              ) : (
                <div className="max-h-64 overflow-y-auto">
                  {notifications.slice(0, 10).map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => {
                        const ticket = tickets.find((t) => t.ticketId === n.ticketId);
                        if (ticket) {
                          setActiveTicket(ticket);
                          setView("thread");
                        }
                        setShowNotifPanel(false);
                        if (!n.read && userUid) {
                          void updateDoc(doc(db, "notifications", userUid, "items", n.id), { read: true });
                        }
                      }}
                      className="w-full px-4 py-3 text-left transition-all hover:bg-white/3"
                      style={{
                        borderBottom: "1px solid rgba(255,255,255,0.04)",
                        background: n.read ? "transparent" : "rgba(0,212,255,0.03)",
                      }}
                    >
                      <p className="text-xs font-medium" style={{ color: "#e8edf5" }}>
                        {n.from === "support"
                          ? isTr
                            ? "Destek ekibinden yanıt"
                            : "Reply from support team"
                          : isTr
                            ? "Yeni mesaj"
                            : "New message"}
                      </p>
                      <p className="text-[11px] mt-0.5 truncate" style={{ color: "#7a8aa0" }}>
                        {n.preview}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-2">
          <h3 className="text-xs font-mono uppercase tracking-wider" style={{ color: "#3d4f66" }}>
            {isTr ? "Biletlerim" : "My Tickets"} ({tickets.length})
          </h3>
          {loadingTickets ? (
            <div className="text-center py-8 text-xs font-mono" style={{ color: "#7a8aa0" }}>
              {isTr ? "Yükleniyor..." : "Loading..."}
            </div>
          ) : tickets.length === 0 ? (
            <div
              className="text-center py-8 rounded-xl"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <MessageSquare className="mx-auto mb-3 opacity-30" size={32} style={{ color: "#7a8aa0" }} />
              <p className="text-sm font-mono" style={{ color: "#7a8aa0" }}>
                {isTr ? "Henüz bilet yok" : "No tickets yet"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {tickets.map((ticket) => {
                const s = STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG.open;
                const SIcon = s.icon;
                const cat = CATEGORIES.find((c) => c.id === ticket.category);
                const CatIcon = cat?.icon ?? HelpCircle;
                const hasUnread = ticket.patientUnread > 0;
                return (
                  <button
                    key={ticket.ticketId}
                    type="button"
                    onClick={() => {
                      setActiveTicket(ticket);
                      setView("thread");
                    }}
                    className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-left transition-all hover:bg-white/3"
                    style={{
                      background: hasUnread ? "rgba(0,212,255,0.03)" : "rgba(255,255,255,0.02)",
                      border: hasUnread ? "1px solid rgba(0,212,255,0.2)" : "1px solid rgba(255,255,255,0.07)",
                    }}
                  >
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{
                        background: "rgba(0,212,255,0.08)",
                        border: "1px solid rgba(0,212,255,0.2)",
                      }}
                    >
                      <CatIcon size={16} style={{ color: "#00d4ff" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate" style={{ color: "#e8edf5" }}>
                          {ticket.subject}
                        </p>
                        {hasUnread && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: "#00d4ff" }} />}
                      </div>
                      <p className="text-xs font-mono mt-0.5" style={{ color: "#7a8aa0" }}>
                        {isTr ? cat?.labelTr : cat?.label} ·{" "}
                        {ticket.assignedEmail
                          ? isTr
                            ? `${ticket.assignedEmail} ile`
                            : `with ${ticket.assignedEmail}`
                          : isTr
                            ? "Atanmadı"
                            : "Unassigned"}{" "}
                        · {new Date(ticket.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold shrink-0"
                      style={{
                        background: s.bg,
                        border: `1px solid ${s.border}`,
                        color: s.color,
                      }}
                    >
                      <SIcon size={10} />
                      {isTr ? s.labelTr : s.label}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <h3 className="text-xs font-mono uppercase tracking-wider" style={{ color: "#3d4f66" }}>
            FAQ
          </h3>
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              className="rounded-xl overflow-hidden"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <button
                type="button"
                onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                className="w-full flex items-center justify-between p-4 text-left"
                style={{ color: "#e8edf5" }}
              >
                <span className="text-sm font-medium">{faq.q}</span>
                {activeFaq === idx ? (
                  <ChevronUp size={15} style={{ color: "#7a8aa0" }} />
                ) : (
                  <ChevronDown size={15} style={{ color: "#7a8aa0" }} />
                )}
              </button>
              {activeFaq === idx && (
                <div className="px-4 pb-4 text-sm leading-relaxed" style={{ color: "#7a8aa0" }}>
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (view === "new") {
    return (
      <div className="h-full flex flex-col p-6" style={{ color: "#e8edf5" }}>
        <header className="flex items-center gap-3 mb-6">
          <button type="button" onClick={() => setView("list")} className="p-2 rounded-lg transition-all" style={{ color: "#7a8aa0" }}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-xl font-bold" style={{ color: "#e8edf5" }}>
              {isTr ? "Yeni Destek Talebi" : "New Support Ticket"}
            </h2>
            <p className="text-xs font-mono" style={{ color: "#7a8aa0" }}>
              {step === "category"
                ? isTr
                  ? "Adım 1/3 — Kategori"
                  : "Step 1/3 — Category"
                : step === "form"
                  ? isTr
                    ? "Adım 2/3 — Detaylar"
                    : "Step 2/3 — Details"
                  : isTr
                    ? "Adım 3/3 — Veri Onayı"
                    : "Step 3/3 — Data Consent"}
            </p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto space-y-4">
          {step === "category" && (
            <div className="space-y-3">
              <p className="text-sm" style={{ color: "#7a8aa0" }}>
                {isTr ? "Ne konusunda yardıma ihtiyacınız var?" : "What do you need help with?"}
              </p>
              {CATEGORIES.map((cat) => {
                const CatIcon = cat.icon;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setSelectedCategory(cat.id);
                      setStep("form");
                    }}
                    className="w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all"
                    style={{
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid rgba(255,255,255,0.07)",
                    }}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{
                        background: "rgba(0,212,255,0.08)",
                        border: "1px solid rgba(0,212,255,0.2)",
                      }}
                    >
                      <CatIcon size={18} style={{ color: "#00d4ff" }} />
                    </div>
                    <div>
                      <p className="font-semibold text-sm" style={{ color: "#e8edf5" }}>
                        {isTr ? cat.labelTr : cat.label}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "#7a8aa0" }}>
                        {isTr ? cat.descTr : cat.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {step === "form" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider mb-2" style={{ color: "#7a8aa0" }}>
                  {isTr ? "Konu" : "Subject"}
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={isTr ? "Kısaca özetleyin" : "Brief summary"}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "#e8edf5",
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider mb-2" style={{ color: "#7a8aa0" }}>
                  {isTr ? "Mesajınız" : "Your Message"}
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  placeholder={isTr ? "Sorununuzu detaylı açıklayın..." : "Describe your issue in detail..."}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "#e8edf5",
                  }}
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider mb-2" style={{ color: "#7a8aa0" }}>
                  {isTr ? "Ekler (isteğe bağlı)" : "Attachments (optional)"}
                </label>
                <input
                  type="file"
                  multiple
                  accept="image/*,.pdf"
                  className="hidden"
                  id="form-file-input"
                  onChange={(e) => handleFormFileAdd(e.target.files)}
                />
                <label
                  htmlFor="form-file-input"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl cursor-pointer text-sm transition-all w-fit"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "#7a8aa0",
                  }}
                >
                  <Paperclip size={14} />
                  {isTr ? "Dosya Ekle" : "Attach File"}
                </label>
                {formFiles.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {formFiles.map((f, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono"
                        style={{
                          background: "rgba(0,212,255,0.06)",
                          border: "1px solid rgba(0,212,255,0.15)",
                          color: "#00d4ff",
                        }}
                      >
                        <File size={11} />
                        {f.name.slice(0, 20)}
                        <button type="button" onClick={() => setFormFiles((prev) => prev.filter((_, j) => j !== i))}>
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setStep("consent")}
                disabled={!subject.trim() || !message.trim()}
                className="w-full py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-40"
                style={{
                  background: "linear-gradient(135deg, #00d4ff, #0099cc)",
                  color: "#001a2e",
                }}
              >
                {isTr ? "Devam Et" : "Continue"}
              </button>
            </div>
          )}

          {step === "consent" && (
            <div className="space-y-4">
              <p className="text-sm leading-relaxed" style={{ color: "#7a8aa0" }}>
                {isTr
                  ? "Destek ekibimizin tıbbi raporlarınıza ve görüntülerinize erişmesini ister misiniz?"
                  : "Would you like to allow our support team to access your medical reports and images?"}
              </p>

              <button
                type="button"
                onClick={() => setDataConsent(true)}
                className="w-full flex items-start gap-4 p-5 rounded-xl text-left transition-all"
                style={
                  dataConsent === true
                    ? {
                        background: "rgba(0,255,136,0.06)",
                        border: "1px solid rgba(0,255,136,0.3)",
                      }
                    : {
                        background: "rgba(255,255,255,0.02)",
                        border: "1px solid rgba(255,255,255,0.07)",
                      }
                }
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    background: "rgba(0,255,136,0.08)",
                    border: "1px solid rgba(0,255,136,0.2)",
                  }}
                >
                  <Shield size={18} style={{ color: "#00ff88" }} />
                </div>
                <div>
                  <p className="font-semibold text-sm mb-1" style={{ color: "#e8edf5" }}>
                    {isTr ? "Evet, raporlarımı paylaş" : "Yes, share my reports"}
                  </p>
                  <p className="text-xs leading-relaxed" style={{ color: "#7a8aa0" }}>
                    {isTr
                      ? "Destek ekibi raporlarınızı ve görüntülerinizi görebilir. Verileriniz yalnızca bu destek talebi için kullanılır."
                      : "Support staff can view your reports and images. Data is only used for this ticket."}
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setDataConsent(false)}
                className="w-full flex items-start gap-4 p-5 rounded-xl text-left transition-all"
                style={
                  dataConsent === false
                    ? {
                        background: "rgba(255,68,102,0.06)",
                        border: "1px solid rgba(255,68,102,0.3)",
                      }
                    : {
                        background: "rgba(255,255,255,0.02)",
                        border: "1px solid rgba(255,255,255,0.07)",
                      }
                }
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    background: "rgba(255,68,102,0.08)",
                    border: "1px solid rgba(255,68,102,0.2)",
                  }}
                >
                  <ShieldOff size={18} style={{ color: "#ff4466" }} />
                </div>
                <div>
                  <p className="font-semibold text-sm mb-1" style={{ color: "#e8edf5" }}>
                    {isTr ? "Hayır, verilerimi paylaşma" : "No, do not share my data"}
                  </p>
                  <p className="text-xs leading-relaxed" style={{ color: "#7a8aa0" }}>
                    {isTr ? "Destek ekibi yalnızca yazdıklarınızı görür." : "Support staff will only see what you write here."}
                  </p>
                </div>
              </button>

              {submitError && (
                <p className="text-xs text-center" style={{ color: "#ff4466" }}>
                  {submitError}
                </p>
              )}

              <button
                type="button"
                onClick={() => void handleSubmitTicket()}
                disabled={dataConsent === null || submitting}
                className="w-full py-3.5 rounded-xl font-bold text-sm transition-all disabled:opacity-40"
                style={{
                  background: "linear-gradient(135deg, #00d4ff, #0099cc)",
                  color: "#001a2e",
                }}
              >
                {submitting ? (isTr ? "Gönderiliyor..." : "Submitting...") : isTr ? "Talebi Gönder" : "Submit Ticket"}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" style={{ color: "#e8edf5" }}>
      <div
        className="shrink-0 flex items-center gap-3 px-5 py-4"
        style={{
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <button
          type="button"
          onClick={() => {
            setView("list");
            setActiveTicket(null);
            setMessages([]);
          }}
          className="p-1.5 rounded-lg transition-all"
          style={{ color: "#7a8aa0" }}
        >
          <ArrowLeft size={17} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: "#e8edf5" }}>
            {activeTicket?.subject}
          </p>
          <p className="text-xs font-mono" style={{ color: "#7a8aa0" }}>
            {activeTicket?.assignedEmail
              ? isTr
                ? `${activeTicket.assignedEmail} ile konuşuyorsunuz`
                : `Chatting with ${activeTicket.assignedEmail}`
              : isTr
                ? "Atanmayı bekleniyor..."
                : "Waiting for assignment..."}
          </p>
        </div>
        {activeTicket &&
          (() => {
            const s = STATUS_CONFIG[activeTicket.status] ?? STATUS_CONFIG.open;
            const SIcon = s.icon;
            return (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold"
                style={{
                  background: s.bg,
                  border: `1px solid ${s.border}`,
                  color: s.color,
                }}
              >
                <SIcon size={10} />
                {isTr ? s.labelTr : s.label}
              </div>
            );
          })()}
      </div>

      {activeTicket && (
        <div
          className="shrink-0 mx-5 mt-3 px-4 py-2 rounded-xl flex items-center gap-2 text-xs font-mono"
          style={
            activeTicket.dataConsent
              ? {
                  background: "rgba(0,255,136,0.05)",
                  border: "1px solid rgba(0,255,136,0.15)",
                  color: "#00ff88",
                }
              : {
                  background: "rgba(255,68,102,0.05)",
                  border: "1px solid rgba(255,68,102,0.15)",
                  color: "#ff4466",
                }
          }
        >
          {activeTicket.dataConsent ? <Shield size={11} /> : <ShieldOff size={11} />}
          {activeTicket.dataConsent
            ? isTr
              ? "Veri paylaşımı onaylandı"
              : "Data sharing approved"
            : isTr
              ? "Veri paylaşımı reddedildi — yalnızca mesajlar görünür"
              : "Data sharing declined — text only"}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {messages.map((msg) => (
          <div key={msg.messageId} className={`flex ${msg.senderRole === "patient" ? "justify-end" : "justify-start"}`}>
            <div className="max-w-[80%]">
              <p className="text-[10px] font-mono mb-1" style={{ color: "#3d4f66" }}>
                {msg.senderRole === "support"
                  ? isTr
                    ? "Destek Ekibi"
                    : "Support Team"
                  : isTr
                    ? "Siz"
                    : "You"}{" "}
                ·{" "}
                {new Date(msg.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
              <div
                className="px-4 py-3 text-sm leading-relaxed"
                style={
                  msg.senderRole === "patient"
                    ? {
                        background: "rgba(0,212,255,0.1)",
                        border: "1px solid rgba(0,212,255,0.2)",
                        color: "#e8edf5",
                        borderRadius: "18px 18px 4px 18px",
                      }
                    : {
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        color: "#e8edf5",
                        borderRadius: "18px 18px 18px 4px",
                      }
                }
              >
                {msg.text ? <p>{msg.text}</p> : null}
                {msg.attachments?.map((a, i) => (
                  <a
                    key={i}
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg text-xs transition-all"
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "#00d4ff",
                    }}
                  >
                    {a.type.startsWith("image") ? <Image size={12} /> : <File size={12} />}
                    {a.name}
                  </a>
                ))}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {activeTicket?.status !== "resolved" ? (
        !canSupport ? (
          <div
            className="shrink-0 px-5 py-4 text-center text-xs font-mono"
            style={{
              borderTop: "1px solid rgba(255,255,255,0.06)",
              color: "#ff4466",
            }}
          >
            No support message tokens remaining. Upgrade your plan for more.
          </div>
        ) : (
          <div
            className="shrink-0 px-5 py-4"
            style={{
              borderTop: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-mono" style={{ color: "#3d4f66" }}>
                {balances.supportTokens} support messages remaining
              </p>
            </div>
            {uploadFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {uploadFiles.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono"
                    style={{
                      background: "rgba(0,212,255,0.06)",
                      border: "1px solid rgba(0,212,255,0.15)",
                      color: "#00d4ff",
                    }}
                  >
                    <File size={11} />
                    {f.name.slice(0, 20)}
                    <button type="button" onClick={() => setUploadFiles((prev) => prev.filter((_, j) => j !== i))}>
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {uploading && (
              <div className="mb-2 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${uploadProgress}%`, background: "#00d4ff" }} />
              </div>
            )}

            <div className="flex gap-2 items-end">
              <input
                type="file"
                multiple
                accept="image/*,.pdf"
                className="hidden"
                ref={fileInputRef}
                onChange={(e) => {
                  if (e.target.files) {
                    setUploadFiles((prev) => [...prev, ...Array.from(e.target.files!).slice(0, 5)]);
                  }
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-3 rounded-xl transition-all shrink-0"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#7a8aa0",
                }}
              >
                <Paperclip size={16} />
              </button>

              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSendReply();
                  }
                }}
                placeholder={isTr ? "Yanıtınızı yazın..." : "Type your reply..."}
                className="flex-1 px-4 py-3 rounded-xl text-sm outline-none"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#e8edf5",
                }}
                disabled={sending}
              />
              <button
                type="button"
                onClick={() => void handleSendReply()}
                disabled={(!replyText.trim() && !uploadFiles.length) || sending}
                className="p-3 rounded-xl shrink-0 transition-all"
                style={
                  (replyText.trim() || uploadFiles.length) && !sending
                    ? {
                        background: "rgba(0,212,255,0.12)",
                        border: "1px solid rgba(0,212,255,0.3)",
                        color: "#00d4ff",
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
          </div>
        )
      ) : (
        <div
          className="shrink-0 px-5 py-4 text-center text-xs font-mono"
          style={{
            borderTop: "1px solid rgba(255,255,255,0.06)",
            color: "#3d4f66",
          }}
        >
          {isTr ? "Bu bilet çözüldü." : "This ticket has been resolved."}
        </div>
      )}
    </div>
  );
}
