import React from 'react';
import { MALAYSIA_STATES } from '../../lib/malaysiaStates';
import { Input } from '../ui/input';

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

function TransformerFormFields({ formData, onChange }) {
  return (
    <section className="grid gap-4 sm:grid-cols-2">
      <Field
        label="Site name"
        name="siteName"
        required
        value={formData.siteName || ''}
        onChange={onChange}
        placeholder="PMU Melawati, PPU Melawati, PE Melawati, LLS Kerian"
      />
      <SelectField
        label="State / territory"
        name="state"
        value={formData.state || ''}
        onChange={onChange}
        hint="Leave this blank to auto-group from the site or transformer name."
      >
        <option value="">Auto detect / unassigned</option>
        {MALAYSIA_STATES.map((state) => (
          <option key={state} value={state}>
            {state}
          </option>
        ))}
      </SelectField>
      <Field
        label="Transformer name"
        name="txName"
        required
        value={formData.txName || ''}
        onChange={onChange}
        placeholder="TX-001"
      />
      <Field
        label="Mnemonic"
        name="mnemonic"
        value={formData.mnemonic || ''}
        onChange={onChange}
        placeholder="TXALP01"
      />
      <Field
        label="Serial number"
        name="serialNumber"
        value={formData.serialNumber || ''}
        onChange={onChange}
        placeholder="SN-2024-001"
      />
      <Field
        label="Voltage"
        name="voltage"
        required
        value={formData.voltage || ''}
        onChange={onChange}
        placeholder="132/33 kV"
      />
      <Field
        label="Load (MVA)"
        name="loadMVA"
        value={formData.loadMVA || ''}
        onChange={onChange}
        placeholder="60"
      />
      <Field
        label="Manufacturer"
        name="maker"
        value={formData.maker || ''}
        onChange={onChange}
        placeholder="ABB, Siemens, Hitachi"
      />
      <Field
        label="Year built"
        name="yearBuilt"
        value={formData.yearBuilt || ''}
        onChange={onChange}
        placeholder="2020"
      />
    </section>
  );
}

export { Field, SelectField };

export default TransformerFormFields;
