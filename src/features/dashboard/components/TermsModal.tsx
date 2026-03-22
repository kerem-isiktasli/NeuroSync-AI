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
            <h3 className="text-sm font-bold text-theme-text-primary uppercase tracking-wider mb-3 flex items-center gap-2">
              <FileText size={14} className="text-theme-accent" />
              Terms of Use
            </h3>
            <div className="text-sm text-theme-text-secondary space-y-2.5 leading-relaxed">
              <p>
                RapiMed provides AI-assisted medical image interpretation for{" "}
                <strong className="text-theme-text-primary">informational purposes only</strong>. It does not constitute
                medical advice, diagnosis, or treatment.
              </p>
              <p>
                By using RapiMed, you confirm you are at least 18 years old and agree to use the platform responsibly.
              </p>
              <p>You must consult a licensed healthcare professional before making any medical decision based on AI-generated output.</p>
              <p>
                RapiMed reserves the right to suspend accounts that misuse the platform, share access credentials, or
                attempt to circumvent usage limits.
              </p>
            </div>
          </section>

          {/* Section 2 — Medical Disclaimer */}
          <section>
            <h3 className="text-sm font-bold text-theme-text-primary uppercase tracking-wider mb-3 flex items-center gap-2">
              <Shield size={14} className="text-theme-accent" />
              Medical Disclaimer
            </h3>
            <div className="text-sm text-theme-text-secondary space-y-2.5 leading-relaxed">
              <p>
                AI-generated analysis may be{" "}
                <strong className="text-theme-text-primary">incomplete, inaccurate, or outdated</strong>. No AI system can
                replace clinical judgment.
              </p>
              <p>
                RapiMed is not liable for any harm, injury, or loss arising from reliance on AI output. All reports are
                supplementary tools only.
              </p>
              <p>
                In case of a medical emergency, call your local emergency services immediately. Do not rely on RapiMed for
                emergency guidance.
              </p>
            </div>
          </section>

          {/* Section 3 — Token & Subscription System */}
          <section>
            <h3 className="text-sm font-bold text-theme-text-primary uppercase tracking-wider mb-3 flex items-center gap-2">
              <Database size={14} className="text-theme-accent" />
              Token & Subscription System
            </h3>
            <div className="text-sm text-theme-text-secondary space-y-2.5 leading-relaxed">
              <p>
                RapiMed uses a token-based system with three separate pools: Report tokens (AI report generation), Agent
                tokens (AI chat), and Support tokens (customer support messages).
              </p>
              <p>
                Free plan tokens reset monthly. Purchased add-on token packs do not expire and are non-refundable once
                consumed.
              </p>
              <p>
                RapiMed reserves the right to adjust token allocations with reasonable notice. Enterprise terms are governed
                by a separate agreement.
              </p>
            </div>
          </section>

          {/* Section 4 — Data & Privacy */}
          <section>
            <h3 className="text-sm font-bold text-theme-text-primary uppercase tracking-wider mb-3 flex items-center gap-2">
              <Shield size={14} className="text-theme-accent" />
              Data & Privacy
            </h3>
            <div className="text-sm text-theme-text-secondary space-y-2.5 leading-relaxed">
              <p>
                Uploaded medical images and reports are processed by AI models to generate insights. Your data is encrypted
                in transit and at rest.
              </p>
              <p>
                Your data is never sold to third parties. It is shared only with AI processing providers (Google Vertex AI,
                Anthropic) under strict data processing agreements.
              </p>
              <p>
                When you submit a customer support ticket and consent to data sharing, designated support staff may access
                your reports to assist you. You can revoke this consent at any time by opening a new ticket.
              </p>
              <p>You may request deletion of your account and all associated data by contacting support@rapimed.ai.</p>
            </div>
          </section>

          {/* Section 5 — Support & Customer Service */}
          <section>
            <h3 className="text-sm font-bold text-theme-text-primary uppercase tracking-wider mb-3 flex items-center gap-2">
              <FileText size={14} className="text-theme-accent" />
              Support & Customer Service
            </h3>
            <div className="text-sm text-theme-text-secondary space-y-2.5 leading-relaxed">
              <p>
                Support conversations are logged and may be reviewed for quality assurance. Support staff operate under
                confidentiality agreements and cannot access your medical data without your explicit ticket consent.
              </p>
              <p>
                Response times: Medical support within 24 hours, account issues within 48 hours. Enterprise customers
                receive priority SLA response times.
              </p>
            </div>
          </section>

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
