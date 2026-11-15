import React, { useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import { BUILT_IN_API_KEYS, isEnvProvided } from '../../lib/globe3d/settingsStore';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';

function createCustomKey() {
  return { id: `key-${Date.now()}-${Math.round(Math.random() * 1e6)}`, name: '', value: '' };
}

/**
 * API keys for the 3D view. Keys are kept in this browser's localStorage and
 * are only sent to the provider they belong to.
 */
export default function ApiKeysDialog({ open, apiKeys, customKeys, onClose, onSave }) {
  const [draftKeys, setDraftKeys] = useState(apiKeys);
  const [draftCustom, setDraftCustom] = useState(customKeys);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (open) {
      setDraftKeys(apiKeys);
      setDraftCustom(customKeys);
      setRevealed(false);
    }
  }, [open, apiKeys, customKeys]);

  const updateCustom = (id, patch) =>
    setDraftCustom((current) => current.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));

  const save = (event) => {
    event.preventDefault();
    onSave({
      apiKeys: Object.fromEntries(Object.entries(draftKeys).map(([key, value]) => [key, String(value || '').trim()])),
      customKeys: draftCustom
        .map((entry) => ({ ...entry, name: entry.name.trim(), value: entry.value.trim() }))
        .filter((entry) => entry.name && entry.value),
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : null)}>
      <DialogContent className="!max-w-[40rem]">
        <DialogHeader>
          <DialogTitle>API keys</DialogTitle>
          <DialogDescription>
            Optional keys that unlock extra layers in the 3D view. They are saved in this browser only and sent only
            to their own provider.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={save} className="flex min-h-0 flex-col">
          <div className="flex flex-col gap-5 overflow-y-auto px-4 py-4 sm:px-5">
            {BUILT_IN_API_KEYS.map((definition) => {
              const fromEnv = isEnvProvided(definition.id);
              return (
                <label key={definition.id} className="flex flex-col gap-1.5">
                  <span className="flex flex-wrap items-center justify-between gap-2 text-sm font-medium">
                    {definition.label}
                    <a
                      href={definition.helpUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-[var(--primary)] hover:underline"
                    >
                      Get a key <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </a>
                  </span>
                  <Input
                    type={revealed ? 'text' : 'password'}
                    autoComplete="off"
                    spellCheck={false}
                    value={draftKeys[definition.id] || ''}
                    placeholder={fromEnv ? `Using ${definition.envVar} from .env` : 'Paste key'}
                    onChange={(event) =>
                      setDraftKeys((current) => ({ ...current, [definition.id]: event.target.value }))
                    }
                  />
                  <span className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
                    {fromEnv && !draftKeys[definition.id] ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-[var(--primary)]" aria-hidden="true" />
                    ) : null}
                    Unlocks: {definition.unlocks}
                  </span>
                </label>
              );
            })}

            <div className="flex flex-col gap-2 border-t border-[color:var(--border)] pt-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">Other keys</p>
                  <p className="text-xs text-[var(--muted)]">
                    Store keys for layers you add later. Read one in code with{' '}
                    <code>resolveApiKey(settings, &apos;NAME&apos;)</code>.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDraftCustom((current) => [...current, createCustomKey()])}
                >
                  <Plus className="h-4 w-4" /> Add key
                </Button>
              </div>

              {draftCustom.map((entry) => (
                <div key={entry.id} className="flex items-center gap-2">
                  <Input
                    className="w-[38%]"
                    value={entry.name}
                    placeholder="Name, e.g. TOMTOM"
                    aria-label="Key name"
                    spellCheck={false}
                    onChange={(event) => updateCustom(entry.id, { name: event.target.value })}
                  />
                  <Input
                    type={revealed ? 'text' : 'password'}
                    autoComplete="off"
                    spellCheck={false}
                    value={entry.value}
                    placeholder="Key value"
                    aria-label="Key value"
                    onChange={(event) => updateCustom(entry.id, { value: event.target.value })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remove key"
                    onClick={() => setDraftCustom((current) => current.filter((item) => item.id !== entry.id))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-[color:var(--border)] px-4 py-3 sm:px-5">
            <Button type="button" variant="ghost" size="sm" onClick={() => setRevealed((current) => !current)}>
              {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {revealed ? 'Hide keys' : 'Show keys'}
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">Save keys</Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
