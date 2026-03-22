"use client";

import React, { useState, useCallback } from "react";
import { ClipboardList, AlertCircle, Paperclip } from "lucide-react";
import { OptionChipGrid } from "@/components/ui/option-chip";
import { usePatient } from "@/context/PatientContext";
import type {
  AnalysisIntake,
  FileType,
  BodyRegion,
  UploadFormat,
  SymptomDuration,
  SymptomTrend,
  StudyTimeline,
  StudyCompleteness,
  YesNoUnsure,
  OutputPreference,
} from "@/types/intake";

// ─── Option type (for option arrays) ──────────────────────────────────

interface OptDef<T extends string> {
  value: T;
  label: string;
  labelTr: string;
}

// ─── Option data ─────────────────────────────────────────────────────

const FILE_TYPES: OptDef<FileType>[] = [
  { value: "mri", label: "MRI", labelTr: "MRI" },
  { value: "ct", label: "CT Scan", labelTr: "BT" },
  { value: "x-ray", label: "X-Ray", labelTr: "Röntgen" },
  { value: "ultrasound", label: "Ultrasound", labelTr: "Ultrason" },
  { value: "blood-test", label: "Blood Test", labelTr: "Kan Testi" },
  { value: "pathology", label: "Pathology", labelTr: "Patoloji" },
  { value: "doctor-report", label: "Doctor Report", labelTr: "Doktor Raporu" },
  { value: "mixed", label: "Mixed", labelTr: "Karışık" },
  { value: "not-sure", label: "Not Sure", labelTr: "Emin Değilim" },
];

const BODY_REGIONS: OptDef<BodyRegion>[] = [
  { value: "brain", label: "Brain / Head", labelTr: "Beyin / Baş" },
  { value: "c-spine", label: "Cervical Spine", labelTr: "Servikal Omurga" },
  { value: "t-spine", label: "Thoracic Spine", labelTr: "Torasik Omurga" },
  { value: "l-spine", label: "Lumbar Spine", labelTr: "Lomber Omurga" },
  { value: "chest", label: "Chest / Lungs", labelTr: "Göğüs / Akciğer" },
  { value: "abdomen", label: "Abdomen", labelTr: "Karın" },
  { value: "pelvis", label: "Pelvis", labelTr: "Pelvis" },
  { value: "shoulder", label: "Shoulder", labelTr: "Omuz" },
  { value: "elbow", label: "Elbow", labelTr: "Dirsek" },
  { value: "wrist-hand", label: "Wrist / Hand", labelTr: "Bilek / El" },
  { value: "hip", label: "Hip", labelTr: "Kalça" },
  { value: "knee", label: "Knee", labelTr: "Diz" },
  { value: "ankle-foot", label: "Ankle / Foot", labelTr: "Ayak Bileği / Ayak" },
  { value: "whole-body", label: "Whole Body", labelTr: "Tüm Vücut" },
  { value: "other", label: "Other", labelTr: "Diğer" },
];

const UPLOAD_FORMATS: OptDef<UploadFormat>[] = [
  { value: "dicom", label: "DICOM Files", labelTr: "DICOM Dosyaları" },
  { value: "screenshots", label: "Screenshots", labelTr: "Ekran Görüntüleri" },
  { value: "pdf-report", label: "PDF Report", labelTr: "PDF Rapor" },
  { value: "images-and-report", label: "Images + Report", labelTr: "Görüntü + Rapor" },
  { value: "mixed", label: "Mixed", labelTr: "Karışık" },
  { value: "not-sure", label: "Not Sure", labelTr: "Emin Değilim" },
];

const DURATIONS: OptDef<SymptomDuration>[] = [
  { value: "today", label: "Today", labelTr: "Bugün" },
  { value: "days", label: "Days", labelTr: "Günler" },
  { value: "weeks", label: "Weeks", labelTr: "Haftalar" },
  { value: "months", label: "Months", labelTr: "Aylar" },
  { value: "chronic", label: "Chronic", labelTr: "Kronik" },
];

const TRENDS: OptDef<SymptomTrend>[] = [
  { value: "worse", label: "Worse", labelTr: "Kötüleşiyor" },
  { value: "better", label: "Better", labelTr: "İyileşiyor" },
  { value: "same", label: "Same", labelTr: "Aynı" },
  { value: "not-sure", label: "Not Sure", labelTr: "Emin Değilim" },
];

const TIMELINES: OptDef<StudyTimeline>[] = [
  { value: "first", label: "First", labelTr: "İlk" },
  { value: "follow-up", label: "Follow-up", labelTr: "Takip" },
  { value: "not-sure", label: "Not Sure", labelTr: "Emin Değilim" },
];

const COMPLETENESS: OptDef<StudyCompleteness>[] = [
  { value: "full-study", label: "Full Study", labelTr: "Tam Çalışma" },
  { value: "selected-images", label: "Selected Images", labelTr: "Seçilmiş Görüntüler" },
  { value: "not-sure", label: "Not Sure", labelTr: "Emin Değilim" },
];

const YES_NO_UNSURE: OptDef<YesNoUnsure>[] = [
  { value: "yes", label: "Yes", labelTr: "Evet" },
  { value: "no", label: "No", labelTr: "Hayır" },
  { value: "not-sure", label: "Not Sure", labelTr: "Emin Değilim" },
];

const OUTPUT_PREFS: OptDef<OutputPreference>[] = [
  { value: "simple-explanation", label: "Simple Explanation", labelTr: "Basit Açıklama" },
  { value: "findings-summary", label: "Findings Summary", labelTr: "Bulgular Özeti" },
  { value: "comparison", label: "Comparison", labelTr: "Karşılaştırma" },
  { value: "possible-meaning", label: "Possible Meaning", labelTr: "Olası Anlam" },
  { value: "doctor-questions", label: "Doctor Questions", labelTr: "Doktora Sorular" },
];

// ─── Conditional option data ─────────────────────────────────────────

const BRAIN_SYMPTOM_CHIPS = [
  { value: "headache", label: "Headache", labelTr: "Baş Ağrısı" },
  { value: "dizziness", label: "Dizziness", labelTr: "Baş Dönmesi" },
  { value: "seizure", label: "Seizure", labelTr: "Nöbet" },
  { value: "weakness", label: "Weakness", labelTr: "Güçsüzlük" },
  { value: "numbness", label: "Numbness", labelTr: "Uyuşma" },
  { value: "vision", label: "Vision Changes", labelTr: "Görme Değişikliği" },
  { value: "speech", label: "Speech Difficulty", labelTr: "Konuşma Güçlüğü" },
  { value: "trauma", label: "Trauma", labelTr: "Travma" },
];

const CHEST_SYMPTOM_CHIPS = [
  { value: "cough", label: "Cough", labelTr: "Öksürük" },
  { value: "shortness-of-breath", label: "Shortness of Breath", labelTr: "Nefes Darlığı" },
  { value: "chest-pain", label: "Chest Pain", labelTr: "Göğüs Ağrısı" },
  { value: "infection", label: "Infection", labelTr: "Enfeksiyon" },
  { value: "cancer-followup", label: "Cancer Follow-up", labelTr: "Kanser Takibi" },
  { value: "screening", label: "Screening", labelTr: "Tarama" },
];

const ABDOMEN_SYMPTOM_CHIPS = [
  { value: "pain", label: "Pain", labelTr: "Ağrı" },
  { value: "bleeding", label: "Bleeding", labelTr: "Kanama" },
  { value: "infection", label: "Infection", labelTr: "Enfeksiyon" },
  { value: "mass", label: "Mass", labelTr: "Kitle" },
  { value: "stones", label: "Stones", labelTr: "Taş" },
  { value: "bowel", label: "Bowel Issues", labelTr: "Bağırsak Sorunları" },
  { value: "follow-up", label: "Follow-up", labelTr: "Takip" },
];

const REPORT_TYPES: OptDef<string>[] = [
  { value: "radiology", label: "Radiology", labelTr: "Radyoloji" },
  { value: "discharge", label: "Discharge", labelTr: "Taburcu" },
  { value: "consultation", label: "Consultation", labelTr: "Konsültasyon" },
  { value: "pathology", label: "Pathology", labelTr: "Patoloji" },
  { value: "other", label: "Other", labelTr: "Diğer" },
];

const REPORT_WANTS: OptDef<string>[] = [
  { value: "summary", label: "Summary", labelTr: "Özet" },
  { value: "explanation", label: "Explanation", labelTr: "Açıklama" },
  { value: "doctor-questions", label: "Doctor Questions", labelTr: "Doktora Sorular" },
];

// ─── Yes/No helpers ──────────────────────────────────────────────────

const BOOL_YES_NO: OptDef<string>[] = [
  { value: "yes", label: "Yes", labelTr: "Evet" },
  { value: "no", label: "No", labelTr: "Hayır" },
];

// ─── Component ───────────────────────────────────────────────────────

interface ReportIntakeFormProps {
  language: "tr" | "en";
  /** When true, uses tighter spacing for completed/review state */
  compact?: boolean;
}

export default function ReportIntakeForm({ language, compact = false }: ReportIntakeFormProps) {
  const { currentIntake, patchIntake, intakeMissingFields } = usePatient();
  const [hasInteracted, setHasInteracted] = useState(false);

  const tr = language === "tr";
  const t = useCallback(
    (en: string, trStr: string) => (tr ? trStr : en),
    [tr],
  );

  const patch = useCallback(
    (p: Partial<AnalysisIntake>) => {
      if (!hasInteracted) setHasInteracted(true);
      patchIntake(p);
    },
    [patchIntake, hasInteracted],
  );

  const isMissing = (field: string) =>
    hasInteracted && intakeMissingFields.includes(field);

  // Localize option arrays based on language
  // ─── Condition helpers ─────────────────────────────────────────────
  const ft = currentIntake.fileType;
  const br = currentIntake.bodyRegion;
  const isImaging = ft === "mri" || ft === "ct" || ft === "x-ray" || ft === "ultrasound";
  const isSpine = br === "c-spine" || br === "t-spine" || br === "l-spine";
  const isBrain = br === "brain";
  const isChest = br === "chest";
  const isAbdomenPelvis = br === "abdomen" || br === "pelvis";
  const isFollowUp = currentIntake.studyTimeline === "follow-up";
  const isScreenshots = currentIntake.uploadFormat === "screenshots";
  const isBloodTest = ft === "blood-test";
  const isPathology = ft === "pathology";
  const isDoctorReport = ft === "doctor-report";

  const hasConditional =
    isImaging || isSpine || isBrain || isChest || isAbdomenPelvis ||
    isFollowUp || isScreenshots || isBloodTest || isPathology || isDoctorReport;

  // ─── Reusable sub-components ───────────────────────────────────────

  function Label({ text, required }: { text: string; required?: boolean }) {
    return (
      <label className="block text-sm font-medium text-theme-text-primary mb-2">
        {text}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
    );
  }

  function BoolToggle({
    value,
    onChange,
    invalid,
  }: {
    value: boolean | null;
    onChange: (v: boolean) => void;
    invalid?: boolean;
  }) {
    return (
      <OptionChipGrid
        options={BOOL_YES_NO}
        value={value === true ? "yes" : value === false ? "no" : null}
        onChange={(v) => onChange(v === "yes")}
        language={language}
        cols={2}
        invalid={invalid}
      />
    );
  }

  function YNUToggle({
    value,
    onChange,
    invalid,
  }: {
    value: YesNoUnsure | null;
    onChange: (v: YesNoUnsure) => void;
    invalid?: boolean;
  }) {
    return (
      <OptionChipGrid
        options={YES_NO_UNSURE}
        value={value}
        onChange={(v) => onChange(v as YesNoUnsure)}
        language={language}
        cols={3}
        invalid={invalid}
      />
    );
  }

  function MultiChips({
    chips,
    value,
    onChange,
  }: {
    chips: { value: string; label: string; labelTr: string }[];
    value: string[];
    onChange: (v: string[]) => void;
  }) {
    return (
      <OptionChipGrid
        options={chips}
        multiValue={value}
        onMultiChange={onChange}
        multi
        language={language}
        cols={4}
      />
    );
  }

  function ConditionalSection({ children }: { children: React.ReactNode }) {
    return (
      <div className="bg-theme-surface/50 rounded-xl p-4 border border-theme-border/50 space-y-5">
        {children}
      </div>
    );
  }

  function Divider() {
    return <div className={`border-t border-theme-border/60 ${compact ? "my-1" : "my-3"}`} />;
  }

  const formPadding = compact ? "px-4 py-3" : "px-5 py-6 md:px-6 md:py-8";
  const formSpacing = compact ? "space-y-4" : "space-y-8";

  // ─── Render ────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col">
      {/* Header — hidden when compact */}
      {!compact && (
        <div className="flex items-center gap-3 px-0 pb-4">
          <div>
            <h2 className="text-base font-bold text-theme-text-primary">
              {t("Required Questions", "Zorunlu Sorular")}
            </h2>
            <p className="text-xs text-theme-text-muted mt-0.5">
              {t(
                "Answer all questions before uploading",
                "Yüklemeden önce tüm soruları yanıtlayın",
              )}
            </p>
          </div>
          {hasInteracted && intakeMissingFields.length > 0 && (
            <div className="ml-auto flex items-center gap-1.5 text-red-500">
              <AlertCircle className="w-4 h-4" />
              <span className="text-xs font-medium">
                {intakeMissingFields.length} {t("missing", "eksik")}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Form body — natural flow, no cramped internal scroll */}
      <div className={`${formPadding} ${formSpacing}`}>
        {/* ── Q1: File Type ──────────────────────────────────────── */}
        <div>
          <Label
            text={t("What type of file are you uploading?", "Ne tür bir dosya yüklüyorsunuz?")}
            required
          />
          <OptionChipGrid
            options={FILE_TYPES}
            value={currentIntake.fileType}
            onChange={(v) => patch({ fileType: v as FileType })}
            language={language}
            invalid={isMissing("fileType")}
          />
        </div>

        <Divider />

        {/* ── Q2: Body Region ────────────────────────────────────── */}
        <div>
          <Label
            text={t("What body area?", "Hangi vücut bölgesi?")}
            required
          />
          <OptionChipGrid
            options={BODY_REGIONS}
            value={currentIntake.bodyRegion}
            onChange={(v) => patch({ bodyRegion: v as BodyRegion })}
            language={language}
            invalid={isMissing("bodyRegion")}
          />
        </div>

        <Divider />

        {/* ── Q3: Primary Concern ────────────────────────────────── */}
        <div>
          <Label
            text={t(
              "What problem led to this test?",
              "Bu tetkike hangi sorun yol açtı?",
            )}
            required
          />
          <textarea
            rows={3}
            placeholder={t(
              "Describe the symptom, concern, or reason...",
              "Belirti, endişe veya nedeni açıklayın...",
            )}
            value={currentIntake.primaryConcern}
            onChange={(e) => patch({ primaryConcern: e.target.value })}
            className={`w-full px-3 py-2.5 rounded-xl bg-theme-surface border text-theme-text-primary resize-none text-sm transition-colors ${
              isMissing("primaryConcern")
                ? "border-red-500"
                : "border-theme-border"
            }`}
          />
        </div>

        <Divider />

        {/* ── Q4: Symptom Duration ───────────────────────────────── */}
        <div>
          <Label
            text={t("When did this start?", "Bu ne zaman başladı?")}
            required
          />
          <OptionChipGrid
            options={DURATIONS}
            value={currentIntake.symptomDuration}
            onChange={(v) => patch({ symptomDuration: v as SymptomDuration })}
            language={language}
            cols={3}
            invalid={isMissing("symptomDuration")}
          />
        </div>

        <Divider />

        {/* ── Q5: Symptom Trend ──────────────────────────────────── */}
        <div>
          <Label
            text={t(
              "Getting worse, better, or same?",
              "Kötüleşiyor, iyileşiyor yoksa aynı mı?",
            )}
            required
          />
          <OptionChipGrid
            options={TRENDS}
            value={currentIntake.symptomTrend}
            onChange={(v) => patch({ symptomTrend: v as SymptomTrend })}
            language={language}
            cols={4}
            invalid={isMissing("symptomTrend")}
          />
        </div>

        <Divider />

        {/* ── Q6: Study Timeline ─────────────────────────────────── */}
        <div>
          <Label
            text={t("First test or follow-up?", "İlk tetkik mi, takip mi?")}
            required
          />
          <OptionChipGrid
            options={TIMELINES}
            value={currentIntake.studyTimeline}
            onChange={(v) => patch({ studyTimeline: v as StudyTimeline })}
            language={language}
            cols={3}
            invalid={isMissing("studyTimeline")}
          />
        </div>

        <Divider />

        {/* ── Q7: Upload Format ──────────────────────────────────── */}
        <div>
          <Label
            text={t("What are you uploading?", "Ne yüklüyorsunuz?")}
            required
          />
          <OptionChipGrid
            options={UPLOAD_FORMATS}
            value={currentIntake.uploadFormat}
            onChange={(v) => patch({ uploadFormat: v as UploadFormat })}
            language={language}
            invalid={isMissing("uploadFormat")}
          />
        </div>

        <Divider />

        {/* ── Q8: Study Completeness ─────────────────────────────── */}
        <div>
          <Label
            text={t(
              "Full study or selected images?",
              "Tam çalışma mı seçilmiş görüntüler mi?",
            )}
            required
          />
          <OptionChipGrid
            options={COMPLETENESS}
            value={currentIntake.studyCompleteness}
            onChange={(v) => patch({ studyCompleteness: v as StudyCompleteness })}
            language={language}
            cols={3}
            invalid={isMissing("studyCompleteness")}
          />
        </div>

        <Divider />

        {/* ── Q9: Has Written Report ─────────────────────────────── */}
        <div>
          <Label
            text={t(
              "Do you have a written report?",
              "Yazılı raporunuz var mı?",
            )}
            required
          />
          <YNUToggle
            value={currentIntake.hasWrittenReport}
            onChange={(v) => patch({ hasWrittenReport: v })}
            invalid={isMissing("hasWrittenReport")}
          />
        </div>

        {currentIntake.hasWrittenReport === "yes" && (
          <div
            className="mt-4 p-4 rounded-xl space-y-3"
            style={{
              background: "rgba(0,212,255,0.04)",
              border: "1px solid rgba(0,212,255,0.15)",
            }}
          >
            <p className="text-xs font-semibold" style={{ color: "#00d4ff" }}>
              {language === "tr"
                ? "Doktor raporunuzu ekleyin"
                : "Attach your doctor report"}
            </p>
            <p className="text-xs" style={{ color: "#7a8aa0" }}>
              {language === "tr"
                ? "PDF veya görsel olarak yükleyin, ya da içeriği metin olarak yapıştırın."
                : "Upload as PDF or image, or paste the content as text below."}
            </p>

            <label
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl cursor-pointer transition-all w-fit text-sm"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#e8edf5",
              }}
            >
              <Paperclip size={14} />
              {language === "tr"
                ? "Rapor Yükle (PDF/Görsel)"
                : "Upload Report (PDF/Image)"}
              <input
                type="file"
                className="hidden"
                accept=".pdf,image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    patch({ doctorReportFile: file.name });
                  }
                }}
              />
            </label>
            {currentIntake.doctorReportFile && (
              <p className="text-xs font-mono" style={{ color: "#00ff88" }}>
                ✓ {currentIntake.doctorReportFile}
              </p>
            )}

            <div>
              <p className="text-xs mb-1.5" style={{ color: "#7a8aa0" }}>
                {language === "tr"
                  ? "veya rapor metnini buraya yapıştırın:"
                  : "or paste report text here:"}
              </p>
              <textarea
                value={currentIntake.doctorReviewSummary || ""}
                onChange={(e) => patch({ doctorReviewSummary: e.target.value })}
                rows={4}
                placeholder={
                  language === "tr"
                    ? "Doktor rapor metnini buraya yapıştırın..."
                    : "Paste your doctor report text here..."
                }
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#e8edf5",
                }}
              />
            </div>
          </div>
        )}

        <Divider />

        {/* ── Q10: Desired Output ────────────────────────────────── */}
        <div>
          <Label
            text={t("What do you want?", "Ne istiyorsunuz?")}
            required
          />
          <p className="text-xs text-theme-text-muted mb-2">
            {t("Select all that apply", "İlgili olanları seçin")}
          </p>
          <OptionChipGrid
            options={OUTPUT_PREFS}
            multi
            multiValue={currentIntake.desiredOutput}
            onMultiChange={(v) => patch({ desiredOutput: v as OutputPreference[] })}
            language={language}
            invalid={isMissing("desiredOutput")}
          />
        </div>

        {/* ══════════════════════════════════════════════════════════
            CONDITIONAL QUESTIONS — Group B2
           ══════════════════════════════════════════════════════════ */}
        {hasConditional && (
          <>
            <div className="pt-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-px flex-1 bg-theme-border" />
                <span className="text-xs font-semibold text-theme-text-muted uppercase tracking-wider">
                  {t("Additional Details", "Ek Detaylar")}
                </span>
                <div className="h-px flex-1 bg-theme-border" />
              </div>
            </div>

            {/* ── Imaging conditionals ─────────────────────────────── */}
            {isImaging && (
              <ConditionalSection>
                <div>
                  <Label text={t("Was contrast used?", "Kontrast kullanıldı mı?")} />
                  <YNUToggle
                    value={currentIntake.contrastUsed}
                    onChange={(v) => patch({ contrastUsed: v })}
                  />
                </div>
                <div>
                  <Label text={t("Did a doctor review this?", "Bir doktor bunu inceledi mi?")} />
                  <YNUToggle
                    value={currentIntake.doctorReviewed}
                    onChange={(v) => patch({ doctorReviewed: v })}
                  />
                </div>
                {currentIntake.doctorReviewed === "yes" && (
                  <div>
                    <Label text={t("What did the doctor say?", "Doktor ne dedi?")} />
                    <textarea
                      rows={2}
                      value={currentIntake.doctorReviewSummary}
                      onChange={(e) => patch({ doctorReviewSummary: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-theme-text-primary resize-none text-sm"
                      placeholder={t("Brief summary...", "Kısa özet...")}
                    />
                  </div>
                )}
                <div>
                  <Label text={t("Do you have older related scans?", "Eski ilgili tetkikleriniz var mı?")} />
                  <YNUToggle
                    value={currentIntake.priorRelatedStudies}
                    onChange={(v) => patch({ priorRelatedStudies: v })}
                  />
                </div>
              </ConditionalSection>
            )}

            {/* ── Follow-up conditional ────────────────────────────── */}
            {isFollowUp && (
              <ConditionalSection>
                <div>
                  <Label text={t("What changed since previous study?", "Önceki tetkikten bu yana ne değişti?")} />
                  <textarea
                    rows={2}
                    value={currentIntake.priorStudyChangeSummary}
                    onChange={(e) => patch({ priorStudyChangeSummary: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-theme-text-primary resize-none text-sm"
                    placeholder={t("Describe changes...", "Değişiklikleri açıklayın...")}
                  />
                </div>
              </ConditionalSection>
            )}

            {/* ── Screenshot conditional ───────────────────────────── */}
            {isScreenshots && (
              <ConditionalSection>
                <div>
                  <Label text={t("Are these from a phone/viewer?", "Bunlar telefon/görüntüleyiciden mi?")} />
                  <BoolToggle
                    value={currentIntake.screenshotFromPhoneViewer}
                    onChange={(v) => patch({ screenshotFromPhoneViewer: v })}
                  />
                </div>
                <div>
                  <Label text={t("Is any part cut off?", "Herhangi bir kısım kesilmiş mi?")} />
                  <BoolToggle
                    value={currentIntake.screenshotCutOff}
                    onChange={(v) => patch({ screenshotCutOff: v })}
                  />
                </div>
              </ConditionalSection>
            )}

            {/* ── Spine conditional ────────────────────────────────── */}
            {isSpine && (
              <ConditionalSection>
                <div>
                  <Label text={t("Spine Region", "Omurga Bölgesi")} />
                  <OptionChipGrid
                    options={[
                      { value: "cervical", label: "Cervical", labelTr: "Servikal" },
                      { value: "thoracic", label: "Thoracic", labelTr: "Torasik" },
                      { value: "lumbar", label: "Lumbar", labelTr: "Lomber" },
                    ]}
                    value={currentIntake.spineRegion}
                    onChange={(v) => patch({ spineRegion: v as AnalysisIntake["spineRegion"] })}
                    language={language}
                    cols={3}
                  />
                </div>
                <div>
                  <Label text={t("Radiating pain?", "Yayılan ağrı var mı?")} />
                  <BoolToggle
                    value={currentIntake.hasRadiatingPain}
                    onChange={(v) => patch({ hasRadiatingPain: v })}
                  />
                </div>
                {currentIntake.hasRadiatingPain === true && (
                  <div>
                    <Label text={t("Which side?", "Hangi taraf?")} />
                    <OptionChipGrid
                      options={[
                        { value: "left", label: "Left", labelTr: "Sol" },
                        { value: "right", label: "Right", labelTr: "Sağ" },
                        { value: "bilateral", label: "Bilateral", labelTr: "İki Taraflı" },
                      ]}
                      value={currentIntake.radiationSide}
                      onChange={(v) => patch({ radiationSide: v as AnalysisIntake["radiationSide"] })}
                      language={language}
                      cols={3}
                    />
                  </div>
                )}
                <div>
                  <Label text={t("Numbness?", "Uyuşma var mı?")} />
                  <BoolToggle value={currentIntake.hasNumbness} onChange={(v) => patch({ hasNumbness: v })} />
                </div>
                <div>
                  <Label text={t("Weakness?", "Güçsüzlük var mı?")} />
                  <BoolToggle value={currentIntake.hasWeakness} onChange={(v) => patch({ hasWeakness: v })} />
                </div>
                <div>
                  <Label text={t("Balance issues?", "Denge sorunları var mı?")} />
                  <BoolToggle value={currentIntake.hasBalanceIssues} onChange={(v) => patch({ hasBalanceIssues: v })} />
                </div>
                <div>
                  <Label text={t("Bowel/bladder changes?", "Bağırsak/mesane değişiklikleri?")} />
                  <BoolToggle value={currentIntake.hasBowelBladderChanges} onChange={(v) => patch({ hasBowelBladderChanges: v })} />
                </div>
                <div>
                  <Label text={t("Saddle numbness?", "Semer bölgesi uyuşması?")} />
                  <BoolToggle value={currentIntake.hasSaddleNumbness} onChange={(v) => patch({ hasSaddleNumbness: v })} />
                </div>
                <div>
                  <Label text={t("Prior spine surgery?", "Daha önce omurga ameliyatı?")} />
                  <BoolToggle value={currentIntake.priorSpineSurgery} onChange={(v) => patch({ priorSpineSurgery: v })} />
                </div>
                <div>
                  <Label text={t("Recent spine injury?", "Yakın zamanda omurga yaralanması?")} />
                  <BoolToggle value={currentIntake.recentSpineInjury} onChange={(v) => patch({ recentSpineInjury: v })} />
                </div>
              </ConditionalSection>
            )}

            {/* ── Brain conditional ────────────────────────────────── */}
            {isBrain && (
              <ConditionalSection>
                <div>
                  <Label text={t("Brain symptoms", "Beyin belirtileri")} />
                  <MultiChips
                    chips={BRAIN_SYMPTOM_CHIPS}
                    value={currentIntake.brainSymptoms}
                    onChange={(v) => patch({ brainSymptoms: v })}
                  />
                </div>
                <div>
                  <Label text={t("Onset type", "Başlangıç tipi")} />
                  <OptionChipGrid
                    options={[
                      { value: "sudden", label: "Sudden", labelTr: "Ani" },
                      { value: "gradual", label: "Gradual", labelTr: "Kademeli" },
                    ]}
                    value={currentIntake.brainOnsetType}
                    onChange={(v) => patch({ brainOnsetType: v as AnalysisIntake["brainOnsetType"] })}
                    language={language}
                    cols={2}
                  />
                </div>
                <div>
                  <Label text={t("History of stroke/tumor/surgery?", "İnme/tümör/ameliyat öyküsü?")} />
                  <BoolToggle
                    value={currentIntake.brainPriorHistory}
                    onChange={(v) => patch({ brainPriorHistory: v })}
                  />
                </div>
              </ConditionalSection>
            )}

            {/* ── Chest conditional ────────────────────────────────── */}
            {isChest && (
              <ConditionalSection>
                <div>
                  <Label text={t("Chest symptoms", "Göğüs belirtileri")} />
                  <MultiChips
                    chips={CHEST_SYMPTOM_CHIPS}
                    value={currentIntake.chestSymptoms}
                    onChange={(v) => patch({ chestSymptoms: v })}
                  />
                </div>
                <div>
                  <Label text={t("Fever?", "Ateş var mı?")} />
                  <BoolToggle value={currentIntake.chestHasFever} onChange={(v) => patch({ chestHasFever: v })} />
                </div>
                <div>
                  <Label text={t("Known lung disease?", "Bilinen akciğer hastalığı?")} />
                  <BoolToggle value={currentIntake.chestKnownLungDisease} onChange={(v) => patch({ chestKnownLungDisease: v })} />
                </div>
                <div>
                  <Label text={t("Mass follow-up?", "Kitle takibi?")} />
                  <BoolToggle value={currentIntake.chestMassFollowUp} onChange={(v) => patch({ chestMassFollowUp: v })} />
                </div>
              </ConditionalSection>
            )}

            {/* ── Abdomen/Pelvis conditional ───────────────────────── */}
            {isAbdomenPelvis && (
              <ConditionalSection>
                <div>
                  <Label text={t("Abdomen symptoms", "Karın belirtileri")} />
                  <MultiChips
                    chips={ABDOMEN_SYMPTOM_CHIPS}
                    value={currentIntake.abdomenSymptoms}
                    onChange={(v) => patch({ abdomenSymptoms: v })}
                  />
                </div>
                <div>
                  <Label text={t("Side", "Taraf")} />
                  <OptionChipGrid
                    options={[
                      { value: "left", label: "Left", labelTr: "Sol" },
                      { value: "right", label: "Right", labelTr: "Sağ" },
                      { value: "diffuse", label: "Diffuse", labelTr: "Yaygın" },
                    ]}
                    value={currentIntake.abdomenSide}
                    onChange={(v) => patch({ abdomenSide: v as AnalysisIntake["abdomenSide"] })}
                    language={language}
                    cols={3}
                  />
                </div>
                <div>
                  <Label text={t("Fever / nausea / vomiting?", "Ateş / bulantı / kusma?")} />
                  <BoolToggle value={currentIntake.abdomenFeverNauseaVomiting} onChange={(v) => patch({ abdomenFeverNauseaVomiting: v })} />
                </div>
                <div>
                  <Label text={t("Weight loss?", "Kilo kaybı?")} />
                  <BoolToggle value={currentIntake.abdomenWeightLoss} onChange={(v) => patch({ abdomenWeightLoss: v })} />
                </div>
                <div>
                  <Label text={t("Prior abdominal surgery?", "Daha önce karın ameliyatı?")} />
                  <BoolToggle value={currentIntake.abdomenPriorSurgery} onChange={(v) => patch({ abdomenPriorSurgery: v })} />
                </div>
                <div>
                  <Label text={t("Pregnancy context?", "Gebelik bağlamı?")} />
                  <BoolToggle value={currentIntake.abdomenPregnancyContext} onChange={(v) => patch({ abdomenPregnancyContext: v })} />
                </div>
              </ConditionalSection>
            )}

            {/* ── Blood test conditional ───────────────────────────── */}
            {isBloodTest && (
              <ConditionalSection>
                <div>
                  <Label text={t("Test purpose", "Test amacı")} />
                  <OptionChipGrid
                    options={[
                      { value: "routine", label: "Routine", labelTr: "Rutin" },
                      { value: "symptom-driven", label: "Symptom-Driven", labelTr: "Belirtiye Bağlı" },
                    ]}
                    value={currentIntake.labTestPurpose}
                    onChange={(v) => patch({ labTestPurpose: v as AnalysisIntake["labTestPurpose"] })}
                    language={language}
                    cols={2}
                  />
                </div>
                <div>
                  <Label text={t("Test category", "Test kategorisi")} />
                  <input
                    type="text"
                    value={currentIntake.labTestCategory}
                    onChange={(e) => patch({ labTestCategory: e.target.value })}
                    placeholder={t("e.g. CBC, thyroid panel...", "örn. Hemogram, tiroid paneli...")}
                    className="w-full px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-theme-text-primary text-sm"
                  />
                </div>
                <div>
                  <Label text={t("Prior lab results available?", "Önceki lab sonuçları mevcut mu?")} />
                  <BoolToggle value={currentIntake.labPriorAvailable} onChange={(v) => patch({ labPriorAvailable: v })} />
                </div>
                <div>
                  <Label text={t("Show abnormal only?", "Sadece anormal sonuçlar?")} />
                  <BoolToggle value={currentIntake.labAbnormalOnly} onChange={(v) => patch({ labAbnormalOnly: v })} />
                </div>
              </ConditionalSection>
            )}

            {/* ── Pathology conditional ────────────────────────────── */}
            {isPathology && (
              <ConditionalSection>
                <div>
                  <Label text={t("Organ", "Organ")} />
                  <input
                    type="text"
                    value={currentIntake.pathologyOrgan}
                    onChange={(e) => patch({ pathologyOrgan: e.target.value })}
                    placeholder={t("e.g. liver, breast...", "örn. karaciğer, meme...")}
                    className="w-full px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-theme-text-primary text-sm"
                  />
                </div>
                <div>
                  <Label text={t("Biopsy or surgery?", "Biyopsi mi ameliyat mı?")} />
                  <OptionChipGrid
                    options={[
                      { value: "biopsy", label: "Biopsy", labelTr: "Biyopsi" },
                      { value: "surgery", label: "Surgery", labelTr: "Ameliyat" },
                    ]}
                    value={currentIntake.pathologyBiopsyOrSurgery}
                    onChange={(v) => patch({ pathologyBiopsyOrSurgery: v as AnalysisIntake["pathologyBiopsyOrSurgery"] })}
                    language={language}
                    cols={2}
                  />
                </div>
                <div>
                  <Label text={t("Suspected diagnosis", "Şüpheli tanı")} />
                  <input
                    type="text"
                    value={currentIntake.pathologySuspectedDiagnosis}
                    onChange={(e) => patch({ pathologySuspectedDiagnosis: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-theme-text-primary text-sm"
                    placeholder={t("If any...", "Varsa...")}
                  />
                </div>
                <div>
                  <Label text={t("Related imaging available?", "İlgili görüntüleme mevcut mu?")} />
                  <BoolToggle value={currentIntake.pathologyRelatedImaging} onChange={(v) => patch({ pathologyRelatedImaging: v })} />
                </div>
              </ConditionalSection>
            )}

            {/* ── Doctor report conditional ────────────────────────── */}
            {isDoctorReport && (
              <ConditionalSection>
                <div>
                  <Label text={t("Report type", "Rapor türü")} />
                  <OptionChipGrid
                    options={REPORT_TYPES}
                    value={currentIntake.reportType}
                    onChange={(v) => patch({ reportType: v as AnalysisIntake["reportType"] })}
                    language={language}
                    cols={3}
                  />
                </div>
                <div>
                  <Label text={t("What do you want from this report?", "Bu rapordan ne istiyorsunuz?")} />
                  <OptionChipGrid
                    options={REPORT_WANTS}
                    value={currentIntake.reportWantsType}
                    onChange={(v) => patch({ reportWantsType: v as AnalysisIntake["reportWantsType"] })}
                    language={language}
                    cols={3}
                  />
                </div>
                <div>
                  <Label text={t("Related images available?", "İlgili görüntüler mevcut mu?")} />
                  <BoolToggle value={currentIntake.reportRelatedImages} onChange={(v) => patch({ reportRelatedImages: v })} />
                </div>
              </ConditionalSection>
            )}
          </>
        )}

        {/* Bottom spacer for scroll padding */}
        <div className="h-4" />
      </div>
    </div>
  );
}
