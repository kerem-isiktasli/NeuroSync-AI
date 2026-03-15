/**
 * Targeted literature retrieval via PubMed E-utilities.
 *
 * POLICY: Literature search is OFF by default.
 * It is enabled only when ALL conditions are met:
 *   1. concern_level is "high" or "urgent-review"
 *   2. confidence < 60 OR concern is urgent-review
 *   3. domain_route is in the supported subset
 *   4. a route-aware query can be constructed
 *
 * Supported routes: spine-mri, brain-imaging, chest-imaging
 */

export interface LiteratureCitation {
  title: string;
  source: "PubMed" | "Semantic Scholar";
  year: string;
  relevance: string;
}

export interface LiteratureSearchInput {
  domainRoute: string;
  keyFindings: string[];
  anatomicalRegion: string;
  modality: string;
  concernLevel: string;
  confidence: number;
}

const PUBMED_SEARCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi";
const PUBMED_SUMMARY_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi";

const LITERATURE_TIMEOUT_MS = 5000;
const MAX_RESULTS = 3;

const SUPPORTED_LIT_ROUTES = new Set(["spine-mri", "brain-imaging", "chest-imaging"]);

const ROUTE_MESH_TERMS: Record<string, string[]> = {
  "spine-mri": ["Spine[MeSH]", "Magnetic Resonance Imaging[MeSH]", "Intervertebral Disc[MeSH]"],
  "brain-imaging": ["Brain[MeSH]", "Neuroimaging[MeSH]"],
  "chest-imaging": ["Thorax[MeSH]", "Radiography, Thoracic[MeSH]"],
};

export function shouldFetchLiterature(input: LiteratureSearchInput): boolean {
  const isHighRisk = input.concernLevel === "high" || input.concernLevel === "urgent-review";
  if (!isHighRisk) return false;

  if (!SUPPORTED_LIT_ROUTES.has(input.domainRoute)) return false;

  const isUrgent = input.concernLevel === "urgent-review";
  const isLowConfidence = input.confidence > 0 && input.confidence < 60;
  if (!isUrgent && !isLowConfidence) return false;

  return true;
}

function buildRouteAwareQuery(input: LiteratureSearchInput): string {
  const meshTerms = ROUTE_MESH_TERMS[input.domainRoute];
  if (!meshTerms?.length) return "";

  const findingKeywords = input.keyFindings
    .slice(0, 2)
    .flatMap((f) =>
      f.replace(/[^a-zA-Z\s]/g, "")
        .split(/\s+/)
        .filter((w) => w.length > 4)
        .slice(0, 3)
    )
    .filter(Boolean);

  if (!findingKeywords.length) return "";

  const meshPart = meshTerms.slice(0, 2).join(" AND ");
  const findingPart = findingKeywords.slice(0, 3).join(" ");

  return `(${meshPart}) AND (${findingPart}) NOT (veterinary OR animal OR pediatric[ti])`;
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function searchPubMed(query: string): Promise<LiteratureCitation[]> {
  const results: LiteratureCitation[] = [];
  try {
    const params = new URLSearchParams({
      db: "pubmed",
      retmode: "json",
      retmax: String(MAX_RESULTS),
      sort: "relevance",
      term: query,
    });
    const searchRes = await fetchWithTimeout(`${PUBMED_SEARCH_URL}?${params}`, LITERATURE_TIMEOUT_MS);
    if (!searchRes.ok) return results;

    const searchData = await searchRes.json();
    const ids: string[] = searchData?.esearchresult?.idlist ?? [];
    if (!ids.length) return results;

    const summaryRes = await fetchWithTimeout(
      `${PUBMED_SUMMARY_URL}?db=pubmed&retmode=json&id=${ids.join(",")}`,
      LITERATURE_TIMEOUT_MS
    );
    if (!summaryRes.ok) return results;

    const summaryData = await summaryRes.json();
    const entries = summaryData?.result ?? {};

    for (const id of ids) {
      const entry = entries[id];
      if (!entry?.title) continue;

      const title = String(entry.title).replace(/<[^>]*>/g, "").trim();
      if (!title || title.length < 15) continue;

      const pubYear = String(entry.pubdate ?? "").slice(0, 4);
      const yearNum = parseInt(pubYear, 10);
      if (yearNum && yearNum < 2010) continue;

      results.push({
        title,
        source: "PubMed",
        year: pubYear || "N/A",
        relevance: `PMID: ${id}`,
      });
    }
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[LiteratureSearch] PubMed search failed:", err instanceof Error ? err.message : err);
    }
  }
  return results;
}

export async function fetchLiterature(input: LiteratureSearchInput): Promise<LiteratureCitation[]> {
  const query = buildRouteAwareQuery(input);
  if (!query) {
    if (process.env.NODE_ENV !== "production") {
      console.log("[LiteratureSearch] Could not build route-aware query, skipping");
    }
    return [];
  }

  if (process.env.NODE_ENV !== "production") {
    console.log(`[LiteratureSearch] PubMed query: "${query}"`);
  }

  return searchPubMed(query);
}
