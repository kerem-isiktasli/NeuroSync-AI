import React, { useState } from 'react';
import { useSettings } from '@/context/SettingsContext';
import { MessageSquare, ChevronDown, ChevronUp, Ticket } from 'lucide-react';
import SupportTicketModal from './SupportTicketModal';
import { AnimatePresence } from 'framer-motion';

export default function SupportView() {
  const { t } = useSettings();
  const [activeFaq, setActiveFaq] = useState<number | null>(0);
  const [modalOpen, setModalOpen] = useState(false);

  const faqs = [
    {
      question: t('faq_1_q'),
      answer: t('faq_1_a')
    },
    {
      question: t('faq_2_q'),
      answer: t('faq_2_a')
    },
    {
      question: t('faq_3_q'),
      answer: t('faq_3_a')
    }
  ];

  return (
    <div className="h-full overflow-y-auto p-6 space-y-8">
      <header>
        <h2 className="text-3xl font-bold text-theme-text-primary">{t('support')}</h2>
        <p className="text-theme-text-secondary">{t('contact_support')}</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Contact / Ticket Section */}
        <div className="luxo-card p-8 flex flex-col items-center justify-center text-center space-y-6 bg-gradient-to-br from-theme-accent/5 to-theme-surface border-theme-accent/20">
          <div className="w-20 h-20 bg-theme-accent/10 rounded-full flex items-center justify-center border border-theme-accent/20">
            <Ticket className="w-10 h-10 text-theme-accent" />
          </div>
          
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-theme-text-primary">{t('need_assistance')}</h3>
            <p className="text-theme-text-secondary max-w-sm mx-auto">
              {t('create_ticket_desc')}
            </p>
          </div>

          <button 
            onClick={() => setModalOpen(true)}
            className="px-8 py-4 bg-theme-accent hover:bg-theme-accent/90 text-theme-accent-foreground font-bold rounded-xl transition-all shadow-lg flex items-center gap-2"
          >
            <MessageSquare size={20} />
            {t('open_ticket')}
          </button>
        </div>

        {/* FAQs & Info */}
        <div className="space-y-6">
          {/* Quick Contact Info - ticket is primary; others coming later */}
          <div className="rounded-2xl border border-theme-border bg-theme-surface p-4 flex items-center gap-4">
            <p className="text-sm text-theme-text-secondary">
              Use <strong className="text-theme-text-primary">Open Support Ticket</strong> above for help. Live chat and phone support are coming soon.
            </p>
          </div>

          {/* FAQs */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-theme-text-primary">{t('faq')}</h3>
            <div className="space-y-2">
              {faqs.map((faq, idx) => (
                <div key={idx} className="bg-theme-surface-elevated border border-theme-border rounded-xl overflow-hidden">
                  <button 
                    onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-theme-surface transition-colors"
                  >
                    <span className="font-medium text-theme-text-primary text-sm">{faq.question}</span>
                    {activeFaq === idx ? <ChevronUp size={16} className="text-theme-text-muted" /> : <ChevronDown size={16} className="text-theme-text-muted" />}
                  </button>
                  {activeFaq === idx && (
                    <div className="px-4 pb-4 pt-0 text-sm text-theme-text-secondary leading-relaxed">
                      {faq.answer}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {modalOpen && (
          <SupportTicketModal 
            isOpen={modalOpen} 
            onClose={() => setModalOpen(false)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
