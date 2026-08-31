import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarDays, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Combobox } from './ui/combobox';
import { DatePicker } from './ui/date-picker';
import ConfirmDialog from './ConfirmDialog';
import MaintenanceImpactCharts from './MaintenanceImpactCharts';
import { interventionService } from '../lib/interventionService';
import {
  DEFAULT_INTERVENTION_TYPE,
  getInterventionType,
  INTERVENTION_TYPES,
} from '../lib/interventionTypes';

const TYPE_OPTIONS = INTERVENTION_TYPES.map((type) => ({
  value: type.value,
  label: type.label,
}));

function emptyForm(compartment) {
  return {
    eventDate: '',
    eventType: DEFAULT_INTERVENTION_TYPE,
    compartment: compartment || '',
    oilVolumeLitres: '',
    performedBy: '',
    notes: '',
  };
}

function formatDate(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? String(value ?? '')
    : parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function InterventionSection({
  transformerId,
  interventions = [],
  oilTests = [],
  compartmentLabel = '',
  canEdit = true,
  onChange,
}) {
  const [form, setForm] = useState(() => emptyForm(compartmentLabel));
  const [editingId, setEditingId] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const sorted = useMemo(
    () =>
      [...interventions].sort((left, right) =>
        String(right.eventDate).localeCompare(String(left.eventDate))
      ),
    [interventions]
  );

  const resetForm = () => {
    setForm(emptyForm(compartmentLabel));
    setEditingId(null);
    setIsFormOpen(false);
    setError('');
  };

  const startCreate = () => {
    setForm(emptyForm(compartmentLabel));
    setEditingId(null);
    setIsFormOpen(true);
    setError('');
  };

  const startEdit = (intervention) => {
    setForm({
      eventDate: intervention.eventDate || '',
      eventType: intervention.eventType || DEFAULT_INTERVENTION_TYPE,
      compartment: intervention.compartment || '',
      oilVolumeLitres:
        intervention.oilVolumeLitres === null || intervention.oilVolumeLitres === undefined
          ? ''
          : String(intervention.oilVolumeLitres),
      performedBy: intervention.performedBy || '',
      notes: intervention.notes || '',
    });
    setEditingId(intervention.id);
    setIsFormOpen(true);
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.eventDate) {
      setError('A date is required — the date is the whole point of the record.');
      return;
    }

    try {
      setSaving(true);
      setError('');

      if (editingId) {
        await interventionService.update(editingId, form);
      } else {
        await interventionService.create(transformerId, form);
      }

      const refreshed = await interventionService.getByTransformerId(transformerId);
      onChange?.(refreshed);
      resetForm();
    } catch (saveError) {
      setError(saveError?.message || 'Could not save this maintenance record.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) {
      return;
    }

    try {
      setDeleting(true);
      await interventionService.delete(pendingDelete.id);
      const refreshed = await interventionService.getByTransformerId(transformerId);
      onChange?.(refreshed);
      setPendingDelete(null);
    } catch (deleteError) {
      setError(deleteError?.message || 'Could not delete this maintenance record.');
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const activeType = getInterventionType(form.eventType);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-[var(--foreground)]">Maintenance history</h3>
          <p className="mt-1 max-w-2xl text-xs text-[var(--muted)]">
            Filtration, top-up, retrofill and repairs change what the oil is. Recording the date
            marks it on the trending charts, so a step in the pattern reads as maintenance instead
            of a developing fault.
          </p>
        </div>
        {canEdit ? (
          <Button type="button" onClick={startCreate} className="shrink-0">
            <Plus className="mr-1 h-4 w-4" />
            Add event
          </Button>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-md border border-[color:var(--border)] bg-[var(--card-muted)] px-3 py-2 text-xs text-[#f87171]">
          {error}
        </p>
      ) : null}

      <AnimatePresence initial={false}>
        {isFormOpen ? (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleSubmit}
            className="overflow-hidden rounded-lg border border-[color:var(--border)] bg-[var(--card)] p-4"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-medium text-[var(--muted)]">Date *</span>
                <DatePicker
                  value={form.eventDate}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, eventDate: value }))}
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium text-[var(--muted)]">What was done *</span>
                <Combobox
                  value={form.eventType}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, eventType: value }))}
                  options={TYPE_OPTIONS}
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium text-[var(--muted)]">Compartment</span>
                <Input
                  value={form.compartment}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, compartment: event.target.value }))
                  }
                  placeholder={compartmentLabel || 'Maintank'}
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium text-[var(--muted)]">Oil volume (litres)</span>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={form.oilVolumeLitres}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, oilVolumeLitres: event.target.value }))
                  }
                  placeholder="e.g. 250"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium text-[var(--muted)]">Performed by</span>
                <Input
                  value={form.performedBy}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, performedBy: event.target.value }))
                  }
                  placeholder="Contractor or team"
                />
              </label>

              <label className="space-y-1 sm:col-span-2">
                <span className="text-xs font-medium text-[var(--muted)]">Notes</span>
                <Input
                  value={form.notes}
                  onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                  placeholder="Work order, reason, observations"
                />
              </label>
            </div>

            {activeType.hint ? (
              <p className="mt-3 rounded-md bg-[var(--card-muted)] px-3 py-2 text-xs text-[var(--muted)]">
                <strong style={{ color: activeType.color }}>{activeType.code}</strong> —{' '}
                {activeType.hint}
              </p>
            ) : null}

            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={resetForm} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : editingId ? 'Update event' : 'Save event'}
              </Button>
            </div>
          </motion.form>
        ) : null}
      </AnimatePresence>

      {sorted.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[color:var(--border)] px-4 py-8 text-center">
          <CalendarDays className="mx-auto mb-2 h-6 w-6 text-[var(--muted)]" />
          <p className="text-sm text-[var(--foreground)]">No maintenance recorded yet</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Add the dates oil was filtered, topped up or replaced to explain the shape of the trend.
          </p>
        </div>
      ) : (
        <ol className="space-y-2">
          {sorted.map((intervention) => {
            const type = getInterventionType(intervention.eventType);

            return (
              <li
                key={intervention.id}
                className="rounded-lg border border-[color:var(--border)] bg-[var(--card)] p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 gap-3">
                    <span
                      className="mt-0.5 inline-flex h-7 shrink-0 items-center rounded-md px-2 text-[11px] font-bold"
                      style={{ backgroundColor: `${type.color}22`, color: type.color }}
                    >
                      {type.code}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--foreground)]">{type.label}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {formatDate(intervention.eventDate)}
                        {intervention.compartment ? ` · ${intervention.compartment}` : ''}
                        {intervention.oilVolumeLitres
                          ? ` · ${intervention.oilVolumeLitres} L`
                          : ''}
                        {intervention.performedBy ? ` · ${intervention.performedBy}` : ''}
                      </p>
                      {intervention.notes ? (
                        <p className="mt-1 text-xs text-[var(--muted)]">{intervention.notes}</p>
                      ) : null}
                      {type.resets.length ? (
                        <p className="mt-1 text-[11px] text-[var(--muted)]">
                          Resets baseline for: {type.resets.join(', ')}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {canEdit ? (
                    <div className="flex shrink-0 gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => startEdit(intervention)}
                        aria-label="Edit event"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setPendingDelete(intervention)}
                        aria-label="Delete event"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {sorted.length ? (
        <div className="border-t border-[color:var(--border)] pt-4">
          <MaintenanceImpactCharts oilTests={oilTests} interventions={sorted} />
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        tone="danger"
        title="Delete maintenance record?"
        description={
          pendingDelete
            ? `${getInterventionType(pendingDelete.eventType).label} recorded on ${formatDate(
                pendingDelete.eventDate
              )}.`
            : ''
        }
        detail={
          pendingDelete && getInterventionType(pendingDelete.eventType).resets.length
            ? `The trending charts will stop marking this date, so the change in ${getInterventionType(
                pendingDelete.eventType
              ).resets.join(', ')} will no longer be explained. This cannot be undone.`
            : 'This cannot be undone.'
        }
        confirmLabel="Delete event"
        busy={deleting}
        onConfirm={handleDelete}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  );
}
