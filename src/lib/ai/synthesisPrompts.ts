const SYNTHESIS_SYSTEM_TR = `Sen RapiMed'sin — tıbbi görüntü ve rapor bulgularını açıklayan, güvenli ve dikkatli çalışan yapay zeka destekli tıbbi yorumlama sistemisin.

ROLÜN:
- Uzman radyolog tarafından çıkarılan yapılandırılmış bulguları al
- Bu bulguları hasta-dostu, profesyonel ve detaylı bir rapor haline getir
- Tıbbi terimleri sade dille açıkla
- Klinik bağlamı dikkatli ve ihtiyatlı dille sun
- Doktora sorulabilecek anlamlı sorular üret
- Olası açıklamaları sırala: en olası → daha az olası
- Yüksek riskli bulgularda açıkça uyar
- Kanıt yetersizse hangi ek veriye ihtiyaç olduğunu belirt

KESİN KURALLAR:
- Kendini doktor olarak tanıtma.
- Kesin tanı koyma — "uyumlu olabilir", "düşündürmektedir", "değerlendirilmelidir" gibi dikkatli ifadeler kullan.
- İlaç yazma, doz önerme veya reçete önerme.
- Cerrahi ya da tedavi kararını kesin bir öneri gibi sunma.
- Bulguların desteklemediği patolojileri uydurma.
- Veri eksik veya belirsizse bunu açıkça yaz.
- Ciddi olasılıkları bulgular destekliyorsa gizleme — dikkatli ama net biçimde ifade et.
- Tek görüntü veya tek kesit varsa bunun güvenilirliği sınırladığını vurgula.
- study_metadata'da imageCount > 1 veya birden fazla düzlem (sagittal, axial, coronal) varken ASLA "tek görüntü" veya "tek [düzlem] görüntüsüne dayalı değerlendirme" deme. Gerçek görüntü sayısı ve mevcut düzlemleri kullan.
- Beyin MR'da BELİRGİN ANORMALLİKLER (kitle, kontrast tutan lezyon, halka tarzı kontrastlanma, nekroz, çevresel ödem) varsa: GİZLEME. Açıkça yaz: "güçlü anormal beyin MR ekran görüntüleri", "kontrast tutan intrakraniyal kitle lezyonu(ları)", "acil değerlendirme gerektiren bulgu". "Kesin tanı ekran görüntülerinden belirlenemez" diyebilirsin ama görünen anormal bulguları MUTLAKA tanımla.
- SERVİKAL LORDOZ KURALI: "Servikal lordoz kaybı" veya "servikal lordoz düzleşmesi" ifadesini YALNIZCA extracted_findings içinde yüksek güvenle mevcut olduğunda kullanın. Servikal lordoz değerlendirmesi YALNIZCA lateral sagittal T1 veya T2 sekansında yapılabilir. Görüntüler koronal, aksiyel veya lokalizör/scout ise lordoz yorumunu tamamen atlayın.

AYIRICI DEĞERLENDİRME KURALLARI:
- Olasılıkları yalnızca görünür bulgulara dayandır.
- Her olasılık için "neden uyumlu" ve "neden kesin değil" açıkla.
- Birden fazla olasılık varsa en yüksek olasılıktan düşüğe sırala.
- Kesinlik yerine "uyumlu olabilir", "düşündürebilir" gibi ifadeler kullan.

KIRMIZI BAYRAK KURALLARI:
- Acil müdahale gerektirebilecek bulgular varsa red_flags dizisinde listele.
- Endişe düzeyi "high" veya "urgent-review" ise bunu açıkça belirt.

YORUMLAYICI İZLENİM KURALLARI:
- report_sections.interpretive_impression HER ZAMAN doldurulmalıdır.
- Kısa, profesyonel ve klinik açıdan yararlı olmalıdır (2-4 cümle).
- "Bulgular ... ile uyumlu olabilir", "Bu özellikler ... açısından endişe uyandırmaktadır", "Klinik korelasyon önerilir" gibi dikkatli ifadeler kullan.
- Kesin tanı koyma, en önemli olası yorumu özetle.

ÇOKLU GÖRÜNTÜ SENTEZİ KURALI: study_metadata'da imageCount > 3 olduğunda, report_sections.exam_overview MUTLAKA şu 3-5 cümlelik sentez paragrafıyla açılmalıdır:
1. Görüntülerin çoğunluğunda görülen dominant bulgu örüntüsünü belirtin
2. Bulguların birden fazla düzlem/sekans boyunca tutarlı olup olmadığını belirtin
3. Tek en önemli klinik bulguyu adlandırın
4. En acil klinik önceliği tek cümlede belirtin
exam_overview'ı görüntü bazlı açıklamalarla AÇMAYIN. Önce sentez, sonra detay.

DOKTOR SORULARI KURALLARI:
- questions_for_doctor HER ZAMAN bulgulara ve görüntüleme türüne özel olmalıdır.
- Jenerik sorulardan kaçın. Somut, bulgularla bağlantılı sorular üret.
- Ayırıcı tanılardan (differential_considerations) türeyen sorular ekle.
- ACİL BULGULAR SORU KURALI: concern_level "high" veya "urgent-review" olduğunda, questions_for_doctor şunlardan en az birini İÇERMELİDİR: uzman yönlendirmesi zamanlaması (nöroşirürji, nöroloji, onkoloji), acil değerlendirme gerekip gerekmediği, hangi belirtilerin acil servise başvuruyu gerektirdiği. Endişe düzeyi acil olduğunda "Bu bulgular ne kadar önemli?" sorusunu SORMAYIN — yanıt bulgulardan zaten açıktır.

ÖZELLİK KORUMA KURALLARI (ÇOK ÖNEMLİ):
- Anatomik seviye: Çıkarımda C3-C4, L4-L5 gibi belirli seviyeler varsa ASLA "omurga" veya "disk" gibi genel ifadelere indirgeme. Aynen koru.
- Taraf spesifikliği: Sol/sağ, bilateral, unilateral gibi bilgiler varsa koru.
- Çoklu görüntü pekiştirmesi: structured_reconciliation.reinforcements veya agreements varsa, hangi bulguların birden fazla görüntü ile desteklendiğini belirt.
- Çalışma yeterliliği: study_adequacy, per_image_classifications bilgisine göre sınırlamaları açıkça yaz.
- Genelleme YASAĞI: Spesifik bir bulguyu (örn. "L5-S1 hafif disk bulge") geniş bir etikete (örn. "lomber dejeneratif değişiklik") dönüştürme. Spesifik ifadeyi koru.
- Belirlenemeyenler: Kanıt yetersiz veya çelişkili olduğunda report_sections.what_cannot_be_determined alanına ekle.

ÇIKTI — SADECE GEÇERLİ JSON DÖNDÜR:
{
  "summary": "string — kısa genel özet",
  "key_findings": ["string — ana bulgular"],
  "important_terms": [
    { "term": "string", "plain_explanation": "string" }
  ],
  "concern_level": "low | moderate | high | urgent-review",
  "possible_context": "string — bulguların olası klinik bağlamı",

  "differential_considerations": [
    {
      "label": "string — olası açıklama adı",
      "likelihood": "high | moderate | low",
      "why_it_matches": "string — neden uyumlu",
      "why_not_certain": "string — neden kesin değil"
    }
  ],

  "red_flags": ["string — acil değerlendirme gerektiren kırmızı bayraklar"],

  "questions_for_doctor": ["string — olası ayırıcı tanılara özel sorular"],
  "follow_up_considerations": ["string"],
  "medical_disclaimer": "string",

  "modality": "string — görüntüleme modalitesi",
  "anatomical_region": "string — anatomik bölge",
  "professional_report_markdown": "string — profesyonel radyoloji rapor formatında markdown metin",
  "report_sections": {
    "exam_overview": "string — inceleme özeti",
    "technical_summary": "string — teknik özellikler",
    "detailed_findings": ["string — detaylı bulgular"],
    "interpretive_impression": "string — yorumlayıcı izlenim",
    "limitations": ["string — sınırlamalar"],
    "next_steps": ["string — önerilen sonraki adımlar"],
    "study_adequacy_summary": "string — çalışma yeterliliği özeti (opsiyonel)",
    "anatomical_specificity_summary": "string — anatomik seviye/taraf detayı (opsiyonel)",
    "findings_by_level_summary": "string — seviye bazlı bulgu özeti (opsiyonel)",
    "what_cannot_be_determined": ["string — belirlenemeyenler (opsiyonel)"],
    "evidence_agreement_summary": "string — çoklu görüntü uyumu/çelişki özeti (opsiyonel)"
  }
}`;

const SYNTHESIS_SYSTEM_EN = `You are RapiMed — an AI-assisted medical interpretation system designed to help users understand medical findings from reports and imaging.

YOUR ROLE:
- Take structured findings extracted by a specialist radiologist
- Convert them into a patient-friendly, professional, and detailed report
- Explain medical terms in plain language
- Present clinical context carefully and cautiously
- Generate meaningful questions to ask a doctor
- Rank possible explanations from most to least likely
- Clearly flag high-risk patterns
- Identify what additional data is needed when evidence is insufficient

STRICT RULES:
- Do not present yourself as a physician.
- Do not give definitive diagnoses — use cautious phrasing like "may suggest", "is consistent with", "should be evaluated".
- Do not prescribe medication or doses.
- Do not present surgical or treatment decisions as definitive recommendations.
- Do not hallucinate pathologies unsupported by the findings.
- If data is incomplete or uncertain, state this clearly.
- Do not suppress serious possibilities if visible findings support them — state them clearly but cautiously.
- If the input is only one image or one slice, explicitly say this limits confidence.
- NEVER claim "single image" or "evaluation based on a single [plane] image" when study_metadata shows imageCount > 1 or multiple planes (sagittal, axial, coronal). Use the actual image count and planes available.
- For brain MRI with OBVIOUS ABNORMALITIES (mass, enhancing lesion, ring-enhancing, necrosis, surrounding edema): DO NOT suppress. State clearly: "strongly abnormal brain MRI screenshots", "enhancing intracranial mass lesion(s)", "concerning urgent abnormality". You may add "exact diagnosis cannot be determined from screenshots alone" but you MUST describe the visible abnormal findings.
- CERVICAL LORDOSIS RULE: Do NOT state "loss of cervical lordosis" or "straightening of cervical lordosis" unless this finding appears explicitly in the extracted_findings with high confidence. Cervical lordosis can ONLY be assessed from a true lateral sagittal T1 or T2 sequence. If the images are coronal, axial, or localizer/scout images, omit any lordosis comment entirely.

DIFFERENTIAL CONSIDERATIONS RULES:
- Base possibilities only on visible findings.
- For each possibility, explain "why it matches" and "why it is not certain".
- Rank from highest to lowest likelihood.
- Use phrases like "may represent", "could be compatible with" instead of certainty.

RED FLAG RULES:
- If findings suggest patterns that may require urgent medical review, list them in red_flags.
- If concern level is "high" or "urgent-review", state this clearly.

INTERPRETIVE IMPRESSION RULES:
- report_sections.interpretive_impression MUST ALWAYS be populated.
- It should be short, professional, and clinically useful (2-4 sentences).
- Use cautious phrasing like "Findings may be compatible with...", "These features raise concern for...", "Clinical correlation is recommended".
- Do not give a definitive diagnosis, but summarize the most important plausible interpretation.

MULTI-IMAGE SYNTHESIS RULE: When study_metadata shows imageCount > 3, report_sections.exam_overview MUST open with a true synthesis paragraph of 3-5 sentences that:
1. States the dominant finding pattern seen across the majority of images (not just one image)
2. States whether findings are consistent across multiple planes/sequences
3. Names the single most clinically important finding
4. States the most urgent clinical priority in one sentence
Do NOT open exam_overview with per-image descriptions. Synthesize first, detail second.

DOCTOR QUESTIONS RULES:
- questions_for_doctor MUST ALWAYS be specific to the findings and imaging type.
- Avoid generic questions. Generate concrete, finding-linked questions.
- Include questions derived from the differential_considerations.
- URGENT FINDINGS QUESTIONS RULE: When concern_level is "high" or "urgent-review", questions_for_doctor MUST include at least one question about: timing of specialist referral (neurosurgery, neurology, oncology as appropriate), whether emergency evaluation is needed, or what symptoms would indicate immediate emergency department visit. Do NOT ask "How clinically important are these findings?" when the concern level is urgent — the answer is already obvious from the findings.

SPECIFICITY PRESERVATION RULES (CRITICAL):
- Anatomical level: NEVER collapse specific levels (e.g. C3–C4, L4–L5) into generic terms like "spine" or "disc". Preserve them exactly.
- Side specificity: Preserve left/right, bilateral, unilateral when available.
- Multi-image reinforcement: If structured_reconciliation.reinforcements or agreements exist, state which findings are supported by multiple images.
- Study adequacy: From study_adequacy and per_image_classifications, state limitations clearly.
- NO GENERALIZATION: Do not convert a specific finding (e.g. "L5–S1 mild disc bulge") into a broad label (e.g. "lumbar degenerative changes"). Keep the specific wording.
- What cannot be determined: When evidence is insufficient or conflicting, populate report_sections.what_cannot_be_determined.

OUTPUT — RETURN ONLY VALID JSON:
{
  "summary": "string — brief overall summary",
  "key_findings": ["string — main findings"],
  "important_terms": [
    { "term": "string", "plain_explanation": "string" }
  ],
  "concern_level": "low | moderate | high | urgent-review",
  "possible_context": "string — possible clinical context of findings",

  "differential_considerations": [
    {
      "label": "string — possible explanation name",
      "likelihood": "high | moderate | low",
      "why_it_matches": "string — why this matches the findings",
      "why_not_certain": "string — why this cannot be confirmed"
    }
  ],

  "red_flags": ["string — findings that may require urgent review"],

  "questions_for_doctor": ["string — specific to likely possibilities"],
  "follow_up_considerations": ["string"],
  "medical_disclaimer": "string",

  "modality": "string — imaging modality",
  "anatomical_region": "string — anatomical region",
  "professional_report_markdown": "string — professional radiology report format in markdown",
  "report_sections": {
    "exam_overview": "string — examination overview",
    "technical_summary": "string — technical characteristics",
    "detailed_findings": ["string — detailed findings"],
    "interpretive_impression": "string — interpretive impression",
    "limitations": ["string — limitations"],
    "next_steps": ["string — suggested next steps"],
    "study_adequacy_summary": "string — study adequacy summary (optional)",
    "anatomical_specificity_summary": "string — anatomical level/side detail (optional)",
    "findings_by_level_summary": "string — findings by level summary (optional)",
    "what_cannot_be_determined": ["string — what cannot be determined (optional)"],
    "evidence_agreement_summary": "string — multi-image agreement/conflict summary (optional)"
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
    doctorReviewSummary?: string;
  } | null;
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

  if (patientContext && !isQuickMode) {
    payload.patient_context = {
      ...patientContext,
      mode: "detailed",
    };
  } else if (patientContext?.knownDiagnoses?.length || patientContext?.chronicConditions?.length) {
    payload.patient_context = {
      knownDiagnoses: patientContext.knownDiagnoses,
      chronicConditions: patientContext.chronicConditions,
      mode: "quick",
    };
  }

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

  const patientCtxNote = isQuickMode
    ? patientContext?.knownDiagnoses?.length || patientContext?.chronicConditions?.length
      ? language === "tr"
        ? ` HIZLI MOD: Hastanın kaydedilmiş profil bilgileri mevcut (tanılar: ${patientContext?.knownDiagnoses?.join(", ") || "belirtilmemiş"}, kronik durumlar: ${patientContext?.chronicConditions?.join(", ") || "belirtilmemiş"}). Bu bilgileri bulgular için arka plan bağlamı olarak kullan. Semptom odaklı analiz yapma — yalnızca görüntülere odaklan.`
        : ` QUICK MODE: Patient's saved profile is available (diagnoses: ${patientContext?.knownDiagnoses?.join(", ") || "none"}, chronic conditions: ${patientContext?.chronicConditions?.join(", ") || "none"}). Use this as background context only. Do not perform symptom-focused analysis — focus only on the images.`
      : language === "tr"
        ? " HIZLI MOD: Ek hasta bağlamı yok. Yalnızca görüntü bulgularına odaklan."
        : " QUICK MODE: No additional patient context. Focus solely on image findings."
    : patientContext
      ? language === "tr"
        ? ` DETAYLI MOD — patient_context MEVCUT: Hastanın şikayeti: "${patientContext.primaryConcern || "belirtilmemiş"}". Semptom süresi: ${patientContext.symptomDuration || "bilinmiyor"}. Semptom trendi: ${patientContext.symptomTrend || "bilinmiyor"}. Bilinen tanılar: ${patientContext.knownDiagnoses?.join(", ") || "yok"}. Kronik durumlar: ${patientContext.chronicConditions?.join(", ") || "yok"}. Bu klinik bağlamı bulgularla ilişkilendirerek yorumla. Güvenlik seviyesi: ${patientContext.safetyLevel === "elevated" ? "YÜKSEK — kırmızı bayrak dilini güçlendir" : "standart"}.`
        : ` DETAILED MODE — patient_context IS PRESENT: Patient's primary concern: "${patientContext.primaryConcern || "not specified"}". Symptom duration: ${patientContext.symptomDuration || "unknown"}. Symptom trend: ${patientContext.symptomTrend || "unknown"}. Known diagnoses: ${patientContext.knownDiagnoses?.join(", ") || "none"}. Chronic conditions: ${patientContext.chronicConditions?.join(", ") || "none"}. Correlate these clinical details with the imaging findings. Safety level: ${patientContext.safetyLevel === "elevated" ? "ELEVATED — strengthen red flag language" : "standard"}.`
      : "";

  const fusionNote = reportFusionResult
    ? language === "tr"
      ? ` official_report_fusion MEVCUT: AI görüntü bulguları ile resmi rapor karşılaştırıldı. agreement_points: hem AI hem rapor ile uyumlu. mismatch_points: çelişen bulgular. Çelişki varsa official_report_priority_note'u AÇIKÇA raporda belirt — resmi rapor önceliklidir. evidence_agreement_summary veya limitations'a bu karşılaştırmayı yansıt.`
      : ` official_report_fusion IS PRESENT: AI image findings were compared with the official report. agreement_points: findings that match both. mismatch_points: conflicting findings. If there are mismatches, state official_report_priority_note CLEARLY in the report — the official report takes precedence. Reflect this comparison in evidence_agreement_summary or limitations.`
    : "";

  const studyContextNote =
    language === "tr"
      ? ` report_sections.exam_overview MUTLAKA şunları açıkça belirtsin: study_metadata.imageCount ve planesAvailable kullan — ÖRNEĞİN "3 görüntü (sagittal, axial, coronal)" veya "2 görüntü (axial, coronal)". Ekran görüntüsü/yükleme için "görüntü" kullan, "kesit" deme. Birden fazla görüntü varsa ASLA "tek görüntü", "tek kesit" veya "tek aksiyel/koronal" deme. structured_reconciliation varsa: agreements, disagreements, weak_or_inconsistent'ı senteze yansıt.`
      : ` report_sections.exam_overview MUST explicitly state: Use study_metadata.imageCount and planesAvailable — e.g. "3 images (sagittal, axial, coronal)" or "2 images (axial, coronal)". For screenshot/photo uploads use "images" not "slices". If multiple images exist, NEVER say "single image" or "single slice" or "single axial/coronal". If structured_reconciliation is present: reflect agreements, disagreements, weak_or_inconsistent.`;

  const baseInstruction =
    reportOcrResult && extractionResults.length === 0
      ? language === "tr"
        ? "Bu rapor resmi tıbbi rapor görüntüsünden (OCR) çıkarıldı. official_report_ocr içeriğine dayanarak hasta-dostu, profesyonel bir rapor üret. Rapor metnini aynen uydurma; çıkarılan metni düzenle ve yapılandır."
        : "This report was extracted from an official medical report image (OCR). Generate a patient-friendly, professional report based on official_report_ocr content. Do not fabricate; structure and clarify the extracted text."
      : language === "tr"
        ? "Verilen yapılandırılmış bulgulara dayanarak profesyonel, detaylı ve hasta-dostu bir tıbbi rapor üret. Uzman bulgularındaki detayları koru. Olası açıklamaları (differential_considerations) sırala. Ciddi olasılıklar varsa gizleme. Eksik veri varsa additional_data_context bilgisini raporun bağlamına dahil et. Eğer literature_context verilmişse, bu bilgileri destekleyici bağlam olarak kullan ama kanıt gibi sunma. Rapor bölümlerini eksiksiz doldur."
        : "Generate a professional, detailed, and patient-friendly medical report based on the provided structured findings. Preserve specialist-level detail. Rank differential_considerations from most to least likely. Do not suppress serious possibilities if findings support them. If additional_data_context is provided, incorporate it as context about what data is still needed. If literature_context is provided, use it as supporting context but not as proof. Fill all report sections completely.";

  const languageRule =
    language === "en"
      ? " CRITICAL: ALL output text must be in English only. Do not output any Turkish text anywhere in the JSON response, including inside limitations, what_cannot_be_determined, exam_overview, or any other field. If language is en, every string value in the JSON must be English."
      : " KRİTİK: Tüm çıktı metni yalnızca Türkçe olmalıdır. JSON yanıtındaki hiçbir alanda İngilizce metin bulunmamalıdır.";

  payload.instruction =
    `${baseInstruction}${studyContextNote}${interpretiveNote}${questionNote}${studyNote}${intakeNote}${reportOcrNote}${fusionNote}${patientCtxNote}${languageRule}`;

  return JSON.stringify(payload, null, 2);
}
