/**
 * Client-side avatar prep: downscale large photos and squeeze JPEG size so
 * Storage rules and mobile decoders stay happy.
 */

const MAX_DECODE_EDGE = 3000;
const OUT_MAX_EDGE = 512;
const TARGET_BYTES = 900_000;

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("JPEG encode failed"))),
      "image/jpeg",
      quality
    );
  });
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not load image"));
    };
    img.src = url;
  });
}

async function bitmapToJpegBlob(bmp: ImageBitmap): Promise<Blob> {
  let canvas: HTMLCanvasElement;
  try {
    const w = bmp.width;
    const h = bmp.height;
    if (!w || !h) throw new Error("Invalid image dimensions");
    const scale = Math.min(1, OUT_MAX_EDGE / Math.max(w, h));
    const cw = Math.max(1, Math.round(w * scale));
    const ch = Math.max(1, Math.round(h * scale));
    canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not available");
    ctx.drawImage(bmp, 0, 0, cw, ch);
  } finally {
    bmp.close();
  }

  let q = 0.84;
  for (let i = 0; i < 14; i++) {
    const blob = await canvasToJpeg(canvas, q);
    if (blob.size <= TARGET_BYTES || q <= 0.38) return blob;
    q -= 0.05;
  }
  return canvasToJpeg(canvas, 0.35);
}

async function imageElementToJpegBlob(img: HTMLImageElement): Promise<Blob> {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) throw new Error("Invalid image dimensions");
  const scale = Math.min(1, OUT_MAX_EDGE / Math.max(w, h));
  const cw = Math.max(1, Math.round(w * scale));
  const ch = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available");
  ctx.drawImage(img, 0, 0, cw, ch);

  let q = 0.84;
  for (let i = 0; i < 14; i++) {
    const blob = await canvasToJpeg(canvas, q);
    if (blob.size <= TARGET_BYTES || q <= 0.38) return blob;
    q -= 0.05;
  }
  return canvasToJpeg(canvas, 0.35);
}

/**
 * Returns a JPEG Blob (typically under ~1MB) suitable for Firebase Storage avatars.
 */
export async function prepareAvatarJpegBlob(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/") && !/\.(jpe?g|png|gif|webp|heic|heif)$/i.test(file.name)) {
    throw new Error("NOT_IMAGE");
  }

  try {
    const first = await createImageBitmap(file);
    const mw = first.width;
    const mh = first.height;
    if (Math.max(mw, mh) > MAX_DECODE_EDGE) {
      first.close();
      const s = MAX_DECODE_EDGE / Math.max(mw, mh);
      const tw = Math.max(1, Math.round(mw * s));
      const th = Math.max(1, Math.round(mh * s));
      const scaled = await createImageBitmap(file, { resizeWidth: tw, resizeHeight: th });
      return bitmapToJpegBlob(scaled);
    }
    return bitmapToJpegBlob(first);
  } catch {
    const img = await loadImageFromFile(file);
    return imageElementToJpegBlob(img);
  }
}
