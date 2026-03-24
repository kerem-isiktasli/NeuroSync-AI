/**
 * DICOM Analysis Pipeline — Shared logic for /api/dicom/analyze (multipart).
 * Runs: assembleStudy → buildVolume → studyImageAnalyzer (real slice analysis) → Vertex synthesis → FinalResponse.
 */
import {
  assembleStudy,
  buildVolume,
  indexSlicesToVertebrae,
  scanPathology,
  buildRadiologyReport,
  type RadiologyReport,
} from "@/lib/dicom";
import { mapAnatomyUniversal } from "@/lib/dicom/anatomyMapperUniversal";
import { runStudyImageAnalysis, toPathologyObservations } from "@/lib/dicom/studyImageAnalyzer";
import { googleHealthcare } from "@/lib/googleHealthcare";
import { routeToDomain } from "@/lib/medical/domainRouter";

// DICOM ingest cap is separate from screenshot analysis cap.
// MAX_DICOM_SLICES_FOR_AI controls screenshots. DICOM_MAX_FILES controls DICOM ingest.
const MAX_DICOM_SLICES_INGEST = parseInt(
  process.env.DICOM_MAX_FILES ||
    process.env.MAX_DICOM_SLICES_FOR_AI ||
    "300",
  10
);

export interface DicomFinalResponse {
  reportMode?: "METADATA_ONLY_REPORT" | "LIMITED_METADATA_REPORT" | "LIMITED_IMAGE_ANALYSIS_REPORT" | "FULL_INTERPRETATION_REPORT";
  summary: string;
  key_findings: string[];
  important_terms: Array<{ term: string; plain_explanation: string }>;
  concern_level: "low" | "moderate" | "high" | "urgent-review";
  possible_context: string;
  differential_considerations: Array<{
    label: string;
    likelihood: "high" | "moderate" | "low";
    why_it_matches: string;
    why_not_certain: string;
  }>;
  additional_data_requested: Array<{
    item: string;
    reason: string;
    priority: "high" | "medium" | "low";
  }>;
  red_flags: string[];
  literature_support: Array<{
    title: string;
    source: string;
    year: string;
    relevance: string;
  }>;
  questions_for_doctor: string[];
  follow_up_considerations: string[];
  medical_disclaimer: string;
  modality: string;
  anatomical_region: string;
  professional_report_markdown: string;
  report_sections: {
    exam_overview: string;
    technical_summary: string;
    detailed_findings: string[];
    interpretive_impression: string;
    limitations: string[];
    next_steps: string[];
    study_adequacy_summary: string;
    anatomical_specificity_summary: string;
    findings_by_level_summary: string;
    what_cannot_be_determined: string[];
    evidence_agreement_summary: string;
  };
}

export type DicomPipelineMeta = {
  fileNames: string[];
  pipeline: string;
  domain: string;
  reportMode?: "METADATA_ONLY_REPORT" | "LIMITED_METADATA_REPORT" | "LIMITED_IMAGE_ANALYSIS_REPORT" | "FULL_INTERPRETATION_REPORT";
  studyMetadata: {
    studyUID: string;
    seriesUID: string;
    modality: string;
    sliceCount: number;
    totalUploaded?: number;
    totalAnalyzed?: number;
  };
  sliceCount: number;
  anatomicalRegion: string;
  vertebraMap: Record<string, number>;
  findingsPerVertebra: Array<{ level: string; finding: string }>;
  finalImpression: string;
  confidenceScore: number;
};

function toFinalResponse(
  report: RadiologyReport,
  language: "tr" | "en",
  fileNames: string[],
  sliceCount: number,
  reportMode: "LIMITED_IMAGE_ANALYSIS_REPORT" | "FULL_INTERPRETATION_REPORT",
  sliceStats?: { totalUploaded: number; totalUsable: number; totalAnalyzed: number }
): DicomFinalResponse {
  const tr = language === "tr";
  const findingsByLevel = report.vertebraeFindings
    .map((v) => `${v.level}: ${v.finding}`)
    .join("\n");
  let keyFindings: string[] =
    report.abnormalities.length > 0
      ? report.abnormalities
      : report.vertebraeFindings
          .filter((v) => v.finding !== "No significant finding.")
          .map((v) => `${v.level}: ${v.finding}`);
  if (keyFindings.length === 0) {
    keyFindings =
      reportMode === "LIMITED_IMAGE_ANALYSIS_REPORT"
        ? [tr ? "Sınırlı görüntü analizi yapıldı." : "Limited image analysis was performed."]
        : [tr ? "Belirgin anormallik saptanmadı." : "No significant abnormality detected."];
  }
  return {
    reportMode,
    summary: report.impression,
    key_findings: keyFindings,
    important_terms: [],
    concern_level: report.abnormalities.length > 0 ? "moderate" : "low",
    possible_context: tr
      ? `${report.studyType} ${report.region} çalışması. ${report.impression}`
      : `${report.studyType} ${report.region} study. ${report.impression}`,
    differential_considerations: [],
    additional_data_requested: [],
    red_flags: report.abnormalities,
    literature_support: [],
    questions_for_doctor: [],
    follow_up_considerations: report.recommendedNextSteps,
    medical_disclaimer: tr
      ? "Bu çıktı bilgilendirme amaçlıdır. Kesin tanı için uzman hekim değerlendirmesi gerekir."
      : "This output is for informational purposes only. Expert review required for definitive diagnosis.",
    modality: report.studyType,
    anatomical_region: report.region,
    professional_report_markdown: [
      `## ${tr ? "Çalışma Türü" : "Study Type"}: ${report.studyType}`,
      `## ${tr ? "Bölge" : "Region"}: ${report.region}`,
      "",
      `### ${tr ? "Seviye Bulguları" : "Findings by Level"}`,
      findingsByLevel || (tr ? "Veri yok." : "No data."),
      "",
      `### ${tr ? "İzlenim" : "Impression"}`,
      report.impression,
    ].join("\n"),
    report_sections: {
      exam_overview: `${report.studyType} ${report.region}`,
      technical_summary: sliceStats
        ? (tr
          ? `Yüklenen: ${sliceStats.totalUploaded}, kullanılabilir: ${sliceStats.totalUsable}, analiz edilen: ${sliceStats.totalAnalyzed} kesit.${sliceStats.totalAnalyzed < sliceStats.totalUsable ? ` Temsili örnekleme: ${sliceStats.totalAnalyzed}/${sliceStats.totalUsable} kesit AI yorumu için incelendi.` : ""}`
          : `Uploaded: ${sliceStats.totalUploaded}, usable: ${sliceStats.totalUsable}, analyzed: ${sliceStats.totalAnalyzed} slices.${sliceStats.totalAnalyzed < sliceStats.totalUsable ? ` Representative sampling: ${sliceStats.totalAnalyzed} of ${sliceStats.totalUsable} slices analyzed for AI interpretation.` : ""}`)
        : (tr ? `${sliceCount} kesit işlendi.` : `${sliceCount} slices processed.`),
      detailed_findings: report.abnormalities.length > 0
        ? report.abnormalities
        : report.vertebraeFindings.map((v) => `${v.level}: ${v.finding}`),
      interpretive_impression: report.impression,
      limitations:
        sliceStats && sliceStats.totalAnalyzed < sliceStats.totalUsable
          ? [
              tr
                ? `Temsili örnekleme: ${sliceStats.totalAnalyzed}/${sliceStats.totalUsable} kesit AI için analiz edildi; tüm seri kapsanmadı.`
                : `Representative sampling: ${sliceStats.totalAnalyzed} of ${sliceStats.totalUsable} slices analyzed for AI; not all slices were included.`,
            ]
          : reportMode === "LIMITED_IMAGE_ANALYSIS_REPORT"
            ? [tr ? "Kısmi kesit analizi; tüm seri kapsanmadı." : "Partial slice analysis; not all slices were analyzed."]
            : [],
      next_steps: report.recommendedNextSteps,
      study_adequacy_summary: "",
      anatomical_specificity_summary: findingsByLevel,
      findings_by_level_summary: findingsByLevel,
      what_cannot_be_determined: [],
      evidence_agreement_summary: "",
    },
  };
}

function buildMetadataOnlyResponse(
  modality: string,
  region: string,
  totalUploaded: number,
  totalUsable: number,
  language: "tr" | "en"
): DicomFinalResponse {
  const tr = language === "tr";
  const summary = tr
    ? "DICOM çalışması alındı. Modalite ve bölge tanımlandı. Görüntü analizi yapılamadı."
    : "DICOM study ingested. Modality and region identified. Image analysis could not be performed.";
  return {
    reportMode: "METADATA_ONLY_REPORT",
    summary,
    key_findings: [
      tr ? `Modalite: ${modality}` : `Modality: ${modality}`,
      tr ? `Bölge: ${region}` : `Region: ${region}`,
      tr ? `Yüklenen: ${totalUploaded}, kullanılabilir: ${totalUsable}` : `Uploaded: ${totalUploaded}, usable: ${totalUsable}`,
      tr ? "Görüntü analizi yapılamadı." : "Image analysis was not performed.",
    ],
    important_terms: [],
    concern_level: "low",
    possible_context: tr ? "Sadece metadata özeti." : "Metadata summary only.",
    differential_considerations: [],
    additional_data_requested: [],
    red_flags: [],
    literature_support: [],
    questions_for_doctor: [],
    follow_up_considerations: [tr ? "Manuel inceleme önerilir." : "Manual review recommended."],
    medical_disclaimer: tr
      ? "Bu çıktı bilgilendirme amaçlıdır."
      : "This output is for informational purposes only.",
    modality,
    anatomical_region: region,
    professional_report_markdown: `## ${tr ? "YALNIZCA METADATA" : "METADATA ONLY"}\n\n${summary}`,
    report_sections: {
      exam_overview: `${modality} ${region}`,
      technical_summary: tr ? `${totalUploaded} kesit yüklendi, ${totalUsable} kullanılabilir.` : `${totalUploaded} slices uploaded, ${totalUsable} usable.`,
      detailed_findings: [],
      interpretive_impression: tr ? "Tanısal yorumlama yapılmadı." : "No diagnostic interpretation performed.",
      limitations: [tr ? "Görüntü analizi yapılamadı." : "Image analysis could not be performed."],
      next_steps: [tr ? "Manuel inceleme önerilir." : "Manual review recommended."],
      study_adequacy_summary: tr ? "Sadece metadata." : "Metadata only.",
      anatomical_specificity_summary: "",
      findings_by_level_summary: "",
      what_cannot_be_determined: [tr ? "Patolojik bulgular" : "Pathologic findings"],
      evidence_agreement_summary: "",
    },
  };
}

export interface RunDicomAnalysisPipelineParams {
  dicomFiles: Array<{ buffer: Buffer | Uint8Array; fileName: string }>;
  language: "tr" | "en";
  sendEvent: (type: string, data: unknown) => Promise<void>;
  fileNames?: string[];
}

export interface RunDicomAnalysisPipelineResult {
  result: DicomFinalResponse;
  meta: DicomPipelineMeta;
}

export async function runDicomAnalysisPipeline(
  params: RunDicomAnalysisPipelineParams
): Promise<RunDicomAnalysisPipelineResult> {
  const { dicomFiles, language, sendEvent, fileNames } = params;
  const names = fileNames ?? dicomFiles.map((f) => f.fileName);
  const totalUploaded = dicomFiles.length;
  const pipelineStart = Date.now();
  const logPhase = (phase: string) => {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[dicom] ${phase} @ +${Date.now() - pipelineStart}ms`);
    }
  };

  logPhase("start");
  const cappedFiles = dicomFiles.slice(0, MAX_DICOM_SLICES_INGEST);

  // ──── DICOM COUNT CHECKPOINTS ────
  await sendEvent("log", {
    phase: "dicom-count-checkpoint",
    uploadedCount: totalUploaded,
    ingestCap: MAX_DICOM_SLICES_INGEST,
    afterCapCount: cappedFiles.length,
    message: totalUploaded > MAX_DICOM_SLICES_INGEST
      ? `Ingested ${cappedFiles.length} of ${totalUploaded} files (capped at ${MAX_DICOM_SLICES_INGEST}).`
      : `Ingesting all ${totalUploaded} files.`,
  });

  await sendEvent("status", {
    step: "dicom-ingestion",
    message:
      language === "tr"
        ? `DICOM çalışması işleniyor (${cappedFiles.length} kesit)...`
        : `Processing DICOM study (${cappedFiles.length} slices)...`,
  });
  await sendEvent("progress", {
    phase: "dicom-ingest",
    percent: 12,
    message:
      language === "tr"
        ? `DICOM işleniyor (${cappedFiles.length} dosya)...`
        : `Processing DICOM (${cappedFiles.length} files)...`,
  });

  logPhase("assemble-start");
  const study = assembleStudy(cappedFiles);
  const totalUsable = study.sliceCount;
  logPhase(`assemble-done usable=${totalUsable}`);

  await sendEvent("log", {
    phase: "dicom-count-checkpoint",
    validDicomCount: totalUsable,
    seriesCount: 1,
    selectedSeriesSliceCount: totalUsable,
    message: `Valid DICOM slices after assembly: ${totalUsable}.`,
  });

  await sendEvent("status", {
    step: "volume-reconstruction",
    message:
      language === "tr" ? "Hacim oluşturuluyor..." : "Building volume...",
  });

  logPhase("volume-start");
  const volume = buildVolume(study.orderedSlices);
  logPhase("volume-done");
  const anatomyUniversal = mapAnatomyUniversal({
    modality: study.modality,
    seriesDescription: study.orderedSlices[0]?.metadata.seriesDescription,
    bodyPartExamined: study.orderedSlices[0]?.metadata.bodyPartExamined,
  });
  const vertebraIndexMap = anatomyUniversal.isSpine
    ? indexSlicesToVertebrae(
        study.orderedSlices,
        anatomyUniversal.vertebraRange
      )
    : {};

  await sendEvent("status", {
    step: "slice-analysis",
    message:
      language === "tr"
        ? "Kesit görüntüleri analiz ediliyor..."
        : "Analyzing slice images...",
  });
  await sendEvent("progress", {
    phase: "slice-analysis",
    percent: 38,
    message:
      language === "tr"
        ? "Kesit analizi çalışıyor..."
        : "Running slice analysis...",
  });

  logPhase("slice-analysis-start");
  let analysisResult: Awaited<ReturnType<typeof runStudyImageAnalysis>>;
  try {
    analysisResult = await runStudyImageAnalysis({
      volume,
      orderedSlices: study.orderedSlices,
      modality: study.modality,
      anatomicalRegion: anatomyUniversal.region,
      vertebraIndexMap,
      language,
      sendEvent,
    });
    logPhase(`slice-analysis-done analyzed=${analysisResult.analyzedSliceCount}/${analysisResult.totalSliceCount}`);
  } catch (err) {
    console.error("[dicomAnalysisPipeline] Image analysis failed:", err);
    analysisResult = {
      sliceFindings: [],
      aggregatedFindings: [],
      aggregatedAbnormalities: [],
      analyzedSliceCount: 0,
      totalSliceCount: totalUsable,
      sampledIndices: [],
      domain: "general-radiology",
      modality: study.modality,
      anatomicalRegion: anatomyUniversal.region,
      avgConfidence: 0,
      hadImageAnalysis: false,
    };
    logPhase("slice-analysis-FAILED");
  }

  await sendEvent("progress", {
    phase: "slice-analysis-done",
    percent: 68,
    message:
      language === "tr"
        ? `Kesit analizi: ${analysisResult.analyzedSliceCount}/${analysisResult.totalSliceCount}`
        : `Slice analysis: ${analysisResult.analyzedSliceCount}/${analysisResult.totalSliceCount}`,
    completed: analysisResult.analyzedSliceCount,
    total: analysisResult.totalSliceCount,
  });

  await sendEvent("log", {
    phase: "dicom-count-checkpoint",
    convertedImageCount: analysisResult.totalSliceCount,
    analyzedSliceCount: analysisResult.analyzedSliceCount,
    sampledIndices: analysisResult.sampledIndices,
    hadImageAnalysis: analysisResult.hadImageAnalysis,
    message: `Slice analysis: ${analysisResult.analyzedSliceCount}/${analysisResult.totalSliceCount} analyzed, hadImageAnalysis=${analysisResult.hadImageAnalysis}.`,
  });

  const pathologyObservations = toPathologyObservations(
    analysisResult.sliceFindings,
    vertebraIndexMap
  );
  const pathologyScan = {
    observations: pathologyObservations.map((o) => ({
      sliceIndex: o.sliceIndex,
      vertebraLevel: o.vertebraLevel,
      pathologyType: "other" as const,
      description: o.description,
      confidence: o.confidence,
    })),
    summary:
      analysisResult.aggregatedAbnormalities.length > 0
        ? analysisResult.aggregatedAbnormalities.join(". ")
        : "No significant abnormality detected.",
  };

  const hasRealFindings = pathologyScan.observations.length > 0 || analysisResult.aggregatedAbnormalities.length > 0;
  const coverageRatio = analysisResult.totalSliceCount > 0
    ? analysisResult.analyzedSliceCount / analysisResult.totalSliceCount
    : 0;
  const isLimitedAnalysis =
    analysisResult.hadImageAnalysis &&
    (analysisResult.avgConfidence < 60 || coverageRatio < 0.5);

  logPhase("vertex-synthesis-start");
  await sendEvent("status", {
    step: "ai-reasoning",
    message:
      language === "tr"
        ? "Vertex AI ile çalışma yorumlanıyor..."
        : "Interpreting study with Vertex AI...",
  });
  await sendEvent("progress", {
    phase: "vertex-synthesis",
    percent: 78,
    message:
      language === "tr"
        ? "AI çalışma yorumu oluşturuluyor..."
        : "Generating AI study interpretation...",
  });

  const domainRoute = routeToDomain({
    uploadType: "dicom-study",
    modality: study.modality,
    anatomicalRegion: anatomyUniversal.region,
    hasDicomStudy: true,
  });

  const studyReportInputBase = {
    studySummary: {
      studyType: study.modality,
      region: anatomyUniversal.region,
      sliceCount: study.sliceCount,
      studyUID: study.studyUID,
      seriesUID: study.seriesUID,
      vertebraRange: anatomyUniversal.vertebraRange,
      vertebraeFindings: Object.entries(vertebraIndexMap).map(([level]) => ({
        level,
        finding:
          pathologyScan.observations.find((o) => o.vertebraLevel === level)
            ?.description ?? "No significant finding.",
      })),
    },
    sliceStatistics: {
      width: volume.width,
      height: volume.height,
      depth: volume.depth,
      voxelSpacing: volume.voxelSpacing,
      sliceCount: study.sliceCount,
    },
    groundedSliceFindings: analysisResult.sliceFindings.map((sf) => ({
      sliceIndex: sf.sliceIndex,
      sliceLabel: `Slice ${sf.sliceIndex + 1}/${analysisResult.totalSliceCount}`,
      findings: sf.findings,
      abnormalities: sf.abnormalities,
      confidence: sf.confidence,
      limitations: sf.limitations,
    })),
    coverageSummary: {
      totalSlices: analysisResult.totalSliceCount,
      analyzedSlices: analysisResult.analyzedSliceCount,
      sampledIndices: analysisResult.sampledIndices,
      notAnalyzed: Array.from(
        { length: analysisResult.totalSliceCount },
        (_, i) => i
      ).filter((i) => !analysisResult.sampledIndices.includes(i)),
      coveragePercent: Math.round(
        (analysisResult.analyzedSliceCount /
          Math.max(1, analysisResult.totalSliceCount)) *
          100
      ),
    },
    detectedAnomalies: pathologyScan.observations.map((o) => ({
      sliceIndex: o.sliceIndex,
      vertebraLevel: o.vertebraLevel,
      pathologyType: o.pathologyType,
      description: o.description,
      confidence: o.confidence,
    })),
  };

  let radiologyReport: RadiologyReport;
  const reportMode: "METADATA_ONLY_REPORT" | "LIMITED_IMAGE_ANALYSIS_REPORT" | "FULL_INTERPRETATION_REPORT" =
    !analysisResult.hadImageAnalysis
      ? "METADATA_ONLY_REPORT"
      : isLimitedAnalysis
        ? "LIMITED_IMAGE_ANALYSIS_REPORT"
        : "FULL_INTERPRETATION_REPORT";

  if (!analysisResult.hadImageAnalysis) {
    radiologyReport = {
      studyType: study.modality,
      region: anatomyUniversal.region,
      vertebraeFindings: Object.entries(vertebraIndexMap).map(([level]) => ({
        level,
        finding: "No significant finding.",
      })),
      abnormalities: [],
      impression:
        language === "tr"
          ? "DICOM çalışması alındı. Modalite ve bölge tanımlandı. Görüntü analizi yapılamadı."
          : "DICOM study ingested. Modality and region identified. Image analysis could not be performed.",
      recommendedNextSteps: [
        language === "tr" ? "Manuel inceleme önerilir." : "Manual review recommended.",
      ],
    };
  } else if (anatomyUniversal.isSpine) {
    logPhase("spine-synthesis-start");
    try {
      const vertexReport = await Promise.race([
        googleHealthcare.analyzeStudy(studyReportInputBase, language),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Spine synthesis timeout (60s)")), 60_000)
        ),
      ]);
      radiologyReport = {
        ...vertexReport,
        abnormalities:
          vertexReport.abnormalities.length > 0
            ? vertexReport.abnormalities
            : analysisResult.aggregatedAbnormalities,
        impression:
          vertexReport.impression && vertexReport.impression !== "No significant abnormality detected."
            ? vertexReport.impression
            : analysisResult.aggregatedAbnormalities.length > 0
              ? analysisResult.aggregatedAbnormalities.join(". ")
              : vertexReport.impression,
      };
      logPhase("spine-synthesis-done");
    } catch (vertexErr) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[dicomAnalysisPipeline] Vertex analyzeStudy failed, using image analysis findings:", vertexErr);
      }
      const legacyAnatomy = {
        region:
          anatomyUniversal.region === "T-SPINE"
            ? "CHEST"
            : (anatomyUniversal.region as "C-SPINE" | "CHEST" | "LUMBAR" | "THORACOLUMBAR" | "SACRUM" | "UNKNOWN"),
        vertebraRange: anatomyUniversal.vertebraRange,
      };
      radiologyReport = buildRadiologyReport({
        study,
        anatomy: legacyAnatomy,
        vertebraIndexMap,
        pathologyScan,
      });
    }
  } else {
    logPhase("universal-synthesis-start");
    try {
      const vertexOut = await Promise.race([
        googleHealthcare.analyzeStudyUniversal(
          { ...studyReportInputBase, domain: domainRoute.domain },
          language
        ),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Universal synthesis timeout (60s)")), 60_000)
        ),
      ]);
      const obj = vertexOut as Record<string, unknown>;
      const getArr = (k: string) => (Array.isArray(obj[k]) ? obj[k] : []) as string[];
      radiologyReport = {
        studyType: String(obj.studyType ?? study.modality),
        region: String(obj.region ?? anatomyUniversal.region),
        vertebraeFindings: [],
        abnormalities: getArr("abnormalities"),
        impression: String(obj.impression ?? "No significant abnormality detected."),
        recommendedNextSteps: getArr("recommendedNextSteps"),
      };
      logPhase("universal-synthesis-done");
    } catch {
      radiologyReport = {
        studyType: study.modality,
        region: anatomyUniversal.region,
        vertebraeFindings: [],
        abnormalities:
          analysisResult.aggregatedAbnormalities.length > 0
            ? analysisResult.aggregatedAbnormalities
            : [],
        impression:
          analysisResult.aggregatedAbnormalities.length > 0
            ? analysisResult.aggregatedAbnormalities.join(". ")
            : "No significant abnormality detected.",
        recommendedNextSteps: ["Routine follow-up per clinical indication."],
      };
    }
  }

  const sliceStats = {
    totalUploaded,
    totalUsable,
    totalAnalyzed: analysisResult.analyzedSliceCount,
  };

  const dicomResult =
    !analysisResult.hadImageAnalysis
      ? buildMetadataOnlyResponse(
          study.modality,
          anatomyUniversal.region,
          totalUploaded,
          totalUsable,
          language
        )
      : toFinalResponse(
          radiologyReport,
          language,
          names,
          study.sliceCount,
          reportMode as "LIMITED_IMAGE_ANALYSIS_REPORT" | "FULL_INTERPRETATION_REPORT",
          sliceStats
        );

  const avgConfidence =
    analysisResult.hadImageAnalysis && analysisResult.sliceFindings.length > 0
      ? analysisResult.avgConfidence / 100
      : 0.5;

  await sendEvent("progress", {
    phase: "dicom-finalize",
    percent: 97,
    message:
      language === "tr" ? "Rapor paketleniyor..." : "Packaging report...",
  });

  const meta: DicomPipelineMeta = {
    fileNames: names,
    pipeline: "dicom-study",
    domain: domainRoute.domain,
    reportMode: dicomResult.reportMode,
    studyMetadata: {
      studyUID: study.studyUID,
      seriesUID: study.seriesUID,
      modality: study.modality,
      sliceCount: study.sliceCount,
      totalUploaded,
      totalAnalyzed: analysisResult.analyzedSliceCount,
    },
    sliceCount: study.sliceCount,
    anatomicalRegion: anatomyUniversal.region,
    vertebraMap: { ...vertebraIndexMap },
    findingsPerVertebra: radiologyReport.vertebraeFindings,
    finalImpression: radiologyReport.impression,
    confidenceScore: Math.round(avgConfidence * 100) / 100,
  };

  return { result: dicomResult, meta };
}
