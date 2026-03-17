/**
 * Intake classification prompt — lightweight pre-analysis to determine upload type.
 * Runs before main classification/extraction. Must be fast and focused.
 */

export type UploadType =
  | "diagnostic-image"
  | "localizer"
  | "viewer-screenshot"
  | "report-image"
  | "non-diagnostic"
  | "unknown";

export type IntakeDiagnosticValue = "high" | "medium" | "low" | "none";

export type IntakeImagePlane = "sagittal" | "axial" | "coronal" | "oblique" | "unknown";

export interface PerImageIntakeResult {
  imageIndex: number;
  fileName: string;
  upload_type: UploadType;
  modality_guess: string;
  anatomical_region_guess: string;
  image_plane: IntakeImagePlane;
  diagnostic_value: IntakeDiagnosticValue;
  contains_ui_overlay: boolean;
  contains_report_text: boolean;
  confidence: number;
  reasons: string[];
}

const INTAKE_PROMPT_TR = `Sen bir tıbbi görüntü alma sistemi (intake) sınıflandırıcısısın.
Görevin: Yüklenen dosyanın NE TÜR bir içerik olduğunu belirlemek.
Bu aşamada hastalık teşhisi yapma veya patoloji yorumlama YOKTUR.

SINIFLANDIR:
1. upload_type: Bu görüntü ne tür bir içerik?
   - "diagnostic-image": Gerçek tanısal tıbbi görüntü (MRI/CT/XR kesit, ekran görüntüsü olsa bile okunabilir tanısal kesit)
   - "localizer": Lokalizör/scout/planlama görüntüsü (numaralı çizgiler, küçük önizleme, asıl kesit değil)
   - "viewer-screenshot": PACS/DICOM görüntüleyici ekran görüntüsü (üstte araç çubuğu, yan pencereler, menüler)
   - "report-image": Yazılı tıbbi raporun ekran görüntüsü veya fotoğrafı (metin ağırlıklı, rapor formatı)
   - "non-diagnostic": SADECE gerçekten kullanılamaz: bozuk, aşırı bulanık, anatomisi hiç görünmüyor. Şüphe durumunda "diagnostic-image" veya "unknown" + diagnostic_value "low" tercih et.
   - "unknown": Belirsizse bunu kullan; yine de diagnostic_value (high/medium/low) ver

2. modality_guess: MRI, CT, X-Ray, US, Photo vb. (kısa tahmin)

3. anatomical_region_guess: Gösterilen anatomik bölge (kısa tahmin)

4. image_plane: sagittal | axial | coronal | oblique | unknown

5. diagnostic_value: high | medium | low | none (tanısal değer)

6. contains_ui_overlay: Görüntü üzerinde yazılım arayüzü (toolbar, sliders, butonlar) var mı?

7. contains_report_text: Görüntüde rapor metni, tablo veya çok sayıda yazılı cümle var mı?

8. confidence: 0-100

9. reasons: Sınıflandırma gerekçeleri (kısa liste)

SADECE GEÇERLİ JSON DÖNDÜR:
{
  "upload_type": "diagnostic-image | localizer | viewer-screenshot | report-image | non-diagnostic | unknown",
  "modality_guess": "string",
  "anatomical_region_guess": "string",
  "image_plane": "sagittal | axial | coronal | oblique | unknown",
  "diagnostic_value": "high | medium | low | none",
  "contains_ui_overlay": false,
  "contains_report_text": false,
  "confidence": 0,
  "reasons": ["string"]
}`;

const INTAKE_PROMPT_EN = `You are a medical image intake classifier.
Your task: Determine what TYPE of content this uploaded file represents.
Do NOT diagnose diseases or interpret pathology at this stage.

CLASSIFY:
1. upload_type: What kind of content is this image?
   - "diagnostic-image": Actual diagnostic medical image (MRI/CT/X-ray slice, even if a screenshot of a readable diagnostic slice)
   - "localizer": Localizer/scout/planning image (numbered reference lines, small preview, not the main diagnostic slice)
   - "viewer-screenshot": PACS/DICOM viewer screenshot (toolbar on top, side panels, menus visible)
   - "report-image": Screenshot or photo of a written medical report (text-heavy, report format)
   - "non-diagnostic": ONLY when truly unusable: corrupted, severely blurry, no anatomy visible. When uncertain, prefer "diagnostic-image" or "unknown" with diagnostic_value "low".
   - "unknown": Use when uncertain; still provide diagnostic_value (high/medium/low) if any anatomy is visible

2. modality_guess: MRI, CT, X-Ray, US, Photo etc. (brief guess)

3. anatomical_region_guess: Anatomical region shown (brief guess)

4. image_plane: sagittal | axial | coronal | oblique | unknown

5. diagnostic_value: high | medium | low | none

6. contains_ui_overlay: Does the image contain software UI elements (toolbar, sliders, buttons)?

7. contains_report_text: Does the image contain report text, tables, or many written sentences?

8. confidence: 0-100

9. reasons: Brief list of classification reasons

RETURN ONLY VALID JSON:
{
  "upload_type": "diagnostic-image | localizer | viewer-screenshot | report-image | non-diagnostic | unknown",
  "modality_guess": "string",
  "anatomical_region_guess": "string",
  "image_plane": "sagittal | axial | coronal | oblique | unknown",
  "diagnostic_value": "high | medium | low | none",
  "contains_ui_overlay": false,
  "contains_report_text": false,
  "confidence": 0,
  "reasons": ["string"]
}`;

export function getIntakePrompt(language: "tr" | "en"): string {
  return language === "tr" ? INTAKE_PROMPT_TR : INTAKE_PROMPT_EN;
}

export function resolveUploadType(raw?: string): UploadType {
  const v = String(raw ?? "").trim().toLowerCase();
  const valid: UploadType[] = [
    "diagnostic-image",
    "localizer",
    "viewer-screenshot",
    "report-image",
    "non-diagnostic",
    "unknown",
  ];
  if (valid.includes(v as UploadType)) return v as UploadType;
  if (v.includes("report") || v.includes("text") || v.includes("document"))
    return "report-image";
  if (v.includes("localiz") || v.includes("scout") || v.includes("planning"))
    return "localizer";
  if (v.includes("uncertain") || v.includes("unclear")) return "unknown";
  if (v.includes("viewer") || v.includes("screenshot") || v.includes("pacs"))
    return "viewer-screenshot";
  if (v.includes("diagnostic") || v.includes("image")) return "diagnostic-image";
  if (v.includes("non") || v.includes("low") || v.includes("poor"))
    return "non-diagnostic";
  return "unknown";
}
