"use client";

import React from "react";
import { motion } from "framer-motion";
import { X, AlertCircle } from "lucide-react";

interface DowngradeConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isConfirming?: boolean;
}

export default function DowngradeConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  isConfirming = false,
}: DowngradeConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-theme-text-primary/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="relative z-10 w-full max-w-md bg-theme-bg rounded-3xl shadow-2xl border border-theme-border overflow-hidden luxo-card"
      >
        <div className="p-6 border-b border-theme-border flex justify-between items-center bg-theme-surface">
          <h3 className="font-bold text-theme-text-primary flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-theme-warning" />
            Downgrade to Free
          </h3>
          <button
            onClick={onClose}
            className="text-theme-text-muted hover:text-theme-text-primary transition-colors p-1 rounded-lg"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6 bg-theme-bg">
          <p className="text-theme-text-secondary">
            Your access will change to the Free plan at the end of your current billing period. No payment is required — you will not be charged again.
          </p>
          <p className="text-sm text-theme-text-muted">
            Until then, you keep all Pro features. After the change, you will have limited analyses and standard support.
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-theme-border bg-theme-surface text-theme-text-primary font-medium hover:bg-theme-surface-elevated transition-colors"
            >
              Keep Pro
            </button>
            <button
              onClick={onConfirm}
              disabled={isConfirming}
              className="flex-1 py-3 rounded-xl bg-theme-accent text-theme-accent-foreground font-semibold hover:bg-theme-accent/90 transition-colors disabled:opacity-70"
            >
              {isConfirming ? "Confirming…" : "Confirm downgrade"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
