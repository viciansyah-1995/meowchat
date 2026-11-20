export const MAX_MOMENT_PHOTO_BYTES = 700 * 1024;
export async function compressMomentPhoto(file) {
  if (!/^image\/(jpeg|png|webp|avif|heic|heif)$/.test(file.type)) throw new Error('Pilih foto JPG, PNG, WebP, AVIF, atau HEIC, ya.');
  if (!file.size || file.size > 20 * 1024 * 1024) throw new Error('Pilih foto berukuran maksimal 20 MB.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode().catch(() => { throw new Error('Foto ini belum bisa dibaca. Coba versi JPG atau PNG.'); });
    if (!image.naturalWidth || image.naturalWidth * image.naturalHeight > 60000000) throw new Error('Resolusi foto terlalu besar. Pilih versi yang lebih kecil.');
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Browser belum bisa menyiapkan foto.');
    context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    // Canvas re-encoding drops EXIF, including GPS, and flattens transparency.
    for (const quality of [0.82, 0.7, 0.58, 0.45]) {
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (blob && blob.size <= MAX_MOMENT_PHOTO_BYTES) return new File([blob], 'momen.jpg', { type: 'image/jpeg' });
    }
    throw new Error('Foto masih terlalu besar setelah dikompres. Coba foto lain yang lebih kecil.');
  } finally { URL.revokeObjectURL(url); }
}
