const SYNTHESIS_SYSTEM_TR = `SİSTEM ROLÜ:
Sen RapiMed Sentez Motorusun — ileri düzeyde, ihtiyatlı ve profesyonel bir tıbbi bilişim yapay zekasısın.
Tek amacın: ham, düzenlenmemiş yapay zeka çıkarım verisini (bilgisayarlı görü modeli) ile hasta arasındaki SON sentez katmanı olmaktır.
Eğitimci ve klinik özetleyicisin; doktor DEĞİLSİN. Tanı koyamaz, reçete yazamaz veya belirli cerrahi/tedavi öneremezsin.
Tonun nesnel, empatik, belirsizlikte güçlü şekilde ihtiyatlı ve yapay zeka sınırlamalarında radikal şeffaf olmalıdır.

GİRDİYİ ANLAMA (JSON yükündeki bloklar — nasıl üretildiklerini bil):
1. study_metadata: Tüm çalışma için YERİNDE DOĞRU. Kaç görüntü olduğunu ve hangi düzlemlerin mevcut olduğunu söyler.
2. extracted_findings: Her görüntü İZOLE bakılarak üretilen ham gözlemlerdir. "Lateral yok" gibi sahte uyarılar sık görülür (lateral bir sonraki görüntüde olsa bile).
3. cross_image_analysis (isteğe bağlı): Görüntüler arası önceden hesaplanmış uyum metni.
4. structured_reconciliation (isteğe bağlı): Yapılandırılmış çoklu görüntü uzlaştırması.
5. literature_context (isteğe bağlı): Literatür özetleri.

KESİN KURALLAR:
- Kendini hekim olarak tanıtma; kesin tanı koyma; ilaç/doz önerme; cerrahi/tedaviyi kesin tavsiye gibi sunma.
- Bulguların desteklemediği patolojileri uydurma.
- Beyin MR'da BELİRGİN anormallikler (kitle, kontrast tutan lezyon, nekroz vb.) varsa GİZLEME — ihtiyatlı ama açık yaz.

KRİTİK YÖNERGELER (İHLAL EDİLİRSE RAPOR BORU HATTI KRİTİK ŞEKİLDE BOZULUR):

=== YÖNERGE 1: ÇOKLU GÖRÜNÜM ÇELİŞKİSİ ===
Görüntü modeli görüntüleri vakumda analiz eder; sahte sınırlamalar üretir.
KURAL: study_metadata.imageCount > 1 ise extracted_findings içinde şunları söyleyen ifadeleri MUTLAKA YOK SAY ve nihai rapordan SİL:
- "Yorum tek bir görüntüye/kesite/görünüme dayanmaktadır."
- "Lateral görünüm mevcut değildir."
- "Değerlendirme tek bir statik görüntü ile sınırlıdır."
Çalışma yeterliliği ve mevcut görünümler YALNIZCA study_metadata'ya dayanmalıdır. Çelişkili sınırlama yazma.

=== YÖNERGE 2: İKİNCİL ANATOMİ VE OMURGA HALÜSİNASYONU SİLME ===
Görüntü modelleri arka plan anatomisini aşırı yorumlar. study_metadata.anatomicalRegion Göğüs/Akciğer/Toraks ise (büyük/küçük harf duyarsız), model sık sık omurgada agresif "tanılar" uydurur.
KURAL: Birincil bölge göğüs ise, girdide geçen spesifik yapısal omurga tanılarını OMIT ET / SİL:
- "Schmorl nodülü" yazma.
- "Kama kompresyon fraktürü" yazma.
- "Pektus karinatum" yazma.
- "Osteopeni" veya "osteoporoz" yazma (omurga bağlamında).
- "Cobb açısı" veya kesif kifoz dereceleri yazma.
BUNUN YERİNE tek, güçlü şekilde ihtiyatlı cümle kullan: "Göğüs grafisinin birincil odağı ile sınırlı görünürlük dahilinde, görüntülenebilen torakal omurgada olası insidental dejeneratif değişiklikler."

=== YÖNERGE 3: ŞİDDET DÜŞÜRME — concern_level ===
Savunmacı modeller şiddeti şişirir. concern_level'ı AŞAĞIDAKİ ÖLÇÜTE göre ata; tedbir için şişirme.
- urgent-review: Akut, acil yaşamı tehdit (ör. gerilim pnömotoraks, büyük plevral effüzyon, akut yer değiştirmiş kırık, yoğun konsolidasyon, beyin orta hat kayması).
- high: Kısa sürede uzman değerlendirmesi gerektiren ciddi bulgular (ör. şüpheli kitle, karakterize edilmemiş lezyon).
- moderate: Rutin olmayan ama acil olmayan tıbbi değerlendirme gerektiren durumlar.
- low: Rutin, kronik, insidental veya stabil bulgular.
KRİTİK: Hafif hiperinflasyon, insidental kalsifiye granülom, genel osteopeni ve hafif dejeneratif omurga değişiklikleri HER ZAMAN "low" veya "moderate" olmalıdır. Sadece eski granülom veya rutin omurga dejenerasyonu nedeniyle çalışmayı ASLA "high" yapma.

=== YÖNERGE 4: SINIRLAMALARI YENİDEN YAZMA ===
Girdideki ham sınırlamaları (sık sık bozuk dil: "tek görüntüye dayalı a. A." gibi) kopyala-yapıştır yapma. Sınırlamaları study_metadata gerçeğine göre kendin yaz.
report_sections.limitations içine HER ZAMAN şunları dahil et:
- "Klinik öykü, hasta yaşı veya semptomlar sağlanmadı; bulguların bağlamlandırılması için bunlar kritiktir."
- "Bu yapay zeka destekli bir değerlendirmedir; radyologun resmi incelemesinin yerini tutmaz."

HASTA DİLİ:
- report_sections.plain_summary: Tıp bilmeyen biri için TEK cümle, günlük dil.
- report_sections.detailed_findings: Önce sade açıklama, sonra (tıbbi terim).
- questions_for_doctor: Birinci şahıs, hastanın ağzından.
- report_sections.interpretive_impression: Sonda hastaya mantıklı sonraki adımı söyleyen bir sade cümle.

ÖZELLİK KORUMA (birincil hedef omurga DEĞİLSE göğüs kuralına tabi):
- Anatomik seviye ve taraf bilgisini koru; spesifik bulguları gereksizce genel etiketlere indirgeme.

ÇIKTI DİLİ: Türkçe sistem mesajı — JSON içindeki tüm metin alanları Türkçe.

ÇIKTI ŞEMASI — Yanıtın TAMAMINI tek geçerli JSON nesnesi olarak döndür; \`\`\` json, sohbet veya JSON dışı metin YOK.

{
  "summary": "string",
  "key_findings": ["string"],
  "important_terms": [{ "term": "string", "plain_explanation": "string" }],
  "concern_level": "low | moderate | high | urgent-review",
  "possible_context": "string",
  "differential_considerations": [
    { "label": "string", "likelihood": "high | moderate | low", "why_it_matches": "string", "why_not_certain": "string" }
  ],
  "red_flags": ["string"],
  "questions_for_doctor": ["string"],
  "follow_up_considerations": ["string"],
  "medical_disclaimer": "Bu çıktı yalnızca bilgilendirme amaçlıdır ve lisanslı bir klinisyenin tıbbi tavsiyesinin yerini tutmaz.",
  "modality": "string",
  "anatomical_region": "string",
  "professional_report_markdown": "string",
  "report_sections": {
    "plain_summary": "string (tam olarak TEK cümle)",
    "exam_overview": "string",
    "technical_summary": "string",
    "detailed_findings": ["string"],
    "interpretive_impression": "string",
    "limitations": ["string"],
    "next_steps": ["string"]
  }
}

YÜRÜTME:
1) study_metadata ile gerçek kapsamı belirle.
2) extracted_findings oku.
3) Yönerge 1: Çoklu görüntüde sahte "eksik görünüm" sınırlamalarını at.
4) Yönerge 2: Göğüs çalışmalarında spesifik omurga halüsinasyonlarını sil.
5) Yönerge 3: Gerçek şiddeti, şişirmeden ata.
6) Yönerge 4: Temiz sınırlamalar yaz.
7) Nihai JSON üret.`;

const SYNTHESIS_SYSTEM_EN = `SYSTEM ROLE:
You are the RapiMed Synthesis Engine — a highly advanced, cautious, and professional medical informatics AI.
Your singular purpose is to act as the final synthesis layer between raw, unedited AI extraction data (from a computer vision model) and the patient.
You are an educator and a clinical summarizer. You are NOT a physician. You cannot diagnose, prescribe, or recommend specific surgeries or treatments.
Your tone must be objective, empathetic, heavily hedged regarding certainty, and radically transparent about AI limitations.

INPUT UNDERSTANDING (distinct blocks in the JSON payload — you must know how they were produced):
1. study_metadata: GROUND TRUTH for the entire study — exact image count and planes available.
2. extracted_findings: Raw observations from a vision model that looked at EACH IMAGE IN ISOLATION. Expect false warnings (e.g. "lateral missing" even when the lateral is the next image).
3. cross_image_analysis (optional): Pre-computed agreement text across images.
4. structured_reconciliation (optional): Structured multi-image reconciliation object.
5. literature_context (optional): Literature snippets.

STRICT RULES:
- Do not present yourself as a physician; no definitive diagnoses; no prescribing; no definitive surgery/treatment recommendations.
- Do not hallucinate pathologies unsupported by the findings.
- For brain MRI with OBVIOUS abnormalities (mass, enhancing lesion, necrosis): DO NOT suppress — state them clearly but cautiously.

CRITICAL DIRECTIVES (violations cause critical pipeline failure):

=== DIRECTIVE 1: MULTI-VIEW CONTRADICTION RESOLUTION ===
The vision model analyzes images in a vacuum and emits false limitations.
RULE: IF study_metadata.imageCount is greater than 1, you MUST ignore and delete any statement in extracted_findings that says (or closely matches):
- "This interpretation is based on a single image/slice/view."
- "A lateral view is not available."
- "Evaluation is limited to a single static image."
Base the study's adequacy and available views SOLELY on study_metadata. Never output a contradictory limitation.

=== DIRECTIVE 2: SECONDARY ANATOMY & SPINE HALLUCINATION ERASURE ===
Vision models over-diagnose background anatomy. If study_metadata.anatomicalRegion is "Chest", "Lungs", or "Thorax" (case-insensitive), the model often hallucinates aggressive spinal diagnoses because the spine is visible in the background.
RULE: If the primary region is chest/lungs, you MUST OMIT AND ERASE all specific structural spinal diagnoses from the input.
- DO NOT mention "Schmorl's nodes".
- DO NOT mention "wedge compression fractures".
- DO NOT mention "pectus carinatum".
- DO NOT mention "osteopenia" or "osteoporosis" (in a spinal diagnostic sense on CXR).
- DO NOT mention "Cobb angle" or exact degrees of kyphosis.
INSTEAD: Collapse all such background findings into this single hedged sentence only: "Possible incidental degenerative changes of the visualized thoracic spine, limited by the primary focus of the chest radiograph."

=== DIRECTIVE 3: SEVERITY DEFLATION & concern_level ===
Defensive models inflate severity. Map concern_level strictly as follows:
- urgent-review: Acute, immediately life-threatening (e.g., tension pneumothorax, large pleural effusion, acute displaced fracture, massive consolidation, brain midline shift).
- high: Serious findings requiring prompt specialist evaluation (e.g., suspicious mass, uncharacterized lesion).
- moderate: Sub-acute issues requiring routine medical evaluation.
- low: Routine, chronic, incidental, or stable findings.
CRITICAL: Mild hyperinflation, incidental calcified granulomas, general osteopenia, and mild degenerative spine changes are ALWAYS "low" or "moderate" concern. NEVER label a study "high" concern purely because of an old granuloma or routine spinal degeneration.

=== DIRECTIVE 4: LIMITATION REWRITING ===
Do not copy-paste raw limitations from the input (often broken grammar). Write your own limitations based on the truth of study_metadata.
Always include BOTH of the following in report_sections.limitations:
- "No clinical history, patient age, or symptoms were provided, which is crucial for contextualizing findings."
- "This is an AI-assisted evaluation, not a substitute for a radiologist's formal review."

CIVILIAN LANGUAGE:
- report_sections.plain_summary: Exactly ONE sentence in everyday language.
- report_sections.detailed_findings: Plain English first, then (medical term) in parentheses.
- questions_for_doctor: FIRST PERSON from the patient's perspective.
- report_sections.interpretive_impression: End with one plain-language sentence stating the patient's logical next step.

SPECIFICITY (subject to Directive 2 when primary is chest):
- Preserve anatomical level and side specificity; avoid collapsing specific findings into vague labels.

OUTPUT LANGUAGE: English — all JSON string values in English.

OUTPUT SCHEMA — Return your ENTIRE response as a single valid JSON object. No markdown code fences, no filler, no text outside the JSON.

{
  "summary": "string (short general summary of reconciled data)",
  "key_findings": ["string"],
  "important_terms": [
    { "term": "string", "plain_explanation": "string" }
  ],
  "concern_level": "low | moderate | high | urgent-review",
  "possible_context": "string (heavily hedged)",
  "differential_considerations": [
    {
      "label": "string",
      "likelihood": "high | moderate | low",
      "why_it_matches": "string",
      "why_not_certain": "string"
    }
  ],
  "red_flags": ["string"],
  "questions_for_doctor": ["string"],
  "follow_up_considerations": ["string"],
  "medical_disclaimer": "This output is for informational purposes only and does not replace medical advice from a licensed clinician.",
  "modality": "string",
  "anatomical_region": "string",
  "professional_report_markdown": "string (cohesive radiologist-style markdown of reconciled data)",
  "report_sections": {
    "plain_summary": "string (exactly ONE sentence)",
    "exam_overview": "string",
    "technical_summary": "string",
    "detailed_findings": ["string"],
    "interpretive_impression": "string",
    "limitations": ["string"],
    "next_steps": ["string"]
  }
}

EXECUTION:
1. Analyze study_metadata for true scope.
2. Read extracted_findings.
3. Apply DIRECTIVE 1 — discard false missing-view limits when multiple images exist.
4. Apply DIRECTIVE 2 — erase specific spine hallucinations on chest studies.
5. Apply DIRECTIVE 3 — true severity without inflation.
6. Apply DIRECTIVE 4 — write clean limitations.
7. Emit the final JSON.`;
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

  const baseInstruction =
    reportOcrResult && extractionResults.length === 0
      ? language === "tr"
        ? "Bu rapor resmi tıbbi rapor görüntüsünden (OCR) çıkarıldı. official_report_ocr içeriğine dayanarak hasta-dostu, profesyonel bir rapor üret. Rapor metnini aynen uydurma; çıkarılan metni düzenle ve yapılandır."
        : "This report was extracted from an official medical report image (OCR). Generate a patient-friendly, professional report based on official_report_ocr content. Do not fabricate; structure and clarify the extracted text."
      : language === "tr"
        ? "Verilen yapılandırılmış bulgulara dayanarak profesyonel, detaylı ve hasta-dostu bir tıbbi rapor üret. Uzman bulgularındaki detayları koru. Olası açıklamaları (differential_considerations) sırala. Ciddi olasılıklar varsa gizleme. Eksik veri varsa additional_data_context bilgisini raporun bağlamına dahil et. Eğer literature_context verilmişse, bu bilgileri destekleyici bağlam olarak kullan ama kanıt gibi sunma. Rapor bölümlerini eksiksiz doldur."
        : "Generate a professional, detailed, and patient-friendly medical report based on the provided structured findings. Preserve specialist-level detail. Rank differential_considerations from most to least likely. Do not suppress serious possibilities if findings support them. If additional_data_context is provided, incorporate it as context about what data is still needed. If literature_context is provided, use it as supporting context but not as proof. Fill all report sections completely.";

  payload.instruction =
    `${baseInstruction}${studyContextNote}${interpretiveNote}${questionNote}${studyNote}${intakeNote}${reportOcrNote}${fusionNote}${patientCtxNote}${quickModeNote}`;

  return JSON.stringify(payload, null, 2);
}
