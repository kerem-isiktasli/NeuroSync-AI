"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Shield, Lock } from "lucide-react";

export type CheckoutAction = "upgrade" | "manage" | "enterprise";

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  planName: string;
  price: string;
  action: CheckoutAction;
}

export default function PricingModal({
  isOpen,
  onClose,
  planName,
  price,
  action,
}: PricingModalProps) {
  const [isRedirecting, setIsRedirecting] = useState(false);

  const handleSecureCheckout = () => {
    setIsRedirecting(true);
    // Interim: No real payment provider wired.
    // When Stripe/Paddle/etc is integrated: window.location.href = checkoutUrl;
    setTimeout(() => {
      setIsRedirecting(false);
      onClose();
    }, 1500);
  };

  if (!isOpen) return null;

  const isEnterprise = action === "enterprise" || planName.toLowerCase() === "enterprise";

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
            <Shield className="w-5 h-5 text-theme-accent" />
            Secure checkout
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
          {isEnterprise ? (
            <>
              <div className="space-y-4">
                <p className="text-theme-text-secondary">
                  Enterprise plans are customized for your organization. Our team will contact you to discuss volume, integrations, and pricing.
                </p>
                <a
                  href="mailto:support@rapimed.com?subject=Enterprise%20inquiry"
                  className="premium-btn w-full py-4 rounded-xl flex items-center justify-center gap-2 text-theme-accent-foreground font-semibold"
                >
                  Contact sales
                </a>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-sm text-theme-text-muted uppercase tracking-wider font-bold">
                    {action === "manage" ? "Billing portal" : "Total due today"}
                  </p>
                  <h2 className="text-3xl font-black text-theme-text-primary">
                    {price} <span className="text-lg font-medium text-theme-text-muted">/mo</span>
                  </h2>
                </div>
                <div className="text-right">
                  <p className="font-bold text-theme-text-primary">{planName}</p>
                  <p className="text-xs text-theme-accent">Billed monthly</p>
                </div>
              </div>

              <div className="rounded-xl bg-theme-surface border border-theme-border p-4 space-y-3">
                <p className="text-sm text-theme-text-secondary">
                  Payment is handled securely by our PCI-compliant provider. You will be redirected to complete your transaction.
                </p>
                <ul className="flex flex-col gap-2 text-xs text-theme-text-muted">
                  <li className="flex items-center gap-2">
                    <Lock size={12} className="shrink-0 text-theme-accent" />
                    Encrypted payment processing
                  </li>
                  <li className="flex items-center gap-2">
                    <Shield size={12} className="shrink-0 text-theme-accent" />
                    Managed billing — no card data stored
                  </li>
                </ul>
              </div>

              <button
                onClick={handleSecureCheckout}
                disabled={isRedirecting}
                className="w-full premium-btn py-4 rounded-xl flex items-center justify-center gap-2 font-semibold disabled:opacity-70"
              >
                {isRedirecting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-theme-accent-foreground/30 border-t-theme-accent-foreground rounded-full animate-spin" />
                    Redirecting…
                  </>
                ) : (
                  <>
                    <Lock size={16} />
                    {action === "manage" ? "Open billing portal" : `Pay ${price} securely`}
                  </>
                )}
              </button>

              <p className="text-center text-xs text-theme-text-muted">
                Payment integration coming soon. Contact support@rapimed.com to upgrade now.
              </p>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
