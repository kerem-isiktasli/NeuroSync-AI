/**
 * Safe strings for patient-facing templates (Problem 4 — null interpolation).
 */

export function safeStr(val: string | null | undefined, fallback: string): string {
  if (val === null || val === undefined) return fallback;
  const t = String(val).trim();
  return t.length > 0 ? t : fallback;
}

export function buildInterpretationScopeSentence(params: {
  language: "tr" | "en";
  imageCount: number;
  modalityLabel: string;
  lowClassificationConfidence: boolean;
}): string {
  const { language, imageCount, modalityLabel, lowClassificationConfidence } = params;
  const tr = language === "tr";
  const rawMod = safeStr(
    modalityLabel,
    tr ? "belirsiz modalite" : "unspecified modality"
  );
  const _modality = rawMod.trim();
  const _hasModality =
    _modality.length > 0 &&
    _modality !== "undefined" &&
    _modality !== "null" &&
    _modality.toLowerCase() !== "unknown";
  const mod = _hasModality ? _modality : tr ? "belirsiz modalite" : "unspecified modality";
  const imgWord =
    imageCount === 1
      ? tr
        ? "görüntü"
        : "image"
      : tr
        ? "görüntü"
        : "images";
  const countPhrase =
    imageCount === 1
      ? tr
        ? "tek bir görüntü"
        : "a single image"
      : tr
        ? `${imageCount} görüntü`
        : `${imageCount} images`;
  const lowNote = lowClassificationConfidence
    ? tr
      ? " Otomatik sınıflandırma güveni düşük; modaliteye özel kontrol listesi eksik kalmış olabilir."
      : " Automatic classification confidence is low; modality-specific checklist coverage may be incomplete."
    : "";
  return tr
    ? `Bu değerlendirme ${countPhrase} (${mod}) üzerinden yapılmıştır.${lowNote} Klinik öykü ve semptom bilgisi sağlanmamıştır.`
    : `This interpretation is based on ${countPhrase} (${mod}).${lowNote} No clinical history or symptom information was provided.`;
}
