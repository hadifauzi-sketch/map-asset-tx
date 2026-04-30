import React, { useCallback, useState } from 'react';
import { AlertCircle, CheckCircle2, FileText, Loader2, Sparkles, Upload } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { extractDgaImportFromFile } from '../../lib/dga-import/dgaFileImport';
import {
  buildImportedOilTestPayloadsFromRows,
  buildImportedOilTestRows,
} from '../../lib/oilTestImportUtils';
import { extractTransformerImportFromPdfFile } from '../../lib/transformer-import/transformerPdfImport';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';

const PDF_ACCEPT = {
  'application/pdf': ['.pdf'],
};
const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024;

function getDropErrorMessage(rejection) {
  const firstError = rejection?.errors?.[0];

  if (!firstError) {
    return 'Failed to read the selected PDF.';
  }

  if (firstError.code === 'file-too-large') {
    return 'PDF is too large. Please use a PDF smaller than 10 MB.';
  }

  if (firstError.code === 'file-invalid-type') {
    return 'Only PDF files are supported here.';
  }

  if (firstError.code === 'too-many-files') {
    return 'Please drop only one PDF at a time.';
  }

  return firstError.message || 'Failed to read the selected PDF.';
}

function TransformerPdfImportPanel({
  onImport,
  onReviewClick,
  oilTestReviewStatus = 'idle',
  oilTestDraftCount = 0,
  reviewedOilTestCount = 0,
}) {
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [importSummary, setImportSummary] = useState(null);

  const handleImportFile = useCallback(async (file) => {
    if (!file) {
      return;
    }

    setIsImporting(true);
    setImportError('');

    try {
      const transformerImport = await extractTransformerImportFromPdfFile(file);
      let oilTestImportResult = null;
      let oilTestImportError = '';

      try {
        oilTestImportResult = await extractDgaImportFromFile(file);
      } catch (error) {
        oilTestImportError = error instanceof Error ? error.message : 'Oil-test results could not be read from this PDF.';
      }

      const oilTestDraftRows = oilTestImportResult ? buildImportedOilTestRows(oilTestImportResult, file) : [];
      const oilTestPayloads = buildImportedOilTestPayloadsFromRows(oilTestDraftRows);
      const result = {
        ...transformerImport,
        file,
        oilTestImportResult,
        oilTestImportError,
        oilTestDraftRows,
        oilTestPayloads,
        oilTestReviewStatus: oilTestDraftRows.length ? 'pending' : 'idle',
      };

      setImportSummary(result);
      onImport?.(result);
    } catch (error) {
      setImportSummary(null);
      setImportError(error instanceof Error ? error.message : 'Failed to read the selected PDF.');
    } finally {
      setIsImporting(false);
    }
  }, [onImport]);

  const handleDropAccepted = useCallback(
    (acceptedFiles) => {
      const [file] = acceptedFiles;
      if (!file) {
        return;
      }

      handleImportFile(file);
    },
    [handleImportFile]
  );

  const handleDropRejected = useCallback((fileRejections) => {
    setImportSummary(null);
    setImportError(getDropErrorMessage(fileRejections?.[0]));
  }, []);

  const { getRootProps, getInputProps, isDragActive, isDragAccept, isDragReject, open } = useDropzone({
    accept: PDF_ACCEPT,
    disabled: isImporting,
    maxSize: MAX_PDF_SIZE_BYTES,
    multiple: false,
    noClick: true,
    noKeyboard: true,
    onDropAccepted: handleDropAccepted,
    onDropRejected: handleDropRejected,
  });

  const dropzoneLabel = isImporting
    ? 'Reading transformer details from the PDF...'
    : isDragReject
      ? 'Only one PDF up to 10 MB is supported'
      : isDragActive
        ? 'Drop the report PDF here'
        : 'Drag and drop the ACTMS report PDF here';
  const hasReviewableOilTests = oilTestDraftCount > 0;
  const showReviewPrompt = Boolean(importSummary?.oilTestImportResult) && hasReviewableOilTests;
  const reviewActionLabel =
    oilTestReviewStatus === 'approved'
      ? 'Review oil-test rows again'
      : oilTestReviewStatus === 'skipped'
        ? 'Review oil-test rows'
        : 'Review oil-test rows';

  return (
    <section
      {...getRootProps({
        className: cn(
          'overflow-hidden rounded-xl border transition-colors',
          isDragReject
            ? 'border-[color:var(--danger-soft)] bg-[var(--danger-soft)]/30'
            : isDragAccept || isDragActive
              ? 'border-[color:var(--primary)] bg-[linear-gradient(135deg,rgba(12,120,113,0.16),rgba(255,255,255,0.96)_44%,rgba(12,120,113,0.10))]'
              : 'border-[color:var(--border)] bg-[linear-gradient(135deg,rgba(12,120,113,0.10),rgba(255,255,255,0.92)_44%,rgba(12,120,113,0.05))]'
        ),
      })}
    >
      <input {...getInputProps()} />

      <div className="flex flex-col gap-4 border-b border-[color:var(--border)]/70 px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-sm',
              isDragAccept || isDragActive
                ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                : 'bg-[var(--primary)] text-[var(--primary-foreground)]'
            )}
          >
            <Sparkles className={cn('h-5 w-5', isImporting ? 'animate-pulse' : '')} />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-[var(--foreground)]">Import details from report PDF</p>
            <p className="max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Upload the same ACTMS lab-result PDF and the form will prefill the transformer identity fields.
              Nothing is saved until you click Save transformer.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={isDragReject ? 'danger' : isDragAccept || isDragActive ? 'success' : 'secondary'}>
                <Upload className="h-3.5 w-3.5" />
                {dropzoneLabel}
              </Badge>
              <Badge variant="outline">PDF only</Badge>
              <Badge variant="outline">Max 10 MB</Badge>
            </div>
          </div>
        </div>

        <Button
          variant="outline"
          className="w-full sm:w-auto"
          onClick={open}
          disabled={isImporting}
        >
          {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {isImporting ? 'Reading PDF...' : importSummary ? 'Choose another PDF' : 'Upload PDF'}
        </Button>
      </div>

      <div className="space-y-4 px-4 py-4">
        <div
          className={cn(
            'rounded-lg border-2 border-dashed px-4 py-5 text-center transition-colors',
            isDragReject
              ? 'border-[color:var(--danger-soft)] bg-[var(--danger-soft)]/40'
              : isDragAccept || isDragActive
                ? 'border-[color:var(--primary)] bg-[var(--primary-soft)]/60'
                : 'border-[color:var(--border)]/70 bg-[color:var(--card)]/70'
          )}
        >
          <p className="text-sm font-semibold text-[var(--foreground)]">{dropzoneLabel}</p>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Drop the report anywhere in this box, or use the upload button to select a PDF manually.
          </p>
        </div>

        <div className="rounded-lg border border-dashed border-[color:var(--border)]/70 bg-[color:var(--card)]/75 px-4 py-3 text-sm text-[var(--muted)]">
          Supported mapping: Site to Site name, TX No. to Transformer name, Serial No. to Serial number,
          Maker to Manufacturer, plus Mnemonic, Load MVA, Voltage, Year built, and state when it can be
          inferred from the address.
        </div>

        {importError ? (
          <div className="flex items-start gap-3 rounded-lg border border-[color:var(--danger-soft)] bg-[var(--danger-soft)]/65 px-4 py-3 text-sm text-[var(--danger-strong)]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{importError}</p>
          </div>
        ) : null}

        {importSummary ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">
                <FileText className="h-3.5 w-3.5" />
                {importSummary.fileName}
              </Badge>
              <Badge variant="success">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {importSummary.matchedCount} fields filled
              </Badge>
              {showReviewPrompt ? (
                <Badge
                  variant={
                    oilTestReviewStatus === 'approved'
                      ? 'success'
                      : oilTestReviewStatus === 'skipped'
                        ? 'secondary'
                        : 'outline'
                  }
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {oilTestReviewStatus === 'approved'
                    ? `${reviewedOilTestCount} reviewed oil-test ${reviewedOilTestCount === 1 ? 'sample' : 'samples'} ready`
                    : oilTestReviewStatus === 'skipped'
                      ? 'PDF only'
                      : `Review ${oilTestDraftCount} oil-test ${oilTestDraftCount === 1 ? 'sample' : 'samples'}`}
                </Badge>
              ) : importSummary.oilTestPayloads?.length ? (
                <Badge variant="success">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {importSummary.oilTestPayloads.length} oil-test {importSummary.oilTestPayloads.length === 1 ? 'sample' : 'samples'} ready
                </Badge>
              ) : null}
              {importSummary.fields.state ? <Badge variant="outline">{importSummary.fields.state}</Badge> : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {importSummary.matchedFields.map((field) => (
                <div
                  key={field.key}
                  className="rounded-lg border border-[color:var(--border)] bg-[color:var(--card)]/82 px-3 py-3 shadow-sm"
                >
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--muted)]">
                    {field.label}
                  </p>
                  <p className="mt-2 break-words text-sm font-semibold text-[var(--foreground)]">
                    {field.value}
                  </p>
                </div>
              ))}
            </div>

            <p className="text-sm text-[var(--muted)]">
              The values above have already been applied to the form below. You can still edit any field before
              saving.
            </p>
            {showReviewPrompt ? (
              <div
                className={cn(
                  'flex flex-col gap-3 rounded-lg border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between',
                  oilTestReviewStatus === 'approved'
                    ? 'border-[color:var(--success-soft)] bg-[var(--success-soft)]/45 text-[var(--success-strong)]'
                    : oilTestReviewStatus === 'skipped'
                      ? 'border-[color:var(--border)] bg-[color:var(--card)]/80 text-[var(--muted)]'
                      : 'border-[color:var(--primary-soft)] bg-[var(--primary-soft)]/45 text-[var(--foreground)]'
                )}
              >
                <p>
                  {oilTestReviewStatus === 'approved'
                    ? 'Reviewed oil-test rows are ready. They will sync into Oil Tests when you save this transformer.'
                    : oilTestReviewStatus === 'skipped'
                      ? 'This PDF is set to store in Documents only. Reopen the review if you want to sync oil-test rows too.'
                      : 'Review the imported oil-test rows before save. Nothing is sent to Oil Tests until you confirm the review.'}
                </p>
                {typeof onReviewClick === 'function' ? (
                  <Button
                    variant={oilTestReviewStatus === 'approved' ? 'secondary' : 'outline'}
                    className="w-full sm:w-auto"
                    onClick={onReviewClick}
                    disabled={isImporting}
                  >
                    {reviewActionLabel}
                  </Button>
                ) : null}
              </div>
            ) : importSummary.oilTestPayloads?.length ? (
              <div className="rounded-lg border border-[color:var(--success-soft)] bg-[var(--success-soft)]/45 px-4 py-3 text-sm text-[var(--success-strong)]">
                This same PDF will also be stored in Documents and synced into Oil Tests when you save this
                transformer.
              </div>
            ) : null}
            {importSummary.oilTestImportError ? (
              <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--card)]/80 px-4 py-3 text-sm text-[var(--muted)]">
                Transformer details were filled, but oil-test values could not be linked from this PDF:
                {' '}
                {importSummary.oilTestImportError}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default TransformerPdfImportPanel;
