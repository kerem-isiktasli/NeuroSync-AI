import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, CheckCircle, MessageSquare } from 'lucide-react';

interface SupportTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SupportTicketModal({ isOpen, onClose }: SupportTicketModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [subject, setSubject] = useState('Technical Issue');
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate API call
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSuccess(true);
      setTimeout(() => {
        onClose();
        setIsSuccess(false);
        setMessage(''); // Reset form
        setSubject('Technical Issue');
      }, 2000);
    }, 1500);
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
        className="relative z-10 w-full max-w-lg bg-theme-bg rounded-3xl shadow-2xl border border-theme-border overflow-hidden"
      >
        {isSuccess ? (
          <div className="flex flex-col items-center justify-center p-10 text-center bg-theme-bg">
            <div className="w-16 h-16 bg-theme-accent rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="text-theme-accent-foreground w-8 h-8" />
            </div>
            <h3 className="text-2xl font-bold text-theme-text-primary mb-2">Ticket Submitted!</h3>
            <p className="text-theme-text-muted">We've received your request and will get back to you shortly.</p>
          </div>
        ) : (
          <>
            <div className="p-6 border-b border-theme-border flex justify-between items-center bg-theme-surface">
              <h3 className="font-bold text-theme-text-primary flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-theme-accent" />
                New Support Ticket
              </h3>
              <button onClick={onClose} className="text-theme-text-muted hover:text-theme-text-primary transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6 bg-theme-bg">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-theme-text-muted uppercase tracking-wider">Subject</label>
                  <select 
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full bg-theme-surface border border-theme-border rounded-xl px-4 py-3 text-theme-text-primary focus:outline-none focus:border-theme-focus-ring transition-all appearance-none"
                  >
                    <option value="Technical Issue" className="bg-theme-bg text-theme-text-primary">Technical Issue</option>
                    <option value="Billing Question" className="bg-theme-bg text-theme-text-primary">Billing Question</option>
                    <option value="Feature Request" className="bg-theme-bg text-theme-text-primary">Feature Request</option>
                    <option value="Other" className="bg-theme-bg text-theme-text-primary">Other</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-theme-text-muted uppercase tracking-wider">Message</label>
                  <textarea 
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                    rows={5}
                    placeholder="Describe your issue in detail..."
                    className="w-full bg-theme-surface border border-theme-border rounded-xl px-4 py-3 text-theme-text-primary placeholder:text-theme-text-muted focus:outline-none focus:border-theme-focus-ring transition-all resize-none"
                  />
                </div>
              </div>
              
              <div className="pt-2">
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-theme-accent hover:bg-theme-accent/90 text-theme-accent-foreground font-bold py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send size={16} />
                      Submit Ticket
                    </>
                  )}
                </button>
              </div>
            </form>
          </>
        )}
      </motion.div>
    </div>
  );
}
