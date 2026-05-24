import React, { useEffect, useState } from 'react';
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
import { MALAYSIA_STATES } from '../lib/malaysiaStates';

function CompanyBoundaryMetadataDialog({
  open,
  boundaryDraft,
  onClose,
  onSave,
  onShowNotice,
}) {
  const [formData, setFormData] = useState({
    id: null,
    companyName: '',
    state: '',
    notes: '',
    createdAt: null,
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    setFormData({
      id: boundaryDraft?.id || null,
      companyName: boundaryDraft?.companyName || '',
      state: boundaryDraft?.state || '',
      notes: boundaryDraft?.notes || '',
      createdAt: boundaryDraft?.createdAt || null,
    });
  }, [boundaryDraft, open]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!String(formData.companyName || '').trim()) {
      onShowNotice?.({
        variant: 'warning',
        title: 'Company or parent name required',
        description: 'Add the company or parent name before saving this boundary.',
        detail: 'Example: GS Paper & Packaging. Area/Floor boundaries such as WWT can then sit under this parent.',
        contextLabel: 'Company boundary',
        actionLabel: 'Back to form',
      });
      return;
    }

    if (!String(formData.state || '').trim()) {
      onShowNotice?.({
        variant: 'warning',
        title: 'State required',
        description: 'Choose the state or territory before saving this company boundary.',
        detail: 'The state keeps the parent boundary grouped correctly in the sidebar.',
        contextLabel: 'Company boundary',
        actionLabel: 'Back to form',
      });
      return;
    }

    onSave({
      ...boundaryDraft,
      id: formData.id,
      companyName: formData.companyName.trim(),
      state: formData.state.trim(),
      notes: formData.notes.trim(),
      createdAt: formData.createdAt,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : null)}>
      <DialogContent className="mobile-form-dialog max-w-2xl p-0">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="default">Parent boundary</Badge>
            <Badge variant="outline">{boundaryDraft?.points?.length || 0} points</Badge>
          </div>
          <DialogTitle>{formData.id ? 'Edit Company / Parent Boundary' : 'Save Company / Parent Boundary'}</DialogTitle>
          <DialogDescription>
            Draw the main parent outline first, then save area/floor boundaries such as WWT, GSPP COGEN, or GENTING under the same company name.
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
                  placeholder="GS Paper & Packaging"
                  required
                />
              </label>

              <label className="space-y-2">
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

              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-[var(--foreground)]">Notes</span>
                <Textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  placeholder="Optional parent boundary notes, site access notes, or operating entity details"
                  rows={4}
                />
              </label>
            </section>

            <section className="rounded-md border border-[color:var(--border)] bg-[var(--card-muted)] p-4">
              <p className="text-sm font-semibold text-[var(--foreground)]">Suggested structure</p>
              <div className="mt-3 grid gap-2 text-sm text-[var(--muted)] sm:grid-cols-3">
                <div className="rounded-md bg-[var(--card)] px-3 py-2">
                  <span className="font-medium text-[var(--foreground)]">1. Parent</span>
                  <br />
                  GS Paper & Packaging
                </div>
                <div className="rounded-md bg-[var(--card)] px-3 py-2">
                  <span className="font-medium text-[var(--foreground)]">2. Area/Floor</span>
                  <br />
                  WWT
                </div>
                <div className="rounded-md bg-[var(--card)] px-3 py-2">
                  <span className="font-medium text-[var(--foreground)]">3. Assets</span>
                  <br />
                  Transformers inside WWT
                </div>
              </div>
            </section>
          </div>

          <DialogFooter className="mt-auto px-4 sm:px-5">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">{formData.id ? 'Update Boundary' : 'Save Boundary'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default CompanyBoundaryMetadataDialog;
