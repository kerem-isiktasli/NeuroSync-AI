/**
 * RapiMed upload outcome messenger — user-facing upload handling JSON only; no medical analysis.
 */

import type { UploadCohesionResult } from "./uploadCohesionArbiter";
import {
  computeKeepIndicesForCohesion,
  fileIdForUploadIndex,
} from "./uploadCohesionArbiter";
import { isWeakMetadataAloneReason } from "./technicalOutcomeRenderer";

export type UploadOutcomeStatus =
  | "analysis_started"
  | "analysis_started_with_exclusions"
  | "analysis_not_started";

export interface UploadOutcomeExcludedFile {
  file_id: string;
  reason: string;
}

export interface UploadOutcomeMessage {
  title: string;
  status: UploadOutcomeStatus;
  body: string;
  excluded_files: UploadOutcomeExcludedFile[];
  clarification_needed: boolean;
  clarification_questions: string[];
}

function coherentGroupsCount(cohesion: UploadCohesionResult): number {
  return cohesion.groups.filter((g) => g.group_type !== "excluded_group").length;
}

function cohesionOverallReasonForProceedingBody(
  cohesion: UploadCohesionResult,
  tr: boolean
): string | null {
  const raw = cohesion.overall_reason?.trim();
  if (!raw) return null;
  const provisionalish =
    cohesion.process_action === "continue_provisional" ||
    cohesion.process_action === "continue_with_quarantine";
  if (provisionalish && isWeakMetadataAloneReason(raw)) {
    return tr
      ? "Üst veri veya bağlantı sınırlı olabilir; analiz provizyonel/kısıtlı tutarlı küme üzerinden sürdürülüyor."
      : "Metadata or linkage may be limited; analysis continues on a provisional or partially coherent subset.";
  }
  return raw;
}

/**
 * Build excluded file list with reasons; includes quarantine, cancel, excluded groups,
 * and any upload slots not kept after cohesion rules.
 */
export function buildUploadExcludedFiles(
  cohesion: UploadCohesionResult,
  imageCount: number,
  keepIndices: number[]
): UploadOutcomeExcludedFile[] {
  const keep = new Set(keepIndices);
  const byId = new Map<string, string>();

  for (const q of cohesion.quarantined_files) {
    if (q.file_id) byId.set(q.file_id, String(q.reason || "").trim() || "Quarantined");
  }
  for (const c of cohesion.canceled_files) {
    if (c.file_id) byId.set(c.file_id, String(c.reason || "").trim() || "Canceled");
  }
  for (const g of cohesion.groups) {
    if (g.group_type === "excluded_group") {
      for (const id of g.included_file_ids) {
        if (id && !byId.has(id)) {
          byId.set(
            id,
            "This file was not included in the analysis group."
          );
        }
      }
    }
  }

  const notInGroup =
    cohesion.process_action === "continue_with_quarantine" ||
    cohesion.process_action === "continue_provisional"
      ? "This file was not part of the coherent group used for analysis."
      : "This file was not included in analysis.";

  for (let i = 0; i < imageCount; i++) {
    if (!keep.has(i)) {
      const fid = fileIdForUploadIndex(i);
      if (!byId.has(fid)) byId.set(fid, notInGroup);
    }
  }

  return [...byId.entries()].map(([file_id, reason]) => ({ file_id, reason }));
}

export function buildUploadOutcomeMessage(params: {
  language: "tr" | "en";
  cohesion: UploadCohesionResult;
  /** Current upload slot count before cohesion filtering. */
  imageCount: number;
}): UploadOutcomeMessage {
  const { language, cohesion, imageCount } = params;
  const tr = language === "tr";
  const keepIndices = computeKeepIndicesForCohesion(cohesion, imageCount);
  const analysisProceeds = keepIndices.length > 0;
  const excluded = buildUploadExcludedFiles(cohesion, imageCount, keepIndices);
  const groupsCount = coherentGroupsCount(cohesion);

  const clarification_needed = Boolean(cohesion.user_clarification_needed);
  const clarification_questions = Array.isArray(cohesion.clarification_questions)
    ? cohesion.clarification_questions.map((q) => String(q).trim()).filter(Boolean)
    : [];

  if (!analysisProceeds) {
    const title = tr ? "Analiz başlatılamadı" : "Analysis not started";
    const bodyParts = [
      tr
        ? "Yüklemeniz şu anda güvenilir şekilde analiz edilemiyor."
        : "Your upload cannot be analyzed reliably in its current form.",
      cohesion.overall_reason?.trim() || "",
    ];
    if (clarification_needed && clarification_questions.length > 0) {
      bodyParts.push(
        tr
          ? "Lütfen aşağıdaki noktaları netleştirin."
          : "Please review the questions below."
      );
    }
    const body = bodyParts.filter(Boolean).join(" ");

    return {
      title,
      status: "analysis_not_started",
      body,
      excluded_files: excluded,
      clarification_needed,
      clarification_questions,
    };
  }

  const hasExclusions = excluded.length > 0;
  const status: UploadOutcomeStatus = hasExclusions
    ? "analysis_started_with_exclusions"
    : "analysis_started";

  const title =
    tr
      ? hasExclusions
        ? "Analiz başlatıldı (bazı dosyalar hariç)"
        : "Analiz başlatıldı"
      : hasExclusions
        ? "Analysis started (some files excluded)"
        : "Analysis started";

  const bodyLines: string[] = [];
  if (tr) {
    bodyLines.push("Yükleme işleme alındı.");
    if (groupsCount > 1) {
      bodyLines.push("Birden fazla dosya grubu ayırt edildi.");
    }
    if (hasExclusions) {
      bodyLines.push(
        `${excluded.length} dosya bu analize dahil edilmedi; ayrıntılar listede.`
      );
    }
    const reasonLine = cohesionOverallReasonForProceedingBody(cohesion, true);
    if (reasonLine) bodyLines.push(reasonLine);
    if (clarification_needed && clarification_questions.length > 0) {
      bodyLines.push("Ek netleştirme gerekebilir; sorular aşağıda.");
    }
  } else {
    bodyLines.push("Your upload is being processed.");
    if (groupsCount > 1) {
      bodyLines.push("More than one file group was identified.");
    }
    if (hasExclusions) {
      bodyLines.push(
        `${excluded.length} file(s) were not included in this analysis; see excluded_files.`
      );
    }
    const reasonLine = cohesionOverallReasonForProceedingBody(cohesion, false);
    if (reasonLine) bodyLines.push(reasonLine);
    if (clarification_needed && clarification_questions.length > 0) {
      bodyLines.push("Additional clarification may be needed; see questions below.");
    }
  }

  return {
    title,
    status,
    body: bodyLines.join(" "),
    excluded_files: excluded,
    clarification_needed,
    clarification_questions,
  };
}
