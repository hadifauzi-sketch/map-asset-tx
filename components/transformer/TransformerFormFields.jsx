import React from 'react';
import { Combobox } from '../ui/combobox';
import {
  ASSET_OWNER_TYPES,
  getAssetOwnerLabel,
  normalizeAssetOwnerType,
} from '../../lib/assetOwner';
import { MALAYSIA_STATES } from '../../lib/malaysiaStates';
import { PAPER_TYPE_OPTIONS } from '../../lib/paperTypeUtils';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';

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

function SelectField({ label, name, hint, options = [], value, onChange, disabled, ...props }) {
  return (
    <div className="space-y-2">
      <span className="block text-sm font-medium text-[var(--foreground)]">{label}</span>
      <Combobox
        value={value}
        onValueChange={(val) => onChange?.({ target: { name, value: val } })}
        options={options}
        disabled={disabled}
        {...props}
      />
      {hint ? <span className="block text-xs text-[var(--muted)]">{hint}</span> : null}
    </div>
  );
}

function buildSerialConflictMessage(serialConflicts) {
  if (!serialConflicts?.length) {
    return '';
  }

  if (serialConflicts.length === 1) {
    const conflict = serialConflicts[0];
    const location = [conflict.siteName, conflict.txName].filter(Boolean).join(' / ');
    const mnemonicLabel = conflict.mnemonic ? ` (${conflict.mnemonic})` : '';

    return `This serial number is already registered to ${location || 'another asset'}${mnemonicLabel}. Update that record instead of creating a duplicate serial number.`;
  }

  return `This serial number is already registered on ${serialConflicts.length} assets. Review the register before saving.`;
}

function buildSuggestionMeta(suggestion) {
  return [suggestion.reason, suggestion.siteName, suggestion.txName, suggestion.serialNumber ? `SN ${suggestion.serialNumber}` : '']
    .filter(Boolean)
    .join(' | ');
}

function TransformerFormFields({
  formData,
  onChange,
  mnemonicSuggestions = [],
  serialConflicts = [],
  mnemonicSuggestionListId,
  onMnemonicSuggestionPick,
}) {
  const currentMnemonic = String(formData.mnemonic || '').trim();
  const ownerType = normalizeAssetOwnerType(formData.ownerType);
  const isNonTnbOwner = ownerType === ASSET_OWNER_TYPES.NON_TNB;
  const hasLookupInput = Boolean(
    String(formData.serialNumber || '').trim() ||
      String(formData.siteName || '').trim() ||
      String(formData.txName || '').trim()
  );
  const serialConflictMessage = buildSerialConflictMessage(serialConflicts);
  const handleOwnerToggle = (checked) => {
    onChange?.({
      target: {
        name: 'ownerType',
        value: checked ? ASSET_OWNER_TYPES.NON_TNB : ASSET_OWNER_TYPES.TNB,
      },
    });
  };

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
        options={[
          { value: '', label: 'Auto detect / unassigned' },
          ...MALAYSIA_STATES.map((state) => ({ value: state, label: state })),
        ]}
        hint="Leave this blank to auto-group from the site or transformer name."
      />
      <div className="sm:col-span-2 rounded-md border border-[color:var(--border)] bg-[var(--card-muted)] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <span className="text-sm font-medium text-[var(--foreground)]">Asset owner</span>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Current category: {getAssetOwnerLabel(ownerType)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 rounded-md border border-[color:var(--border)] bg-[var(--card)] px-3 py-2">
            <span
              className={`text-xs font-semibold ${
                !isNonTnbOwner ? 'text-[var(--foreground)]' : 'text-[var(--muted)]'
              }`}
            >
              TNB
            </span>
            <Switch
              checked={isNonTnbOwner}
              onCheckedChange={handleOwnerToggle}
              aria-label="Set transformer owner to Non-TNB"
            />
            <span
              className={`text-xs font-semibold ${
                isNonTnbOwner ? 'text-[var(--foreground)]' : 'text-[var(--muted)]'
              }`}
            >
              Non-TNB
            </span>
          </div>
        </div>
      </div>
      <Field
        label="Transformer name"
        name="txName"
        required
        value={formData.txName || ''}
        onChange={onChange}
        placeholder="TX-001"
      />
      <label className="space-y-2">
        <span className="text-sm font-medium text-[var(--foreground)]">Serial number</span>
        <Input
          name="serialNumber"
          value={formData.serialNumber || ''}
          onChange={onChange}
          placeholder="SN-2024-001"
        />
        {serialConflictMessage ? (
          <span className="block rounded-md border border-[color:var(--danger-soft)] bg-[var(--danger-soft)]/60 px-3 py-2 text-xs leading-5 text-[var(--danger-strong)]">
            {serialConflictMessage}
          </span>
        ) : (
          <span className="text-xs text-[var(--muted)]">
            Entering a serial number will search the existing asset register so the mnemonic can be reused
            accurately.
          </span>
        )}
      </label>
      <label className="space-y-2 sm:col-span-2">
        <span className="text-sm font-medium text-[var(--foreground)]">Mnemonic</span>
        <Input
          name="mnemonic"
          value={formData.mnemonic || ''}
          onChange={onChange}
          placeholder="TXALP01"
          list={mnemonicSuggestionListId}
          autoComplete="off"
        />
        {mnemonicSuggestions.length ? (
          <datalist id={mnemonicSuggestionListId}>
            {mnemonicSuggestions.map((suggestion) => (
              <option
                key={`${suggestion.transformerId}-${suggestion.mnemonic}`}
                value={suggestion.mnemonic}
              >
                {buildSuggestionMeta(suggestion)}
              </option>
            ))}
          </datalist>
        ) : null}
        {mnemonicSuggestions.length ? (
          <div className="rounded-md border border-[color:var(--border)] bg-[var(--card-muted)] p-3">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--muted)]">
              Suggested from existing assets
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {mnemonicSuggestions.map((suggestion) => {
                const isSelected = currentMnemonic === suggestion.mnemonic;

                return (
                  <button
                    key={`${suggestion.transformerId}-${suggestion.mnemonic}-button`}
                    type="button"
                    className={`rounded-md border px-3 py-3 text-left transition-colors ${
                      isSelected
                        ? 'border-[color:var(--primary)] bg-[var(--primary-soft)]/70 text-[var(--foreground)]'
                        : 'border-[color:var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--card-strong)]'
                    }`}
                    onClick={() => onMnemonicSuggestionPick?.(suggestion.mnemonic)}
                  >
                    <span className="block text-sm font-semibold">{suggestion.mnemonic}</span>
                    <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">
                      {buildSuggestionMeta(suggestion)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <span className="text-xs text-[var(--muted)]">
            {hasLookupInput
              ? 'No registered mnemonic matches yet. You can type a new mnemonic manually for this asset.'
              : 'Serial number, site, and transformer name will search existing mnemonics here. You can still type a new mnemonic manually.'}
          </span>
        )}
      </label>
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
      <SelectField
        label="Type of paper"
        name="paperType"
        value={formData.paperType || ''}
        onChange={onChange}
        options={[{ value: '', label: 'Not specified' }, ...PAPER_TYPE_OPTIONS]}
        hint="Insulation paper used inside the transformer."
      />
    </section>
  );
}

export { Field, SelectField };

export default TransformerFormFields;
