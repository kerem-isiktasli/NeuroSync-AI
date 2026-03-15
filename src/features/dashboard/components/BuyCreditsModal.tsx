"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { X, Shield, Zap } from "lucide-react";

export const CREDIT_PACKAGES = [
  { id: "small", upload: 10, query: 25, price: "$15", bestValue: false },
  { id: "medium", upload: 30, query: 75, price: "$39", bestValue: true },
  { id: "large", upload: 100, query: 250, price: "$99", bestValue: false },
] as const;

interface BuyCreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPackage?: (pkg: (typeof CREDIT_PACKAGES)[number]) => void;
}

export default function BuyCreditsModal({
  isOpen,
  onClose,
  onSelectPackage,
}: BuyCreditsModalProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleCheckout = () => {
    const pkg = CREDIT_PACKAGES.find((p) => p.id === selectedId);
    if (!pkg) return;
    setIsProcessing(true);
    onSelectPackage?.(pkg);
    setTimeout(() => {
      setIsProcessing(false);
      onClose();
    }, 1000);
  };

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
        className="relative z-10 w-full max-w-lg bg-theme-bg rounded-3xl shadow-2xl border border-theme-border overflow-hidden luxo-card max-h-[90vh] overflow-y-auto"
      >
        <div className="p-6 border-b border-theme-border flex justify-between items-center bg-theme-surface sticky top-0 z-10">
          <h3 className="font-bold text-theme-text-primary flex items-center gap-2">
            <Zap className="w-5 h-5 text-theme-accent" />
            Buy credits
          </h3>
          <button
            onClick={onClose}
            className="text-theme-text-muted hover:text-theme-text-primary transition-colors p-1 rounded-lg"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5 bg-theme-bg">
          <p className="text-sm text-theme-text-secondary">
            Credits are used for scans (upload) and AI questions (query). Choose a package below.
          </p>

          <div className="grid gap-3">
            {CREDIT_PACKAGES.map((pkg) => (
              <button
                key={pkg.id}
                type="button"
                onClick={() => setSelectedId(pkg.id)}
                className={`w-full p-4 rounded-xl border text-left transition-all ${
                  selectedId === pkg.id
                    ? "border-theme-accent bg-theme-accent/10"
                    : "border-theme-border bg-theme-surface hover:border-theme-accent/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-theme-text-primary">
                      {pkg.upload} upload + {pkg.query} query
                    </span>
                    {pkg.bestValue && (
                      <span className="ml-2 text-xs font-bold text-theme-accent uppercase tracking-wider">
                        Best value
                      </span>
                    )}
                  </div>
                  <span className="font-bold text-theme-text-primary">{pkg.price}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="rounded-xl bg-theme-surface border border-theme-border p-4 flex items-start gap-3">
            <Shield className="w-5 h-5 text-theme-accent shrink-0 mt-0.5" />
            <div className="text-sm text-theme-text-secondary">
              <p className="font-medium text-theme-text-primary">Secure checkout</p>
              <p>Payment is encrypted and managed by our PCI-compliant provider. No card data is stored by RapiMed.</p>
            </div>
          </div>

          <button
            onClick={handleCheckout}
            disabled={!selectedId || isProcessing}
            className="w-full premium-btn py-4 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-theme-accent-foreground/30 border-t-theme-accent-foreground rounded-full animate-spin" />
                Processing…
              </span>
            ) : (
              `Continue to secure checkout`
            )}
          </button>

          <p className="text-center text-xs text-theme-text-muted">
            Payment integration coming soon. Contact support@rapimed.com to purchase credits.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
