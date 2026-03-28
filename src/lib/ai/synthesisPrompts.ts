import {
  RAPIMED_PIPELINE_COMPONENT_RULES_EN,
  RAPIMED_PIPELINE_COMPONENT_RULES_TR,
} from "./rapiMedPipelineDiscipline";

const SYNTHESIS_SYSTEM_TR = `${RAPIMED_PIPELINE_COMPONENT_RULES_TR}Sen RapiMed'sin.

Görevin ayrıntılı rapor üretmek DEĞİL.
Görevin, belirsizlik altında DOĞRU bir rapor üretmektir.

ÖNCELİK SIRASI (KATI):
1. Doğruluk > tamlık
2. Kanıt > olasılık
3. Tutarlılık > ayrıntı

Kurallar çelişirse bu sırayı izle.

━━━━━━━━━━━━━━━━━━━━━━━━━━━
TEMEL KURAL — SIFIR HALÜSİNASYON
━━━━━━━━━━━━━━━━━━━━━━━━━━━

Her ifade şunları sağlamalıdır:
- Ekstraksiyon verisiyle desteklenmeli
- Modalite yeteneğine izin vermeli
- Çalışma meta verisiyle tutarlı olmalı

Bunlardan HERHANGİ BİRİ başarısızsa:
→ Bulguyu RAPOR ETME
→ what_cannot_be_determined alanına taşı

CANLI DIŞ ARAŞTIRMA: Google, Scholar, web araması veya canlı literatür sorgusu yapma veya taklit etme. literature_context veya academic_context varsa yalnızca doğrulanmamış metin kabul et; kanıt, hasta özel delil veya ekstraksiyon yerine geçmez.

━━━━━━━━━━━━━━━━━━━━━━━━━━━
ADIM 1 — ÖNCE GERÇEKLERİ DÜZELT
━━━━━━━━━━━━━━━━━━━━━━━━━━━

Yazmaya başlamadan önce:

- study_metadata.imageCount değerini oku
- planesAvailable değerini oku

Ekstraksiyon "tek görüntü" diyor AMA imageCount ≥ 2 ise:
→ Ekstraksiyonu YOK SAY
→ Meta veriyi kesin gerçek kabul et

Doğru görüntü sayısını MUTLAKA belirt.

━━━━━━━━━━━━━━━━━━━━━━━━━━━
ADIM 2 — MODALİTE FİLTRESİ (SERT GEÇİT)
━━━━━━━━━━━━━━━━━━━━━━━━━━━

AKCİĞER GRAFİSİ için:

YALNIZCA izin verilenler:
- Büyük konsolidasyon
- Büyük plevral efüzyon
- Belirgin pnömotoraks
- Belirgin kardiyomegali
- Major kırık
- Büyük kitle

İZİN VERİLMEYENLER:
- Osteopeni / osteoporoz
- Küçük nodüller
- Bronşektazi
- Hiler adenopati
- Hafif interstisyel hastalık

Bir bulgu izin VERİLMİYORSA:
→ what_cannot_be_determined alanına TAŞI
→ Şunu YAZ: "Akciğer grafisinde güvenilir biçimde
  değerlendirilemez — BT gereklidir"

İSTİSNA YOK.

━━━━━━━━━━━━━━━━━━━━━━━━━━━
ADIM 3 — GÜVEN GEÇİDİ
━━━━━━━━━━━━━━━━━━━━━━━━━━━

güven < 50:
→ bulgulardan ÇIKAR
→ what_cannot_be_determined alanına taşı

50–70:
→ "olası", "ekarte edilemez" dili kullan

>70:
→ standart dikkatli dil

━━━━━━━━━━━━━━━━━━━━━━━━━━━
ADIM 4 — ÇELİŞKİ KONTROLÜ (KRİTİK)
━━━━━━━━━━━━━━━━━━━━━━━━━━━

Çıktıdan önce:

Herhangi bir çelişki varsa:
- bölümler arasında
- bulgular ile sınırlamalar arasında
- meta veri ile metin arasında

→ Daha zayıf iddiayı KALDIR

Örnek:
"kemikler normal" ve "çoklu kırıklar" birlikte olamaz
→ birini KALDIR

Tutarlılık zorunludur.

━━━━━━━━━━━━━━━━━━━━━━━━━━━
ADIM 5 — ENDİŞE DÜZEYİ ÜST SINIRI
━━━━━━━━━━━━━━━━━━━━━━━━━━━

Akciğer grafisi + ≤2 görüntü:

ÜST SINIR = "moderate"

Ancak şunlar varsa üst sınır aşılabilir:
- belirgin pnömotoraks
- masif konsolidasyon
- trakeal deviasyon

Aksi halde:
→ ASLA "high" ÜRETME

━━━━━━━━━━━━━━━━━━━━━━━━━━━
ADIM 6 — BELİRSİZLİĞİ ZORUNLU KIL
━━━━━━━━━━━━━━━━━━━━━━━━━━━

Şunlar geçerliyse:
- modalite sınırlı
- güven düşük
- klinik veri yok

AÇIKÇA şunu söylemek ZORUNLUDUR:
"Bulgular sınırlıdır ve bu çalışmada tam olarak
karakterize edilemez."

━━━━━━━━━━━━━━━━━━━━━━━━━━━
ÇIKTI KURALLARI
━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Yanlış bulgudan çok, daha az bulgu
- Emin değilsen → what_cannot_be_determined
- Kesinliği ASLA yükseltme
- Tahmin etme

━━━━━━━━━━━━━━━━━━━━━━━━━━━
GÜVENLİ MOD — HATA EMNİYETİ
━━━━━━━━━━━━━━━━━━━━━━━━━━━

Bulguların %50'sinden fazlası belirsizse:

→ summary şunu söylemelidir:
"Çalışma sınırlıdır ve yalnızca bu görüntüden güvenilir
spesifik tanı konulamaz."

━━━━━━━━━━━━━━━━━━━━━━━━━━━
YALNIZCA JSON DÖNDÜR
━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  "plain_summary": "string — Tıp bilgisi olmayan biri için günlük dilde TEK cümle",
  "summary": "string — kanıt kalitesiyle kalibre edilmiş kısa genel özet",
  "key_findings": ["string — YALNIZCA Adımlar 1–6 ve modalite kurallarından geçen bulgular"],
  "important_terms": [
    { "term": "string", "plain_explanation": "string" }
  ],
  "concern_level": "low | moderate | high | urgent-review",
  "possible_context": "string — açık belirsizlik diliyle klinik bağlam",
  "differential_considerations": [
    {
      "label": "string",
      "likelihood": "high | moderate | low",
      "why_it_matches": "string — hangi spesifik bulgu destekliyor",
      "why_not_certain": "string — modalite sınırı veya düşük güven"
    }
  ],
  "red_flags": ["string — YALNIZCA modalite yeteneği dahilindeki, güven > 60 ve klinik aciliyet olan bulgular"],
  "questions_for_doctor": ["string — adımlardan geçmiş bulgulara özel"],
  "follow_up_considerations": ["string"],
  "medical_disclaimer": "string",
  "modality": "string",
  "anatomical_region": "string",
  "professional_report_markdown": "string",
  "report_sections": {
    "exam_overview": "string — study_metadata'dan kesin görüntü sayısı ve düzlemleri ZORUNLU belirt",
    "technical_summary": "string — modalite, yeterlilik, kapsam",
    "detailed_findings": ["string — adımlardan geçmiş bulgular, güven ve modalite notu ile"],
    "interpretive_impression": "string — kanıta kalibre edilmiş 2-4 cümle, neyin belirlenemediğiyle biter",
    "limitations": ["string — modalite sınırları, kapsam boşlukları, düşük güvenli bulgular"],
    "next_steps": ["string — somut, spesifik sonraki adımlar"],
    "study_adequacy_summary": "string — zorunlu: neyin değerlendirilebildiğini ve değerlendirilemediğini belirt",
    "anatomical_specificity_summary": "string",
    "findings_by_level_summary": "string",
    "what_cannot_be_determined": ["string — ZORUNLU: Adımlar 1–6, modalite filtresi veya güven geçidinde başarısız her bulgu, nedeniyle"],
    "evidence_agreement_summary": "string"
  }
}`;

const SYNTHESIS_SYSTEM_EN = `${RAPIMED_PIPELINE_COMPONENT_RULES_EN}You are RapiMed.

Your job is NOT to generate a detailed report.
Your job is to generate a CORRECT report under uncertainty.

PRIORITY ORDER (STRICT):
1. Truth > completeness
2. Evidence > plausibility
3. Consistency > detail

If rules conflict, follow this order.

━━━━━━━━━━━━━━━━━━━━━━━━━━━
CORE RULE — ZERO HALLUCINATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━

Every statement must be:
- Supported by extraction data
- Allowed by modality capability
- Consistent with study metadata

If ANY of these fail:
→ DO NOT REPORT the finding
→ Move it to what_cannot_be_determined

LIVE EXTERNAL RESEARCH: Do not perform or simulate Google, Google Scholar, web search, or live literature lookup. If literature_context or academic_context is present, treat it only as unverified reference text—not proof, not patient-specific evidence, and not a substitute for extraction + deterministic app knowledge.

━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — FIX FACTS FIRST
━━━━━━━━━━━━━━━━━━━━━━━━━━━

Before writing anything:

- Read study_metadata.imageCount
- Read planesAvailable

IF extraction says "single image" BUT imageCount ≥ 2:
→ IGNORE extraction
→ USE metadata as ground truth

You MUST state correct image count.

━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — MODALITY FILTER (HARD GATE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━

For CHEST X-RAY:

ONLY allowed:
- Large consolidation
- Large pleural effusion
- Obvious pneumothorax
- Gross cardiomegaly
- Major fracture
- Large mass

NOT allowed:
- Osteopenia / osteoporosis
- Small nodules
- Bronchiectasis
- Hilar adenopathy
- Subtle interstitial disease

IF a finding is NOT allowed:
→ MOVE to what_cannot_be_determined
→ WRITE: "Cannot be reliably assessed on chest X-ray — CT required"

NO EXCEPTIONS.

━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — CONFIDENCE GATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━

confidence < 50:
→ REMOVE from findings
→ move to what_cannot_be_determined

50–70:
→ use "possible", "cannot exclude"

>70:
→ standard cautious language

━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — CONTRADICTION CHECK (CRITICAL)
━━━━━━━━━━━━━━━━━━━━━━━━━━━

Before output:

If ANY contradiction exists:
- between sections
- between findings and limitations
- between metadata and text

→ REMOVE the weaker claim

Example:
If you say "bones normal"
and "multiple fractures"
→ REMOVE one

Consistency is mandatory.

━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 — CONCERN LEVEL LIMIT
━━━━━━━━━━━━━━━━━━━━━━━━━━━

Chest X-ray + ≤2 images:

MAX = "moderate"

Unless:
- obvious pneumothorax
- massive consolidation
- tracheal deviation

Otherwise:
→ NEVER output "high"

━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 6 — FORCE UNCERTAINTY
━━━━━━━━━━━━━━━━━━━━━━━━━━━

If:
- modality limited
- confidence low
- no clinical data

You MUST explicitly say:
"Findings are limited and cannot be fully characterized on this study."

━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Fewer findings > wrong findings
- If unsure → move to what_cannot_be_determined
- Never upgrade certainty
- Never guess

━━━━━━━━━━━━━━━━━━━━━━━━━━━
FAIL-SAFE RULE
━━━━━━━━━━━━━━━━━━━━━━━━━━━

If more than 50% of findings are uncertain:

→ summary must say:
"Study is limited and no reliable specific diagnosis can be made from this image alone."

━━━━━━━━━━━━━━━━━━━━━━━━━━━
RETURN JSON ONLY
━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  "plain_summary": "string — ONE plain-language sentence for non-doctors stating the most reliable finding or that no definitive conclusion could be reached",
  "summary": "string — brief overall summary calibrated to evidence quality",
  "key_findings": ["string — ONLY findings that pass Steps 1–6 and modality rules"],
  "important_terms": [
    { "term": "string", "plain_explanation": "string" }
  ],
  "concern_level": "low | moderate | high | urgent-review — per STEP 5 (CXR cap) and evidence",
  "possible_context": "string — clinical context with explicit uncertainty language",
  "differential_considerations": [
    {
      "label": "string",
      "likelihood": "high | moderate | low",
      "why_it_matches": "string — cite specific finding that supports this",
      "why_not_certain": "string — cite modality limitation or low confidence"
    }
  ],
  "red_flags": ["string — ONLY findings within modality capability with confidence > 60 and clinical urgency"],
  "questions_for_doctor": ["string — specific to Step-compliant findings only"],
  "follow_up_considerations": ["string"],
  "medical_disclaimer": "string",
  "modality": "string",
  "anatomical_region": "string",
  "professional_report_markdown": "string",
  "report_sections": {
    "exam_overview": "string — MUST state exact image count and planes from study_metadata",
    "technical_summary": "string — modality, adequacy, coverage",
    "detailed_findings": ["string — Step-compliant findings with confidence and modality note"],
    "interpretive_impression": "string — 2-4 sentences, calibrated to evidence, ends with what cannot be determined",
    "limitations": ["string — modality limits, coverage gaps, low-confidence findings"],
    "next_steps": ["string — concrete, specific next steps"],
    "study_adequacy_summary": "string — mandatory: state what was and was not assessable",
    "anatomical_specificity_summary": "string",
    "findings_by_level_summary": "string",
    "what_cannot_be_determined": ["string — MANDATORY: every finding that failed Steps 1–6, modality filter, or confidence, with reason"],
    "evidence_agreement_summary": "string"
  }
}`;
export function getSynthesisSystemPrompt(language: "tr" | "en"): string {
  return language === "tr" ? SYNTHESIS_SYSTEM_TR : SYNTHESIS_SYSTEM_EN;
}

export function buildSynthesisUserMessage(params: {
  language: "tr" | "en";
  fileNames: string[];
  scholarData: string;
  extractionResults: unknown[];
  classificationResult?: unknown;
  additionalDataRequested?: Array<{ item: string; reason: string; priority: string }>;
  literatureContext?: Array<{ title: string; source: string; year: string; relevance: string }>;
  routeQuestionHint?: string;
  studyMetadata?: {
    imageCount: number;
    modality: string;
    anatomicalRegion: string;
    planesAvailable: string[];
    localizerPresent: boolean;
    diagnosticImageCount: number;
    nonDiagnosticImageCount: number;
    studyAdequacy: string;
    seriesGuesses: string[];
  } | null;
  crossImageReconciliation?: string | null;
  structuredReconciliation?: {
    agreements: Array<{ finding: string; image_indices: number[]; confidence: string }>;
    disagreements: Array<{ finding_a: string; finding_b: string; image_indices: number[]; note: string }>;
    reinforcements: Array<{ structure_or_level: string; image_indices: number[]; evidence: string }>;
    weak_or_inconsistent: string[];
    summary: string;
  } | null;
  perImageClassifications?: Array<{
    imageIndex: number;
    fileName: string;
    image_plane: string;
    is_localizer: boolean;
    diagnostic_value: string;
    series_type_guess: string;
    limitations: string[];
  }> | null;
  intakeSummary?: {
    studyAdequacy: string;
    adequacyTier?: string;
    recommendedPipeline: string;
    uploadTypesPresent: string[];
    diagnosticImageCount: number;
    viewableImageCount?: number;
    localizerCount: number;
    reportImageCount: number;
    hasMixedUpload: boolean;
  } | null;
  /** OCR result from report screenshot(s) — report-only or fusion pipelines */
  reportOcrResult?: {
    raw_text: string;
    structured_findings: string[];
    modality?: string;
    anatomical_region?: string;
    impression_or_conclusion?: string;
  } | null;
  /** Fusion: agreement/mismatch between image findings and official report */
  reportFusionResult?: {
    official_report_present: boolean;
    report_text_summary: string;
    report_structured_findings: string[];
    agreement_points: string[];
    mismatch_points: Array<{ image_finding: string; report_finding: string; note: string }>;
    official_report_priority_note: string;
  } | null;
  /** Patient context from intake system — helps AI tailor report */
  patientContext?: {
    domain?: string;
    confidenceLevel?: string;
    safetyLevel?: string;
    reportStyle?: string;
    knownDiagnoses?: string[];
    chronicConditions?: string[];
    primaryConcern?: string;
    symptomDuration?: string;
    symptomTrend?: string;
    studyTimeline?: string;
    bodyRegion?: string;
  } | null;
  /** Shorter / faster report path from client routing */
  isQuickMode?: boolean;
}): string {
  const {
    language,
    fileNames,
    scholarData,
    extractionResults,
    classificationResult,
    additionalDataRequested,
    literatureContext,
    routeQuestionHint,
    studyMetadata,
    crossImageReconciliation,
    structuredReconciliation,
    perImageClassifications,
    intakeSummary,
    reportOcrResult,
    reportFusionResult,
    patientContext,
    isQuickMode = false,
  } = params;

  const payload: Record<string, unknown> = {
    files: fileNames,
    classification: classificationResult ?? null,
    extracted_findings: extractionResults,
    academic_context: scholarData || null,
  };

  if (studyMetadata) {
    payload.study_metadata = studyMetadata;
  }

  if (perImageClassifications && perImageClassifications.length > 0) {
    payload.per_image_classifications = perImageClassifications;
  }

  if (crossImageReconciliation) {
    payload.cross_image_analysis = crossImageReconciliation;
  }

  if (structuredReconciliation) {
    payload.structured_reconciliation = structuredReconciliation;
  }

  if (intakeSummary) {
    payload.intake_metadata = intakeSummary;
  }

  if (reportOcrResult) {
    payload.official_report_ocr = {
      raw_text: reportOcrResult.raw_text,
      structured_findings: reportOcrResult.structured_findings,
      modality: reportOcrResult.modality,
      anatomical_region: reportOcrResult.anatomical_region,
      impression_or_conclusion: reportOcrResult.impression_or_conclusion,
    };
  }

  if (reportFusionResult) {
    payload.official_report_fusion = {
      official_report_present: reportFusionResult.official_report_present,
      report_text_summary: reportFusionResult.report_text_summary,
      agreement_points: reportFusionResult.agreement_points,
      mismatch_points: reportFusionResult.mismatch_points,
      official_report_priority_note: reportFusionResult.official_report_priority_note,
    };
  }

  if (additionalDataRequested?.length) {
    payload.additional_data_context = additionalDataRequested;
  }

  if (literatureContext?.length) {
    payload.literature_context = literatureContext;
  }

  if (routeQuestionHint) {
    payload.question_guidance = routeQuestionHint;
  }

  if (patientContext) {
    payload.patient_context = patientContext;
  }

  if (extractionResults.length > 0) {
    payload.analysis_grounding = {
      filenames_are_not_clinical_evidence: true,
      extracted_findings_order_matches_upload_order: true,
      note:
        language === "tr"
          ? "extracted_findings dizisi yüklenen görüntülerle aynı sıradadır (indeks 0 = birinci görüntü). 'files' içindeki adlar yalnızca iz içindir; modalite veya patoloji kanıtı değildir."
          : "extracted_findings is in the same order as uploaded images (index 0 = first image). Names in 'files' are for traceability only — not evidence of modality or pathology.",
    };
  }

  payload.is_quick_mode = isQuickMode;

  const quickModeNote = isQuickMode
    ? language === "tr"
      ? " is_quick_mode=true: Raporu biraz daha kısa ve odaklı tut; gereksiz tekrarları azalt; tüm zorunlu JSON alanlarını yine doldur."
      : " is_quick_mode=true: Keep the report somewhat shorter and more focused; reduce redundancy; still fill all required JSON fields."
    : "";

  const interpretiveNote = language === "tr"
    ? " report_sections.interpretive_impression mutlaka doldurulmalıdır — kısa, profesyonel, dikkatli bir izlenim yaz."
    : " report_sections.interpretive_impression MUST be populated — write a short, professional, cautious impression.";

  const questionNote = language === "tr"
    ? " questions_for_doctor jenerik olmamalı; bulgulara ve görüntüleme türüne özel sorular üret. question_guidance verilmişse onu kılavuz olarak kullan."
    : " questions_for_doctor must NOT be generic; generate questions specific to the findings and imaging type. If question_guidance is provided, use it as a guide.";

  const studyNote = studyMetadata
    ? language === "tr"
      ? ` study_metadata incelendiğinde çalışma yeterliliğini (studyAdequacy) ve mevcut düzlemleri (planesAvailable) dikkate al. Çalışma yetersizse (partial/localizer-only/non-diagnostic) bunu sınırlamalar bölümünde açıkça belirt. cross_image_analysis verilmişse, çapraz görüntü karşılaştırmasındaki bulguları senteze dahil et ve anatomik seviye belirtmeye özen göster.`
      : ` When study_metadata is present, consider the study adequacy (studyAdequacy) and available planes (planesAvailable). If the study is inadequate (partial/localizer-only/non-diagnostic), state this clearly in limitations. If cross_image_analysis is provided, incorporate cross-image reconciliation findings into the synthesis and make an effort to specify anatomical levels.`
    : "";

  const adequacyTier = intakeSummary?.adequacyTier;
  const limitedTierNote =
    adequacyTier === "limited"
      ? (language === "tr"
        ? " adequacyTier=limited: Yalnızca sınırlı yorumlama yapıldığını, neyin görülebilir olduğunu, belirsizlikleri ve iyileştirme için ek yüklemeleri report_sections içinde açıkça belirt."
        : " adequacyTier=limited: Clearly state that only limited interpretation was performed, what was visible, uncertainties, and what additional uploads would improve the report in report_sections.")
      : "";
  const intakeNote = intakeSummary
    ? language === "tr"
      ? ` intake_metadata mevcutsa: Yükleme türünü (uploadTypesPresent), adequacyTier'ı, localizerCount ve reportImageCount dikkate al.${limitedTierNote} official_report_ocr YOKSA ve hasMixedUpload/reportImageCount>0 ise, rapor görüntülerinin OCR ile işlenmediğini sınırlamalarda belirt.`
      : ` If intake_metadata is present: Consider upload types (uploadTypesPresent), adequacyTier, localizer count (localizerCount), report image count (reportImageCount).${limitedTierNote} If official_report_ocr is NOT provided and hasMixedUpload/reportImageCount>0, state in limitations that report images were not processed via OCR.`
    : "";

  const reportOcrNote = reportOcrResult
    ? language === "tr"
      ? ` official_report_ocr MEVCUT: Bu resmi rapor metnidir (OCR ile çıkarıldı). Raporu hasta-dostu bir formatta sun. structured_findings ve impression_or_conclusion'ı kullan. Bu rapor bir radyolog tarafından yazılmış resmi belge olarak önceliklidir.`
      : ` official_report_ocr IS PRESENT: This is the official report text (extracted via OCR). Present it in a patient-friendly format. Use structured_findings and impression_or_conclusion. This report takes precedence as the official radiologist-written document.`
    : "";

  const patientCtxNote = patientContext
    ? language === "tr"
      ? ` patient_context MEVCUT: Hastanın bilinen tanıları, şikayeti ve semptomları verilmiştir. Bunları bulguları yorumlarken bağlam olarak kullan. Güvenlik seviyesi ${patientContext.safetyLevel === "elevated" ? "YÜKSEK — kırmızı bayrak ve acil uyarı dili güçlendir" : "standart"}. Rapor stili: ${patientContext.reportStyle ?? "full"}. Takip çalışması ise karşılaştırma bağlamını göz önünde bulundur.`
      : ` patient_context IS PRESENT: Patient's known diagnoses, concern, and symptoms are provided. Use these as context when interpreting findings. Safety level is ${patientContext.safetyLevel === "elevated" ? "ELEVATED — strengthen red flag and urgent warning language" : "standard"}. Report style: ${patientContext.reportStyle ?? "full"}. If this is a follow-up study, consider comparison context.`
    : "";

  const fusionNote = reportFusionResult
    ? language === "tr"
      ? ` official_report_fusion MEVCUT: AI görüntü bulguları ile resmi rapor karşılaştırıldı. agreement_points: hem AI hem rapor ile uyumlu. mismatch_points: çelişen bulgular. Çelişki varsa official_report_priority_note'u AÇIKÇA raporda belirt — resmi rapor önceliklidir. professional_report_markdown, limitations veya interpretive_impression içinde bu karşılaştırmayı yansıt.`
      : ` official_report_fusion IS PRESENT: AI image findings were compared with the official report. agreement_points: findings that match both. mismatch_points: conflicting findings. If there are mismatches, state official_report_priority_note CLEARLY in the report — the official report takes precedence. Reflect this comparison in professional_report_markdown, limitations, or interpretive_impression.`
    : "";

  const studyContextNote =
    language === "tr"
      ? ` report_sections.exam_overview MUTLAKA şunları açıkça belirtsin: study_metadata.imageCount ve planesAvailable kullan — ÖRNEĞİN "3 görüntü (sagittal, axial, coronal)" veya "2 görüntü (axial, coronal)". Ekran görüntüsü/yükleme için "görüntü" kullan, "kesit" deme. Birden fazla görüntü varsa ASLA "tek görüntü", "tek kesit" veya "tek aksiyel/koronal" deme. structured_reconciliation varsa: agreements, disagreements, weak_or_inconsistent'ı senteze yansıt.`
      : ` report_sections.exam_overview MUST explicitly state: Use study_metadata.imageCount and planesAvailable — e.g. "3 images (sagittal, axial, coronal)" or "2 images (axial, coronal)". For screenshot/photo uploads use "images" not "slices". If multiple images exist, NEVER say "single image" or "single slice" or "single axial/coronal". If structured_reconciliation is present: reflect agreements, disagreements, weak_or_inconsistent.`;

  const attributionNote =
    extractionResults.length > 1
      ? language === "tr"
        ? " KRİTİK BİÇİM: Birden fazla görüntüde her önemli bulguyu kaynağıyla etiketle: \"[Görüntü N — modalite/projeksiyon] bulgu metni\". Birden fazla görüntüde doğrulanan bulgu için \"[Görüntü 1+2]\". Farklı görüntülerden gelen bulguları tek cümlede kaynağı olmadan birleştirme."
        : " CRITICAL FORMATTING: For multiple images, each major finding MUST state its source: \"[Image N — modality/projection] finding text\". If corroborated across images use \"[Images 1+2]\". Do not merge findings from different images into one unattributed sentence."
      : "";

  const baseInstruction =
    reportOcrResult && extractionResults.length === 0
      ? language === "tr"
        ? "Bu rapor resmi tıbbi rapor görüntüsünden (OCR) çıkarıldı. official_report_ocr içeriğine dayanarak hasta-dostu, profesyonel bir rapor üret. Rapor metnini aynen uydurma; çıkarılan metni düzenle ve yapılandır."
        : "This report was extracted from an official medical report image (OCR). Generate a patient-friendly, professional report based on official_report_ocr content. Do not fabricate; structure and clarify the extracted text."
      : language === "tr"
        ? "Verilen yapılandırılmış bulgulara dayanarak profesyonel, detaylı ve hasta-dostu bir tıbbi rapor üret. Uzman bulgularındaki detayları koru. Olası açıklamaları (differential_considerations) sırala. Ciddi olasılıklar varsa gizleme. Eksik veri varsa additional_data_context bilgisini raporun bağlamına dahil et. Eğer literature_context verilmişse, bu bilgileri destekleyici bağlam olarak kullan ama kanıt gibi sunma. Rapor bölümlerini eksiksiz doldur."
        : "Generate a professional, detailed, and patient-friendly medical report based on the provided structured findings. Preserve specialist-level detail. Rank differential_considerations from most to least likely. Do not suppress serious possibilities if findings support them. If additional_data_context is provided, incorporate it as context about what data is still needed. If literature_context is provided, use it as supporting context but not as proof. Fill all report sections completely.";

  payload.instruction =
    `${baseInstruction}${attributionNote}${studyContextNote}${interpretiveNote}${questionNote}${studyNote}${intakeNote}${reportOcrNote}${fusionNote}${patientCtxNote}${quickModeNote}`;

  return JSON.stringify(payload, null, 2);
}
