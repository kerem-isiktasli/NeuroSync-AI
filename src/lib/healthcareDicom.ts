/**
 * Cloud Healthcare API — DICOM Store integration.
 *
 * Upload, retrieve, and search DICOM studies via DICOMweb REST API.
 * Config from: HEALTHCARE_DATASET, HEALTHCARE_DICOM_STORE, GOOGLE_PROJECT_ID, GOOGLE_LOCATION.
 */
import { GoogleAuth } from "google-auth-library";
import path from "path";
import { HEALTHCARE_CONFIG } from "./healthcareApiStub";
import { VertexCredentialError } from "./vertexErrors";

const SCOPES = ["https://www.googleapis.com/auth/cloud-platform"];
const KEY_FILE_PATH = (() => {
  const env = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (env) return path.isAbsolute(env) ? env : path.join(process.cwd(), env);
  return path.join(process.cwd(), "service-account.json");
})();

function getDicomWebBaseUrl(): string {
  const { projectId, location, dataset, dicomStore } = HEALTHCARE_CONFIG;
  return `https://healthcare.googleapis.com/v1/projects/${projectId}/locations/${location}/datasets/${dataset}/dicomStores/${dicomStore}/dicomWeb`;
}

async function getAccessToken(): Promise<string> {
  const auth = new GoogleAuth({
    keyFile: KEY_FILE_PATH,
    scopes: SCOPES,
  });
  try {
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    return token.token ?? "";
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
      throw new VertexCredentialError(`Credential file not found at ${KEY_FILE_PATH}`);
    }
    throw new VertexCredentialError(
      err instanceof Error ? err.message : "Failed to obtain access token"
    );
  }
}

export interface DicomUploadResult {
  studyUid: string;
  seriesUids: string[];
  instanceCount: number;
  retrieveUrl: string;
}

/**
 * Upload DICOM files to the Healthcare API DICOM store.
 * Uses multipart/related for multiple files, application/dicom for single file.
 */
export async function uploadDicomStudy(
  files: Array<{ buffer: Buffer | Uint8Array; fileName?: string }>
): Promise<DicomUploadResult> {
  if (files.length === 0) {
    throw new Error("No DICOM files provided");
  }

  const token = await getAccessToken();
  const baseUrl = getDicomWebBaseUrl();
  const url = `${baseUrl}/studies`;

  let body: BodyInit;
  let contentType: string;

  if (files.length === 1) {
    const buf = files[0]!.buffer;
    body = (buf instanceof Buffer ? buf : Buffer.from(buf)) as BodyInit;
    contentType = "application/dicom";
  } else {
    const boundary = "RapiMedDicomBoundary_" + Date.now();
    contentType = `multipart/related; type=application/dicom; boundary=${boundary}`;
    const chunks: Buffer[] = [];
    for (const file of files) {
      const buf = file.buffer instanceof Buffer ? file.buffer : Buffer.from(file.buffer);
      chunks.push(
        Buffer.from(`--${boundary}\r\nContent-Type: application/dicom\r\n\r\n`, "utf8"),
        buf,
        Buffer.from("\r\n", "utf8")
      );
    }
    chunks.push(Buffer.from(`--${boundary}--\r\n`, "utf8"));
    body = Buffer.concat(chunks) as BodyInit;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": contentType,
      Accept: "application/dicom+json",
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Healthcare API storeInstances failed: ${response.status} ${response.statusText} - ${text.slice(0, 500)}`
    );
  }

  const text = await response.text();
  return parseStoreResponse(text);
}

function parseStoreResponse(responseBody: string): DicomUploadResult {
  const studyUidMatch = responseBody.match(
    /studies\/([0-9.]+)/
  );
  const seriesMatches = responseBody.matchAll(
    /series\/([0-9.]+)\/instances/g
  );
  const seriesUids = [...new Set([...seriesMatches].map((m) => m[1]!))];
  const instanceCount = (responseBody.match(/ReferencedSOPInstanceUID/g) ?? []).length;
  const retrieveUrlMatch = responseBody.match(
    /<Value[^>]*>https:\/\/healthcare\.googleapis\.com[^<]+<\/Value>/
  );
  const retrieveUrl = retrieveUrlMatch
    ? retrieveUrlMatch[0].replace(/<[^>]+>/g, "").trim()
    : "";

  return {
    studyUid: studyUidMatch?.[1] ?? "",
    seriesUids,
    instanceCount,
    retrieveUrl,
  };
}

export interface StudyMetadata {
  studyUid: string;
  series: Array<{
    seriesUid: string;
    modality?: string;
    seriesNumber?: number;
    instanceCount?: number;
  }>;
  patientName?: string;
  studyDate?: string;
  modality?: string;
}

/**
 * Get study metadata (fetches series list and aggregates).
 */
export async function getStudyMetadata(
  studyUid: string
): Promise<StudyMetadata | null> {
  try {
    const series = await getStudySeries(studyUid);
    if (series.length === 0) return null;

    const token = await getAccessToken();
    const baseUrl = getDicomWebBaseUrl();
    const url = `${baseUrl}/studies/${studyUid}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/dicom+json",
      },
    });

    let patientName: string | undefined;
    let studyDate: string | undefined;
    let modality: string | undefined;

    if (response.ok) {
      const data = await response.json();
      const arr = Array.isArray(data) ? data : [data];
      const first = arr[0] as Record<string, { Value?: string[] }> | undefined;
      if (first) {
        patientName = first["00100010"]?.Value?.[0];
        studyDate = first["00080020"]?.Value?.[0];
        modality = first["00080060"]?.Value?.[0];
      }
    }

    return {
      studyUid,
      series: series.map((s) => ({
        seriesUid: s.seriesUid,
        modality: s.modality,
        seriesNumber: s.seriesNumber,
        instanceCount: s.instanceCount,
      })),
      patientName,
      studyDate,
      modality: modality ?? series[0]?.modality,
    };
  } catch {
    return null;
  }
}

export interface SeriesInfo {
  seriesUid: string;
  modality?: string;
  seriesNumber?: number;
  instanceCount?: number;
}

/**
 * Get list of series in a study.
 */
export async function getStudySeries(
  studyUid: string
): Promise<SeriesInfo[]> {
  const token = await getAccessToken();
  const baseUrl = getDicomWebBaseUrl();
  const url = `${baseUrl}/studies/${studyUid}/series`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/dicom+json",
    },
  });

  if (response.status === 404) return [];
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Healthcare API getStudySeries failed: ${response.status} - ${text.slice(0, 300)}`
    );
  }

  const data = await response.json();
  const arr = Array.isArray(data) ? data : [data];
  return arr.map((item: Record<string, unknown>) => {
    const getStr = (tag: string) => {
      const el = item[tag] as { Value?: string[] } | undefined;
      return el?.Value?.[0];
    };
    const getNum = (tag: string) => {
      const v = getStr(tag);
      return v ? parseInt(v, 10) : undefined;
    };
    return {
      seriesUid: getStr("0020000E") ?? "",
      modality: getStr("00080060"),
      seriesNumber: getNum("00200011"),
      instanceCount: undefined,
    };
  });
}

/**
 * Download a series as multipart DICOM (binary).
 * Returns Buffer of multipart/related content.
 */
export async function downloadSeries(
  studyUid: string,
  seriesUid: string
): Promise<Buffer> {
  const token = await getAccessToken();
  const baseUrl = getDicomWebBaseUrl();
  const url = `${baseUrl}/studies/${studyUid}/series/${seriesUid}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "multipart/related; type=application/dicom; transfer-syntax=*",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Healthcare API downloadSeries failed: ${response.status} - ${text.slice(0, 300)}`
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
