import React, { useEffect, useMemo, useState } from 'react';
import { FileText, TestTubeDiagonal } from 'lucide-react';
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
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { TEST_TYPE_OPTIONS } from '../lib/testTypeUtils';

const DEFAULT_TEST_TYPE = 'Routine';
const DGA_FIELDS = [
  { key: 'h2', label: 'H2' },
  { key: 'ch4', label: 'CH4' },
  { key: 'c2h6', label: 'C2H6' },
  { key: 'c2h4', label: 'C2H4' },
  { key: 'c2h2', label: 'C2H2' },
  { key: 'co', label: 'CO' },
  { key: 'co2', label: 'CO2' },
  { key: 'o2', label: 'O2' },
  { key: 'n2', label: 'N2' },
];
const ADDITIONAL_FIELDS = [
  { key: 'breakdown', label: 'BDV', placeholder: 'kV' },
  { key: 'waterContent', label: 'Moisture', placeholder: 'ppm' },
  { key: 'acidity', label: 'Acidity', placeholder: 'mgKOH/g' },
  { key: 'interfacialTension', label: 'IFT', placeholder: 'mN/m' },
  { key: 'color', label: 'Color', placeholder: 'ASTM', inputMode: 'text' },
  { key: 'flashPoint', label: 'Flash Point', placeholder: 'deg C' },
  { key: 'inhibitor', label: 'Inhibitor', placeholder: '%' },
  { key: 'copperCorrosive', label: 'Copper Corrosive IEC', placeholder: 'e.g. 1a', inputMode: 'text' },
  { key: 'density', label: 'Density', placeholder: 'kg/m3' },
  { key: 'dbds', label: 'DBDS', placeholder: 'mg/kg' },
  { key: 'viscosity40', label: 'Viscosity @40C', placeholder: 'cSt' },
  { key: 'methanol', label: 'Methanol', placeholder: 'ppm' },
  { key: 'pcb', label: 'PCB', placeholder: 'ppm' },
  { key: 'powerFactor', label: 'Power Factor', placeholder: 'ratio' },
  { key: 'resistivity', label: 'Resistivity', placeholder: 'GOhm-m' },
  { key: 'specificGravity', label: 'Specific Gravity', placeholder: 'value' },
  { key: 'passivator', label: 'Passivator', placeholder: 'ppm' },
  { key: 'fol2', label: '2-FOL', placeholder: 'ppb' },
  { key: 'hmf5', label: '5-HMF', placeholder: 'ppb' },
  { key: 'fal2', label: '2-FAL', placeholder: 'ppb' },
  { key: 'acf2', label: '2-ACF', placeholder: 'ppb' },
  { key: 'mef5', label: '5-MEF', placeholder: 'ppb' },
  { key: 'copperCu', label: 'Copper (Cu)', placeholder: 'ppm' },
  { key: 'ironFe', label: 'Iron (Fe)', placeholder: 'ppm' },
  { key: 'aluminumAl', label: 'Aluminum (Al)', placeholder: 'ppm' },
  { key: 'estimatedDpFuran', label: 'DP from Furan', placeholder: 'value' },
  { key: 'estimatedDpMethanol', label: 'DP from Methanol', placeholder: 'value' },
];
const IMPORT_FIELDS = [...DGA_FIELDS, ...ADDITIONAL_FIELDS];
const TDCG_FIELDS = ['h2', 'ch4', 'c2h2', 'c2h4', 'c2h6', 'co'];
const SELECT_CLASS_NAME =
  'flex h-10 w-full rounded-md border border-[color:var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] shadow-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] disabled:cursor-not-allowed disabled:opacity-50';

function getTodayDateString() {
  return new Date().toISOString().split('T')[0];
}

function buildImportNotes(file, importResult) {
  const parts = [];

  if (file?.name) {
    parts.push(`Imported from ${file.name}`);
  }

  if (importResult?.strategyLabel) {
    parts.push(importResult.strategyLabel);
  }

  return parts.join(' - ');
}

function buildDraftRows(importResult, file) {
  const samples =
    importResult?.kind === 'sample-history'
      ? importResult.samples || []
      : importResult?.samplePatch
        ? [importResult.samplePatch]
        : [];

  return samples.map((sample, index) => {
    const row = {
      localId: `${file?.name || 'import'}-${index + 1}`,
      sampleNumber: index + 1,
      testDate: sample.date || getTodayDateString(),
      testType: DEFAULT_TEST_TYPE,
      notes: buildImportNotes(file, importResult),
    };

    IMPORT_FIELDS.forEach(({ key }) => {
      row[key] = sample[key] ?? '';
    });

    return row;
  });
}

function hasAnyImportedValue(row) {
  return IMPORT_FIELDS.some(({ key }) => String(row?.[key] ?? '').trim() !== '');
}

function calculateTdcg(row) {
  const total = TDCG_FIELDS.reduce((sum, key) => {
    const parsedValue = Number.parseFloat(String(row?.[key] ?? '').replace(/,/g, ''));
    return sum + (Number.isFinite(parsedValue) ? parsedValue : 0);
  }, 0);

  return total > 0 ? Number(total.toFixed(6)) : null;
}

function formatModalDate(dateString) {
  if (!dateString) {
    return '-';
  }

  const date = new Date(dateString);
  return Number.isNaN(date.getTime()) ? dateString : date.toLocaleDateString();
}

function getFileTypeLabel(importResult) {
  switch (importResult?.fileType) {
    case 'excel':
      return 'Excel';
    case 'pdf':
      return 'PDF';
    case 'image':
      return 'Image OCR';
    default:
      return 'Document';
  }
}

function DocumentImportReviewModal({
  open,
  file,
  importResult,
  errorMessage,
  transformerName,
  isSubmitting,
  onClose,
  onStoreOnly,
  onSubmit,
}) {
  const [draftRows, setDraftRows] = useState([]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setDraftRows(buildDraftRows(importResult, file));
  }, [file, importResult, open]);

  const validDraftCount = useMemo(
    () => draftRows.filter((row) => row.testDate && hasAnyImportedValue(row)).length,
    [draftRows]
  );

  const canSubmit = Boolean(importResult) && validDraftCount > 0 && !errorMessage;

  const handleRowChange = (rowIndex, field, value) => {
    setDraftRows((currentRows) =>
      currentRows.map((row, index) => (index === rowIndex ? { ...row, [field]: value } : row))
    );
  };

  const handleRemoveRow = (rowIndex) => {
    setDraftRows((currentRows) => currentRows.filter((_, index) => index !== rowIndex));
  };

  const handleSubmit = () => {
    onSubmit(draftRows);
  };

  const submitLabel =
    validDraftCount > 1 ? `Submit ${validDraftCount} Samples to Oil Test` : 'Submit to Oil Test';

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen && !isSubmitting ? onClose() : null)}>
      <DialogContent className="mobile-form-dialog max-w-[1100px] p-0" showClose={!isSubmitting}>
        <DialogHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">
                  <FileText className="h-3.5 w-3.5" />
                  {file?.name || 'Imported report'}
                </Badge>
                {importResult ? <Badge variant="outline">{getFileTypeLabel(importResult)}</Badge> : null}
                {importResult?.sampleCount ? (
                  <Badge variant="success">{importResult.sampleCount} samples found</Badge>
                ) : null}
              </div>
              <DialogTitle>Review imported lab report</DialogTitle>
              <DialogDescription className="max-w-3xl leading-6">
                {transformerName ? `${transformerName}: ` : ''}
                Review the extracted values before saving them. Submit creates oil-test records and keeps
                the report in Documents. Store Document Only saves the file without creating oil-test data.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="mobile-dialog-scroll flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {errorMessage ? (
            <div className="rounded-md border border-[color:var(--danger-soft)] bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger-strong)]">
              {errorMessage}
            </div>
          ) : null}

          {importResult ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {importResult.sourceLabel ? <Badge variant="secondary">{importResult.sourceLabel}</Badge> : null}
                {importResult.strategyLabel ? <Badge variant="outline">{importResult.strategyLabel}</Badge> : null}
                <Badge variant="secondary">{validDraftCount} ready to submit</Badge>
              </div>

              {draftRows.length > 0 ? (
                <div className="grid gap-4">
                  {draftRows.map((row, rowIndex) => {
                    const tdcg = calculateTdcg(row);

                    return (
                      <section
                        key={row.localId}
                        className="rounded-md border border-[color:var(--border)] bg-[var(--card-muted)] p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="secondary">Sample #{row.sampleNumber}</Badge>
                              <Badge variant="outline">{formatModalDate(row.testDate)}</Badge>
                            </div>
                            <p className="mt-2 text-sm text-[var(--muted)]">
                              Edit the imported values before sending them into Oil Tests.
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={tdcg != null ? 'success' : 'secondary'}>
                              <TestTubeDiagonal className="h-3.5 w-3.5" />
                              TDCG {tdcg != null ? tdcg : '-'}
                            </Badge>
                            {draftRows.length > 1 ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveRow(rowIndex)}
                                disabled={isSubmitting}
                              >
                                Remove sample
                              </Button>
                            ) : null}
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
                              Test Date
                            </label>
                            <Input
                              type="date"
                              value={row.testDate}
                              onChange={(event) => handleRowChange(rowIndex, 'testDate', event.target.value)}
                              disabled={isSubmitting}
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
                              Test Type
                            </label>
                            <select
                              className={SELECT_CLASS_NAME}
                              value={row.testType}
                              onChange={(event) => handleRowChange(rowIndex, 'testType', event.target.value)}
                              disabled={isSubmitting}
                            >
                              {TEST_TYPE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          {DGA_FIELDS.map((field) => (
                            <div key={`${row.localId}-${field.key}`} className="space-y-1.5">
                              <label className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
                                {field.label}
                              </label>
                              <Input
                                inputMode="decimal"
                                placeholder="ppm"
                                value={row[field.key]}
                                onChange={(event) => handleRowChange(rowIndex, field.key, event.target.value)}
                                disabled={isSubmitting}
                              />
                            </div>
                          ))}
                          {ADDITIONAL_FIELDS.map((field) => (
                            <div key={`${row.localId}-${field.key}`} className="space-y-1.5">
                              <label className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
                                {field.label}
                              </label>
                              <Input
                                inputMode={field.inputMode || 'decimal'}
                                placeholder={field.placeholder}
                                value={row[field.key]}
                                onChange={(event) => handleRowChange(rowIndex, field.key, event.target.value)}
                                disabled={isSubmitting}
                              />
                            </div>
                          ))}
                        </div>

                        <div className="mt-4 space-y-1.5">
                          <label className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
                            Notes
                          </label>
                          <Textarea
                            className="min-h-20"
                            value={row.notes}
                            onChange={(event) => handleRowChange(rowIndex, 'notes', event.target.value)}
                            disabled={isSubmitting}
                          />
                        </div>
                      </section>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-[color:var(--border)] bg-[var(--card-muted)] px-4 py-10 text-center text-sm text-[var(--muted)]">
                  No imported samples are ready yet. You can still keep the file in Documents.
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-[color:var(--border)] bg-[var(--card-muted)] px-4 py-10 text-center text-sm text-[var(--muted)]">
              The file can still be stored as a lab document even though no importable lab data is ready.
            </div>
          )}
        </div>

        <DialogFooter className="sm:justify-between">
          <p className="text-sm text-[var(--muted)]">
            {canSubmit
              ? `${validDraftCount} sample${validDraftCount === 1 ? '' : 's'} will be added to Oil Tests.`
              : 'You can store the report without creating Oil Test records.'}
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button variant="secondary" onClick={onStoreOnly} disabled={isSubmitting}>
              Store Document Only
            </Button>
            {importResult ? (
              <Button onClick={handleSubmit} disabled={!canSubmit || isSubmitting}>
                {submitLabel}
              </Button>
            ) : null}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default DocumentImportReviewModal;
