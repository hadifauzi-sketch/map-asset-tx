import React, { useEffect, useMemo, useState } from 'react';
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
import { MALAYSIA_STATES } from '../lib/malaysiaStates';

function normalizeSearchText(value) {
  return String(value || '').trim().toLowerCase();
}

function FloorPlanMetadataDialog({
  open,
  floorPlanDraft,
  transformers = [],
  detectedTransformerIds = [],
  onClose,
  onSave,
}) {
  const [formData, setFormData] = useState({
    id: null,
    name: '',
    companyName: '',
    state: '',
    transformerIds: [],
    createdAt: null,
  });
  const [transformerSearch, setTransformerSearch] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }

    setFormData({
      id: floorPlanDraft?.id || null,
      name: floorPlanDraft?.name || '',
      companyName: floorPlanDraft?.companyName || '',
      state: floorPlanDraft?.state || '',
      transformerIds: Array.isArray(floorPlanDraft?.transformerIds)
        ? floorPlanDraft.transformerIds.map(String)
        : [],
      createdAt: floorPlanDraft?.createdAt || null,
    });
    setTransformerSearch('');
  }, [floorPlanDraft, open]);

  const sortedTransformers = useMemo(
    () =>
      [...transformers].sort((left, right) => {
        const siteDifference = String(left.siteName || '').localeCompare(String(right.siteName || ''));
        if (siteDifference !== 0) {
          return siteDifference;
        }
        return String(left.txName || '').localeCompare(String(right.txName || ''));
      }),
    [transformers]
  );

  const filteredTransformers = useMemo(() => {
    const search = normalizeSearchText(transformerSearch);
    if (!search) {
      return sortedTransformers;
    }

    return sortedTransformers.filter((transformer) =>
      [transformer.txName, transformer.serialNumber, transformer.mnemonic]
        .filter(Boolean)
        .some((value) => normalizeSearchText(value).includes(search))
    );
  }, [sortedTransformers, transformerSearch]);

  const detectedTransformerIdSet = useMemo(
    () => new Set((detectedTransformerIds || []).map((value) => String(value))),
    [detectedTransformerIds]
  );

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const toggleTransformerAssignment = (transformerId) => {
    const nextId = String(transformerId);
    setFormData((current) => {
      const hasTransformer = current.transformerIds.includes(nextId);
      return {
        ...current,
        transformerIds: hasTransformer
          ? current.transformerIds.filter((value) => value !== nextId)
          : [...current.transformerIds, nextId],
      };
    });
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!String(formData.name || '').trim()) {
      window.alert('Please enter an area name.');
      return;
    }

    if (!String(formData.companyName || '').trim()) {
      window.alert('Please enter a company or parent name.');
      return;
    }

    if (!String(formData.state || '').trim()) {
      window.alert('Please choose a state.');
      return;
    }

    onSave({
      ...floorPlanDraft,
      id: formData.id,
      name: formData.name.trim(),
      companyName: formData.companyName.trim(),
      state: formData.state.trim(),
      transformerIds: formData.transformerIds,
      createdAt: formData.createdAt,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : null)}>
      <DialogContent className="mobile-form-dialog max-w-3xl p-0">
        <DialogHeader>
          <DialogTitle>{formData.id ? 'Edit Floor Plan' : 'Save Floor Plan'}</DialogTitle>
          <DialogDescription>
            Name the overlay, attach it to a company and state, then choose which transformers belong inside this floor.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mobile-dialog-form">
          <div className="mobile-dialog-scroll space-y-5 px-4 py-4 sm:px-5 sm:py-5">
            <section className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-[var(--foreground)]">
                  Company / Parent name
                  <span className="ml-1 text-[var(--danger-strong)]">*</span>
                </span>
                <Input
                  name="companyName"
                  value={formData.companyName}
                  onChange={handleChange}
                  placeholder="Ditrolic, PrefChem, PMU, PPU, PE and LSS"
                  required
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-[var(--foreground)]">
                  Area Name
                  <span className="ml-1 text-[var(--danger-strong)]">*</span>
                </span>
                <Input
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Plant 1, Substation, Area and Building"
                  required
                />
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-[var(--foreground)]">
                  State / territory
                  <span className="ml-1 text-[var(--danger-strong)]">*</span>
                </span>
                <select
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  className="flex h-10 w-full rounded-md border border-[color:var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] shadow-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
                  required
                >
                  <option value="">Select a state</option>
                  {MALAYSIA_STATES.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </select>
              </label>
            </section>

            <section className="rounded-md border border-[color:var(--border)] bg-[var(--card-muted)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--foreground)]">Transformers inside this Area</p>
                  <p className="text-sm text-[var(--muted)]">
                    Assets detected inside the drawn boundary are preselected. Search by transformer name, serial number, or mnemonic to fine-tune the list.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{formData.transformerIds.length} selected</Badge>
                  <Badge variant="outline">{detectedTransformerIds.length} detected in shape</Badge>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <label className="space-y-2">
                  <span className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
                    Search transformers
                  </span>
                  <Input
                    value={transformerSearch}
                    onChange={(event) => setTransformerSearch(event.target.value)}
                    placeholder="Search by name, serial number, or mnemonic"
                  />
                </label>

                <p className="text-xs text-[var(--muted)]">
                  {filteredTransformers.length} of {sortedTransformers.length} transformers shown
                </p>

                <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                  {sortedTransformers.length === 0 ? (
                    <p className="rounded-md bg-[var(--card)] px-3 py-3 text-sm text-[var(--muted)]">
                      Add a transformer first, then attach it to this floor plan.
                    </p>
                  ) : filteredTransformers.length === 0 ? (
                    <p className="rounded-md bg-[var(--card)] px-3 py-3 text-sm text-[var(--muted)]">
                      No transformer matched that search. Try part of the name, serial number, or mnemonic.
                    </p>
                  ) : (
                    filteredTransformers.map((transformer) => {
                      const transformerId = String(transformer.id);
                      const isSelected = formData.transformerIds.includes(transformerId);
                      const isDetected = detectedTransformerIdSet.has(transformerId);

                      return (
                        <label
                          key={transformer.id}
                          className={`flex items-start gap-3 rounded-md border px-3 py-3 transition-colors ${
                            isSelected
                              ? 'border-[color:var(--primary)] bg-[var(--primary-soft)]'
                              : 'border-[color:var(--border)] bg-[var(--card)]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="mt-1 h-4 w-4"
                            checked={isSelected}
                            onChange={() => toggleTransformerAssignment(transformer.id)}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-semibold text-[var(--foreground)]">
                                {transformer.txName || 'Unnamed transformer'}
                              </p>
                              {isDetected ? <Badge variant="secondary">Inside shape</Badge> : null}
                            </div>
                            <p className="truncate text-sm text-[var(--muted)]">
                              {transformer.siteName || 'Unknown site'}
                              {transformer.mnemonic ? ` - ${transformer.mnemonic}` : ''}
                              {transformer.serialNumber ? ` - ${transformer.serialNumber}` : ''}
                            </p>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            </section>
          </div>

          <DialogFooter className="mt-auto px-4 sm:px-5">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">{formData.id ? 'Update Area Plan' : 'Save floor plan'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default FloorPlanMetadataDialog;
