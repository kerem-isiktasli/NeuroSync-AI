"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { FileText, Shield, Database, Check } from "lucide-react";

interface TermsModalProps {
  onAccept: () => void;
  onLogout?: () => void;
  isAccepting?: boolean;
}

const SCROLL_THRESHOLD = 10;

export default function TermsModal({ onAccept, onLogout, isAccepting = false }: TermsModalProps) {
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [checkboxChecked, setCheckboxChecked] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const atBottom = scrollHeight - scrollTop - clientHeight <= SCROLL_THRESHOLD;
    setHasScrolledToBottom(atBottom);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll);
    return () => el.removeEventListener("scroll", checkScroll);
  }, [checkScroll]);

  const canAccept = hasScrolledToBottom && checkboxChecked;
  const handleAccept = () => {
    if (!canAccept || isAccepting) return;
    onAccept();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-theme-text-primary/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
        className="relative z-10 w-full max-w-2xl max-h-[90vh] flex flex-col bg-theme-bg rounded-3xl shadow-2xl border border-theme-border overflow-hidden"
      >
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-5 border-b border-theme-border bg-theme-surface">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-theme-accent/10 border border-theme-accent/20 flex items-center justify-center">
              <FileText className="w-5 h-5 text-theme-accent" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-theme-text-primary">
                Terms of Use & Medical Disclaimer
              </h2>
              <p className="text-xs text-theme-text-muted">
                Please read and accept to continue using RapiMed.
              </p>
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto overscroll-contain px-6 py-5 space-y-6 min-h-0"
        >
          {/* Section 1 — Terms of Use */}
          <section>
            <h3 className="text-sm font-bold text-theme-text-primary uppercase tracking-wider mb-2 flex items-center gap-2">
              <FileText size={14} className="text-theme-accent" />
              Terms of Use
            </h3>
            <ul className="text-sm text-theme-text-secondary space-y-2 list-disc list-inside">
              <li>RapiMed provides AI-assisted insights for <strong className="text-theme-text-primary">informational purposes only</strong>.</li>
              <li>The platform <strong className="text-theme-text-primary">does not provide medical diagnoses</strong>.</li>
              <li>You must consult licensed healthcare professionals for any medical decisions.</li>
            </ul>
          </section>

          {/* Section 2 — Medical Disclaimer */}
          <section>
            <h3 className="text-sm font-bold text-theme-text-primary uppercase tracking-wider mb-2 flex items-center gap-2">
              <Shield size={14} className="text-theme-accent" />
              Medical Disclaimer
            </h3>
            <ul className="text-sm text-theme-text-secondary space-y-2 list-disc list-inside">
              <li>AI-generated analysis may be <strong className="text-theme-text-primary">incomplete or incorrect</strong>.</li>
              <li>RapiMed is not responsible for decisions made based on AI output.</li>
            </ul>
          </section>

          {/* Section 3 — Data Use */}
          <section>
            <h3 className="text-sm font-bold text-theme-text-primary uppercase tracking-wider mb-2 flex items-center gap-2">
              <Database size={14} className="text-theme-accent" />
              Data Use
            </h3>
            <ul className="text-sm text-theme-text-secondary space-y-2 list-disc list-inside">
              <li>Uploaded reports may be processed by AI models to provide insights.</li>
              <li>Your data remains private and is not shared with third parties except as needed for processing.</li>
            </ul>
          </section>

          {/* Spacer so last content can scroll to bottom */}
          <div className="h-4" />
        </div>

        {/* Footer: checkbox + button */}
        <div className="flex-shrink-0 px-6 py-5 border-t border-theme-border bg-theme-surface space-y-4">
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={checkboxChecked}
              onChange={(e) => setCheckboxChecked(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-theme-border text-theme-accent focus:ring-theme-focus-ring focus:ring-offset-0"
            />
            <span className="text-sm text-theme-text-secondary group-hover:text-theme-text-primary transition-colors">
              I understand and agree to the Terms and Medical Disclaimer.
            </span>
          </label>
          {!hasScrolledToBottom && (
            <p className="text-xs text-theme-warning">
              Please scroll to the bottom of the terms before continuing.
            </p>
          )}
          <button
            type="button"
            onClick={handleAccept}
            disabled={!canAccept || isAccepting}
            className="w-full py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 bg-theme-accent text-theme-accent-foreground hover:bg-theme-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg disabled:shadow-none"
          >
            {isAccepting ? (
              <>
                <span className="w-4 h-4 border-2 border-theme-accent-foreground/30 border-t-theme-accent-foreground rounded-full animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Check size={18} />
                Agree and Continue
              </>
            )}
          </button>
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              disabled={isAccepting}
              className="w-full py-2 text-sm text-theme-text-muted hover:text-theme-text-secondary disabled:opacity-50"
            >
              Log out instead
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
