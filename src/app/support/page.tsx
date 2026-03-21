"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { auth, db, storage } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { collection, doc, onSnapshot, query, orderBy, updateDoc } from "firebase/firestore";
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import {
  MessageSquare,
  Send,
  Clock,
  AlertTriangle,
  CheckCircle,
  Shield,
  ShieldOff,
  Stethoscope,
  CreditCard,
  HelpCircle,
  Paperclip,
  X,
  File,
  Image,
  Bell,
  Lock,
  UserCheck,
} from "lucide-react";

type TicketStatus = "open" | "in-progress" | "resolved";

interface Attachment {
  url: string;
  name: string;
  type: string;
}

interface Ticket {
  ticketId: string;
  patientUid: string;
  patientEmail: string;
  category: string;
  subject: string;
  status: TicketStatus;
  dataConsent: boolean;
  assignedTo: string | null;
  assignedEmail: string | null;
  supportUnread: number;
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
  ticketId: string;
  subject: string;
  preview: string;
  from: string;
  read: boolean;
  createdAt: string;
}

const STATUS_CONFIG = {
  open: {
    label: "Open",
    color: "#00d4ff",
    bg: "rgba(0,212,255,0.08)",
    border: "rgba(0,212,255,0.2)",
    icon: Clock,
  },
  "in-progress": {
    label: "In Progress",
    color: "#ffaa00",
    bg: "rgba(255,170,0,0.08)",
    border: "rgba(255,170,0,0.2)",
    icon: AlertTriangle,
  },
  resolved: {
    label: "Resolved",
    color: "#00ff88",
    bg: "rgba(0,255,136,0.08)",
    border: "rgba(0,255,136,0.2)",
    icon: CheckCircle,
  },
};

const CATEGORY_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>> = {
  medical: Stethoscope,
  account: CreditCard,
  general: HelpCircle,
};

export default function SupportPanel() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [currentUid, setCurrentUid] = useState("");
  const [currentEmail, setCurrentEmail] = useState("");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "all" | "mine">("all");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const getToken = async (forceRefresh = false) => {
    const user = auth.currentUser;
    if (!user) return null;
    return user.getIdToken(forceRefresh);
  };

  const sendHeartbeat = useCallback(async (typing = false, activeTicketId: string | null = null) => {
    const token = await getToken();
    if (!token) return;
    void fetch("/api/support/presence", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        typing,
        activeTicketId,
      }),
    });
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }
      try {
        const token = await user.getIdToken(true);
        const res = await fetch("/api/support/tickets", { headers: { Authorization: `Bearer ${token}` } });
        const data = (await res.json()) as { isSupportStaff?: boolean; tickets?: Ticket[] };
        if (res.ok && data.isSupportStaff) {
          setAuthorized(true);
          setCurrentUid(user.uid);
          setCurrentEmail(user.email || "");
          setTickets(data.tickets || []);
          void sendHeartbeat(false, null);
        } else {
          router.replace("/dashboard");
        }
      } catch {
        router.replace("/dashboard");
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, [router, sendHeartbeat]);

  useEffect(() => {
    if (!authorized) return;
    const interval = setInterval(() => {
      void sendHeartbeat(isTyping, activeTicket?.ticketId ?? null);
    }, 30_000);
    return () => clearInterval(interval);
  }, [authorized, isTyping, activeTicket, sendHeartbeat]);

  useEffect(() => {
    if (!authorized) return;
    const q = query(collection(db, "supportTickets"), orderBy("updatedAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const all = snap.docs.map((d) => ({ ticketId: d.id, ...d.data() } as Ticket));
      setTickets(all);
      setActiveTicket((prev) => {
        if (!prev) return prev;
        const updated = all.find((t) => t.ticketId === prev.ticketId);
        return updated ?? prev;
      });
    });
    return unsub;
  }, [authorized]);

  useEffect(() => {
    if (!activeTicket) return;
    const q = query(collection(db, "supportTickets", activeTicket.ticketId, "messages"), orderBy("createdAt", "asc"));
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
    if (!currentUid) return;
    const q = query(collection(db, "notifications", currentUid, "items"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setNotifications(
        snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Notification[]
      );
    });
    return unsub;
  }, [currentUid]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSelectTicket = async (ticket: Ticket) => {
    setActiveTicket(ticket);
    setMessages([]);
    void sendHeartbeat(false, ticket.ticketId);
    const token = await getToken();
    if (token && ticket.supportUnread > 0) {
      void fetch(`/api/support/tickets/${ticket.ticketId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ clearSupportUnread: true }),
      });
    }
  };

  const handleClaimTicket = async () => {
    if (!activeTicket) return;
    const token = await getToken();
    if (!token) return;
    const res = await fetch(`/api/support/tickets/${activeTicket.ticketId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ assign: true }),
    });
    if (!res.ok) {
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      alert(d.error || "Could not claim ticket");
    }
  };

  const handleReleaseTicket = async () => {
    if (!activeTicket) return;
    const token = await getToken();
    if (!token) return;
    await fetch(`/api/support/tickets/${activeTicket.ticketId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ unassign: true }),
    });
  };

  const handleStatusChange = async (status: TicketStatus) => {
    if (!activeTicket) return;
    const token = await getToken();
    if (!token) return;
    await fetch(`/api/support/tickets/${activeTicket.ticketId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status }),
    });
  };

  const uploadFile = async (file: File, ticketId: string): Promise<Attachment> => {
    return new Promise((resolve, reject) => {
      const path = `support/${ticketId}/${Date.now()}_${file.name}`;
      const sRef = storageRef(storage, path);
      const task = uploadBytesResumable(sRef, file);
      task.on(
        "state_changed",
        (s) => setUploadProgress((s.bytesTransferred / s.totalBytes) * 100),
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

    if (activeTicket.assignedTo && activeTicket.assignedTo !== currentUid) {
      alert("This ticket is assigned to another agent.");
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
      setIsTyping(false);
    } finally {
      setSending(false);
    }
  };

  const handleTyping = (value: string) => {
    setReplyText(value);
    setIsTyping(value.length > 0);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    if (value.length > 0) {
      void sendHeartbeat(true, activeTicket?.ticketId ?? null);
      typingTimer.current = setTimeout(() => {
        setIsTyping(false);
        void sendHeartbeat(false, activeTicket?.ticketId ?? null);
      }, 3000);
    }
  };

  const canReply = !activeTicket?.assignedTo || activeTicket.assignedTo === currentUid;

  const filtered = (() => {
    const base =
      statusFilter === "all"
        ? tickets
        : statusFilter === "mine"
          ? tickets.filter((t) => t.assignedTo === currentUid)
          : tickets.filter((t) => t.status === statusFilter);
    return base;
  })();

  const unreadNotifs = notifications.filter((n) => !n.read).length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0f1e" }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-white/10 rounded-full animate-spin" style={{ borderTopColor: "#00d4ff" }} />
          <p className="text-xs font-mono" style={{ color: "#7a8aa0" }}>
            VERIFYING ACCESS...
          </p>
        </div>
      </div>
    );
  }

  if (!authorized) return null;

  return (
    <div className="min-h-screen flex" style={{ background: "#0a0f1e", color: "#e8edf5" }}>
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(
            rgba(0,212,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,212,255,0.03)
            1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }}
      />

      <div
        className="relative z-10 w-80 shrink-0 flex flex-col h-screen"
        style={{
          borderRight: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(10,15,30,0.98)",
        }}
      >
        <div
          className="px-4 py-4"
          style={{
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{
                  background: "rgba(0,212,255,0.1)",
                  border: "1px solid rgba(0,212,255,0.2)",
                }}
              >
                <MessageSquare size={14} style={{ color: "#00d4ff" }} />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: "#e8edf5" }}>
                  Support Panel
                </p>
                <p className="text-[10px] font-mono" style={{ color: "#7a8aa0" }}>
                  {currentEmail}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setShowNotifs((p) => !p)} className="relative p-1.5 rounded-lg transition-all" style={{ color: "#7a8aa0" }}>
                <Bell size={15} />
                {unreadNotifs > 0 && (
                  <span
                    className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full text-[8px] font-bold flex items-center justify-center"
                    style={{
                      background: "#ff4466",
                      color: "#fff",
                    }}
                  >
                    {unreadNotifs > 9 ? "9+" : unreadNotifs}
                  </span>
                )}
              </button>
            </div>
          </div>

          {showNotifs && (
            <div
              className="mb-3 rounded-xl overflow-hidden"
              style={{
                background: "rgba(13,20,36,0.98)",
                border: "1px solid rgba(0,212,255,0.2)",
              }}
            >
              <div
                className="px-3 py-2 flex items-center justify-between"
                style={{
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <p className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "#00d4ff" }}>
                  Notifications
                </p>
                <button type="button" onClick={() => setShowNotifs(false)} style={{ color: "#7a8aa0" }}>
                  <X size={12} />
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="px-3 py-4 text-center text-[10px] font-mono" style={{ color: "#3d4f66" }}>
                    No notifications
                  </p>
                ) : (
                  notifications.slice(0, 8).map((n) => {
                    const t = tickets.find((tk) => tk.ticketId === n.ticketId);
                    return (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => {
                          if (t) void handleSelectTicket(t);
                          setShowNotifs(false);
                          if (!n.read && currentUid) {
                            void updateDoc(doc(db, "notifications", currentUid, "items", n.id), { read: true });
                          }
                        }}
                        className="w-full px-3 py-2.5 text-left transition-all hover:bg-white/3"
                        style={{
                          borderBottom: "1px solid rgba(255,255,255,0.04)",
                          background: n.read ? "transparent" : "rgba(0,212,255,0.03)",
                        }}
                      >
                        <p className="text-[11px] font-medium truncate" style={{ color: "#e8edf5" }}>
                          Patient replied: {n.subject}
                        </p>
                        <p className="text-[10px] mt-0.5 truncate" style={{ color: "#7a8aa0" }}>
                          {n.preview}
                        </p>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-4 gap-0.5">
            {(["all", "mine", "open", "resolved"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setStatusFilter(f)}
                className="py-1.5 rounded-lg text-[10px] font-mono transition-all"
                style={
                  statusFilter === f
                    ? {
                        background: "rgba(0,212,255,0.1)",
                        border: "1px solid rgba(0,212,255,0.2)",
                        color: "#00d4ff",
                      }
                    : {
                        color: "#3d4f66",
                        border: "1px solid transparent",
                      }
                }
              >
                {f === "all" ? "All" : f === "mine" ? "Mine" : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <p className="text-center py-8 text-xs font-mono" style={{ color: "#3d4f66" }}>
              No tickets
            </p>
          ) : (
            filtered.map((ticket) => {
              const s = STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG.open;
              const SIcon = s.icon;
              const CatIcon = CATEGORY_ICONS[ticket.category] ?? HelpCircle;
              const isActive = activeTicket?.ticketId === ticket.ticketId;
              const isMine = ticket.assignedTo === currentUid;
              const isLocked = ticket.assignedTo && ticket.assignedTo !== currentUid;
              const hasUnread = ticket.supportUnread > 0;
              return (
                <button
                  key={ticket.ticketId}
                  type="button"
                  onClick={() => void handleSelectTicket(ticket)}
                  className="w-full flex items-start gap-3 p-3 rounded-xl text-left transition-all"
                  style={
                    isActive
                      ? {
                          background: "rgba(0,212,255,0.08)",
                          border: "1px solid rgba(0,212,255,0.2)",
                        }
                      : {
                          background: "rgba(255,255,255,0.02)",
                          border: "1px solid rgba(255,255,255,0.05)",
                        }
                  }
                >
                  <CatIcon size={13} className="mt-0.5 shrink-0" style={{ color: "#00d4ff" }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-medium truncate" style={{ color: "#e8edf5" }}>
                        {ticket.subject}
                      </p>
                      {hasUnread && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#00d4ff" }} />}
                    </div>
                    <p className="text-[10px] font-mono mt-0.5 truncate" style={{ color: "#7a8aa0" }}>
                      {ticket.patientEmail}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      {isMine && (
                        <span
                          className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                          style={{
                            background: "rgba(0,255,136,0.08)",
                            color: "#00ff88",
                          }}
                        >
                          MINE
                        </span>
                      )}
                      {isLocked && !isMine && (
                        <span
                          className="text-[9px] font-mono px-1.5 py-0.5 rounded flex items-center gap-1"
                          style={{
                            background: "rgba(255,170,0,0.08)",
                            color: "#ffaa00",
                          }}
                        >
                          <Lock size={8} />
                          LOCKED
                        </span>
                      )}
                    </div>
                  </div>
                  <SIcon size={10} style={{ color: s.color }} />
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="relative z-10 flex-1 flex flex-col h-screen">
        {!activeTicket ? (
          <div className="flex-1 flex items-center justify-center flex-col gap-3" style={{ color: "#3d4f66" }}>
            <MessageSquare size={40} className="opacity-20" />
            <p className="text-sm font-mono">Select a ticket to start</p>
          </div>
        ) : (
          <>
            <div
              className="shrink-0 flex items-center gap-4 px-6 py-4"
              style={{
                borderBottom: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate" style={{ color: "#e8edf5" }}>
                  {activeTicket.subject}
                </p>
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                  <p className="text-xs font-mono" style={{ color: "#7a8aa0" }}>
                    {activeTicket.patientEmail}
                  </p>
                  <div
                    className="text-[10px] font-mono flex items-center gap-1"
                    style={activeTicket.dataConsent ? { color: "#00ff88" } : { color: "#ff4466" }}
                  >
                    {activeTicket.dataConsent ? (
                      <>
                        <Shield size={10} /> Data shared
                      </>
                    ) : (
                      <>
                        <ShieldOff size={10} /> Text only
                      </>
                    )}
                  </div>
                  {activeTicket.assignedTo && (
                    <div
                      className="text-[10px] font-mono flex items-center gap-1"
                      style={activeTicket.assignedTo === currentUid ? { color: "#00ff88" } : { color: "#ffaa00" }}
                    >
                      <Lock size={10} />
                      {activeTicket.assignedTo === currentUid
                        ? `Assigned to you`
                        : `Assigned to ${activeTicket.assignedEmail}`}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                {!activeTicket.assignedTo ? (
                  <button
                    type="button"
                    onClick={() => void handleClaimTicket()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      background: "rgba(0,255,136,0.08)",
                      border: "1px solid rgba(0,255,136,0.25)",
                      color: "#00ff88",
                    }}
                  >
                    <UserCheck size={12} />
                    Claim
                  </button>
                ) : activeTicket.assignedTo === currentUid ? (
                  <button
                    type="button"
                    onClick={() => void handleReleaseTicket()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      background: "rgba(255,68,102,0.08)",
                      border: "1px solid rgba(255,68,102,0.25)",
                      color: "#ff4466",
                    }}
                  >
                    <X size={12} />
                    Release
                  </button>
                ) : null}

                {(["open", "in-progress", "resolved"] as TicketStatus[]).map((s) => {
                  const cfg = STATUS_CONFIG[s];
                  const SIcon = cfg.icon;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => void handleStatusChange(s)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold transition-all"
                      style={
                        activeTicket.status === s
                          ? {
                              background: cfg.bg,
                              border: `1px solid ${cfg.border}`,
                              color: cfg.color,
                            }
                          : {
                              background: "rgba(255,255,255,0.03)",
                              border: "1px solid rgba(255,255,255,0.06)",
                              color: "#3d4f66",
                            }
                      }
                    >
                      <SIcon size={10} />
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {activeTicket.assignedTo && activeTicket.assignedTo !== currentUid && (
              <div
                className="shrink-0 mx-6 mt-3 px-4 py-2.5 rounded-xl flex items-center gap-2 text-xs font-mono"
                style={{
                  background: "rgba(255,170,0,0.06)",
                  border: "1px solid rgba(255,170,0,0.2)",
                  color: "#ffaa00",
                }}
              >
                <Lock size={12} />
                This ticket is locked to {activeTicket.assignedEmail}. You can view but not reply.
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {messages.map((msg) => (
                <div key={msg.messageId} className={`flex ${msg.senderUid === currentUid ? "justify-end" : "justify-start"}`}>
                  <div className="max-w-[75%]">
                    <p className="text-[10px] font-mono mb-1" style={{ color: "#3d4f66" }}>
                      {msg.senderUid === currentUid ? `You (${msg.senderEmail})` : `Patient · ${msg.senderEmail}`} ·{" "}
                      {new Date(msg.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    <div
                      className="px-4 py-3 text-sm leading-relaxed"
                      style={
                        msg.senderUid === currentUid
                          ? {
                              background: "rgba(0,212,255,0.1)",
                              border: "1px solid rgba(0,212,255,0.2)",
                              color: "#e8edf5",
                              borderRadius: "18px 4px 18px 18px",
                            }
                          : {
                              background: "rgba(255,255,255,0.04)",
                              border: "1px solid rgba(255,255,255,0.08)",
                              color: "#e8edf5",
                              borderRadius: "4px 18px 18px 18px",
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

            {canReply && activeTicket.status !== "resolved" ? (
              <div
                className="shrink-0 px-6 py-4"
                style={{
                  borderTop: "1px solid rgba(255,255,255,0.06)",
                }}
              >
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
                <div className="flex gap-2">
                  <input
                    type="file"
                    multiple
                    accept="image/*,.pdf"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={(e) => {
                      if (e.target.files) {
                        setUploadFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-3 rounded-xl transition-all"
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
                    onChange={(e) => handleTyping(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void handleSendReply();
                      }
                    }}
                    placeholder={activeTicket.assignedTo ? "Reply to patient..." : "Claim ticket first to reply..."}
                    className="flex-1 px-4 py-3 rounded-xl text-sm outline-none"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: "#e8edf5",
                    }}
                    disabled={sending || !activeTicket.assignedTo}
                  />
                  <button
                    type="button"
                    onClick={() => void handleSendReply()}
                    disabled={(!replyText.trim() && !uploadFiles.length) || sending || !activeTicket.assignedTo}
                    className="p-3 rounded-xl transition-all"
                    style={
                      (replyText.trim() || uploadFiles.length) && !sending && activeTicket.assignedTo
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
            ) : (
              activeTicket.status === "resolved" && (
                <div
                  className="shrink-0 px-6 py-4 text-center text-xs font-mono"
                  style={{
                    borderTop: "1px solid rgba(255,255,255,0.06)",
                    color: "#3d4f66",
                  }}
                >
                  Ticket resolved.
                </div>
              )
            )}
          </>
        )}
      </div>
    </div>
  );
}
