import React, { useCallback, useState } from 'react';
import { Combobox } from './ui/combobox';
import { FileText, TestTubeDiagonal, Upload } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import DocumentImportReviewModal from './DocumentImportReviewModal';
import { AppTooltip } from './ui/app-tooltip';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { documentService } from '../lib/documentService';
import { extractDgaImportFromFile } from '../lib/dga-import/dgaFileImport';
import { oilTestService } from '../lib/oilTestService';
import { normaliseTestTypeForStorage } from '../lib/testTypeUtils';
import { cn } from '../lib/utils';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const DGA_FIELDS = ['h2', 'ch4', 'c2h6', 'c2h4', 'c2h2', 'co', 'co2', 'o2', 'n2'];
const ADDITIONAL_IMPORT_FIELDS = [
  'breakdown',
  'waterContent',
  'acidity',
  'interfacialTension',
  'color',
  'flashPoint',
  'inhibitor',
  'copperCorrosive',
  'density',
  'dbds',
  'viscosity40',
  'methanol',
  'pcb',
  'powerFactor',
  'resistivity',
  'specificGravity',
  'passivator',
  'fol2',
  'hmf5',
  'fal2',
  'acf2',
  'mef5',
  'copperCu',
  'ironFe',
  'aluminumAl',
  'estimatedDpFuran',
  'estimatedDpMethanol',
];
const IMPORT_FIELDS = [...DGA_FIELDS, ...ADDITIONAL_IMPORT_FIELDS];
const TDCG_FIELDS = ['h2', 'ch4', 'c2h2', 'c2h4', 'c2h6', 'co'];
const STORAGE_ACCEPT = {
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.ms-excel.sheet.macroEnabled.12': ['.xlsm'],
  'application/vnd.ms-excel.sheet.binary.macroEnabled.12': ['.xlsb'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
  'image/bmp': ['.bmp'],
};
const IMPORTABLE_EXTENSIONS = ['.pdf', '.xlsx', '.xls', '.xlsm', '.xlsb', '.png', '.jpg', '.jpeg', '.webp', '.bmp'];

function formatFileSize(bytes) {
  if (!bytes) {
    return '0 Bytes';
  }

  const units = ['Bytes', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${Math.round(value * 100) / 100} ${units[exponent]}`;
}

function getFileIcon(type) {
  if (!type) return 'file';
  if (type === 'application/pdf') return 'pdf';
  if (type.startsWith('image/')) return 'image';
  if (type.includes('word') || type.includes('document')) return 'word';
  if (type.includes('excel') || type.includes('spreadsheet')) return 'excel';
  return 'file';
}

function renderFileIcon(iconType) {
  switch (iconType) {
    case 'pdf':
      return (
        <svg className="file-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
      );
    case 'image':
      return (
        <svg className="file-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      );
    case 'word':
      return (
        <svg className="file-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      );
    case 'excel':
      return (
        <svg className="file-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M9 3v2m6-2v2M9 5h6m6 0a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2h12zm-2 7h-4v-2h4v2zm0 4h-4v-2h4v2z"
          />
        </svg>
      );
    default:
      return (
        <svg className="file-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
        </svg>
      );
  }
}

function isDgaImportableFile(file) {
  const name = String(file?.name ?? '').toLowerCase();
  const type = String(file?.type ?? '').toLowerCase();

  return IMPORTABLE_EXTENSIONS.some((extension) => name.endsWith(extension)) || type === 'application/pdf' || type.startsWith('image/') || type.includes('excel') || type.includes('spreadsheet');
}

function calculateTdcg(row) {
  const total = TDCG_FIELDS.reduce((sum, key) => {
    const parsedValue = Number.parseFloat(String(row?.[key] ?? '').replace(/,/g, ''));
    return sum + (Number.isFinite(parsedValue) ? parsedValue : 0);
  }, 0);

  return total > 0 ? String(Number(total.toFixed(6))) : null;
}

function hasImportedValues(row) {
  return IMPORT_FIELDS.some((key) => String(row?.[key] ?? '').trim() !== '');
}

function normaliseImportedOilTest(row) {
  const payload = {
    testDate: row.testDate,
    testType: normaliseTestTypeForStorage(row.testType),
    notes: row.notes?.trim() || null,
    tdcg: calculateTdcg(row),
  };

  DGA_FIELDS.forEach((field) => {
    payload[field] = String(row?.[field] ?? '').trim();
  });

  ADDITIONAL_IMPORT_FIELDS.forEach((field) => {
    payload[field] = String(row?.[field] ?? '').trim();
  });

  return payload;
}

function normaliseComparableValue(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim();
}

function isSameOilTestPayload(existingTest, incomingPayload) {
  if (!existingTest || !incomingPayload) {
    return false;
  }

  const fieldsToCompare = ['testDate', 'testType', 'notes', 'tdcg', ...IMPORT_FIELDS];

  return fieldsToCompare.every((field) => {
    const existingValue = existingTest[field];
    const incomingValue = incomingPayload[field];
    return normaliseComparableValue(existingValue) === normaliseComparableValue(incomingValue);
  });
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

function DocumentSection({
  transformerId,
  transformerName,
  documents,
  oilTests = [],
  readOnly = false,
  onUpdate,
  onUpdateOilTests,
  activeCompartment = 'Maintank',
  onAssignDocumentCompartment,
  onAssignOilTestCompartment,
  availableCompartments = [],
  getCompartmentForDocument,
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [isReadingImport, setIsReadingImport] = useState(false);
  const [isSubmittingImport, setIsSubmittingImport] = useState(false);
  const [isDeletingDocument, setIsDeletingDocument] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [importSession, setImportSession] = useState(null);
  const [pendingDeleteDocument, setPendingDeleteDocument] = useState(null);

  const isBusy = isUploading || isReadingImport || isSubmittingImport || isDeletingDocument;
  const hasDocuments = documents.length > 0;

  const refreshDocuments = useCallback(async () => {
    const updatedDocuments = await documentService.getByTransformerId(transformerId);
    onUpdate(transformerId, updatedDocuments);
    return updatedDocuments;
  }, [onUpdate, transformerId]);

  const refreshOilTests = useCallback(async () => {
    if (!onUpdateOilTests) {
      return [];
    }

    const updatedTests = await oilTestService.getByTransformerId(transformerId);
    onUpdateOilTests(transformerId, updatedTests);
    return updatedTests;
  }, [onUpdateOilTests, transformerId]);

  const uploadFilesAsDocuments = useCallback(
    async (files, successMessage) => {
      setIsUploading(true);

      try {
        const uploadedDocuments = await documentService.uploadMultiple(transformerId, files);

        if (uploadedDocuments?.length && onAssignDocumentCompartment) {
          onAssignDocumentCompartment(
            uploadedDocuments.map((doc) => doc.id).filter(Boolean),
            activeCompartment
          );
        }

        await refreshDocuments();
        setFeedback({ type: 'success', text: successMessage });
        return uploadedDocuments;
      } catch (error) {
        console.error('Error uploading files:', error);
        setFeedback({ type: 'error', text: 'Failed to upload the selected files. Please try again.' });
        return null;
      } finally {
        setIsUploading(false);
      }
    },
    [activeCompartment, onAssignDocumentCompartment, refreshDocuments, transformerId]
  );

  const handleSelectedFiles = useCallback(
    async (incomingFiles) => {
      if (readOnly) {
        return;
      }
      const files = Array.from(incomingFiles || []).filter(Boolean);

      if (files.length === 0) {
        return;
      }

      setFeedback(null);

      const oversizedFile = files.find((file) => file.size > MAX_FILE_SIZE_BYTES);

      if (oversizedFile) {
        setFeedback({
          type: 'error',
          text: `${oversizedFile.name} is larger than the 10MB file limit.`,
        });
        return;
      }

      if (files.length > 1) {
        await uploadFilesAsDocuments(
          files,
          `${files.length} documents uploaded to the lab report library.`
        );
        return;
      }

      const [file] = files;

      if (!isDgaImportableFile(file)) {
        await uploadFilesAsDocuments([file], `${file.name} stored in Documents.`);
        return;
      }

      setIsReadingImport(true);

      try {
        const importResult = await extractDgaImportFromFile(file);
        setImportSession({
          file,
          importResult,
          errorMessage: '',
        });
      } catch (error) {
        console.error('Error reading imported report:', error);
        setImportSession({
          file,
          importResult: null,
          errorMessage:
            error instanceof Error ? error.message : 'The report could not be read.',
        });
      } finally {
        setIsReadingImport(false);
      }
    },
    [readOnly, uploadFilesAsDocuments]
  );

  const handleDrop = useCallback(
    async (acceptedFiles, fileRejections) => {
      if (readOnly) {
        return;
      }
      if (fileRejections.length > 0) {
        const tooLarge = fileRejections.find((rejection) =>
          rejection.errors.some((error) => error.code === 'file-too-large')
        );

        if (tooLarge) {
          setFeedback({
            type: 'error',
            text: `${tooLarge.file.name} is larger than the 10MB file limit.`,
          });
        } else {
          setFeedback({
            type: 'error',
            text: 'Only PDF, Word, Excel, and image files can be uploaded here.',
          });
        }

        return;
      }

      await handleSelectedFiles(acceptedFiles);
    },
    [handleSelectedFiles, readOnly]
  );

  const { getRootProps, getInputProps, isDragActive, isDragAccept, isDragReject, open } = useDropzone({
    accept: STORAGE_ACCEPT,
    disabled: isBusy || readOnly,
    maxSize: MAX_FILE_SIZE_BYTES,
    multiple: true,
    noClick: true,
    noKeyboard: true,
    onDrop: handleDrop,
  });

  const handleRequestDeleteDocument = (doc) => {
    if (readOnly) {
      return;
    }
    if (!doc) {
      return;
    }

    setPendingDeleteDocument(doc);
  };

  const closeDeleteDialog = () => {
    if (isDeletingDocument) {
      return;
    }

    setPendingDeleteDocument(null);
  };

  const handleDeleteDocument = async () => {
    if (!pendingDeleteDocument?.id || isDeletingDocument) {
      return;
    }

    const docToDelete = pendingDeleteDocument;
    setIsDeletingDocument(true);

    try {
      await documentService.delete(docToDelete.id, docToDelete.storagePath);
      await refreshDocuments();
      setFeedback({
        type: 'success',
        text: `${docToDelete.fileName || docToDelete.name} deleted from Documents.`,
      });
      setPendingDeleteDocument(null);
    } catch (error) {
      console.error('Error deleting document:', error);
      setFeedback({
        type: 'error',
        text: 'Failed to delete the selected document.',
      });
    } finally {
      setIsDeletingDocument(false);
    }
  };

  const handleDownloadDocument = async (doc) => {
    try {
      await documentService.download(doc.storagePath, doc.fileName);
    } catch (error) {
      console.error('Error downloading document:', error);
      setFeedback({
        type: 'error',
        text: 'Failed to download the selected document.',
      });
    }
  };

  const handleViewDocument = (doc) => {
    try {
      const url = documentService.getPublicUrl(doc.storagePath);
      window.open(url, '_blank');
    } catch (error) {
      console.error('Error viewing document:', error);
      setFeedback({
        type: 'error',
        text: 'Failed to open the selected document.',
      });
    }
  };

  const closeImportModal = () => {
    if (isSubmittingImport) {
      return;
    }

    setImportSession(null);
  };

  const handleStoreOnly = async () => {
    if (!importSession?.file) {
      return;
    }

    setIsSubmittingImport(true);

    try {
      const storedDocuments = await uploadFilesAsDocuments(
        [importSession.file],
        `${importSession.file.name} stored in Documents.`
      );

      if (storedDocuments?.length) {
        setImportSession(null);
      }
    } finally {
      setIsSubmittingImport(false);
    }
  };

  const handleSubmitImportedRows = async (rows) => {
    if (!importSession?.file) {
      return;
    }

    const validRows = rows
      .filter((row) => row.testDate && hasImportedValues(row))
      .map(normaliseImportedOilTest);

    const rowsByDate = validRows.reduce((map, row) => {
      if (row.testDate) {
        map.set(row.testDate, row);
      }
      return map;
    }, new Map());
    const dedupedRows = Array.from(rowsByDate.values());

    if (dedupedRows.length === 0) {
      setFeedback({
        type: 'error',
          text: 'Add at least one sample with a test date and imported values before submitting.',
      });
      return;
    }

    setIsSubmittingImport(true);
    let createdCount = 0;
    let updatedCount = 0;
    let unchangedCount = 0;
    let documentStored = false;

    try {
      const storedDocument = await documentService.upload(transformerId, importSession.file);
      if (storedDocument?.id && onAssignDocumentCompartment) {
        onAssignDocumentCompartment(storedDocument.id, activeCompartment);
      }
      documentStored = true;

      const existingByDate = new Map();
      oilTests.forEach((test) => {
        if (!test?.testDate || existingByDate.has(test.testDate)) {
          return;
        }
        existingByDate.set(test.testDate, test);
      });

      const createdTestIds = [];
      for (const row of dedupedRows) {
        const existingTest = existingByDate.get(row.testDate);

        if (existingTest?.id) {
          if (isSameOilTestPayload(existingTest, row)) {
            unchangedCount += 1;
            continue;
          }

          await oilTestService.update(existingTest.id, row);
          updatedCount += 1;
          existingByDate.set(row.testDate, { ...existingTest, ...row });
          continue;
        }

        const createdTest = await oilTestService.create(transformerId, row);
        if (createdTest?.id) {
          createdTestIds.push(createdTest.id);
          existingByDate.set(row.testDate, createdTest);
        }
        createdCount += 1;
      }

      if (createdTestIds.length > 0 && onAssignOilTestCompartment) {
        onAssignOilTestCompartment(createdTestIds, activeCompartment);
      }

      await Promise.all([refreshDocuments(), refreshOilTests()]);
      const summaryParts = [];
      if (createdCount > 0) {
        summaryParts.push(`${createdCount} created`);
      }
      if (updatedCount > 0) {
        summaryParts.push(`${updatedCount} updated`);
      }
      if (unchangedCount > 0) {
        summaryParts.push(`${unchangedCount} unchanged`);
      }

      setFeedback({
        type: 'success',
        text: summaryParts.length > 0
          ? `Oil-test records synced (${summaryParts.join(', ')}) and the lab report was stored.`
          : 'Lab report was stored.',
      });
      setImportSession(null);
    } catch (error) {
      console.error('Error submitting imported oil tests:', error);
      await Promise.allSettled([refreshDocuments(), refreshOilTests()]);
      const touchedCount = createdCount + updatedCount;
      setFeedback({
        type: 'error',
        text:
          documentStored || touchedCount > 0 || unchangedCount > 0
            ? `The report was stored and ${createdCount} created / ${updatedCount} updated / ${unchangedCount} unchanged before the import stopped.`
            : 'Failed to submit the imported report. Please try again.',
      });
    } finally {
      setIsSubmittingImport(false);
    }
  };

  const dropzoneLabel = isReadingImport
    ? 'Reading lab values from the file...'
    : isUploading
      ? 'Uploading documents...'
      : isDragReject
        ? 'Some files are not supported here'
        : isDragActive
          ? 'Drop the report or screenshot here'
          : 'Drag and drop a lab report, spreadsheet, or screenshot here';

  const actionButtonLabel = isReadingImport
    ? 'Reading...'
    : isUploading
      ? 'Uploading...'
      : isSubmittingImport
        ? 'Saving...'
        : '+ Upload Files';

  return (
    <div className="document-section">
      <div className="section-header">
        <div className="flex items-center gap-2">
          <h3>Documents & Reports</h3>
          <span className="rounded-md border border-[color:var(--border)] bg-[var(--card-muted)] px-2 py-1 text-xs font-medium text-[var(--muted)]">
            {activeCompartment}
          </span>
        </div>
        {!readOnly ? (
          <Button onClick={open} disabled={isBusy}>
            {actionButtonLabel}
          </Button>
        ) : null}
      </div>

      <div className="upload-info">
        <p>Store lab reports in Documents, or let the app read DGA and key oil-test values before sending them into Oil Tests.</p>
        <p>Supported formats: PDF, Word, Excel, Images (JPG, PNG, WEBP, BMP). Maximum file size: 10MB per file.</p>
        {readOnly ? <p>Viewer mode: document upload, import, reassignment, and deletion are disabled.</p> : null}
      </div>

      {!readOnly ? (
        <div
          {...getRootProps({
            className: cn(
              'rounded-md border-2 border-dashed transition-colors',
              hasDocuments ? 'min-h-36 p-5' : 'min-h-[220px] p-6',
              isDragReject
                ? 'border-[color:var(--danger-soft)] bg-[var(--danger-soft)]'
                : isDragAccept
                  ? 'border-[color:var(--primary)] bg-[var(--primary-soft)]'
                  : 'border-[color:var(--border)] bg-[var(--card-muted)]'
            ),
          })}
        >
          <input {...getInputProps()} />

          <div
            className={cn(
              'flex h-full gap-4',
              hasDocuments
                ? 'flex-col justify-center text-left md:flex-row md:items-center md:justify-between'
                : 'flex-col items-center justify-center text-center'
            )}
          >
            <div className={cn('space-y-3', hasDocuments ? 'max-w-3xl' : 'max-w-2xl')}>
              <div className={cn('flex flex-wrap gap-2', hasDocuments ? '' : 'justify-center')}>
                <Badge variant="secondary">
                  <TestTubeDiagonal className="h-3.5 w-3.5" />
                  Oil Test import ready
                </Badge>
                <Badge variant="outline">
                  <FileText className="h-3.5 w-3.5" />
                  Documents storage
                </Badge>
              </div>

              <div>
                <p className="text-base font-semibold text-[var(--foreground)]">{dropzoneLabel}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  Upload a single PDF, Excel file, or screenshot image to review extracted lab results
                  first. Multiple files are stored in Documents only.
                </p>
              </div>
            </div>

            <div className={cn('flex flex-wrap gap-2', hasDocuments ? 'justify-end' : 'justify-center')}>
              <Button onClick={open} disabled={isBusy}>
                <Upload className="h-4 w-4" />
                {hasDocuments ? 'Choose Files' : 'Upload First Document'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {feedback ? (
        <div
          className={cn(
            'rounded-md border px-4 py-3 text-sm',
            getFeedbackClasses(feedback.type)
          )}
        >
          {feedback.text}
        </div>
      ) : null}

      {hasDocuments ? (
        <div className="document-list">
          {documents.map((doc) => (
            <div key={doc.id} className="document-card">
              <div className="doc-icon">{renderFileIcon(getFileIcon(doc.type || doc.fileType))}</div>

              <div className="doc-info">
                <div className="doc-name">{doc.name || doc.fileName}</div>
                <div className="doc-meta">
                  <span className="doc-size">{formatFileSize(doc.size || doc.fileSize)}</span>
                  <span className="doc-separator">|</span>
                  <span className="doc-date">
                    {new Date(doc.uploadDate || doc.uploadedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

                <div className="doc-actions">
                  {!readOnly && availableCompartments.length > 0 ? (
                    <AppTooltip content="Move to compartment">
                      <Combobox
                        value={getCompartmentForDocument ? getCompartmentForDocument(doc) : activeCompartment}
                        onValueChange={(val) => onAssignDocumentCompartment?.(doc.id, val)}
                        options={availableCompartments.map((name) => ({ value: name, label: name }))}
                      />
                    </AppTooltip>
                  ) : null}
                  <AppTooltip content="View document" disabled={isBusy}>
                    <button
                      className="doc-btn view-btn"
                      onClick={() => handleViewDocument(doc)}
                      aria-label="View document"
                      disabled={isBusy}
                    >
                      <svg className="doc-icon-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                  </AppTooltip>
                  <AppTooltip content="Download document" disabled={isBusy}>
                    <button
                      className="doc-btn download-btn"
                      onClick={() => handleDownloadDocument(doc)}
                      aria-label="Download document"
                      disabled={isBusy}
                    >
                      <svg className="doc-icon-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </button>
                  </AppTooltip>
                  {!readOnly ? (
                    <AppTooltip content="Delete document" disabled={isBusy}>
                      <button
                        className="doc-btn delete-btn"
                        onClick={() => handleRequestDeleteDocument(doc)}
                        aria-label="Delete document"
                        disabled={isBusy}
                      >
                        <svg className="doc-icon-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </AppTooltip>
                  ) : null}
                </div>
            </div>
          ))}
        </div>
      ) : null}

      <DocumentImportReviewModal
        open={Boolean(importSession)}
        file={importSession?.file || null}
        importResult={importSession?.importResult || null}
        errorMessage={importSession?.errorMessage || ''}
        transformerName={transformerName}
        isSubmitting={isSubmittingImport}
        onClose={closeImportModal}
        onStoreOnly={handleStoreOnly}
        onSubmit={handleSubmitImportedRows}
      />

      <Dialog
        open={Boolean(pendingDeleteDocument)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            closeDeleteDialog();
          }
        }}
      >
        <DialogContent className="max-w-[460px]" showClose={!isDeletingDocument}>
          <DialogHeader>
            <DialogTitle>Delete document?</DialogTitle>
            <DialogDescription className="leading-6">
              {pendingDeleteDocument?.fileName || pendingDeleteDocument?.name ? (
                <>
                  This will permanently remove{' '}
                  <span className="font-semibold text-[var(--foreground)]">
                    {pendingDeleteDocument.fileName || pendingDeleteDocument.name}
                  </span>{' '}
                  from Documents.
                </>
              ) : (
                'This will permanently remove the selected document from Documents.'
              )}{' '}
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={closeDeleteDialog} disabled={isDeletingDocument}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteDocument} disabled={isDeletingDocument}>
              {isDeletingDocument ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default DocumentSection;
