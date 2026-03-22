"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { auth, storage } from "@/lib/firebase";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { usePatient } from "@/context/PatientContext";
import { useSettings } from "@/context/SettingsContext";
import { useToast } from "@/hooks/use-toast";
import { prepareAvatarJpegBlob } from "@/lib/avatarImage";
import { Camera, Copy, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const AVATAR_PATH = (uid: string) => `avatars/${uid}/profile.jpg`;

export default function AccountSettingsSection() {
  const { profile, updateProfile, refresh, uid } = usePatient();
  const { t, language } = useSettings();
  const { toast } = useToast();
  const isTr = language === "tr";
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [nicknameDraft, setNicknameDraft] = useState(profile.nickname ?? "");
  const [nicknameSaving, setNicknameSaving] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [checkState, setCheckState] = useState<"idle" | "checking" | "taken" | "ok" | "invalid">(
    "idle"
  );
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setNicknameDraft(profile.nickname ?? "");
  }, [profile.nickname]);

  const runNicknameCheck = useCallback(
    async (value: string) => {
      if (!value.trim()) {
        setCheckState("idle");
        return;
      }
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;
      setCheckState("checking");
      try {
        const q = encodeURIComponent(value.trim());
        const res = await fetch(`/api/profile/nickname-check?n=${q}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          setCheckState("invalid");
          return;
        }
        const data = (await res.json()) as { available?: boolean; reason?: string };
        if (data.reason && data.reason !== "empty") {
          setCheckState("invalid");
          return;
        }
        setCheckState(data.available ? "ok" : "taken");
      } catch {
        setCheckState("idle");
      }
    },
    []
  );

  useEffect(() => {
    if (checkTimer.current) clearTimeout(checkTimer.current);
    const v = nicknameDraft.trim();
    if (!v) {
      setCheckState("idle");
      return;
    }
    if (v === (profile.nickname ?? "").trim()) {
      setCheckState("ok");
      return;
    }
    checkTimer.current = setTimeout(() => void runNicknameCheck(nicknameDraft), 450);
    return () => {
      if (checkTimer.current) clearTimeout(checkTimer.current);
    };
  }, [nicknameDraft, profile.nickname, runNicknameCheck]);

  const saveNickname = async () => {
    const token = await auth.currentUser?.getIdToken();
    if (!token) {
      toast({ title: isTr ? "Oturum gerekli" : "Sign in required", variant: "destructive" });
      return;
    }
    setNicknameSaving(true);
    try {
      const body =
        !nicknameDraft.trim() ? { nickname: null } : { nickname: nicknameDraft.trim() };
      const res = await fetch("/api/profile/nickname", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      if (res.status === 409) {
        toast({
          title: t("nickname_taken"),
          variant: "destructive",
        });
        setCheckState("taken");
        return;
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        const code = (j as { code?: string }).code;
        let desc = isTr ? "Geçersiz takma ad." : "Invalid nickname.";
        if (code === "too_short") desc = t("nickname_too_short");
        if (code === "too_long") desc = t("nickname_too_long");
        if (code === "invalid_key") desc = t("nickname_invalid");
        toast({ title: desc, variant: "destructive" });
        return;
      }
      await refresh();
      toast({ title: isTr ? "Takma ad kaydedildi" : "Nickname saved" });
      setCheckState("ok");
    } finally {
      setNicknameSaving(false);
    }
  };

  const onPickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const user = auth.currentUser;
    if (!user?.uid) {
      toast({ title: isTr ? "Oturum gerekli" : "Sign in required", variant: "destructive" });
      return;
    }
    const storageUid = user.uid;
    if (uid && uid !== storageUid) {
      toast({ title: isTr ? "Oturum senkronu bekleyin" : "Please wait for account to sync", variant: "destructive" });
      return;
    }

    if (!file.type.startsWith("image/") && !/\.(jpe?g|png|gif|webp|heic|heif)$/i.test(file.name)) {
      toast({ title: t("photo_error"), variant: "destructive" });
      return;
    }
    if (file.size > 40 * 1024 * 1024) {
      toast({
        title: isTr ? "Dosya çok büyük (40 MB üstü)." : "File is too large (over 40 MB).",
        variant: "destructive",
      });
      return;
    }

    setAvatarBusy(true);
    try {
      await user.getIdToken(true);
      const blob = await prepareAvatarJpegBlob(file);
      const ref = storageRef(storage, AVATAR_PATH(storageUid));
      await uploadBytes(ref, blob, {
        contentType: "image/jpeg",
        cacheControl: "public,max-age=3600",
      });
      const url = await getDownloadURL(ref);
      await updateProfile({ avatarUrl: url });
      await refresh();
      toast({
        title: isTr ? "Fotoğraf güncellendi (gerekirse küçültüldü)." : "Photo updated (resized if needed).",
      });
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : String(err);
      const code = (err as { code?: string })?.code;
      if (code === "storage/unauthorized" || msg.includes("storage/unauthorized")) {
        toast({
          title: isTr
            ? "Depolama izni yok. Firebase Console’da Storage kurallarını yayınlayın (avatars/*)."
            : "Storage denied. Deploy storage.rules to Firebase (avatars path). See firebase.json.",
          variant: "destructive",
        });
        return;
      }
      if (code === "storage/request-too-large" || msg.includes("too large")) {
        toast({
          title: t("photo_too_large"),
          variant: "destructive",
        });
        return;
      }
      if ((err as Error)?.message === "NOT_IMAGE") {
        toast({ title: t("photo_error"), variant: "destructive" });
        return;
      }
      toast({ title: t("photo_error"), variant: "destructive" });
    } finally {
      setAvatarBusy(false);
    }
  };

  const removePhoto = async () => {
    const storageUid = auth.currentUser?.uid ?? uid;
    if (!storageUid || !profile.avatarUrl) {
      await updateProfile({ avatarUrl: null });
      await refresh();
      return;
    }
    setAvatarBusy(true);
    try {
      await auth.currentUser?.getIdToken(true);
      try {
        await deleteObject(storageRef(storage, AVATAR_PATH(storageUid)));
      } catch {
        /* ignore missing file */
      }
      await updateProfile({ avatarUrl: null });
      await refresh();
      toast({ title: isTr ? "Fotoğraf kaldırıldı" : "Photo removed" });
    } finally {
      setAvatarBusy(false);
    }
  };

  const copyUid = async () => {
    if (!uid) return;
    try {
      await navigator.clipboard.writeText(uid);
      toast({ title: t("copied") });
    } catch {
      toast({ title: isTr ? "Kopyalanamadı" : "Could not copy", variant: "destructive" });
    }
  };

  const email = auth.currentUser?.email ?? "";
  const displayInitial =
    (profile.nickname?.[0] || email?.[0] || "?").toUpperCase();

  return (
    <div className="space-y-6">
      {/* Avatar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="relative shrink-0">
          {profile.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatarUrl}
              alt=""
              className="w-20 h-20 rounded-full object-cover border border-white/10"
            />
          ) : (
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-xl font-bold border border-white/10"
              style={{ background: "rgba(0,212,255,0.12)", color: "#00d4ff" }}
            >
              {displayInitial}
            </div>
          )}
          {avatarBusy && (
            <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-white" />
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={onPickPhoto}
          />
          <button
            type="button"
            disabled={avatarBusy || !uid}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={{
              background: "rgba(0,212,255,0.12)",
              border: "1px solid rgba(0,212,255,0.25)",
              color: "#00d4ff",
            }}
          >
            <Camera size={16} />
            {t("change_photo")}
          </button>
          {(profile.avatarUrl || avatarBusy) && (
            <button
              type="button"
              disabled={avatarBusy}
              onClick={() => void removePhoto()}
              className="px-4 py-2 rounded-xl text-sm text-[#7a8aa0] hover:text-[#ff4466] transition-colors"
            >
              {t("remove_photo")}
            </button>
          )}
        </div>
      </div>
      <p className="text-xs" style={{ color: "#7a8aa0" }}>
        {t("profile_photo")}
      </p>

      {/* Nickname */}
      <div className="space-y-2">
        <label className="text-sm font-medium" style={{ color: "#e8edf5" }}>
          {t("nickname")}
        </label>
        <input
          type="text"
          value={nicknameDraft}
          onChange={(e) => setNicknameDraft(e.target.value)}
          maxLength={32}
          className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "#e8edf5",
          }}
          placeholder={isTr ? "ör. Ayşe_K" : "e.g. Alex_M"}
          autoComplete="nickname"
        />
        <div className="flex flex-wrap items-center gap-2 min-h-[22px]">
          {checkState === "checking" && (
            <span className="text-xs text-[#7a8aa0] flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              {t("nickname_checking")}
            </span>
          )}
          {checkState === "taken" && (
            <span className="text-xs text-[#ff4466]">{t("nickname_taken")}</span>
          )}
          {checkState === "invalid" && (
            <span className="text-xs text-[#ff4466]">{t("nickname_invalid")}</span>
          )}
          {checkState === "ok" && nicknameDraft.trim() && nicknameDraft.trim() !== (profile.nickname ?? "").trim() && (
            <span className="text-xs text-[#00ff88]">
              {isTr ? "Kullanılabilir" : "Available"}
            </span>
          )}
        </div>
        <p className="text-xs" style={{ color: "#7a8aa0" }}>
          {t("nickname_hint")}
        </p>
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            disabled={
              nicknameSaving ||
              checkState === "taken" ||
              checkState === "invalid" ||
              checkState === "checking" ||
              (nicknameDraft.trim() || null) === (profile.nickname?.trim() || null)
            }
            onClick={() => void saveNickname()}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-semibold transition-all",
              "disabled:opacity-40 disabled:cursor-not-allowed"
            )}
            style={{
              background: "linear-gradient(135deg, #00d4ff, #0099cc)",
              color: "#001a2e",
            }}
          >
            {nicknameSaving ? t("saving") : t("nickname_save")}
          </button>
          {profile.nickname && (
            <button
              type="button"
              disabled={nicknameSaving}
              onClick={() => {
                setNicknameDraft("");
                void (async () => {
                  const token = await auth.currentUser?.getIdToken();
                  if (!token) return;
                  setNicknameSaving(true);
                  try {
                    const res = await fetch("/api/profile/nickname", {
                      method: "PATCH",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                      },
                      body: JSON.stringify({ nickname: null }),
                    });
                    if (!res.ok) {
                      toast({
                        title: isTr ? "Kaldırılamadı" : "Could not remove nickname",
                        variant: "destructive",
                      });
                      return;
                    }
                    await refresh();
                    setCheckState("idle");
                    toast({ title: isTr ? "Takma ad kaldırıldı" : "Nickname cleared" });
                  } finally {
                    setNicknameSaving(false);
                  }
                })();
              }}
              className="px-4 py-2 rounded-xl text-sm text-[#7a8aa0] hover:text-[#e8edf5]"
            >
              {t("nickname_clear")}
            </button>
          )}
        </div>
      </div>

      {/* Email + UID */}
      <div
        className="rounded-xl p-4 space-y-3"
        style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        <div>
          <p className="text-[10px] font-mono uppercase mb-1" style={{ color: "#7a8aa0" }}>
            {t("account_email")}
          </p>
          <p className="text-sm truncate" style={{ color: "#e8edf5" }}>
            {email || "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-mono uppercase mb-1" style={{ color: "#7a8aa0" }}>
            {t("user_id_label")}
          </p>
          <div className="flex items-center gap-2">
            <code className="text-[11px] font-mono truncate flex-1" style={{ color: "#7a8aa0" }}>
              {uid ?? "—"}
            </code>
            <button
              type="button"
              onClick={() => void copyUid()}
              className="p-2 rounded-lg shrink-0 hover:bg-white/5"
              style={{ color: "#00d4ff" }}
              title={t("copy_user_id")}
            >
              <Copy size={16} />
            </button>
          </div>
          <p className="text-[10px] mt-1" style={{ color: "#5a6a7a" }}>
            {t("copy_user_id")}
          </p>
        </div>
      </div>
    </div>
  );
}
