import React, { useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';
import { MALAYSIA_STATES } from '../lib/malaysiaStates';
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

const DEFAULT_FORM = {
  siteName: '',
  state: '',
  txName: '',
  mnemonic: '',
  serialNumber: '',
  voltage: '',
  loadMVA: '',
  maker: '',
  yearBuilt: '',
  position: [3.139, 101.6869],
  oilTests: [],
  documents: [],
};

function TransformerModal({ open, transformer, onSave, onClose }) {
  const [formData, setFormData] = useState(DEFAULT_FORM);

  useEffect(() => {
    if (transformer) {
      setFormData({ ...DEFAULT_FORM, ...transformer });
    } else {
      setFormData(DEFAULT_FORM);
    }
  }, [transformer]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!formData.siteName.trim()) {
      window.alert('Please enter a site name.');
      return;
    }
    if (!formData.txName.trim()) {
      window.alert('Please enter a transformer name.');
      return;
    }
    if (!formData.voltage.trim()) {
      window.alert('Please enter a voltage.');
      return;
    }

    onSave({
      ...formData,
      id: transformer?.id || Date.now().toString(),
    });
  };

  return (
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
            <section className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Company / site name"
                name="siteName"
                required
                value={formData.siteName}
                onChange={handleChange}
                placeholder="Kedah Cement"
              />
              <SelectField
                label="State / territory"
                name="state"
                value={formData.state}
                onChange={handleChange}
                hint="Leave this blank to auto-group from the site or transformer name."
              >
                <option value="">Auto detect / unassigned</option>
                {MALAYSIA_STATES.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </SelectField>
              <Field label="Transformer name" name="txName" required value={formData.txName} onChange={handleChange} placeholder="TX-001" />
              <Field label="Mnemonic" name="mnemonic" value={formData.mnemonic} onChange={handleChange} placeholder="TXALP01" />
              <Field label="Serial number" name="serialNumber" value={formData.serialNumber} onChange={handleChange} placeholder="SN-2024-001" />
              <Field label="Voltage" name="voltage" required value={formData.voltage} onChange={handleChange} placeholder="132/33 kV" />
              <Field label="Load (MVA)" name="loadMVA" value={formData.loadMVA} onChange={handleChange} placeholder="60" />
              <Field label="Manufacturer" name="maker" value={formData.maker} onChange={handleChange} placeholder="ABB, Siemens, Hitachi" />
              <Field label="Year built" name="yearBuilt" value={formData.yearBuilt} onChange={handleChange} placeholder="2020" />
            </section>

            <section className="rounded-md border border-[color:var(--border)] bg-[var(--card-muted)] p-4">
              <div className="flex items-start gap-3">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-[var(--primary-soft)] text-[var(--primary-strong)]">
                  <MapPin className="h-4 w-4" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Map placement</p>
                  <p className="text-sm text-[var(--muted)]">
                    Latitude {formData.position[0].toFixed(6)} and longitude {formData.position[1].toFixed(6)}. Drag the marker on the map later if you need to refine the position.
                  </p>
                </div>
              </div>
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
  );
}

function Field({ label, name, required = false, ...props }) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium text-[var(--foreground)]">
        {label}
        {required ? <span className="ml-1 text-[var(--danger-strong)]">*</span> : null}
      </span>
      <Input name={name} required={required} {...props} />
    </label>
  );
}

function SelectField({ label, name, hint, children, ...props }) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium text-[var(--foreground)]">{label}</span>
      <select
        name={name}
        className="flex h-10 w-full rounded-md border border-[color:var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] shadow-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
        {...props}
      >
        {children}
      </select>
      {hint ? <span className="text-xs text-[var(--muted)]">{hint}</span> : null}
    </label>
  );
}

export default TransformerModal;
