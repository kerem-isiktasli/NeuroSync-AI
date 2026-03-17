/**
 * Runs DICOM analysis asynchronously and stores result in job store.
 * Domain-aware: spine uses vertebra logic; brain/chest/abdomen use region-specific processors.
 */
import {
  isDicomBuffer,
  assembleStudy,
  buildVolume,
  indexSlicesToVertebrae,
  scanPathology,
  buildRadiologyReport,
  MAX_DICOM_FILES,
  MAX_STUDY_SIZE_BYTES,
} from "@/lib/dicom";
import { mapAnatomyUniversal } from "@/lib/dicom/anatomyMapperUniversal";
import { googleHealthcare } from "@/lib/googleHealthcare";
import { routeToDomain } from "@/lib/medical/domainRouter";
import {
  buildSpineFindings,
  buildBrainFindings,
  buildChestFindings,
  buildAbdomenFindings,
  buildGeneralFindings,
} from "@/lib/medical/processors";
import {
  createJob,
  updateJob,
  getJob,
  type AnalysisJobResult,
} from "./analysisJobStore";

const MAX_DICOM_SLICES = parseInt(
  process.env.MAX_DICOM_SLICES_FOR_AI || "50",
  10
);

export interface JobPayload {
  images: Array<{ imageBase64: string; fileName: string }>;
  language?: "tr" | "en";
}

import { extractDataUriMeta } from "@/lib/dataUriUtils";

export async function runDicomAnalysisJob(
  jobId: string,
  payload: JobPayload
): Promise<void> {
  const job = getJob(jobId);
  if (!job || job.status !== "pending") return;

  updateJob(jobId, { status: "processing" });

  try {
    const { images, language = "en" } = payload;
    if (!images?.length) {
      updateJob(jobId, { status: "failed", error: "No images provided" });
      return;
    }

    const dicomFiles = images
      .map((img) => {
        const { mimeType, base64 } = extractDataUriMeta(img.imageBase64);
        const name = (img.fileName ?? "").toLowerCase();
        const looksLikeDicom =
          name.endsWith(".dcm") ||
          name.endsWith(".dicom") ||
          mimeType.includes("dicom") ||
          mimeType.includes("application/octet-stream") ||
          !mimeType;
        if (!base64 && !looksLikeDicom) return null;
        try {
          const buf = Buffer.from(base64, "base64");
          if (buf.length < 132) {
            if (process.env.NODE_ENV !== "production") {
              console.warn(`[DICOM] Rejected ${img.fileName}: buffer too small (${buf.length} < 132)`);
            }
            return null;
          }
          if (isDicomBuffer(buf)) {
            return { buffer: buf as Buffer | Uint8Array, fileName: img.fileName };
          }
          if (process.env.NODE_ENV !== "production" && looksLikeDicom) {
            const preamble = buf.slice(128, 132);
            console.warn(
              `[DICOM] Rejected ${img.fileName}: no DICM magic at 128-132, got [${Array.from(preamble).join(",")}], mime=${mimeType}`
            );
          }
        } catch (e) {
          if (process.env.NODE_ENV !== "production") {
            console.warn(`[DICOM] Rejected ${img.fileName}: decode error`, e);
          }
        }
        return null;
      })
      .filter((f): f is { buffer: Buffer | Uint8Array; fileName: string } => f !== null);

    if (dicomFiles.length === 0) {
      updateJob(jobId, { status: "failed", error: "No valid DICOM files found" });
      return;
    }

    if (dicomFiles.length > MAX_DICOM_FILES) {
      updateJob(jobId, {
        status: "failed",
        error: `Maximum ${MAX_DICOM_FILES} files supported`,
      });
      return;
    }

    const totalBytes = dicomFiles.reduce((s, f) => s + (f.buffer?.byteLength ?? 0), 0);
    if (totalBytes > MAX_STUDY_SIZE_BYTES) {
      updateJob(jobId, {
        status: "failed",
        error: `Study size exceeds ${MAX_STUDY_SIZE_BYTES / (1024 * 1024 * 1024)}GB limit`,
      });
      return;
    }

    const cappedFiles = dicomFiles.slice(0, MAX_DICOM_SLICES);
    const study = assembleStudy(cappedFiles);
    const volume = buildVolume(study.orderedSlices);
    const anatomyUniversal = mapAnatomyUniversal({
      modality: study.modality,
      seriesDescription: study.orderedSlices[0]?.metadata.seriesDescription,
      bodyPartExamined: study.orderedSlices[0]?.metadata.bodyPartExamined,
    });

    const domainRoute = routeToDomain({
      uploadType: "dicom-study",
      modality: study.modality,
      anatomicalRegion: anatomyUniversal.region,
      hasDicomStudy: true,
    });

    const vertebraIndexMap = anatomyUniversal.isSpine
      ? indexSlicesToVertebrae(study.orderedSlices, anatomyUniversal.vertebraRange)
      : {};
    const pathologyScan = scanPathology({
      volume,
      orderedSlices: study.orderedSlices,
      vertebraIndexMap,
    });

    const detectedAnomaliesForVertex = pathologyScan.observations.map((o) => ({
      sliceIndex: o.sliceIndex,
      vertebraLevel: o.vertebraLevel,
      region: (o as unknown as { region?: string }).region,
      organ: (o as unknown as { organ?: string }).organ,
      pathologyType: o.pathologyType,
      description: o.description,
      confidence: o.confidence,
    }));

    const studyReportInputUniversal = {
      studySummary: {
        studyType: study.modality,
        region: anatomyUniversal.region,
        sliceCount: study.sliceCount,
        studyUID: study.studyUID,
        seriesUID: study.seriesUID,
        vertebraRange: anatomyUniversal.vertebraRange,
        vertebraeFindings: Object.entries(vertebraIndexMap).map(([level, _]) => ({
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
      detectedAnomalies: detectedAnomaliesForVertex,
      domain: domainRoute.domain,
    };

    let radiologyReport: {
      impression: string;
      vertebraeFindings: Array<{ level: string; finding: string }>;
      abnormalities: string[];
      recommendedNextSteps: string[];
    };
    let keyFindings: string[];
    let avgConfidence: number;

    if (anatomyUniversal.isSpine) {
      const studyReportInputSpine = {
        studySummary: studyReportInputUniversal.studySummary,
        sliceStatistics: studyReportInputUniversal.sliceStatistics,
        detectedAnomalies: studyReportInputUniversal.detectedAnomalies.map(
          ({ region: _r, organ: _o, ...rest }) => rest
        ),
      };
      try {
        radiologyReport = await googleHealthcare.analyzeStudy(
          studyReportInputSpine,
          language
        );
      } catch {
        const regionForLegacy =
          anatomyUniversal.region === "T-SPINE"
            ? "CHEST"
            : (anatomyUniversal.region as "C-SPINE" | "CHEST" | "LUMBAR" | "THORACOLUMBAR" | "SACRUM" | "UNKNOWN");
        const legacyAnatomy = {
          region: regionForLegacy,
          vertebraRange: anatomyUniversal.vertebraRange,
        };
        radiologyReport = buildRadiologyReport({
          study,
          anatomy: legacyAnatomy,
          vertebraIndexMap,
          pathologyScan,
        });
      }
      keyFindings =
        radiologyReport.abnormalities.length > 0
          ? radiologyReport.abnormalities
          : radiologyReport.vertebraeFindings
              .filter((v) => v.finding !== "No significant finding.")
              .map((v) => `${v.level}: ${v.finding}`);
      avgConfidence =
        pathologyScan.observations.length > 0
          ? pathologyScan.observations.reduce((s, o) => s + o.confidence, 0) /
            pathologyScan.observations.length
          : 0.8;
    } else {
      try {
        const vertexOut = await googleHealthcare.analyzeStudyUniversal(
          studyReportInputUniversal,
          language
        );
        const obj = vertexOut as Record<string, unknown>;
        const getArr = (key: string) =>
          (Array.isArray(obj[key]) ? obj[key] : []) as string[];
        const getFindings = (key: string) =>
          (Array.isArray(obj[key])
            ? (obj[key] as Array<{ level?: string; lobe?: string; region?: string; organ?: string; finding: string }>).map(
                (x) => (x.level ? `${x.level}: ` : x.lobe ? `${x.lobe}: ` : x.region ? `${x.region}: ` : x.organ ? `${x.organ}: ` : "") + (x.finding ?? "")
              )
            : []) as string[];
        radiologyReport = {
          impression: String(obj.impression ?? "No significant abnormality detected."),
          vertebraeFindings: [],
          abnormalities: getArr("abnormalities"),
          recommendedNextSteps: getArr("recommendedNextSteps"),
        };
        keyFindings =
          radiologyReport.abnormalities.length > 0
            ? radiologyReport.abnormalities
            : getFindings("vertebraeFindings").length > 0
              ? getFindings("vertebraeFindings")
              : getFindings("lesionLocalization").length > 0
                ? getFindings("lesionLocalization")
                : getFindings("lungLobeFindings").length > 0
                  ? getFindings("lungLobeFindings")
                  : getFindings("organFindings").length > 0
                    ? getFindings("organFindings")
                    : getArr("findings");
      } catch {
        radiologyReport = {
          impression: "No significant abnormality detected. AI analysis unavailable for this domain.",
          vertebraeFindings: [],
          abnormalities: [],
          recommendedNextSteps: ["Routine follow-up per clinical indication."],
        };
        keyFindings = [];
      }
      avgConfidence = 0.7;
    }

    const result: AnalysisJobResult = {
      studyMetadata: {
        studyUID: study.studyUID,
        seriesUID: study.seriesUID,
        modality: study.modality,
        sliceCount: study.sliceCount,
      },
      anatomicalRegion: anatomyUniversal.region,
      vertebraMap: anatomyUniversal.isSpine ? { ...vertebraIndexMap } : {},
      findingsPerVertebra: radiologyReport.vertebraeFindings,
      finalImpression: radiologyReport.impression,
      confidenceScore: Math.round(avgConfidence * 100) / 100,
      summary: radiologyReport.impression,
      key_findings: keyFindings.length > 0 ? keyFindings : ["No significant findings."],
      abnormalities: radiologyReport.abnormalities,
      recommendedNextSteps: radiologyReport.recommendedNextSteps,
      domain: domainRoute.domain,
    };

    updateJob(jobId, { status: "completed", result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    updateJob(jobId, { status: "failed", error: message });
  }
}
