/**
 * RapiMed Technical Outcome Renderer — faithful pipeline-outcome summary (JSON shape).
 * Deterministic policy text; does not call LLMs. No diagnosis.
 */

import type { UploadCohesionResult } from "./uploadCohesionArbiter";
import type { ProcedureMapperResult } from "./procedureModalityAnatomyMapper";

export type TechnicalOutcomeReportType =
  | "technical_hold"
  | "constrained_processing"
  | "true_cancel_or_reject";

export interface TechnicalOutcomeReport {
  report_type: TechnicalOutcomeReportType;
  summary: string;
  details: string[];
  next_steps: string[];
}

export type TechnicalOutcomePhase =
  | "cohesion_cancel"
  | "procedure_mapper_reject"
  | "pipeline_continuing";

const WEAK_TECH_ALONE = new RegExp(
  [
    "no\\s*dicom",
    "missing\\s*dicom",
    "without\\s*dicom",
    "no\\s*ocr",
    "missing\\s*ocr",
    "no\\s*text\\s*extract",
    "page\\s*summary",
    "thumbnail",
    "visual\\s*summary",
    "filename",
    "file\\s*name",
    "low[-\\s]?confidence\\s*intake",
    "sparse\\s*metadata",
  ].join("|"),
  "i"
);

/** Exported for upload-outcome copy: do not echo these as if they proved non-medical content. */
export function isWeakMetadataAloneReason(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  const stripped = t.replace(/[.;:!?]+$/g, "").trim();
  return WEAK_TECH_ALONE.test(stripped) && stripped.length < 220;
}

function filterDetailsForConstrained(raw: string[]): string[] {
  const out: string[] = [];
  for (const line of raw) {
    const s = String(line).trim();
    if (!s) continue;
    if (isWeakMetadataAloneReason(s)) continue;
    out.push(s);
  }
  return out;
}

function classifyContinuing(params: {
  cohesion: UploadCohesionResult;
  procedureMapper: ProcedureMapperResult | null | undefined;
  coherentSubsetUsed: boolean;
  excludedFileCount: number;
}): TechnicalOutcomeReportType {
  const { cohesion, procedureMapper, coherentSubsetUsed, excludedFileCount } =
    params;
  const pa = cohesion.process_action;
  if (pa === "continue_provisional" || pa === "continue_with_quarantine") {
    return "constrained_processing";
  }
  if (
    procedureMapper?.routing_decision === "accept_provisional" ||
    procedureMapper?.provisional_mapping
  ) {
    return "constrained_processing";
  }
  if (coherentSubsetUsed || excludedFileCount > 0) {
    return "constrained_processing";
  }
  if (cohesion.user_clarification_needed && pa === "continue") {
    return "technical_hold";
  }
  return "constrained_processing";
}

/**
 * Builds the technical outcome object per RapiMed policy:
 * - No escalation of provisional/quarantine paths into hard rejection language.
 * - Weak technical gaps (OCR/DICOM/filenames alone) are not treated as proof of non-medical content.
 */
export function buildTechnicalOutcomeReport(params: {
  language: "tr" | "en";
  phase: TechnicalOutcomePhase;
  cohesion: UploadCohesionResult;
  procedureMapper?: ProcedureMapperResult | null;
  /** pipeline_continuing only */
  coherentSubsetUsed?: boolean;
  excludedFileCount?: number;
}): TechnicalOutcomeReport {
  const {
    language,
    phase,
    cohesion,
    procedureMapper = null,
    coherentSubsetUsed = false,
    excludedFileCount = 0,
  } = params;
  const tr = language === "tr";

  if (phase === "cohesion_cancel") {
    const details: string[] = [
      tr
        ? "Otomatik hat, kullanılabilir tutarlı tıbbi alt küme oluşturamadığı için durdu; bu, tek tek dosyaların tıbbi olmadığının kanıtı değildir."
        : "The automated pipeline stopped because it could not form a usable coherent medical subset—this is not proof that individual files were non-medical.",
    ];
    const reason = cohesion.overall_reason?.trim() ?? "";
    if (reason && !isWeakMetadataAloneReason(reason)) {
      details.push(reason);
    } else if (reason && isWeakMetadataAloneReason(reason)) {
      details.push(
        tr
          ? "Bağlantı veya üst veri sınırlı olabilir; yine de yükleme tek başına kullanılamaz bir tıbbi çalışma olarak sınıflandırıldı."
          : "Linkage or metadata may have been limited; the batch was still classified as not forming a usable coherent study on its own."
      );
    }
    if (
      Array.isArray(cohesion.clarification_questions) &&
      cohesion.clarification_questions.length > 0
    ) {
      details.push(...cohesion.clarification_questions.map(String).filter(Boolean));
    }
    return {
      report_type: "true_cancel_or_reject",
      summary: tr
        ? "Yükleme, güvenilir tutarlı tıbbi alt küme olarak işlenemediği için iptal edildi."
        : "Processing was stopped because no usable coherent medical subset could be established.",
      details,
      next_steps: [
        tr
          ? "Aynı ziyaret veya çalışmaya ait dosyaları birlikte yükleyin; analiz dışı dosyaları çıkarın."
          : "Re-upload files from the same visit or study together; remove non-analysis files.",
      ],
    };
  }

  if (phase === "procedure_mapper_reject") {
    if (
      procedureMapper &&
      procedureMapper.routing_decision !== "reject" &&
      procedureMapper.routing_target !== "reject"
    ) {
      return buildTechnicalOutcomeReport({
        language,
        phase: "pipeline_continuing",
        cohesion,
        procedureMapper,
        coherentSubsetUsed,
        excludedFileCount,
      });
    }
    const details: string[] = [
      tr
        ? "Prosedür yönlendirmesi güvenilir şekilde tamamlanamadı; bu, içeriğin tıbbi olmadığı anlamına gelmez."
        : "Procedure routing could not be completed reliably; that does not mean the content was non-medical.",
    ];
    const fromMapper = [
      ...(procedureMapper?.mapping_conflicts ?? []),
      ...(procedureMapper?.mapping_rationale ?? []),
    ]
      .map((s) => String(s).trim())
      .filter(Boolean);
    const filtered = filterDetailsForConstrained(fromMapper);
    details.push(...filtered.slice(0, 6));

    return {
      report_type: "true_cancel_or_reject",
      summary: tr
        ? "Bu yükleme güvenli bir çıkarıcı hattına yönlendirilemedi."
        : "This upload could not be routed to a safe extractor pipeline.",
      details,
      next_steps: [
        tr
          ? "Daha net görüntü veya rapor türüyle yeniden deneyin veya klinisyeninize danışın."
          : "Retry with clearer imaging or report context, or consult your clinician.",
      ],
    };
  }

  const reportType = classifyContinuing({
    cohesion,
    procedureMapper,
    coherentSubsetUsed,
    excludedFileCount,
  });

  const details: string[] = [
    tr
      ? "Tıbbi işleme, mevcut kanıtlarla sınırlı bağlamda sürdürüldü; eksik OCR, DICOM veya dosya adları tek başına tıbbi olmayan içerik kanıtı değildir."
      : "Medical processing continued under limited linkage/metadata; missing OCR, DICOM, or filenames alone do not prove non-medical content.",
  ];

  if (cohesion.process_action === "continue_provisional") {
    details.push(
      tr
        ? "Küme provizyonel tutarlı kabul edildi; sonuçlar dikkatli yorumlanmalıdır."
        : "The batch was treated as provisionally coherent; interpret results cautiously."
    );
  } else if (cohesion.process_action === "continue_with_quarantine") {
    details.push(
      tr
        ? "Bazı dosyalar karantinaya alındı veya dışlandı; kalan alt küme üzerinden işlem yapıldı."
        : "Some files were quarantined or excluded; processing used the remaining subset."
    );
  }

  if (procedureMapper?.routing_decision === "accept_provisional") {
    details.push(
      tr
        ? "Prosedür eşlemesi provizyonel kabul edildi."
        : "Procedure mapping was accepted on a provisional basis."
    );
  }

  if (coherentSubsetUsed || excludedFileCount > 0) {
    details.push(
      tr
        ? "Yalnızca tutarlı alt küme veya seçilen dosyalar analiz kapsamına alındı."
        : "Only the coherent subset or selected files were included in analysis scope."
    );
  }

  if (cohesion.user_clarification_needed && reportType === "technical_hold") {
    details.push(
      tr
        ? "Ek netleştirme istenebilir; işlem yine de sınırlı kapsamda sürdürüldü."
        : "Additional clarification may be requested; processing continued within scope."
    );
  }

  const summary =
    reportType === "technical_hold"
      ? tr
        ? "İşlem sürdürülüyor; bazı teknik netleştirmeler beklenebilir."
        : "Processing continues; some technical clarifications may be needed."
      : tr
        ? "Tıbbi işleme, sınırlı üst veri veya bağlantı ile sürdürüldü; yükleme kullanılamaz olarak damgalanmadı."
        : "Medical processing continued with limited metadata or linkage; the upload was not labeled unusable.";

  return {
    report_type: reportType,
    summary,
    details,
    next_steps: [
      tr
        ? "Sonuçları klinik bağlamda değerlendirin; gerekirse daha iyi meta veri veya ek görünümlerle yeniden yükleyin."
        : "Interpret results in clinical context; re-upload with better metadata or views if needed.",
    ],
  };
}
