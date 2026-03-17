"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Save, User, Heart, AlertCircle } from "lucide-react";
import { OptionChip, OptionChipGrid } from "@/components/ui/option-chip";
import { usePatient } from "@/context/PatientContext";
import type {
  PatientProfile,
  BodyRegion,
  OutputPreference,
} from "@/types/intake";

// ─── Constants ───────────────────────────────────────────────────────

const ALL_BODY_REGIONS: BodyRegion[] = [
  "brain",
  "c-spine",
  "t-spine",
  "l-spine",
  "chest",
  "abdomen",
  "pelvis",
  "shoulder",
  "elbow",
  "wrist-hand",
  "hip",
  "knee",
  "ankle-foot",
  "whole-body",
  "other",
];

const ALL_OUTPUT_PREFERENCES: OutputPreference[] = [
  "simple-explanation",
  "findings-summary",
  "comparison",
  "possible-meaning",
  "doctor-questions",
];

const LABELS: Record<string, { en: string; tr: string }> = {
  profileTitle: { en: "Patient Profile", tr: "Hasta Profili" },
  requiredGroup: { en: "Required Information", tr: "Zorunlu Bilgiler" },
  optionalGroup: { en: "Medical History", tr: "Tıbbi Geçmiş" },
  savedContext: { en: "Saved Medical Context", tr: "Kayıtlı Tıbbi Bağlam" },
  dateOfBirth: { en: "Date of Birth", tr: "Doğum Tarihi" },
  sexAtBirth: { en: "Sex at Birth", tr: "Doğumda Cinsiyet" },
  male: { en: "Male", tr: "Erkek" },
  female: { en: "Female", tr: "Kadın" },
  other: { en: "Other", tr: "Diğer" },
  knownDiagnoses: { en: "Known Diagnoses", tr: "Bilinen Tanılar" },
  chronicConditions: { en: "Chronic Conditions", tr: "Kronik Hastalıklar" },
  priorSurgeries: { en: "Prior Surgeries", tr: "Geçmiş Ameliyatlar" },
  activeFollowUp: {
    en: "Active Follow-up Diagnoses",
    tr: "Aktif Takip Tanıları",
  },
  doctorSummary: { en: "Doctor Summary", tr: "Doktor Özeti" },
  priorReports: {
    en: "Prior Reports Available",
    tr: "Önceki Raporlar Mevcut",
  },
  yes: { en: "Yes", tr: "Evet" },
  no: { en: "No", tr: "Hayır" },
  commonBodyRegions: {
    en: "Commonly Followed Body Regions",
    tr: "Sık Takip Edilen Vücut Bölgeleri",
  },
  defaultReportPref: {
    en: "Default Report Preference",
    tr: "Varsayılan Rapor Tercihi",
  },
  save: { en: "Save Profile", tr: "Profili Kaydet" },
  saving: { en: "Saving…", tr: "Kaydediliyor…" },
  commaSeparated: {
    en: "Separate with commas",
    tr: "Virgülle ayırın",
  },
  required: { en: "Required", tr: "Zorunlu" },
};

const BODY_REGION_LABELS: Record<BodyRegion, { en: string; tr: string }> = {
  brain: { en: "Brain", tr: "Beyin" },
  "c-spine": { en: "C-Spine", tr: "Servikal" },
  "t-spine": { en: "T-Spine", tr: "Torakal" },
  "l-spine": { en: "L-Spine", tr: "Lomber" },
  chest: { en: "Chest", tr: "Göğüs" },
  abdomen: { en: "Abdomen", tr: "Karın" },
  pelvis: { en: "Pelvis", tr: "Pelvis" },
  shoulder: { en: "Shoulder", tr: "Omuz" },
  elbow: { en: "Elbow", tr: "Dirsek" },
  "wrist-hand": { en: "Wrist/Hand", tr: "El Bileği/El" },
  hip: { en: "Hip", tr: "Kalça" },
  knee: { en: "Knee", tr: "Diz" },
  "ankle-foot": { en: "Ankle/Foot", tr: "Ayak Bileği/Ayak" },
  "whole-body": { en: "Whole Body", tr: "Tüm Vücut" },
  other: { en: "Other", tr: "Diğer" },
};

const OUTPUT_PREF_LABELS: Record<
  OutputPreference,
  { en: string; tr: string }
> = {
  "simple-explanation": { en: "Simple Explanation", tr: "Basit Açıklama" },
  "findings-summary": { en: "Findings Summary", tr: "Bulgu Özeti" },
  comparison: { en: "Comparison", tr: "Karşılaştırma" },
  "possible-meaning": { en: "Possible Meaning", tr: "Olası Anlam" },
  "doctor-questions": {
    en: "Doctor Questions",
    tr: "Doktora Sorular",
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────

function arrToComma(arr: string[]): string {
  return arr.filter(Boolean).join(", ");
}

function commaToArr(val: string): string[] {
  return val
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// ─── Draft state type (mirrors PatientProfile but with UI-friendly text fields)

interface Draft {
  dateOfBirth: string;
  sexAtBirth: "male" | "female" | "other" | null;
  knownDiagnoses: string;
  chronicConditions: string;
  priorSurgeries: string;
  activeFollowUpDiagnoses: string;
  doctorSummary: string;
  priorReportsAvailable: boolean | null;
  commonBodyRegions: BodyRegion[];
  defaultReportPreference: OutputPreference | null;
}

function profileToDraft(p: PatientProfile): Draft {
  return {
    dateOfBirth: p.dateOfBirth ?? "",
    sexAtBirth: p.sexAtBirth,
    knownDiagnoses: arrToComma(p.knownDiagnoses),
    chronicConditions: arrToComma(p.chronicConditions),
    priorSurgeries: arrToComma(p.priorSurgeries),
    activeFollowUpDiagnoses: arrToComma(p.activeFollowUpDiagnoses),
    doctorSummary: p.doctorSummary,
    priorReportsAvailable: p.priorReportsAvailable,
    commonBodyRegions: [...p.commonBodyRegions],
    defaultReportPreference: p.defaultReportPreference,
  };
}

function draftToProfilePatch(d: Draft): Partial<PatientProfile> {
  return {
    dateOfBirth: d.dateOfBirth || null,
    sexAtBirth: d.sexAtBirth,
    knownDiagnoses: commaToArr(d.knownDiagnoses),
    chronicConditions: commaToArr(d.chronicConditions),
    priorSurgeries: commaToArr(d.priorSurgeries),
    activeFollowUpDiagnoses: commaToArr(d.activeFollowUpDiagnoses),
    doctorSummary: d.doctorSummary,
    priorReportsAvailable: d.priorReportsAvailable,
    commonBodyRegions: d.commonBodyRegions,
    defaultReportPreference: d.defaultReportPreference,
  };
}

// ─── Component ───────────────────────────────────────────────────────

interface ProfileFormProps {
  language: "tr" | "en";
  onSaved?: () => void;
  compact?: boolean;
}

export default function ProfileForm({
  language,
  onSaved,
  compact,
}: ProfileFormProps) {
  const { profile, updateProfile } = usePatient();
  const [draft, setDraft] = useState<Draft>(() => profileToDraft(profile));
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(profileToDraft(profile));
  }, [profile]);

  const t = useCallback(
    (key: string) => LABELS[key]?.[language] ?? key,
    [language],
  );

  const patch = useCallback(
    (fields: Partial<Draft>) =>
      setDraft((prev) => ({ ...prev, ...fields })),
    [],
  );

  const missingDob = submitted && !draft.dateOfBirth;
  const missingSex = submitted && !draft.sexAtBirth;

  const handleSave = async () => {
    setSubmitted(true);
    if (!draft.dateOfBirth || !draft.sexAtBirth) return;

    setSaving(true);
    try {
      await updateProfile(draftToProfilePatch(draft));
      onSaved?.();
    } finally {
      setSaving(false);
    }
  };

  const toggleBodyRegion = (region: BodyRegion) => {
    setDraft((prev) => {
      const has = prev.commonBodyRegions.includes(region);
      return {
        ...prev,
        commonBodyRegions: has
          ? prev.commonBodyRegions.filter((r) => r !== region)
          : [...prev.commonBodyRegions, region],
      };
    });
  };

  const gap = compact ? "gap-3" : "gap-5";
  const sectionGap = compact ? "gap-4" : "gap-6";
  const py = compact ? "py-3 px-4" : "py-4 px-5";

  return (
    <div className={`flex flex-col ${sectionGap} w-full max-w-2xl mx-auto`}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-theme-accent/10">
          <User className="w-5 h-5 text-theme-accent" />
        </div>
        <h2 className="text-lg font-semibold text-theme-text-primary">
          {t("profileTitle")}
        </h2>
      </div>

      {/* GROUP A1 — Required */}
      <section
        className={`rounded-2xl border border-theme-border bg-theme-surface ${py}`}
      >
        <div className="flex items-center gap-2 mb-4">
          <AlertCircle className="w-4 h-4 text-theme-accent" />
          <h3 className="text-sm font-medium text-theme-text-secondary">
            {t("requiredGroup")}
          </h3>
        </div>

        <div className={`flex flex-col ${gap}`}>
          {/* Date of Birth */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-theme-text-primary">
              {t("dateOfBirth")}
              <span className="text-red-500 ml-0.5">*</span>
            </label>
            <input
              type="date"
              value={draft.dateOfBirth}
              onChange={(e) => patch({ dateOfBirth: e.target.value })}
              className={`w-full rounded-lg border bg-theme-surface-elevated px-3 py-2 text-sm text-theme-text-primary outline-none transition-colors focus:ring-2 focus:ring-theme-accent/40 ${
                missingDob
                  ? "border-red-500 text-red-600"
                  : "border-theme-border"
              }`}
            />
            {missingDob && (
              <span className="text-xs text-red-500">{t("required")}</span>
            )}
          </div>

          {/* Sex at Birth */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-theme-text-primary">
              {t("sexAtBirth")}
              <span className="text-red-500 ml-0.5">*</span>
            </label>
            <div className="flex gap-2">
              {(["male", "female", "other"] as const).map((val) => (
                <OptionChip
                  key={val}
                  selected={draft.sexAtBirth === val}
                  onClick={() => patch({ sexAtBirth: val })}
                  className={missingSex ? "border-red-500" : ""}
                >
                  {t(val === "male" ? "male" : val === "female" ? "female" : "other")}
                </OptionChip>
              ))}
            </div>
            {missingSex && (
              <span className="text-xs text-red-500">{t("required")}</span>
            )}
          </div>
        </div>
      </section>

      {/* GROUP A1 — Optional arrays */}
      <section
        className={`rounded-2xl border border-theme-border bg-theme-surface ${py}`}
      >
        <div className="flex items-center gap-2 mb-4">
          <Heart className="w-4 h-4 text-theme-accent" />
          <h3 className="text-sm font-medium text-theme-text-secondary">
            {t("optionalGroup")}
          </h3>
        </div>

        <div className={`flex flex-col ${gap}`}>
          {(
            [
              ["knownDiagnoses", "knownDiagnoses"],
              ["chronicConditions", "chronicConditions"],
              ["priorSurgeries", "priorSurgeries"],
            ] as const
          ).map(([field, labelKey]) => (
            <div key={field} className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-theme-text-primary">
                {t(labelKey)}
              </label>
              <input
                type="text"
                value={draft[field]}
                onChange={(e) => patch({ [field]: e.target.value })}
                placeholder={t("commaSeparated")}
                className="w-full rounded-lg border border-theme-border bg-theme-surface-elevated px-3 py-2 text-sm text-theme-text-primary placeholder:text-theme-text-muted outline-none transition-colors focus:ring-2 focus:ring-theme-accent/40"
              />
            </div>
          ))}
        </div>
      </section>

      {/* GROUP A2 — Saved Medical Context */}
      <section
        className={`rounded-2xl border border-theme-border bg-theme-surface ${py}`}
      >
        <h3 className="text-sm font-medium text-theme-text-secondary mb-4">
          {t("savedContext")}
        </h3>

        <div className={`flex flex-col ${gap}`}>
          {/* Active follow-up diagnoses */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-theme-text-primary">
              {t("activeFollowUp")}
            </label>
            <input
              type="text"
              value={draft.activeFollowUpDiagnoses}
              onChange={(e) =>
                patch({ activeFollowUpDiagnoses: e.target.value })
              }
              placeholder={t("commaSeparated")}
              className="w-full rounded-lg border border-theme-border bg-theme-surface-elevated px-3 py-2 text-sm text-theme-text-primary placeholder:text-theme-text-muted outline-none transition-colors focus:ring-2 focus:ring-theme-accent/40"
            />
          </div>

          {/* Doctor summary */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-theme-text-primary">
              {t("doctorSummary")}
            </label>
            <input
              type="text"
              value={draft.doctorSummary}
              onChange={(e) => patch({ doctorSummary: e.target.value })}
              className="w-full rounded-lg border border-theme-border bg-theme-surface-elevated px-3 py-2 text-sm text-theme-text-primary outline-none transition-colors focus:ring-2 focus:ring-theme-accent/40"
            />
          </div>

          {/* Prior reports available */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-theme-text-primary">
              {t("priorReports")}
            </label>
            <div className="flex gap-2">
              {([true, false] as const).map((val) => (
                <OptionChip
                  key={String(val)}
                  selected={draft.priorReportsAvailable === val}
                  onClick={() => patch({ priorReportsAvailable: val })}
                >
                  {t(val ? "yes" : "no")}
                </OptionChip>
              ))}
            </div>
          </div>

          {/* Common body regions — multi-select grid */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-theme-text-primary">
              {t("commonBodyRegions")}
            </label>
            <OptionChipGrid
              options={ALL_BODY_REGIONS.map((r) => ({
                value: r,
                label: BODY_REGION_LABELS[r].en,
                labelTr: BODY_REGION_LABELS[r].tr,
              }))}
              multiValue={draft.commonBodyRegions}
              onMultiChange={(vals) =>
                patch({ commonBodyRegions: vals as BodyRegion[] })
              }
              multi
              language={language}
              cols={4}
            />
          </div>

          {/* Default report preference — single select */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-theme-text-primary">
              {t("defaultReportPref")}
            </label>
            <OptionChipGrid
              options={[
                { value: "__none__", label: "Not set", labelTr: "Seçilmedi" },
                ...ALL_OUTPUT_PREFERENCES.map((p) => ({
                  value: p,
                  label: OUTPUT_PREF_LABELS[p].en,
                  labelTr: OUTPUT_PREF_LABELS[p].tr,
                })),
              ]}
              value={draft.defaultReportPreference ?? "__none__"}
              onChange={(v) =>
                patch({
                  defaultReportPreference:
                    v === "__none__" ? null : (v as OutputPreference),
                })
              }
              language={language}
              cols={3}
            />
          </div>
        </div>
      </section>

      {/* Save button */}
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="flex items-center justify-center gap-2 w-full rounded-xl bg-theme-accent py-3 text-sm font-semibold text-theme-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        <Save className="w-4 h-4" />
        {saving ? t("saving") : t("save")}
      </button>
    </div>
  );
}
