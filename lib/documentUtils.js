const IMAGE_FILE_EXTENSIONS = [
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.bmp',
  '.gif',
  '.svg',
  '.avif',
  '.heic',
  '.heif',
  '.tif',
  '.tiff',
];

function toLower(value) {
  return String(value || '').trim().toLowerCase();
}

export function getDocumentFileName(document) {
  return String(document?.fileName || document?.name || 'Untitled');
}

export function getDocumentFileType(document) {
  return toLower(document?.fileType || document?.type);
}

export function getDocumentFileSize(document) {
  const parsed = Number(document?.fileSize ?? document?.size ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function getDocumentUploadedAt(document) {
  return document?.uploadedAt || document?.uploadDate || null;
}

export function isImageDocument(document) {
  const fileType = getDocumentFileType(document);
  if (fileType.startsWith('image/')) {
    return true;
  }

  const fileName = toLower(getDocumentFileName(document));
  return IMAGE_FILE_EXTENSIONS.some((extension) => fileName.endsWith(extension));
}
