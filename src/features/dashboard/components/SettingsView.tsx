"use client";

import React, { useState } from "react";
import { useSettings } from "@/context/SettingsContext";
import { useToast } from "@/hooks/use-toast";
import { Moon, Sun, Globe, Shield, Mail, User, Settings, Bell } from "lucide-react";
import { motion } from "framer-motion";
import ProfileForm from "@/features/intake/ProfileForm";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export default function SettingsView() {
  const {
    language,
    setLanguage,
    theme,
    toggleTheme,
    preferences,
    togglePreference,
    t,
  } = useSettings();
  const { toast } = useToast();

  const handleThemeToggle = () => {
    toggleTheme();
    toast({
      title: theme === "dark" ? t("theme") + ": Light" : t("theme") + ": Dark",
      description:
        theme === "dark" ? "Switched to light mode." : "Switched to dark mode.",
    });
  };

  const handlePreferenceToggle = (key: "marketingEmails" | "criticalAlerts") => {
    togglePreference(key);
    toast({
      title: t("settings") + " saved",
      description: "Your preferences have been updated.",
    });
  };

  const purchaseHistory = [
    {
      id: 1,
      date: "2025-02-01",
      item: `${t("plan_pro")} (${t("manage_plan")})`,
      amount: "$29.00",
      status: t("paid"),
    },
    {
      id: 2,
      date: "2025-01-01",
      item: `${t("plan_pro")} (${t("manage_plan")})`,
      amount: "$29.00",
      status: t("paid"),
    },
    {
      id: 3,
      date: "2024-12-01",
      item: `${t("upload_credits")} (50)`,
      amount: "$15.00",
      status: t("paid"),
    },
  ];

  const isTr = language === "tr";

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ color: "#e8edf5" }}>
      <header className="shrink-0 p-6 pb-4">
        <h2 className="text-2xl font-bold" style={{ color: "#e8edf5" }}>
          {t("settings")}
        </h2>
        <p className="text-sm font-mono mt-0.5" style={{ color: "#7a8aa0" }}>
          {isTr
            ? "Profil, dil, tema ve bildirimler."
            : "Profile, language, theme, and notifications."}
        </p>
      </header>

      <Tabs defaultValue="general" className="flex-1 flex flex-col min-h-0 px-6">
        <TabsList
          className={cn(
            "w-full justify-start gap-1 h-11 rounded-xl p-1 mb-4"
          )}
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <TabsTrigger
            value="general"
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border border-transparent",
              "data-[state=active]:bg-[rgba(0,212,255,0.1)] data-[state=active]:border-[rgba(0,212,255,0.25)] data-[state=active]:text-[#00d4ff]",
              "data-[state=inactive]:text-[#7a8aa0] data-[state=inactive]:hover:text-[#e8edf5]"
            )}
          >
            <Settings size={16} />
            {isTr ? "Genel" : "General"}
          </TabsTrigger>
          <TabsTrigger
            value="medical"
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border border-transparent",
              "data-[state=active]:bg-[rgba(0,212,255,0.1)] data-[state=active]:border-[rgba(0,212,255,0.25)] data-[state=active]:text-[#00d4ff]",
              "data-[state=inactive]:text-[#7a8aa0] data-[state=inactive]:hover:text-[#e8edf5]"
            )}
          >
            <User size={16} />
            {isTr ? "Tıbbi Profil" : "Medical Profile"}
          </TabsTrigger>
          <TabsTrigger
            value="notifications"
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border border-transparent",
              "data-[state=active]:bg-[rgba(0,212,255,0.1)] data-[state=active]:border-[rgba(0,212,255,0.25)] data-[state=active]:text-[#00d4ff]",
              "data-[state=inactive]:text-[#7a8aa0] data-[state=inactive]:hover:text-[#e8edf5]"
            )}
          >
            <Bell size={16} />
            {t("notifications")}
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto pb-8">
          <TabsContent value="general" className="m-0 space-y-4">
            {/* Language */}
            <div
              className="rounded-xl p-4 flex items-center justify-between"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(0,212,255,0.08)", color: "#00d4ff" }}
                >
                  <Globe size={18} />
                </div>
                <div>
                  <h4 className="font-medium text-sm" style={{ color: "#e8edf5" }}>
                    {t("language")}
                  </h4>
                  <p className="text-xs" style={{ color: "#7a8aa0" }}>
                    {t("select_language")}
                  </p>
                </div>
              </div>
              <div
                className="flex gap-1 p-1 rounded-lg"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <button
                  type="button"
                  onClick={() => setLanguage("en")}
                  className={cn("px-3 py-1.5 rounded-md text-sm font-medium transition-all")}
                  style={
                    language === "en"
                      ? { background: "rgba(0,212,255,0.15)", color: "#00d4ff" }
                      : { color: "#7a8aa0" }
                  }
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage("tr")}
                  className={cn("px-3 py-1.5 rounded-md text-sm font-medium transition-all")}
                  style={
                    language === "tr"
                      ? { background: "rgba(0,212,255,0.15)", color: "#00d4ff" }
                      : { color: "#7a8aa0" }
                  }
                >
                  TR
                </button>
              </div>
            </div>

            {/* Theme */}
            <div
              className="rounded-xl p-4 flex items-center justify-between"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(0,212,255,0.08)", color: "#00d4ff" }}
                >
                  <Moon className="hidden dark:block" size={18} />
                  <Sun className="block dark:hidden" size={18} />
                </div>
                <div>
                  <h4 className="font-medium text-sm" style={{ color: "#e8edf5" }}>
                    {t("theme")}
                  </h4>
                  <p className="text-xs" style={{ color: "#7a8aa0" }}>
                    {t("toggle_theme")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleThemeToggle}
                aria-label="Toggle Theme"
                className="w-12 h-6 rounded-full p-1 transition-all duration-500"
                style={
                  theme === "light"
                    ? { background: "rgba(0,212,255,0.3)" }
                    : { background: "rgba(255,255,255,0.08)" }
                }
              >
                <motion.div
                  className="w-4 h-4 rounded-full shadow-md border"
                  style={{ background: "#e8edf5", borderColor: "rgba(255,255,255,0.15)" }}
                  animate={{ x: theme === "light" ? 24 : 0 }}
                  transition={{
                    type: "spring",
                    stiffness: 500,
                    damping: 30,
                  }}
                />
              </button>
            </div>

            {/* Purchase History — compact */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-theme-text-muted uppercase tracking-wider">
                  {t("purchase_history")}
                </h3>
                <span className="text-[10px] text-theme-text-muted uppercase tracking-wider">
                  Sample
                </span>
              </div>
              <div className="rounded-2xl bg-theme-surface-elevated border border-theme-border overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-theme-surface text-theme-text-muted">
                    <tr>
                      <th className="px-3 py-2 font-medium text-xs">
                        {t("date")}
                      </th>
                      <th className="px-3 py-2 font-medium text-xs">
                        {t("item")}
                      </th>
                      <th className="px-3 py-2 font-medium text-xs">
                        {t("amount")}
                      </th>
                      <th className="px-3 py-2 font-medium text-xs">
                        {t("status")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-theme-border">
                    {purchaseHistory.map((item) => (
                      <tr
                        key={item.id}
                        className="hover:bg-theme-surface/50 transition-colors"
                      >
                        <td className="px-3 py-2 text-theme-text-secondary text-xs">
                          {item.date}
                        </td>
                        <td className="px-3 py-2 font-medium text-theme-text-primary text-xs">
                          {item.item}
                        </td>
                        <td className="px-3 py-2 text-theme-text-secondary text-xs">
                          {item.amount}
                        </td>
                        <td className="px-3 py-2">
                          <span className="px-1.5 py-0.5 rounded bg-theme-success/10 text-theme-success text-[10px] border border-theme-success/20">
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="medical" className="m-0">
            <div
              className="rounded-xl p-5"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <p className="text-xs font-mono mb-4" style={{ color: "#7a8aa0" }}>
                {isTr
                  ? "Kayıtlı tıbbi bilgileriniz yükleme öncesi kullanılır ve rapor kalitesini artırır."
                  : "Your saved medical information is used before upload and improves report quality."}
              </p>
              <ProfileForm
                language={(language as "tr" | "en") ?? "en"}
                onSaved={() =>
                  toast({
                    title: isTr ? "Profil kaydedildi" : "Profile saved",
                  })
                }
                compact
              />
            </div>
          </TabsContent>

          <TabsContent value="notifications" className="m-0">
            <div
              className="rounded-xl p-4 space-y-4"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ background: "rgba(0,212,255,0.08)", color: "#00d4ff" }}
                  >
                    <Mail size={18} />
                  </div>
                  <div>
                    <h4 className="font-medium text-sm" style={{ color: "#e8edf5" }}>
                      {t("marketing_emails")}
                    </h4>
                    <p className="text-xs" style={{ color: "#7a8aa0" }}>
                      {t("marketing_emails_desc")}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handlePreferenceToggle("marketingEmails")}
                  className="w-11 h-6 rounded-full p-1 transition-colors duration-200"
                  style={
                    preferences.marketingEmails
                      ? { background: "rgba(0,212,255,0.3)" }
                      : { background: "rgba(255,255,255,0.08)" }
                  }
                >
                  <div
                    className={cn(
                      "w-4 h-4 rounded-full border shadow-sm transform transition-transform duration-200",
                      preferences.marketingEmails ? "translate-x-5" : "translate-x-0"
                    )}
                    style={{ background: "#e8edf5", borderColor: "rgba(255,255,255,0.15)" }}
                  />
                </button>
              </div>

              <div className="w-full h-px" style={{ background: "rgba(255,255,255,0.06)" }} />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ background: "rgba(255,68,102,0.08)", color: "#ff4466" }}
                  >
                    <Shield size={18} />
                  </div>
                  <div>
                    <h4 className="font-medium text-sm" style={{ color: "#e8edf5" }}>
                      {t("critical_alerts")}
                    </h4>
                    <p className="text-xs" style={{ color: "#7a8aa0" }}>
                      {t("security_alerts_desc")}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handlePreferenceToggle("criticalAlerts")}
                  className="w-11 h-6 rounded-full p-1 transition-colors duration-200"
                  style={
                    preferences.criticalAlerts
                      ? { background: "rgba(0,212,255,0.3)" }
                      : { background: "rgba(255,255,255,0.08)" }
                  }
                >
                  <div
                    className={cn(
                      "w-4 h-4 rounded-full border shadow-sm transform transition-transform duration-200",
                      preferences.criticalAlerts ? "translate-x-5" : "translate-x-0"
                    )}
                    style={{ background: "#e8edf5", borderColor: "rgba(255,255,255,0.15)" }}
                  />
                </button>
              </div>
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
