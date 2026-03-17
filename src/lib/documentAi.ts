/**
 * Document AI — OCR pipeline for radiology reports.
 *
 * Extracts structured data from PDF radiology reports:
 * impression, findings, clinical history.
 *
 * Config from env: DOCUMENTAI_LOCATION, DOCUMENTAI_PROCESSOR_ID, GOOGLE_PROJECT_ID
 */
import {
  DocumentProcessorServiceClient,
  protos,
} from "@google-cloud/documentai";
import path from "path";

const DOCUMENT_AI_CONFIG = {
  projectId: process.env.GOOGLE_PROJECT_ID || process.env.VERTEX_PROJECT_ID,
  location: process.env.DOCUMENTAI_LOCATION || "us",
  processorId: process.env.DOCUMENTAI_PROCESSOR_ID || "",
} as const;

const KEY_FILE_PATH = (() => {
  const env = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (env) return path.isAbsolute(env) ? env : path.join(process.cwd(), env);
  return path.join(process.cwd(), "service-account.json");
})();

export interface RadiologyReportExtraction {
  impression: string;
  findings: string[];
  clinicalHistory: string;
  rawText?: string;
}

/** Section header patterns (EN and TR) for radiology reports */
const SECTION_PATTERNS = {
  impression: [
    /impression\s*:?\s*/i,
    /izlenim\s*:?\s*/i,
    /sonu[çc]\s*:?\s*/i,
    /conclusion\s*:?\s*/i,
    /özet\s*:?\s*/i,
  ],
  findings: [
    /findings?\s*:?\s*/i,
    /bulgular\s*:?\s*/i,
    /görüntüleme\s*bulguları?\s*:?\s*/i,
    /examination\s*:?\s*/i,
  ],
  clinicalHistory: [
    /clinical\s*history\s*:?\s*/i,
    /indication\s*:?\s*/i,
    /kl[iı]nik\s*öykü\s*:?\s*/i,
    /endikasyon\s*:?\s*/i,
    /reason\s*for\s*(?:exam|study)\s*:?\s*/i,
  ],
};

function extractSection(
  text: string,
  patterns: RegExp[],
  nextSectionPatterns?: RegExp[]
): string {
  let startIdx = -1;
  for (const re of patterns) {
    const m = text.match(re);
    if (m && m.index !== undefined) {
      startIdx = m.index + m[0].length;
      break;
    }
  }
  if (startIdx < 0) return "";

  let endIdx = text.length;
  if (nextSectionPatterns) {
    const rest = text.slice(startIdx);
    for (const re of nextSectionPatterns) {
      const m = rest.match(re);
      if (m && m.index !== undefined) {
        endIdx = startIdx + m.index;
        break;
      }
    }
  }

  return text
    .slice(startIdx, endIdx)
    .replace(/\s+/g, " ")
    .trim();
}

function parseRadiologySections(fullText: string): RadiologyReportExtraction {
  const text = fullText.replace(/\r\n/g, "\n");

  const impression = extractSection(
    text,
    SECTION_PATTERNS.impression,
    [...SECTION_PATTERNS.findings, ...SECTION_PATTERNS.clinicalHistory]
  );

  const findingsRaw = extractSection(
    text,
    SECTION_PATTERNS.findings,
    [
      ...SECTION_PATTERNS.impression,
      ...SECTION_PATTERNS.clinicalHistory,
      /impression/i,
      /izlenim/i,
    ]
  );
  const findings = findingsRaw
    .split(/[;\n•·–—]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);

  const clinicalHistory = extractSection(
    text,
    SECTION_PATTERNS.clinicalHistory,
    [...SECTION_PATTERNS.findings, ...SECTION_PATTERNS.impression]
  );

  return {
    impression: impression || fullText.slice(0, 500).trim(),
    findings: findings.length > 0 ? findings : [fullText.slice(0, 1000).trim()],
    clinicalHistory: clinicalHistory || "",
    rawText: fullText,
  };
}

/**
 * Extract structured radiology report from PDF using Document AI processor.
 *
 * @param pdf — PDF content as Buffer or Uint8Array
 * @returns Structured object with impression, findings, clinicalHistory
 */
export async function extractRadiologyReport(
  pdf: Buffer | Uint8Array
): Promise<RadiologyReportExtraction> {
  const { projectId, location, processorId } = DOCUMENT_AI_CONFIG;
  if (!processorId) {
    throw new Error(
      "DOCUMENTAI_PROCESSOR_ID is not configured. Set it in your environment."
    );
  }

  const client = new DocumentProcessorServiceClient({
    keyFilename: KEY_FILE_PATH,
  });

  const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;
  const content =
    pdf instanceof Buffer ? pdf : Buffer.from(pdf);

  const request: protos.google.cloud.documentai.v1.IProcessRequest = {
    name,
    rawDocument: {
      content,
      mimeType: "application/pdf",
    },
  };

  const [response] = await client.processDocument(request);
  const document = response.document;
  const textContent =
    typeof document?.text === "string"
      ? document.text
      : (document?.text as { content?: string } | undefined)?.content ?? "";

  if (!textContent) {
    return {
      impression: "",
      findings: [],
      clinicalHistory: "",
      rawText: "",
    };
  }

  return parseRadiologySections(textContent);
}
