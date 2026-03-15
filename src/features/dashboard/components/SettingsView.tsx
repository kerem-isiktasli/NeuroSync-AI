"use client";

import React from 'react';
import { useSettings } from '@/context/SettingsContext';
import { useToast } from '@/hooks/use-toast';
import { Moon, Sun, Globe, Shield, Mail } from 'lucide-react';
import { motion } from 'framer-motion';

export default function SettingsView() {
  const { 
    language, setLanguage, 
    theme, toggleTheme, 
    preferences, togglePreference,
    t 
  } = useSettings();
  const { toast } = useToast();

  const handleThemeToggle = () => {
    toggleTheme();
    toast({
      title: theme === 'dark' ? t('theme') + ': Light' : t('theme') + ': Dark',
      description: theme === 'dark' ? 'Switched to light mode.' : 'Switched to dark mode.',
    });
  };

  const handlePreferenceToggle = (key: 'marketingEmails' | 'criticalAlerts') => {
    togglePreference(key);
    toast({
      title: t('settings') + ' saved',
      description: 'Your preferences have been updated.',
    });
  };

  const purchaseHistory = [
    { id: 1, date: '2025-02-01', item: `${t('plan_pro')} (${t('manage_plan')})`, amount: '$29.00', status: t('paid') },
    { id: 2, date: '2025-01-01', item: `${t('plan_pro')} (${t('manage_plan')})`, amount: '$29.00', status: t('paid') },
    { id: 3, date: '2024-12-01', item: `${t('upload_credits')} (50)`, amount: '$15.00', status: t('paid') },
  ];

  return (
    <div className="h-full overflow-y-auto p-6 space-y-8">
      <header className="mb-8">
        <h2 className="text-3xl font-bold text-theme-text-primary">{t('settings')}</h2>
        <p className="text-theme-text-secondary">Language, theme, and notifications.</p>
      </header>

      {/* General Settings */}
      <section className="space-y-4">
        <h3 className="text-sm font-bold text-theme-text-primary uppercase tracking-wider mb-4">{t('general')}</h3>
        
        {/* Language */}
        <div className="rounded-3xl bg-theme-surface-elevated border border-theme-border relative overflow-hidden shadow-sm backdrop-blur-[40px] p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
              <Globe size={20} />
            </div>
            <div>
              <h4 className="font-medium text-theme-text-primary">{t('language')}</h4>
              <p className="text-xs text-theme-text-muted">{t('select_language')}</p>
            </div>
          </div>
          <div className="flex gap-2 bg-theme-surface p-1 rounded-lg">
            <button 
              onClick={() => setLanguage('en')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${language === 'en' ? 'bg-theme-accent text-theme-accent-foreground shadow-lg' : 'text-theme-text-muted hover:text-theme-text-primary'}`}
            >
              EN
            </button>
            <button 
              onClick={() => setLanguage('tr')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${language === 'tr' ? 'bg-theme-accent text-theme-accent-foreground shadow-lg' : 'text-theme-text-muted hover:text-theme-text-primary'}`}
            >
              TR
            </button>
          </div>
        </div>

        {/* Theme */}
        <div className="rounded-3xl bg-theme-surface-elevated border border-theme-border relative overflow-hidden shadow-sm backdrop-blur-[40px] p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500">
              <Moon className="hidden dark:block" size={20} />
              <Sun className="block dark:hidden" size={20} />
            </div>
            <div>
              <h4 className="font-medium text-theme-text-primary">{t('theme')}</h4>
              <p className="text-xs text-theme-text-muted">{t('toggle_theme')}</p>
            </div>
          </div>
          <button 
            onClick={handleThemeToggle}
            aria-label="Toggle Theme"
            className={`w-14 h-7 rounded-full p-1 transition-all duration-500 ${theme === 'light' ? 'bg-theme-accent' : 'bg-theme-text-muted/30'}`}
          >
            <motion.div 
              className="w-5 h-5 rounded-full bg-theme-surface-elevated shadow-md border border-theme-border"
              animate={{ x: theme === 'light' ? 28 : 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          </button>
        </div>
      </section>

      {/* Notifications */}
      <section className="space-y-4">
        <h3 className="text-sm font-bold text-theme-text-primary uppercase tracking-wider mb-4">{t('notifications')}</h3>
        
        <div className="rounded-3xl bg-theme-surface-elevated border border-theme-border relative overflow-hidden shadow-sm backdrop-blur-[40px] p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-theme-accent/10 flex items-center justify-center text-theme-accent">
                <Mail size={20} />
              </div>
              <div>
                <h4 className="font-medium text-theme-text-primary">{t('marketing_emails')}</h4>
                <p className="text-xs text-theme-text-muted">{t('marketing_emails_desc')}</p>
              </div>
            </div>
            <button 
              onClick={() => handlePreferenceToggle('marketingEmails')}
              className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 ${preferences.marketingEmails ? 'bg-theme-accent' : 'bg-theme-text-muted/30'}`}
            >
              <div className={`w-4 h-4 rounded-full bg-theme-surface-elevated border border-theme-border shadow-sm transform transition-transform duration-200 ${preferences.marketingEmails ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
          </div>

          <div className="w-full h-px bg-theme-border"></div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-theme-danger/10 flex items-center justify-center text-theme-danger">
                <Shield size={20} />
              </div>
              <div>
                <h4 className="font-medium text-theme-text-primary">{t('critical_alerts')}</h4>
                <p className="text-xs text-theme-text-muted">{t('security_alerts_desc')}</p>
              </div>
            </div>
            <button 
              onClick={() => handlePreferenceToggle('criticalAlerts')}
              className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 ${preferences.criticalAlerts ? 'bg-theme-accent' : 'bg-theme-text-muted/30'}`}
            >
              <div className={`w-4 h-4 rounded-full bg-theme-surface-elevated border border-theme-border shadow-sm transform transition-transform duration-200 ${preferences.criticalAlerts ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
          </div>
        </div>
      </section>

      {/* Purchase History */}
      <section className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-theme-text-primary uppercase tracking-wider">{t('purchase_history')}</h3>
          <span className="text-[10px] text-theme-text-muted uppercase tracking-wider">Sample data</span>
        </div>
        
        <div className="rounded-3xl bg-theme-surface-elevated border border-theme-border relative overflow-hidden shadow-sm backdrop-blur-[40px]">
          <table className="w-full text-left text-sm">
            <thead className="bg-theme-surface text-theme-text-muted">
              <tr>
                <th className="p-4 font-medium">{t('date')}</th>
                <th className="p-4 font-medium">{t('item')}</th>
                <th className="p-4 font-medium">{t('amount')}</th>
                <th className="p-4 font-medium">{t('status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme-border">
              {purchaseHistory.map((item) => (
                <tr key={item.id} className="hover:bg-theme-surface transition-colors">
                  <td className="p-4 text-theme-text-secondary">{item.date}</td>
                  <td className="p-4 font-medium text-theme-text-primary">{item.item}</td>
                  <td className="p-4 text-theme-text-secondary">{item.amount}</td>
                  <td className="p-4">
                    <span className="px-2 py-1 rounded-full bg-theme-success/10 text-theme-success text-xs border border-theme-success/20">
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
