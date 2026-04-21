import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, ExternalLink, Image as ImageIcon, Tag, Trash2, Upload, X } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { documentService } from '../lib/documentService';
import {
  getDocumentFileName,
  getDocumentFileSize,
  getDocumentUploadedAt,
  isImageDocument,
} from '../lib/documentUtils';
import { cn } from '../lib/utils';

const IMAGE_ACCEPT = {
  'image/*': [
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
  ],
};
const MAX_IMAGE_SIZE = 15 * 1024 * 1024;

const IMAGE_CATEGORIES = [
  {
    key: 'name-plate',
    label: 'Name plate',
    description: 'Rating plate, serial labels, and manufacturer tags.',
  },
  {
    key: 'transformer-design',
    label: 'Transformer design',
    description: 'Main body design and external structure references.',
  },
  {
    key: 'oil-level-design',
    label: 'Oil level design',
    description: 'Oil level gauge and indicator reference photos.',
  },
  {
    key: 'oltc-design',
    label: 'OLTC design',
    description: 'On-load tap changer layout and panel photos.',
  },
  {
    key: 'buchholz-design',
    label: 'Buchholz design',
    description: 'Buchholz relay and connected pipe arrangement.',
  },
  {
    key: 'other',
    label: 'Other',
    description: 'Any additional image reference for this asset.',
  },
];

const CATEGORY_LOOKUP = new Set(IMAGE_CATEGORIES.map((category) => category.key));

function formatFileSize(bytes) {
  if (!bytes) {
    return '0 Bytes';
  }

  const units = ['Bytes', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${Math.round(value * 100) / 100} ${units[exponent]}`;
}

function formatDate(value) {
  if (!value) {
    return 'Unknown date';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Unknown date';
  }

  return parsed.toLocaleDateString('en-GB');
}

function parseCategoryFromFileName(fileName) {
  const match = String(fileName || '').match(/^imgcat-([a-z0-9-]+)--/i);
  if (!match) {
    return null;
  }

  const parsedKey = String(match[1] || '').toLowerCase();
  return CATEGORY_LOOKUP.has(parsedKey) ? parsedKey : null;
}

function stripCategoryPrefix(fileName) {
  return String(fileName || '').replace(/^imgcat-[a-z0-9-]+--/i, '');
}

function getImageUrl(image) {
  if (image?.url) {
    return image.url;
  }

  if (!image?.storagePath) {
    return '';
  }

  try {
    return documentService.getPublicUrl(image.storagePath);
  } catch {
    return '';
  }
}

function ensureImageFile(document) {
  return isImageDocument(document);
}

function categoryClasses(categoryKey) {
  if (categoryKey === 'name-plate') {
    return 'border-[#7c3aed33] bg-[#7c3aed1a] text-[#b08dff]';
  }
  if (categoryKey === 'transformer-design') {
    return 'border-[#0ea5e933] bg-[#0ea5e91a] text-[#7dd3fc]';
  }
  if (categoryKey === 'oil-level-design') {
    return 'border-[#f59e0b33] bg-[#f59e0b1a] text-[#fbbf24]';
  }
  if (categoryKey === 'oltc-design') {
    return 'border-[#22c55e33] bg-[#22c55e1a] text-[#86efac]';
  }
  if (categoryKey === 'buchholz-design') {
    return 'border-[#ef444433] bg-[#ef44441a] text-[#fca5a5]';
  }
  return 'border-[color:var(--border)] bg-[var(--card-muted)] text-[var(--foreground)]';
}

function getFeedbackClasses(type) {
  if (type === 'error') {
    return 'border-[color:var(--danger-soft)] bg-[var(--danger-soft)] text-[var(--danger-strong)]';
  }
  if (type === 'success') {
    return 'border-[color:var(--success-soft)] bg-[var(--success-soft)] text-[var(--success-strong)]';
  }
  return 'border-[color:var(--border)] bg-[var(--card-muted)] text-[var(--foreground)]';
}

function ImageSection({
  transformerId,
  transformerName,
  images = [],
  onUpdate,
  activeCompartment = 'Maintank',
  onAssignImageCompartment,
}) {
  const [selectedCategory, setSelectedCategory] = useState(IMAGE_CATEGORIES[0].key);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingImageId, setDeletingImageId] = useState(null);
  const [updatingCategoryImageId, setUpdatingCategoryImageId] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const resolveImageCategory = useCallback(
    (image) => {
      const databaseCategory = String(image?.imageCategory || '').trim().toLowerCase();
      if (CATEGORY_LOOKUP.has(databaseCategory)) {
        return databaseCategory;
      }

      const parsedCategory = parseCategoryFromFileName(getDocumentFileName(image));
      if (parsedCategory) {
        return parsedCategory;
      }

      return 'other';
    },
    []
  );

  const refreshDocuments = useCallback(async () => {
    if (!transformerId) {
      return [];
    }

    const updatedDocuments = await documentService.getByTransformerId(transformerId);
    onUpdate?.(transformerId, updatedDocuments);
    return updatedDocuments;
  }, [onUpdate, transformerId]);

  const setCategoryForImageIds = useCallback(
    async (imageIds, categoryKey) => {
      const ids = (Array.isArray(imageIds) ? imageIds : [imageIds]).filter(Boolean).map(String);
      if (!ids.length || !CATEGORY_LOOKUP.has(String(categoryKey || '').toLowerCase())) {
        return;
      }

      try {
        setUpdatingCategoryImageId(ids.length === 1 ? ids[0] : 'bulk');
        await Promise.all(
          ids.map((documentId) => documentService.updateImageCategory(documentId, categoryKey))
        );
        await refreshDocuments();
      } catch (error) {
        console.error('Error updating image category:', error);
        setFeedback({
          type: 'error',
          text: 'Unable to update image category. Please try again.',
        });
      } finally {
        setUpdatingCategoryImageId(null);
      }
    },
    [refreshDocuments]
  );

  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    setFeedback(null);
    if (rejectedFiles?.length) {
      setFeedback({
        type: 'error',
        text: 'Some files were skipped. Upload images only, up to 15 MB each.',
      });
    }

    if (!acceptedFiles?.length) {
      return;
    }

    setPendingFiles((currentFiles) => {
      const existingKeys = new Set(
        currentFiles.map((file) => `${file.name}-${file.size}-${file.lastModified}`)
      );
      const nextFiles = [...currentFiles];
      acceptedFiles.forEach((file) => {
        const fileKey = `${file.name}-${file.size}-${file.lastModified}`;
        if (!existingKeys.has(fileKey)) {
          nextFiles.push(file);
          existingKeys.add(fileKey);
        }
      });
      return nextFiles;
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    accept: IMAGE_ACCEPT,
    maxSize: MAX_IMAGE_SIZE,
    multiple: true,
    noClick: true,
    noKeyboard: true,
    onDrop,
  });

  const pendingPreviews = useMemo(
    () =>
      pendingFiles.map((file) => ({
        file,
        key: `${file.name}-${file.size}-${file.lastModified}`,
        previewUrl: URL.createObjectURL(file),
      })),
    [pendingFiles]
  );

  useEffect(
    () => () => {
      pendingPreviews.forEach((preview) => {
        URL.revokeObjectURL(preview.previewUrl);
      });
    },
    [pendingPreviews]
  );

  const removePendingFile = (keyToRemove) => {
    setPendingFiles((currentFiles) =>
      currentFiles.filter((file) => `${file.name}-${file.size}-${file.lastModified}` !== keyToRemove)
    );
  };

  const clearPendingFiles = () => {
    setPendingFiles([]);
  };

  const handleUpload = async () => {
    if (!pendingFiles.length || !transformerId) {
      return;
    }

    try {
      setIsUploading(true);
      setFeedback(null);

      const uploadedImages = await documentService.uploadMultiple(transformerId, pendingFiles, {
        imageCategory: selectedCategory,
      });

      if (uploadedImages?.length && onAssignImageCompartment) {
        onAssignImageCompartment(
          uploadedImages.map((image) => image.id).filter(Boolean),
          activeCompartment
        );
      }

      await refreshDocuments();
      setPendingFiles([]);
      const uploadedCount = uploadedImages?.length || 0;
      setFeedback({
        type: 'success',
        text: `${uploadedCount} image${uploadedCount === 1 ? '' : 's'} uploaded to ${activeCompartment}.`,
      });
    } catch (error) {
      console.error('Error uploading images:', error);
      setFeedback({
        type: 'error',
        text: 'Failed to upload image files. Please try again.',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteImage = async (image) => {
    if (!image?.id || !image?.storagePath) {
      return;
    }

    const confirmed = window.confirm(
      `Delete ${stripCategoryPrefix(getDocumentFileName(image))} from this asset image gallery?`
    );
    if (!confirmed) {
      return;
    }

      try {
        setDeletingImageId(image.id);
        await documentService.delete(image.id, image.storagePath);
        await refreshDocuments();
        setFeedback({
          type: 'success',
        text: 'Image deleted.',
      });
    } catch (error) {
      console.error('Error deleting image:', error);
      setFeedback({
        type: 'error',
        text: 'Failed to delete image. Please try again.',
      });
    } finally {
      setDeletingImageId(null);
    }
  };

  const handleDownloadImage = async (image) => {
    if (!image?.storagePath) {
      return;
    }

    try {
      await documentService.download(image.storagePath, stripCategoryPrefix(getDocumentFileName(image)));
    } catch (error) {
      console.error('Error downloading image:', error);
      setFeedback({
        type: 'error',
        text: 'Unable to download this image right now.',
      });
    }
  };

  const groupedImages = useMemo(() => {
    const imageOnly = (images || []).filter((document) => ensureImageFile(document));
    return IMAGE_CATEGORIES.map((category) => ({
      ...category,
      images: imageOnly.filter((image) => resolveImageCategory(image) === category.key),
    })).filter((group) => group.images.length > 0);
  }, [images, resolveImageCategory]);

  const totalImages = groupedImages.reduce((total, group) => total + group.images.length, 0);
  const selectedCategoryMeta =
    IMAGE_CATEGORIES.find((category) => category.key === selectedCategory) || IMAGE_CATEGORIES[0];
  const isBusy = isUploading || Boolean(deletingImageId) || Boolean(updatingCategoryImageId);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>Image Library</CardTitle>
            <Badge variant="secondary">{totalImages} saved</Badge>
            <Badge variant="outline">{activeCompartment}</Badge>
          </div>
          <p className="text-sm text-[var(--muted)]">
            Upload visual references for {transformerName || 'this asset'}: name plate, transformer design,
            oil level design, OLTC design, Buchholz design, and more.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {feedback ? (
            <div className={cn('rounded-md border px-3 py-2 text-sm', getFeedbackClasses(feedback.type))}>
              {feedback.text}
            </div>
          ) : null}

          <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
            <label className="space-y-1 text-sm font-medium text-[var(--foreground)]">
              Category
              <select
                value={selectedCategory}
                onChange={(event) => setSelectedCategory(event.target.value)}
                className="h-10 w-full rounded-md border border-[color:var(--border)] bg-[var(--card-muted)] px-3 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[color:var(--primary)]"
                disabled={isBusy}
              >
                {IMAGE_CATEGORIES.map((category) => (
                  <option key={category.key} value={category.key}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>

            <Button type="button" variant="outline" className="h-10 self-end" onClick={open} disabled={isBusy}>
              <Upload className="h-4 w-4" />
              Choose images
            </Button>

            <Button
              type="button"
              className="h-10 self-end"
              onClick={handleUpload}
              disabled={isBusy || pendingFiles.length === 0}
            >
              Upload {pendingFiles.length > 0 ? `(${pendingFiles.length})` : ''}
            </Button>
          </div>

          <div
            {...getRootProps()}
            className={cn(
              'rounded-xl border border-dashed p-5 transition-colors',
              isDragActive
                ? 'border-[color:var(--primary)] bg-[var(--primary-soft)]'
                : 'border-[color:var(--border)] bg-[var(--card-muted)]'
            )}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center justify-center gap-2 text-center">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[var(--card)] text-[var(--primary)]">
                <ImageIcon className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-[var(--foreground)]">
                {isDragActive ? 'Drop images here' : 'Drag and drop image files here'}
              </p>
              <p className="text-xs text-[var(--muted)]">
                Category: {selectedCategoryMeta.label}. {selectedCategoryMeta.description}
              </p>
              <p className="text-xs text-[var(--muted)]">Max 15 MB each. PNG, JPG, WEBP, BMP, GIF, SVG, AVIF, HEIC, TIFF.</p>
            </div>
          </div>

          {pendingPreviews.length ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Ready to upload
                </p>
                <button
                  type="button"
                  onClick={clearPendingFiles}
                  className="text-xs font-medium text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
                  disabled={isBusy}
                >
                  Clear all
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {pendingPreviews.map((preview) => (
                  <div
                    key={preview.key}
                    className="flex items-center gap-3 rounded-md border border-[color:var(--border)] bg-[var(--card)] p-2"
                  >
                    <img
                      src={preview.previewUrl}
                      alt={preview.file.name}
                      className="h-14 w-14 rounded-md border border-[color:var(--border)] object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{preview.file.name}</p>
                      <p className="text-xs text-[var(--muted)]">{formatFileSize(preview.file.size)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removePendingFile(preview.key)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[color:var(--border)] bg-[var(--card-muted)] text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
                      aria-label={`Remove ${preview.file.name}`}
                      disabled={isBusy}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {groupedImages.length ? (
        <div className="space-y-5">
          {groupedImages.map((group) => (
            <Card key={group.key}>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-base">{group.label}</CardTitle>
                  <Badge variant="secondary">{group.images.length}</Badge>
                  <span
                    className={cn(
                      'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium',
                      categoryClasses(group.key)
                    )}
                  >
                    <Tag className="mr-1 h-3.5 w-3.5" />
                    {group.description}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {group.images.map((image) => {
                    const imageUrl = getImageUrl(image);
                    const categoryKey = resolveImageCategory(image);
                    const rawName = getDocumentFileName(image);
                    const displayName = stripCategoryPrefix(rawName) || rawName;
                    const uploadDate = formatDate(getDocumentUploadedAt(image));

                    return (
                      <article
                        key={image.id}
                        className="rounded-lg border border-[color:var(--border)] bg-[var(--card-muted)] p-3"
                      >
                        <div className="aspect-[4/3] overflow-hidden rounded-md border border-[color:var(--border)] bg-[var(--card)]">
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={displayName}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-[var(--muted)]">
                              <ImageIcon className="h-8 w-8" />
                            </div>
                          )}
                        </div>

                        <div className="mt-3 space-y-2">
                          <p className="break-words text-sm font-semibold text-[var(--foreground)]">{displayName}</p>
                          <p className="text-xs text-[var(--muted)]">
                            {formatFileSize(getDocumentFileSize(image))} • {uploadDate}
                          </p>
                          <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[var(--muted)]">
                            Category
                            <select
                              value={categoryKey}
                              onChange={(event) => setCategoryForImageIds(image.id, event.target.value)}
                              className="mt-1 h-9 w-full rounded-md border border-[color:var(--border)] bg-[var(--card)] px-2 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[color:var(--primary)]"
                              disabled={isBusy}
                            >
                              {IMAGE_CATEGORIES.map((category) => (
                                <option key={category.key} value={category.key}>
                                  {category.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => imageUrl && window.open(imageUrl, '_blank', 'noopener,noreferrer')}
                            disabled={!imageUrl}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            View
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownloadImage(image)}
                            disabled={!image?.storagePath || isBusy}
                          >
                            <Download className="h-3.5 w-3.5" />
                            Download
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            className="col-span-2"
                            onClick={() => handleDeleteImage(image)}
                            disabled={isBusy}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            {deletingImageId === image.id ? 'Deleting...' : 'Delete image'}
                          </Button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-10 text-center">
            <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--card-muted)] text-[var(--muted)]">
              <ImageIcon className="h-6 w-6" />
            </div>
            <p className="mt-3 text-sm font-medium text-[var(--foreground)]">No images saved yet</p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Upload the first image for this asset to build a future maintenance reference gallery.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default ImageSection;
