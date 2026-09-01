import React, { useEffect, useId, useMemo, useState } from 'react';
import { MapPin, Pencil } from 'lucide-react';
import DocumentImportReviewModal from './DocumentImportReviewModal';
import { createTransformerDraft } from '../lib/transformerDraft';
import { buildImportedOilTestPayloadsFromRows } from '../lib/oilTestImportUtils';
import { buildTransformerMnemonicAssist } from '../lib/transformerMnemonicAssist';
import TransformerFormFields from './transformer/TransformerFormFields';
import TransformerMapPickerModal from './transformer/TransformerMapPickerModal';
import TransformerPdfImportPanel from './transformer/TransformerPdfImportPanel';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

function TransformerModal({ open, transformer, transformers = [], onSave, onClose, onShowNotice }) {
  const [formData, setFormData] = useState(() => createTransformerDraft());
  const [importSession, setImportSession] = useState(null);
  const [isImportReviewOpen, setIsImportReviewOpen] = useState(false);
  const [isMapPickerOpen, setIsMapPickerOpen] = useState(false);
  const mnemonicSuggestionListId = useId();

  useEffect(() => {
    setFormData(createTransformerDraft(transformer));
    setImportSession(null);
    setIsImportReviewOpen(false);
    setIsMapPickerOpen(false);
  }, [transformer]);

  const mnemonicAssist = useMemo(
    () =>
      buildTransformerMnemonicAssist({
        transformers,
        currentTransformerId: transformer?.id,
        serialNumber: formData.serialNumber,
        siteName: formData.siteName,
        txName: formData.txName,
      }),
    [formData.serialNumber, formData.siteName, formData.txName, transformer?.id, transformers]
  );

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleImport = (nextImportSession) => {
    if (!nextImportSession || typeof nextImportSession !== 'object') {
      return;
    }

    setImportSession(nextImportSession);
    setFormData((current) => createTransformerDraft({ ...current, ...nextImportSession.fields }));
    setIsImportReviewOpen(Boolean(nextImportSession.oilTestDraftRows?.length));
  };

  const handleMnemonicSuggestionPick = (mnemonic) => {
    if (!mnemonic) {
      return;
    }

    setFormData((current) => createTransformerDraft({ ...current, mnemonic }));
  };

  const handleImportReviewOpen = () => {
    if (!importSession?.oilTestImportResult && !importSession?.oilTestDraftRows?.length) {
      return;
    }

    setIsImportReviewOpen(true);
  };

  const handleImportReviewClose = () => {
    setIsImportReviewOpen(false);
  };

  const handleMapPositionConfirm = (nextPosition) => {
    setFormData((current) => createTransformerDraft({ ...current, position: nextPosition }));
    setIsMapPickerOpen(false);
  };

  const handleImportReviewSubmit = (draftRows) => {
    const nextRows = Array.isArray(draftRows) ? draftRows : [];

    setImportSession((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        oilTestDraftRows: nextRows,
        oilTestPayloads: buildImportedOilTestPayloadsFromRows(nextRows),
        oilTestReviewStatus: 'approved',
      };
    });
    setIsImportReviewOpen(false);
  };

  const handleImportReviewStoreOnly = () => {
    setImportSession((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        oilTestPayloads: [],
        oilTestReviewStatus: 'skipped',
      };
    });
    setIsImportReviewOpen(false);
  };

  const openFormNotice = (notice) => {
    onShowNotice?.(notice);
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!formData.siteName.trim()) {
      openFormNotice({
        variant: 'warning',
        title: 'Site name required',
        description: 'Add the site name before saving this transformer record.',
        detail: 'The site name helps keep the asset register grouped correctly and avoids ambiguous entries.',
        txName: formData.txName?.trim() || '',
        actionLabel: 'Back to form',
      });
      return;
    }
    if (!formData.txName.trim()) {
      openFormNotice({
        variant: 'warning',
        title: 'Transformer name required',
        description: 'Add the transformer name before saving this asset.',
        detail: 'Use the equipment name used at site, for example T1, TX-001, or the local transformer identifier.',
        siteName: formData.siteName?.trim() || '',
        actionLabel: 'Back to form',
      });
      return;
    }
    if (!formData.voltage.trim()) {
      openFormNotice({
        variant: 'warning',
        title: 'Voltage required',
        description: 'Enter the transformer voltage before saving this record.',
        detail: 'This field is required so the asset can be tracked and compared correctly in the register.',
        txName: formData.txName?.trim() || '',
        siteName: formData.siteName?.trim() || '',
        actionLabel: 'Back to form',
      });
      return;
    }
    if (mnemonicAssist.exactSerialConflicts.length > 0) {
      const firstConflict = mnemonicAssist.exactSerialConflicts[0];
      const assetLabel = [firstConflict.siteName, firstConflict.txName].filter(Boolean).join(' / ');
      const mnemonicLabel = firstConflict.mnemonic ? ` (${firstConflict.mnemonic})` : '';

      openFormNotice({
        variant: 'warning',
        title: 'Duplicate serial number detected',
        description: 'This serial number is already linked to an existing transformer in the asset register.',
        detail: `Serial number belongs to ${assetLabel || 'another transformer'}${mnemonicLabel}. Open that asset and update it instead of creating a duplicate serial number.`,
        txName: formData.txName?.trim() || '',
        siteName: formData.siteName?.trim() || '',
        actionLabel: 'Back to form',
      });
      return;
    }

    if (importSession?.oilTestReviewStatus === 'pending' && importSession?.oilTestDraftRows?.length) {
      setIsImportReviewOpen(true);
      return;
    }

    const normalizedFormData = createTransformerDraft(formData);

    onSave({
      ...normalizedFormData,
      id: transformer?.id || Date.now().toString(),
      importSession,
    });
  };

  const latitude = Number(formData.position?.[0]);
  const longitude = Number(formData.position?.[1]);
  const reviewedOilTestCount = Array.isArray(importSession?.oilTestPayloads) ? importSession.oilTestPayloads.length : 0;
  const oilTestDraftCount = Array.isArray(importSession?.oilTestDraftRows) ? importSession.oilTestDraftRows.length : 0;

  return (
    <>
      <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : null)}>
        <DialogContent className="mobile-form-dialog max-w-3xl p-0">
          <DialogHeader>
            <DialogTitle>{transformer?.id ? 'Edit transformer' : 'Add transformer'}</DialogTitle>
            <DialogDescription>
              Capture the asset identity, electrical rating, and exact map placement for this transformer.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="mobile-dialog-form">
            <div className="mobile-dialog-scroll space-y-5 px-4 py-4 sm:px-5 sm:py-5">
              <TransformerPdfImportPanel
                onImport={handleImport}
                onReviewClick={handleImportReviewOpen}
                oilTestReviewStatus={importSession?.oilTestReviewStatus || 'idle'}
                oilTestDraftCount={oilTestDraftCount}
                reviewedOilTestCount={reviewedOilTestCount}
              />
              <TransformerFormFields
                formData={formData}
                onChange={handleChange}
                mnemonicSuggestions={mnemonicAssist.suggestions}
                serialConflicts={mnemonicAssist.exactSerialConflicts}
                mnemonicSuggestionListId={mnemonicSuggestionListId}
                onMnemonicSuggestionPick={handleMnemonicSuggestionPick}
              />

              <section className="rounded-md border border-[color:var(--border)] bg-[var(--card-muted)]">
                <button
                  type="button"
                  onClick={() => setIsMapPickerOpen(true)}
                  className="flex w-full items-start gap-3 rounded-md p-4 text-left transition-colors hover:bg-[var(--card-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
                >
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[var(--primary-soft)] text-[var(--primary-strong)]">
                    <MapPin className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="block text-sm font-semibold">Map placement</span>
                    <span className="block text-sm text-[var(--muted)]">
                      Latitude {Number.isFinite(latitude) ? latitude.toFixed(6) : '--'} and longitude {Number.isFinite(longitude) ? longitude.toFixed(6) : '--'}. Click here to open the map, drop the pin on the exact spot, or type the coordinates yourself.
                    </span>
                  </span>
                  <span className="mt-0.5 inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[color:var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-xs font-medium text-[var(--foreground)]">
                    <Pencil className="h-3.5 w-3.5" />
                    Change
                  </span>
                </button>
              </section>
            </div>

            <DialogFooter className="mt-auto px-4 sm:px-5">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">{transformer?.id ? 'Update transformer' : 'Save transformer'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <TransformerMapPickerModal
        open={isMapPickerOpen}
        position={formData.position}
        assetLabel={formData.txName || formData.siteName || ''}
        onCancel={() => setIsMapPickerOpen(false)}
        onConfirm={handleMapPositionConfirm}
      />

      <DocumentImportReviewModal
        open={isImportReviewOpen}
        file={importSession?.file || null}
        importResult={importSession?.oilTestImportResult || null}
        errorMessage={importSession?.oilTestImportError || ''}
        transformerName={formData.txName || formData.siteName || transformer?.txName || ''}
        isSubmitting={false}
        initialRows={importSession?.oilTestDraftRows || []}
        mode="transformer"
        onClose={handleImportReviewClose}
        onStoreOnly={handleImportReviewStoreOnly}
        onSubmit={handleImportReviewSubmit}
      />
    </>
  );
}

export default TransformerModal;
