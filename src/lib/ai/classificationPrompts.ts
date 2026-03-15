export const DOMAIN_ROUTES = [
  "spine-mri",
  "brain-imaging",
  "chest-imaging",
  "abdomen-imaging",
  "musculoskeletal-general",
  "medical-photo",
  "unknown",
] as const;

export type DomainRoute = (typeof DOMAIN_ROUTES)[number];

export type ImagePlane = "sagittal" | "axial" | "coronal" | "oblique" | "unknown";
export type DiagnosticValue = "high" | "medium" | "low" | "non-diagnostic";

export interface ClassificationResult {
  modality: string;
  anatomical_region: string;
  domain_route: DomainRoute;
  image_quality: "low" | "moderate" | "high";
  image_plane: ImagePlane;
  is_localizer: boolean;
  diagnostic_value: DiagnosticValue;
  series_type_guess: string;
  confidence: number;
  limitations: string[];
}

const CLASSIFICATION_PROMPT_TR = `Sen bir tıbbi görüntü sınıflandırma sisteminin ilk aşamasısın.
Görevin bu görüntünün HASTALIKLARI ile ilgilenmek DEĞİLDİR.
Görevin yalnızca görüntünün TEKNİK ÖZELLİKLERİNİ sınıflandırmaktır.

SINIFLANDIRMA GÖREVİ:
1. Modalite: Bu görüntü hangi tıbbi görüntüleme tekniği ile alınmış? (MRI, CT, X-Ray, Ultrasound, Fotoğraf, vb.)
2. Anatomik Bölge: Görüntüde hangi vücut bölgesi gösterilmektedir?
3. Domain Route: Aşağıdaki rotalamalardan hangisi bu görüntü için en uygundur?
   - "spine-mri": Omurga MRI görüntüleri (servikal, torakal, lomber)
   - "brain-imaging": Beyin MR, BT veya anjiografi
   - "chest-imaging": Toraks, akciğer röntgeni veya BT
   - "abdomen-imaging": Batın görüntüleme (USG, BT, MR)
   - "musculoskeletal-general": Kas-iskelet sistemi (diz, omuz, kalça, eklem)
   - "medical-photo": Klinik fotoğraf (cilt, yara, intraoperatif)
   - "unknown": Sınıflandırılamıyor
4. Görüntü Kalitesi: low, moderate, high
5. Görüntü Düzlemi: Bu görüntü hangi anatomik düzlemde çekilmiş?
   - "sagittal": Yan görünüm (sağ-sol ayırımı)
   - "axial": Enine kesit (üst-alt)
   - "coronal": Ön-arka görünüm
   - "oblique": Eğik/standart dışı açı
   - "unknown": Belirlenemiyor
6. Lokalizör mü?: Bu görüntü bir lokalizör/scout görüntü mü (asıl tanısal görüntülerin planlanması için kullanılan ön görüntü, genellikle üzerinde çizgiler/numaralar bulunur)?
7. Tanısal Değer: Bu görüntünün tanısal değeri ne? (örn: yüksek kaliteli tanısal kesit = high; düşük çözünürlüklü ekran görüntüsü = low; lokalizör/scout = low; tamamen okunaksız = non-diagnostic)
8. Seri Tahmini: Bu MRI ise seri türünü tahmin et (T1, T2, FLAIR, STIR, PD, DWI, ADC, kontrastlı vb.). MRI değilse boş bırak.
9. Güvenilirlik: 0–100 arası
10. Sınırlamalar: Sınıflandırmayı zorlaştıran sorunlar

ÖNEMLİ:
- Hastalık teşhisi yapma.
- Patoloji hakkında yorum yapma.
- Sadece teknik sınıflandırma yap.

SADECE GEÇERLİ JSON DÖNDÜR:
{
  "modality": "string",
  "anatomical_region": "string",
  "domain_route": "spine-mri | brain-imaging | chest-imaging | abdomen-imaging | musculoskeletal-general | medical-photo | unknown",
  "image_quality": "low | moderate | high",
  "image_plane": "sagittal | axial | coronal | oblique | unknown",
  "is_localizer": false,
  "diagnostic_value": "high | medium | low | non-diagnostic",
  "series_type_guess": "string",
  "confidence": 0,
  "limitations": ["string"]
}`;

const CLASSIFICATION_PROMPT_EN = `You are the first stage of a medical image classification system.
Your task is NOT to identify diseases.
Your task is ONLY to classify the TECHNICAL PROPERTIES of this image.

CLASSIFICATION TASK:
1. Modality: Which imaging technique produced this image? (MRI, CT, X-Ray, Ultrasound, Photo, etc.)
2. Anatomical Region: Which body region is shown?
3. Domain Route: Which of these routing categories best fits this image?
   - "spine-mri": Spine MRI (cervical, thoracic, lumbar)
   - "brain-imaging": Brain MR, CT, or angiography
   - "chest-imaging": Thorax, chest X-ray, or CT
   - "abdomen-imaging": Abdominal imaging (USG, CT, MR)
   - "musculoskeletal-general": Musculoskeletal system (knee, shoulder, hip, joints)
   - "medical-photo": Clinical photograph (skin, wound, intraoperative)
   - "unknown": Cannot be classified
4. Image Quality: low, moderate, high
5. Image Plane: Which anatomical plane is this image taken in?
   - "sagittal": Side view (right-left division)
   - "axial": Cross-sectional (top-bottom)
   - "coronal": Front-back view
   - "oblique": Non-standard/oblique angle
   - "unknown": Cannot be determined
6. Is Localizer: Is this a localizer/scout image (a preliminary image used to plan diagnostic slices, typically showing reference lines or numbered markers)?
7. Diagnostic Value: How useful is this image for diagnosis? (e.g.: high-quality diagnostic slice = high; low-resolution screenshot = low; localizer/scout = low; completely unreadable = non-diagnostic)
8. Series Type Guess: If this is MRI, estimate the series type (T1, T2, FLAIR, STIR, PD, DWI, ADC, contrast-enhanced, etc.). Leave empty if not MRI.
9. Confidence: 0–100
10. Limitations: Issues that make classification difficult

IMPORTANT:
- Do NOT diagnose diseases.
- Do NOT comment on pathology.
- Only perform technical classification.

RETURN ONLY VALID JSON:
{
  "modality": "string",
  "anatomical_region": "string",
  "domain_route": "spine-mri | brain-imaging | chest-imaging | abdomen-imaging | musculoskeletal-general | medical-photo | unknown",
  "image_quality": "low | moderate | high",
  "image_plane": "sagittal | axial | coronal | oblique | unknown",
  "is_localizer": false,
  "diagnostic_value": "high | medium | low | non-diagnostic",
  "series_type_guess": "string",
  "confidence": 0,
  "limitations": ["string"]
}`;

export function getClassificationPrompt(language: "tr" | "en"): string {
  return language === "tr" ? CLASSIFICATION_PROMPT_TR : CLASSIFICATION_PROMPT_EN;
}
