import React, { useEffect, useMemo, useState } from 'react';
import { Combobox } from './ui/combobox';
import { DatePicker } from './ui/date-picker';
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
import { buildImportedOilTestRows } from '../lib/oilTestImportUtils';
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
  { key: 'appearance', label: 'Appearance', placeholder: 'Visual', inputMode: 'text' },
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
  { key: 'passivator', label: 'Passivator', placeholder: 'mg/kg' },
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

function getTodayDateString() {
  return new Date().toISOString().split('T')[0];
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

function normaliseDraftRows(rows, file) {
  return (Array.isArray(rows) ? rows : []).map((row, index) => {
    const nextRow = {
      localId: row?.localId || `${file?.name || 'import'}-${index + 1}`,
      sampleNumber: row?.sampleNumber || index + 1,
      testDate: row?.testDate || getTodayDateString(),
      testType: row?.testType || DEFAULT_TEST_TYPE,
      notes: row?.notes || '',
    };

    IMPORT_FIELDS.forEach(({ key }) => {
      nextRow[key] = row?.[key] ?? '';
    });

    return nextRow;
  });
}

function DocumentImportReviewModal({
  open,
  file,
  importResult,
  errorMessage,
  transformerName,
  isSubmitting,
  initialRows,
  mode = 'document',
  onClose,
  onStoreOnly,
  onSubmit,
}) {
  const [draftRows, setDraftRows] = useState([]);
  const isTransformerMode = mode === 'transformer';

  useEffect(() => {
    if (!open) {
      return;
    }

    const sourceRows = Array.isArray(initialRows)
      ? initialRows
      : buildImportedOilTestRows(importResult, file);

    setDraftRows(normaliseDraftRows(sourceRows, file));
  }, [file, importResult, initialRows, open]);

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

  const submitLabel = isTransformerMode
    ? validDraftCount > 1
      ? `Use ${validDraftCount} Reviewed Samples`
      : 'Use Reviewed Sample'
    : validDraftCount > 1
      ? `Submit ${validDraftCount} Samples to Oil Test`
      : 'Submit to Oil Test';
  const storeOnlyLabel = isTransformerMode ? 'Keep PDF Only' : 'Store Document Only';

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
              <DialogTitle>{isTransformerMode ? 'Review imported oil-test rows' : 'Review imported lab report'}</DialogTitle>
              <DialogDescription className="max-w-3xl leading-6">
                {transformerName ? `${transformerName}: ` : ''}
                {isTransformerMode
                  ? 'Review the extracted values before saving this transformer. Confirmed rows will sync into Oil Tests after the transformer is saved. Keep PDF Only stores the report in Documents without creating oil-test data.'
                  : 'Review the extracted values before saving them. Submit creates oil-test records and keeps the report in Documents. Store Document Only saves the file without creating oil-test data.'}
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
                <Badge variant="secondary">
                  {validDraftCount} ready {isTransformerMode ? 'for save' : 'to submit'}
                </Badge>
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
                              {isTransformerMode
                                ? 'Edit the imported values before confirming them for transformer save.'
                                : 'Edit the imported values before sending them into Oil Tests.'}
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
                            <DatePicker
                              value={row.testDate}
                              onValueChange={(val) => handleRowChange(rowIndex, 'testDate', val)}
                              disabled={isSubmitting}
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
                              Test Type
                            </label>
                            <Combobox
                              value={row.testType}
                              onValueChange={(val) => handleRowChange(rowIndex, 'testType', val)}
                              options={TEST_TYPE_OPTIONS}
                              disabled={isSubmitting}
                            />
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
              ? isTransformerMode
                ? `${validDraftCount} sample${validDraftCount === 1 ? '' : 's'} will be synced after the transformer is saved.`
                : `${validDraftCount} sample${validDraftCount === 1 ? '' : 's'} will be added to Oil Tests.`
              : isTransformerMode
                ? 'You can keep the PDF without syncing Oil Test records.'
                : 'You can store the report without creating Oil Test records.'}
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            {typeof onStoreOnly === 'function' ? (
              <Button variant="secondary" onClick={onStoreOnly} disabled={isSubmitting}>
                {storeOnlyLabel}
              </Button>
            ) : null}
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
