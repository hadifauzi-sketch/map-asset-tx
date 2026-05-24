import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from './ui/dialog';
import { cn } from '../lib/utils';

const TONE_CONFIG = {
  danger: {
    iconShellClass: 'bg-[var(--danger-soft)] text-[var(--danger-strong)]',
    panelClass:
      'bg-[linear-gradient(135deg,color-mix(in_srgb,var(--danger-strong)_16%,var(--card)),var(--card)_55%,color-mix(in_srgb,var(--danger-strong)_8%,var(--card)))]',
    confirmVariant: 'destructive',
  },
  warning: {
    iconShellClass: 'bg-[var(--warning-soft)] text-[var(--warning-strong)]',
    panelClass:
      'bg-[linear-gradient(135deg,color-mix(in_srgb,var(--warning-strong)_18%,var(--card)),var(--card)_55%,color-mix(in_srgb,var(--warning-strong)_8%,var(--card)))]',
    confirmVariant: 'default',
  },
  info: {
    iconShellClass: 'bg-[var(--primary-soft)] text-[var(--primary-strong)]',
    panelClass:
      'bg-[linear-gradient(135deg,color-mix(in_srgb,var(--primary-strong)_14%,var(--card)),var(--card)_55%,color-mix(in_srgb,var(--primary-strong)_6%,var(--card)))]',
    confirmVariant: 'default',
  },
};

function ConfirmDialog({
  open,
  title,
  description,
  detail,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  busy = false,
  onConfirm,
  onClose,
}) {
  const config = TONE_CONFIG[tone] || TONE_CONFIG.danger;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen && !busy ? onClose() : null)}>
      <DialogContent className="max-w-[480px] overflow-hidden p-0">
        <div className={cn('border-b border-[color:var(--border)] px-5 py-5', config.panelClass)}>
          <div className="flex items-start gap-4">
            <div className={cn('inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-sm', config.iconShellClass)}>
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div className="min-w-0 space-y-1.5">
              <DialogTitle className="text-xl">{title || 'Are you sure?'}</DialogTitle>
              {description ? (
                <DialogDescription className="text-sm leading-6 text-[var(--muted)]">
                  {description}
                </DialogDescription>
              ) : null}
            </div>
          </div>
        </div>

        {detail ? (
          <div className="px-5 py-4 text-sm leading-6 text-[var(--foreground)]">{detail}</div>
        ) : null}

        <DialogFooter className="border-t border-[color:var(--border)] bg-[color:var(--card)]/78 px-5 py-4">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button variant={config.confirmVariant} onClick={onConfirm} disabled={busy}>
            {busy ? 'Working…' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ConfirmDialog;
