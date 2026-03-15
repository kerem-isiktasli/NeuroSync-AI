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

DOKTOR SORULARI KURALLARI:
- questions_for_doctor HER ZAMAN bulgulara ve görüntüleme türüne özel olmalıdır.
- Jenerik sorulardan kaçın. Somut, bulgularla bağlantılı sorular üret.
- Ayırıcı tanılardan (differential_considerations) türeyen sorular ekle.

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
    "next_steps": ["string — önerilen sonraki adımlar"]
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

DOCTOR QUESTIONS RULES:
- questions_for_doctor MUST ALWAYS be specific to the findings and imaging type.
- Avoid generic questions. Generate concrete, finding-linked questions.
- Include questions derived from the differential_considerations.

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
    "next_steps": ["string — suggested next steps"]
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
  intakeSummary?: {
    studyAdequacy: string;
    recommendedPipeline: string;
    uploadTypesPresent: string[];
    diagnosticImageCount: number;
    localizerCount: number;
    reportImageCount: number;
    hasMixedUpload: boolean;
  } | null;
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
    intakeSummary,
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

  if (crossImageReconciliation) {
    payload.cross_image_analysis = crossImageReconciliation;
  }

  if (intakeSummary) {
    payload.intake_metadata = intakeSummary;
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

  const intakeNote = intakeSummary
    ? language === "tr"
      ? ` intake_metadata mevcutsa: Yükleme türünü (uploadTypesPresent), yerel görüntü sayısını (localizerCount), rapor görüntüsü sayısını (reportImageCount) dikkate al. hasMixedUpload true ise veya reportImageCount>0 ise, rapor görüntülerinin OCR ile işlenmediğini sınırlamalarda belirt.`
      : ` If intake_metadata is present: Consider upload types (uploadTypesPresent), localizer count (localizerCount), report image count (reportImageCount). If hasMixedUpload is true or reportImageCount>0, state in limitations that report images were not processed via OCR.`
    : "";

  payload.instruction =
    language === "tr"
      ? `Verilen yapılandırılmış bulgulara dayanarak profesyonel, detaylı ve hasta-dostu bir tıbbi rapor üret. Uzman bulgularındaki detayları koru. Olası açıklamaları (differential_considerations) sırala. Ciddi olasılıklar varsa gizleme. Eksik veri varsa additional_data_context bilgisini raporun bağlamına dahil et. Eğer literature_context verilmişse, bu bilgileri destekleyici bağlam olarak kullan ama kanıt gibi sunma. Rapor bölümlerini eksiksiz doldur.${interpretiveNote}${questionNote}${studyNote}${intakeNote}`
      : `Generate a professional, detailed, and patient-friendly medical report based on the provided structured findings. Preserve specialist-level detail. Rank differential_considerations from most to least likely. Do not suppress serious possibilities if findings support them. If additional_data_context is provided, incorporate it as context about what data is still needed. If literature_context is provided, use it as supporting context but not as proof. Fill all report sections completely.${interpretiveNote}${questionNote}${studyNote}${intakeNote}`;

  return JSON.stringify(payload, null, 2);
}
