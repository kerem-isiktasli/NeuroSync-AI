"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

type Language = 'en' | 'tr';
type Theme = 'dark' | 'light';

interface SettingsContextType {
  language: Language;
  theme: Theme;
  setLanguage: (lang: Language) => void;
  toggleTheme: () => void;
  preferences: {
    marketingEmails: boolean;
    criticalAlerts: boolean;
  };
  togglePreference: (key: 'marketingEmails' | 'criticalAlerts') => void;
  t: (key: string) => string;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const translations = {
  en: {
    "dashboard": "Dashboard",
    "new_chat": "New Analysis",
    "new_analysis": "New Analysis",
    "patient_records": "My Reports",
    "my_reports": "My Reports",
    "subscription": "Subscription",
    "settings": "Settings",
    "support": "Support",
    "credits": "Credits",
    "upload_credits": "Upload Credits",
    "ai_queries": "AI Queries",
    "neural_chamber": "Neural Chamber",
    "input_stream": "Input Stream",
    "analysis_log": "Analysis Log",
    "medical_assistant": "Medical Assistant",
    "powered_by": "Powered by VITA-3 Engine",
    "ask_question": "Ask a question about the diagnosis...",
    "scan_received": "Scan received. Analyzing for neural anomalies...",
    "welcome": "Welcome",
    "language": "Language",
    "theme": "Theme",
    "marketing_emails": "Marketing Emails",
    "critical_alerts": "Critical Alerts",
    "purchase_history": "Purchase History",
    "manage_payments": "Manage Payments",
    "next_billing": "Next Billing Date",
    "current_plan": "Current Plan",
    "upgrade": "Upgrade",
    "buy_credits": "Buy credits",
    "logout": "Logout",
    "manage_plan": "Manage Plan",
    "switch_plan": "Switch Plan",
    "active": "Active",
    "contact_support": "Contact Support",
    "recent_patients": "Recent Reports",
    "recent_reports": "Your recent report analyses",
    "coming_soon": "Coming Soon",
    "diagnostic_hub": "Diagnostic Hub",
    "upload_medical_scan": "Upload Medical Scan",
    "drag_drop_dicom": "Drag & drop DICOM, MRI, or CT scans here.",
    "select_file": "Select File",
    "analyzing_anatomy": "Analyzing Anatomy...",
    "scan_complete": "Scan Complete",
    "scan_success_message": "VITA-3 has successfully analyzed the scan. The holographic model has been updated with findings.",
    "upload_new_scan": "Upload New Scan",
    "analysis_failed": "Analysis Failed",
    "retry_analysis": "Retry Analysis",
    "supports_formats": "Supports .dcm, .jpg, .png (Max 50MB)",
    "uploading_scan": "UPLOADING SCAN...",
    "encrypting_transmitting": "Encrypting & Transmitting to VITA-3 Core",
    "awaiting_clinical_data": "AWAITING CLINICAL DATA",
    "upload_prompt": "Upload a DICOM/NIfTI scan to initiate VITA-3 neural analysis pipeline.",
    "system_logs": "SYSTEM LOGS",
    "synthesizing_intelligence": "Synthesizing Intelligence...",
    "pro_plan": "Pro",
    "vita_3_online": "VITA-3 ONLINE",
    "preprocessing": "Preprocessing",
    "ai_inference": "AI Inference",
    "rendering": "Rendering",
    "verifying_neural_link": "VERIFYING NEURAL LINK...",
    "general": "General",
    "notifications": "Notifications",
    "marketing_emails_desc": "Receive updates about new features and promotions.",
    "critical_alerts_desc": "Get notified about urgent system updates.",
    "need_assistance": "Need Assistance?",
    "create_ticket_desc": "Create a support ticket and our team will respond within 24 hours.",
    "open_ticket": "Open Support Ticket",
    "live_chat": "Live Chat",
    "available_24_7": "Available 24/7",
    "phone_support": "Phone Support",
    "faq": "Frequently Asked Questions",
    "search_patients": "Search reports...",
    "search_reports": "Search reports...",
    "filter": "Filter",
    "new_patient": "New Report",
    "report_id": "Report",
    "patient_id": "ID",
    "patient_name": "Scan / Report",
    "patient_age": "Date",
    "patient_diagnosis": "Summary",
    "last_scan": "Date",
    "patient_status": "Status",
    "report_date": "Date",
    "report_summary": "Summary",
    "no_reports_yet": "No reports yet",
    "no_reports_desc": "Upload a medical scan from the Dashboard to see your first analysis here.",
    "insufficient_credits": "Insufficient credits!",
    "uploaded": "Uploaded",
    "ai_intro": "Hello. I'm your RapiMed assistant. I can help you understand your medical scans, interpret report findings, or answer questions about your analyses.",
    "ai_response_sim": "I've reviewed your question. Based on your report, I'd recommend discussing the findings with your doctor for next steps.",
    "analysis_log_1": "L1-L2 disk narrowing observed",
    "analysis_log_2": "Neural activity within normal limits",
    "analysis_log_3": "Contrast enhancement in parietal lobe detected",
    "analysis_log_4": "No acute hemorrhage or infarction",
    "analysis_log_5": "Ventricles are normal in size and configuration",
    "features_basic_analysis": "Basic Analysis (5/mo)",
    "features_standard_support": "Standard Support",
    "features_community_access": "Community Access",
    "features_unlimited_analysis": "Unlimited Analysis",
    "features_priority_support": "Priority Support",
    "features_advanced_3d": "Advanced 3D Models",
    "features_api_access": "API Access",
    "features_custom_solutions": "Custom Solutions",
    "features_dedicated_manager": "Dedicated Manager",
    "features_sla": "SLA",
    "features_on_premise": "On-premise Deployment",
    "plan_free": "Free",
    "plan_pro": "Pro",
    "plan_enterprise": "Enterprise",
    "select_language": "Select your preferred interface language.",
    "toggle_theme": "Toggle between Light and Dark mode.",
    "heart_rate": "Heart Rate",
    "bpm": "BPM",
    "neural_load": "Neural Load",
    "normal": "Normal",
    "stress_level": "Stress Level",
    "low": "Low",
    "system": "System",
    "ready": "Ready",
    "status_stable": "Stable",
    "status_critical": "Critical",
    "status_recovering": "Recovering",
    "neural_fatigue": "Neural Fatigue",
    "cerebral_arrhythmia": "Cerebral Arrhythmia",
    "synaptic_delay": "Synaptic Delay",
    "motor_cortex_stress": "Motor Cortex Stress",
    "visual_cortex_noise": "Visual Cortex Noise",
    "security_alerts_desc": "Get notified about security and account alerts.",
    "paid": "Paid",
    "faq_1_q": "How do I understand the findings in my report?",
    "faq_1_a": "Each analysis includes a summary in plain language. You can also ask follow-up questions in the New Analysis section. We recommend discussing any findings with your doctor.",
    "faq_2_q": "Can I download or share my report analysis?",
    "faq_2_a": "Yes. From the report view you can export a PDF. Use it to share with your care team or keep for your records.",
    "faq_3_q": "Is my data secure and HIPAA compliant?",
    "faq_3_a": "Yes. RapiMed uses end-to-end encryption and is designed to meet HIPAA, GDPR, and other medical data standards.",
    "date": "Date",
    "item": "Item",
    "amount": "Amount",
    "status": "Status",
    "ago_2_hours": "2 hours ago",
    "ago_1_day": "1 day ago",
    "ago_3_days": "3 days ago",
    "ago_1_week": "1 week ago",
    "ago_2_weeks": "2 weeks ago",
    "primary_findings": "Primary Findings",
    "clinical_narrative": "Clinical Narrative",
    "action_plan": "Action Plan",
    "export_report": "EXPORT REPORT",
    "export_unavailable": "EXPORT UNAVAILABLE",
    "generating_pdf": "Generating PDF...",
    "diagnostic_report": "DIAGNOSTIC REPORT",
    "severity": "Severity",
    "region": "Region",
    "confidence": "Confidence",
    "severity_low": "Low",
    "severity_medium": "Medium",
    "severity_high": "High",
    "severity_critical": "Critical",
    "details": "Details",
    "references": "References",
    "view_pdf": "View PDF"
  },
  tr: {
    "dashboard": "Panel",
    "new_chat": "Yeni Analiz",
    "new_analysis": "Yeni Analiz",
    "patient_records": "Raporlarım",
    "my_reports": "Raporlarım",
    "subscription": "Abonelik",
    "settings": "Ayarlar",
    "support": "Destek",
    "credits": "Krediler",
    "upload_credits": "Yükleme Hakkı",
    "ai_queries": "AI Sorguları",
    "neural_chamber": "Nöral Odası",
    "input_stream": "Giriş Akışı",
    "analysis_log": "Analiz Günlüğü",
    "medical_assistant": "Medikal Asistan",
    "powered_by": "VITA-3 Motoru Tarafından Desteklenmektedir",
    "ask_question": "Teşhis hakkında bir soru sorun...",
    "scan_received": "Tarama alındı. Nöral anomaliler analiz ediliyor...",
    "welcome": "Hoşgeldiniz",
    "language": "Dil",
    "theme": "Tema",
    "marketing_emails": "Pazarlama E-postaları",
    "critical_alerts": "Kritik Uyarılar",
    "purchase_history": "Satın Alım Geçmişi",
    "manage_payments": "Ödemeleri Yönet",
    "next_billing": "Sonraki Fatura Tarihi",
    "current_plan": "Mevcut Plan",
    "upgrade": "Yükselt",
    "buy_credits": "Kredi satın al",
    "logout": "Çıkış Yap",
    "manage_plan": "Planı Yönet",
    "switch_plan": "Plan Değiştir",
    "active": "Aktif",
    "contact_support": "Destek İle İletişime Geç",
    "recent_patients": "Son Raporlar",
    "recent_reports": "Son analizleriniz",
    "coming_soon": "Çok Yakında",
    "diagnostic_hub": "Teşhis Merkezi",
    "upload_medical_scan": "Medikal Tarama Yükle",
    "drag_drop_dicom": "DICOM, MRI veya CT taramalarını buraya sürükleyin.",
    "select_file": "Dosya Seç",
    "analyzing_anatomy": "Anatomi Analiz Ediliyor...",
    "scan_complete": "Tarama Tamamlandı",
    "scan_success_message": "VITA-3 taramayı başarıyla analiz etti. Holografik model bulgularla güncellendi.",
    "upload_new_scan": "Yeni Tarama Yükle",
    "analysis_failed": "Analiz Başarısız",
    "retry_analysis": "Tekrar Dene",
    "supports_formats": ".dcm, .jpg, .png (Maks 50MB) destekler",
    "uploading_scan": "TARAMA YÜKLENİYOR...",
    "encrypting_transmitting": "Şifreleniyor & VITA-3 Çekirdeğine İletiliyor",
    "awaiting_clinical_data": "KLİNİK VERİ BEKLENİYOR",
    "upload_prompt": "VITA-3 nöral analiz hattını başlatmak için bir DICOM/NIfTI taraması yükleyin.",
    "system_logs": "SİSTEM GÜNLÜKLERİ",
    "synthesizing_intelligence": "Zeka Sentezleniyor...",
    "pro_plan": "Pro",
    "vita_3_online": "VITA-3 ÇEVRİMİÇİ",
    "preprocessing": "Ön İşleme",
    "ai_inference": "Yapay Zeka Çıkarımı",
    "rendering": "Oluşturuluyor",
    "verifying_neural_link": "NÖRAL BAĞLANTI DOĞRULANIYOR...",
    "general": "Genel",
    "notifications": "Bildirimler",
    "marketing_emails_desc": "Yeni özellikler ve promosyonlar hakkında güncellemeler alın.",
    "critical_alerts_desc": "Acil sistem güncellemeleri hakkında bildirim alın.",
    "need_assistance": "Yardıma mı ihtiyacınız var?",
    "create_ticket_desc": "Bir destek talebi oluşturun, ekibimiz 24 saat içinde yanıtlayacaktır.",
    "open_ticket": "Destek Talebi Oluştur",
    "live_chat": "Canlı Sohbet",
    "available_24_7": "7/24 Müsait",
    "phone_support": "Telefon Desteği",
    "faq": "Sıkça Sorulan Sorular",
    "search_patients": "Rapor ara...",
    "search_reports": "Rapor ara...",
    "filter": "Filtrele",
    "new_patient": "Yeni Rapor",
    "report_id": "Rapor",
    "patient_id": "ID",
    "patient_name": "Tarama / Rapor",
    "patient_age": "Tarih",
    "patient_diagnosis": "Özet",
    "last_scan": "Tarih",
    "patient_status": "Durum",
    "report_date": "Tarih",
    "report_summary": "Özet",
    "no_reports_yet": "Henüz rapor yok",
    "no_reports_desc": "İlk analizinizi görmek için panelden bir medikal tarama yükleyin.",
    "insufficient_credits": "Yetersiz kredi!",
    "uploaded": "Yüklendi",
    "ai_intro": "Merhaba. RapiMed asistanınızım. Medikal taramalarınızı anlamanıza, rapor bulgularını yorumlamanıza veya analizleriniz hakkında sorularınızı yanıtlamanıza yardımcı olabilirim.",
    "ai_response_sim": "Sorunuzu inceledim. Raporunuza göre sonraki adımlar için doktorunuzla görüşmenizi öneririm.",
    "analysis_log_1": "L1-L2 disk mesafesinde daralma gözlendi",
    "analysis_log_2": "Nöral aktivite normal sınırlarda",
    "analysis_log_3": "Parietal lobda kontrast artışı tespit edildi",
    "analysis_log_4": "Akut kanama veya enfarktüs yok",
    "analysis_log_5": "Ventriküller normal boyut ve konfigürasyonda",
    "features_basic_analysis": "Temel Analiz (5/ay)",
    "features_standard_support": "Standart Destek",
    "features_community_access": "Topluluk Erişimi",
    "features_unlimited_analysis": "Sınırsız Analiz",
    "features_priority_support": "Öncelikli Destek",
    "features_advanced_3d": "Gelişmiş 3D Modeller",
    "features_api_access": "API Erişimi",
    "features_custom_solutions": "Özel Çözümler",
    "features_dedicated_manager": "Özel Yönetici",
    "features_sla": "SLA",
    "features_on_premise": "Yerinde Kurulum",
    "plan_free": "Ücretsiz",
    "plan_pro": "Pro",
    "plan_enterprise": "Kurumsal",
    "select_language": "Tercih ettiğiniz arayüz dilini seçin.",
    "toggle_theme": "Aydınlık ve Karanlık mod arasında geçiş yapın.",
    "heart_rate": "Kalp Atış Hızı",
    "bpm": "BPM",
    "neural_load": "Nöral Yük",
    "normal": "Normal",
    "stress_level": "Stres Seviyesi",
    "low": "Düşük",
    "system": "Sistem",
    "ready": "Hazır",
    "status_stable": "Stabil",
    "status_critical": "Kritik",
    "status_recovering": "İyileşiyor",
    "neural_fatigue": "Nöral Yorgunluk",
    "cerebral_arrhythmia": "Serebral Aritmi",
    "synaptic_delay": "Sinaptik Gecikme",
    "motor_cortex_stress": "Motor Korteks Stresi",
    "visual_cortex_noise": "Görsel Korteks Gürültüsü",
    "security_alerts_desc": "Güvenlik ve hesap uyarıları hakkında bildirim alın.",
    "paid": "Ödendi",
    "faq_1_q": "Raporumdaki bulguları nasıl anlayabilirim?",
    "faq_1_a": "Her analiz özeti sade bir dille sunulur. Yeni Analiz bölümünden takip soruları da sorabilirsiniz. Bulguları doktorunuzla görüşmenizi öneririz.",
    "faq_2_q": "Rapor analizimi indirebilir veya paylaşabilir miyim?",
    "faq_2_a": "Evet. Rapor görünümünden PDF olarak dışa aktarabilirsiniz. Bakım ekibinizle paylaşmak veya arşivlemek için kullanabilirsiniz.",
    "faq_3_q": "Verilerim güvende ve HIPAA uyumlu mu?",
    "faq_3_a": "Evet. RapiMed uçtan uca şifreleme kullanır ve HIPAA, GDPR ve diğer tıbbi veri standartlarına uygun olacak şekilde tasarlanmıştır.",
    "date": "Tarih",
    "item": "Öğe",
    "amount": "Tutar",
    "status": "Durum",
    "ago_2_hours": "2 saat önce",
    "ago_1_day": "1 gün önce",
    "ago_3_days": "3 gün önce",
    "ago_1_week": "1 hafta önce",
    "ago_2_weeks": "2 hafta önce",
    "primary_findings": "Birincil Bulgular",
    "clinical_narrative": "Klinik Öykü",
    "action_plan": "Eylem Planı",
    "export_report": "RAPORU DIŞA AKTAR",
    "export_unavailable": "DIŞA AKTARMA YOK",
    "generating_pdf": "PDF Oluşturuluyor...",
    "diagnostic_report": "TEŞHİS RAPORU",
    "severity": "Şiddet",
    "region": "Bölge",
    "confidence": "Güven",
    "severity_low": "Düşük",
    "severity_medium": "Orta",
    "severity_high": "Yüksek",
    "severity_critical": "Kritik",
    "details": "Detaylar",
    "references": "Referanslar",
    "view_pdf": "PDF Görüntüle"
  }
};

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('en');
  const [theme, setTheme] = useState<Theme>('dark');
  const [preferences, setPreferences] = useState({
    marketingEmails: true,
    criticalAlerts: true
  });

  const applyTheme = useCallback((nextTheme: Theme) => {
    document.documentElement.classList.toggle('dark', nextTheme === 'dark');
    document.documentElement.style.colorScheme = nextTheme;
  }, []);

  useEffect(() => {
    // Load from localStorage if available
    let savedLang: Language | null = null;
    let savedTheme: Theme | null = null;
    let savedPrefs: string | null = null;
    try {
      savedLang = localStorage.getItem('neurosync_lang') as Language;
      savedTheme = localStorage.getItem('neurosync_theme') as Theme;
      savedPrefs = localStorage.getItem('neurosync_prefs');
    } catch {}
    
    if (savedLang) setLanguage(savedLang);
    if (savedTheme === 'dark' || savedTheme === 'light') {
      setTheme(savedTheme);
    } else {
      setTheme('dark');
    }
    
    if (savedPrefs) {
      try {
        setPreferences(JSON.parse(savedPrefs));
      } catch (e) {
        console.error("Failed to parse preferences", e);
      }
    }
  }, [applyTheme]);

  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem('neurosync_theme', theme);
    } catch {}
  }, [applyTheme, theme]);

  useEffect(() => {
    try {
      localStorage.setItem('neurosync_lang', language);
    } catch {}
  }, [language]);

  useEffect(() => {
    try {
      localStorage.setItem('neurosync_prefs', JSON.stringify(preferences));
    } catch {}
  }, [preferences]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const togglePreference = useCallback((key: 'marketingEmails' | 'criticalAlerts') => {
    setPreferences(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const t = useCallback((key: string) => {
    return translations[language][key as keyof typeof translations['en']] || key;
  }, [language]);

  const value = React.useMemo(() => ({
    language,
    theme,
    setLanguage,
    toggleTheme,
    preferences,
    togglePreference,
    t
  }), [language, preferences, t, theme, togglePreference, toggleTheme]);

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
