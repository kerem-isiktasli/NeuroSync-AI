import type { StudyMetadata } from "./studyAggregator";

interface PerImageFinding {
  imageIndex: number;
  fileName: string;
  image_plane: string;
  diagnostic_value: string;
  is_localizer: boolean;
  findings: string;
  diagnosis: string;
  severity: string;
  limitations: string[];
}

export function buildReconciliationBlock(
  studyMeta: StudyMetadata,
  perImageFindings: PerImageFinding[],
  language: "tr" | "en"
): string | null {
  const diagnosticFindings = perImageFindings.filter(
    (f) => f.diagnostic_value !== "non-diagnostic" && !f.is_localizer
  );

  if (diagnosticFindings.length < 2) return null;

  const header =
    language === "tr"
      ? "ÇAPRAZ GÖRÜNTÜ KARŞILAŞTIRMA TALİMATI"
      : "CROSS-IMAGE RECONCILIATION INSTRUCTION";

  const instructions =
    language === "tr"
      ? [
          "Aşağıda aynı çalışmaya ait birden fazla görüntüden elde edilen bulgular verilmiştir.",
          `Mevcut düzlemler: ${studyMeta.planesAvailable.join(", ") || "bilinmiyor"}`,
          `Çalışma yeterliliği: ${studyMeta.studyAdequacy}`,
          `Tanısal görüntü sayısı: ${studyMeta.diagnosticImageCount} / ${studyMeta.imageCount}`,
          studyMeta.seriesGuesses.length > 0
            ? `Tahmini seriler: ${studyMeta.seriesGuesses.join(", ")}`
            : "",
          "",
          "Lütfen şunları yap:",
          "1. Farklı düzlemlerdeki (sagittal/aksiyel/koronal) bulguları birleştir ve çapraz doğrula.",
          "2. Birden fazla görüntüde görünen bulguları daha yüksek güvenilirlikle raporla.",
          "3. Tek bir görüntüde görünen bulguları belirt ama güvenilirliğin sınırlı olduğunu not et.",
          "4. Çelişkili bulgular varsa her iki gözlemi de raporla ve uyumsuzluğu açıkla.",
          "5. Anatomik seviye (ör. C3-C4, L4-L5) belirtmeye çalış; birden fazla düzlemden kanıt varsa daha kesin ol.",
          "6. Lokalizör/scout görüntülerden elde edilen bulguları tanısal bulguların altında tut.",
        ]
      : [
          "Below are findings extracted from multiple images belonging to the same study.",
          `Planes available: ${studyMeta.planesAvailable.join(", ") || "unknown"}`,
          `Study adequacy: ${studyMeta.studyAdequacy}`,
          `Diagnostic images: ${studyMeta.diagnosticImageCount} / ${studyMeta.imageCount}`,
          studyMeta.seriesGuesses.length > 0
            ? `Estimated series: ${studyMeta.seriesGuesses.join(", ")}`
            : "",
          "",
          "Please do the following:",
          "1. Correlate and cross-validate findings across different planes (sagittal/axial/coronal).",
          "2. Report findings visible in multiple images with higher confidence.",
          "3. Note findings visible in only one image, but flag that confidence is limited.",
          "4. If findings conflict between images, report both observations and explain the discrepancy.",
          "5. Attempt to specify anatomical levels (e.g. C3-C4, L4-L5); be more specific when evidence from multiple planes supports it.",
          "6. Weight localizer/scout findings below diagnostic-image findings.",
        ];

  const perImageBlock = diagnosticFindings
    .map(
      (f) =>
        `--- Image ${f.imageIndex + 1}: ${f.fileName} [plane=${f.image_plane}, value=${f.diagnostic_value}] ---\n` +
        `Diagnosis: ${f.diagnosis || "N/A"}\n` +
        `Findings: ${f.findings || "N/A"}\n` +
        `Severity: ${f.severity || "N/A"}\n` +
        (f.limitations.length
          ? `Limitations: ${f.limitations.join("; ")}\n`
          : "")
    )
    .join("\n");

  return [
    `=== ${header} ===`,
    ...instructions.filter(Boolean),
    "",
    "PER-IMAGE FINDINGS:",
    perImageBlock,
  ].join("\n");
}
