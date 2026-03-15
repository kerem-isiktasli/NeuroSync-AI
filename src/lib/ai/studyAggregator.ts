import type {
  ClassificationResult,
  DomainRoute,
  ImagePlane,
  DiagnosticValue,
} from "./classificationPrompts";

export type StudyAdequacy =
  | "diagnostic"
  | "partial"
  | "localizer-only"
  | "non-diagnostic";

export interface PerImageClassification {
  imageIndex: number;
  fileName: string;
  modality: string;
  anatomical_region: string;
  domain_route: DomainRoute;
  image_plane: ImagePlane;
  is_localizer: boolean;
  diagnostic_value: DiagnosticValue;
  series_type_guess: string;
  confidence: number;
  limitations: string[];
}

export interface StudyMetadata {
  imageCount: number;
  modality: string;
  anatomicalRegion: string;
  planesAvailable: ImagePlane[];
  localizerPresent: boolean;
  diagnosticImageCount: number;
  nonDiagnosticImageCount: number;
  studyAdequacy: StudyAdequacy;
  seriesGuesses: string[];
  perImageClassifications: PerImageClassification[];
}

interface ImageEntry {
  fileName: string;
  classification: ClassificationResult;
  domainRoute: DomainRoute;
}

export function buildStudyMetadata(images: ImageEntry[]): StudyMetadata {
  const perImage: PerImageClassification[] = images.map((img, i) => ({
    imageIndex: i,
    fileName: img.fileName,
    modality: img.classification.modality,
    anatomical_region: img.classification.anatomical_region,
    domain_route: img.domainRoute,
    image_plane: img.classification.image_plane,
    is_localizer: img.classification.is_localizer,
    diagnostic_value: img.classification.diagnostic_value,
    series_type_guess: img.classification.series_type_guess,
    confidence: img.classification.confidence,
    limitations: img.classification.limitations,
  }));

  const planes = [
    ...new Set(perImage.map((p) => p.image_plane).filter((p) => p !== "unknown")),
  ] as ImagePlane[];

  const localizerPresent = perImage.some((p) => p.is_localizer);

  const diagnosticImageCount = perImage.filter(
    (p) => p.diagnostic_value === "high" || p.diagnostic_value === "medium"
  ).length;

  const nonDiagnosticImageCount = perImage.filter(
    (p) => p.diagnostic_value === "low" || p.diagnostic_value === "non-diagnostic"
  ).length;

  const seriesGuesses = [
    ...new Set(
      perImage
        .map((p) => p.series_type_guess)
        .filter((s) => s.length > 0)
    ),
  ];

  const modalityVotes = new Map<string, number>();
  const regionVotes = new Map<string, number>();
  for (const p of perImage) {
    if (p.modality && p.modality !== "Unknown") {
      modalityVotes.set(p.modality, (modalityVotes.get(p.modality) ?? 0) + 1);
    }
    if (p.anatomical_region && p.anatomical_region !== "Unknown") {
      regionVotes.set(p.anatomical_region, (regionVotes.get(p.anatomical_region) ?? 0) + 1);
    }
  }

  const modality = majorityVote(modalityVotes) ?? "Unknown";
  const anatomicalRegion = majorityVote(regionVotes) ?? "Unknown";

  const studyAdequacy = deriveAdequacy(
    images.length,
    diagnosticImageCount,
    nonDiagnosticImageCount,
    localizerPresent,
    planes
  );

  return {
    imageCount: images.length,
    modality,
    anatomicalRegion,
    planesAvailable: planes,
    localizerPresent,
    diagnosticImageCount,
    nonDiagnosticImageCount,
    studyAdequacy,
    seriesGuesses,
    perImageClassifications: perImage,
  };
}

function majorityVote(votes: Map<string, number>): string | null {
  let best: string | null = null;
  let bestCount = 0;
  for (const [key, count] of votes) {
    if (count > bestCount) {
      best = key;
      bestCount = count;
    }
  }
  return best;
}

function deriveAdequacy(
  total: number,
  diagnostic: number,
  nonDiagnostic: number,
  hasLocalizer: boolean,
  planes: ImagePlane[]
): StudyAdequacy {
  if (diagnostic === 0 && total > 0) {
    if (hasLocalizer) return "localizer-only";
    return "non-diagnostic";
  }

  if (diagnostic >= 2 && planes.length >= 2) return "diagnostic";

  if (diagnostic >= 1) return "partial";

  return "non-diagnostic";
}

/**
 * Returns indices of images with the highest diagnostic value, sorted by
 * diagnostic_value descending. Localizers and non-diagnostic images are ranked last.
 */
export function rankImagesByDiagnosticValue(
  perImage: PerImageClassification[]
): number[] {
  const order: Record<DiagnosticValue, number> = {
    high: 0,
    medium: 1,
    low: 2,
    "non-diagnostic": 3,
  };

  return [...perImage]
    .sort((a, b) => {
      const aRank = order[a.diagnostic_value] + (a.is_localizer ? 10 : 0);
      const bRank = order[b.diagnostic_value] + (b.is_localizer ? 10 : 0);
      return aRank - bRank;
    })
    .map((p) => p.imageIndex);
}

/**
 * Selects which image indices should be included in cross-image extraction.
 * Filters out non-diagnostic/localizer images, keeping at most `maxImages`.
 */
export function selectDiagnosticImages(
  perImage: PerImageClassification[],
  maxImages = 4
): number[] {
  const ranked = rankImagesByDiagnosticValue(perImage);
  return ranked
    .filter((idx) => {
      const img = perImage[idx];
      return (
        img.diagnostic_value !== "non-diagnostic" && !img.is_localizer
      );
    })
    .slice(0, maxImages);
}
