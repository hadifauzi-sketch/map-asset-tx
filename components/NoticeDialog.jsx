import React from 'react';
import { AlertTriangle, CheckCircle2, FileText, Info, TestTubeDiagonal } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from './ui/dialog';
import { cn } from '../lib/utils';

const VARIANT_CONFIG = {
  success: {
    icon: CheckCircle2,
    badgeLabel: 'Completed',
    badgeVariant: 'success',
    iconShellClass: 'bg-[var(--success-soft)] text-[var(--success-strong)]',
    panelClass:
      'bg-[linear-gradient(135deg,color-mix(in_srgb,var(--success-strong)_18%,var(--card)),var(--card)_55%,color-mix(in_srgb,var(--success-strong)_8%,var(--card)))]',
    detailClass: 'border-[color:var(--success-soft)] bg-[var(--success-soft)]/35 text-[var(--success-strong)]',
  },
  info: {
    icon: Info,
    badgeLabel: 'Information',
    badgeVariant: 'default',
    iconShellClass: 'bg-[var(--primary-soft)] text-[var(--primary-strong)]',
    panelClass:
      'bg-[linear-gradient(135deg,color-mix(in_srgb,var(--primary)_16%,var(--card)),var(--card)_55%,color-mix(in_srgb,var(--primary)_8%,var(--card)))]',
    detailClass: 'border-[color:var(--primary-soft)] bg-[var(--primary-soft)]/35 text-[var(--primary-strong)]',
  },
  warning: {
    icon: AlertTriangle,
    badgeLabel: 'Needs attention',
    badgeVariant: 'warning',
    iconShellClass: 'bg-[var(--warning-soft)] text-[var(--warning-strong)]',
    panelClass:
      'bg-[linear-gradient(135deg,color-mix(in_srgb,var(--warning-strong)_18%,var(--card)),var(--card)_55%,color-mix(in_srgb,var(--warning-strong)_8%,var(--card)))]',
    detailClass: 'border-[color:var(--warning-soft)] bg-[var(--warning-soft)]/35 text-[var(--warning-strong)]',
  },
  error: {
    icon: AlertTriangle,
    badgeLabel: 'Save failed',
    badgeVariant: 'danger',
    iconShellClass: 'bg-[var(--danger-soft)] text-[var(--danger-strong)]',
    panelClass:
      'bg-[linear-gradient(135deg,color-mix(in_srgb,var(--danger-strong)_16%,var(--card)),var(--card)_55%,color-mix(in_srgb,var(--danger-strong)_8%,var(--card)))]',
    detailClass: 'border-[color:var(--danger-soft)] bg-[var(--danger-soft)]/35 text-[var(--danger-strong)]',
  },
};

function MetricCard({ icon: Icon, label, value, accent = 'secondary' }) {
  const accentClasses =
    accent === 'success'
      ? 'border-[color:var(--success-soft)]/80 bg-[var(--success-soft)]/20'
      : accent === 'warning'
        ? 'border-[color:var(--warning-soft)]/80 bg-[var(--warning-soft)]/18'
        : accent === 'danger'
          ? 'border-[color:var(--danger-soft)]/80 bg-[var(--danger-soft)]/16'
          : 'border-[color:var(--border)]/80 bg-[color:var(--card)]/82';

  return (
    <div className={cn('rounded-xl border px-4 py-3 shadow-sm', accentClasses)}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[color:var(--card)]/80 text-[var(--foreground)]">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--muted)]">{label}</p>
          <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">{value}</p>
        </div>
      </div>
    </div>
  );
}

function NoticeDialog({ open, notice, onClose }) {
  const variant = VARIANT_CONFIG[notice?.variant] || VARIANT_CONFIG.success;
  const StatusIcon = variant.icon;
  const metrics = [];

  if (notice?.recordStatusLabel) {
    metrics.push({
      key: 'record',
      icon: notice.variant === 'error' ? AlertTriangle : CheckCircle2,
      label: notice.recordLabel || 'Record',
      value: notice.recordStatusLabel,
      accent: notice.variant === 'error' ? 'danger' : 'success',
    });
  }

  if (notice?.documentStored === true) {
    metrics.push({
      key: 'documents',
      icon: FileText,
      label: 'Documents',
      value: 'Stored',
      accent: 'success',
    });
  } else if (notice?.documentStored === false) {
    metrics.push({
      key: 'documents',
      icon: FileText,
      label: 'Documents',
      value: 'Needs retry',
      accent: 'warning',
    });
  }

  if (Number.isFinite(notice?.createdCount) && notice.createdCount > 0) {
    metrics.push({
      key: 'created',
      icon: TestTubeDiagonal,
      label: 'Oil tests created',
      value: String(notice.createdCount),
      accent: 'success',
    });
  }

  if (Number.isFinite(notice?.updatedCount) && notice.updatedCount > 0) {
    metrics.push({
      key: 'updated',
      icon: TestTubeDiagonal,
      label: 'Oil tests updated',
      value: String(notice.updatedCount),
      accent: 'success',
    });
  }

  if (Number.isFinite(notice?.unchangedCount) && notice.unchangedCount > 0) {
    metrics.push({
      key: 'unchanged',
      icon: TestTubeDiagonal,
      label: 'Already up to date',
      value: String(notice.unchangedCount),
      accent: 'secondary',
    });
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : null)}>
      <DialogContent className="max-w-[580px] overflow-hidden p-0">
        <div className={cn('border-b border-[color:var(--border)] px-5 py-5', variant.panelClass)}>
          <div className="flex items-start gap-4">
            <div className={cn('inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-sm', variant.iconShellClass)}>
              <StatusIcon className="h-6 w-6" />
            </div>
            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={variant.badgeVariant}>{variant.badgeLabel}</Badge>
                {notice?.txName ? <Badge variant="outline">{notice.txName}</Badge> : null}
                {notice?.siteName ? <Badge variant="outline">{notice.siteName}</Badge> : null}
                {notice?.contextLabel ? <Badge variant="outline">{notice.contextLabel}</Badge> : null}
              </div>
              <div className="space-y-1.5">
                <DialogTitle className="text-xl">{notice?.title || 'Save result'}</DialogTitle>
                <DialogDescription className="max-w-2xl text-sm leading-6 text-[var(--muted)]">
                  {notice?.description || 'The action has completed.'}
                </DialogDescription>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4 px-5 py-5">
          {metrics.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {metrics.map((metric) => (
                <MetricCard
                  key={metric.key}
                  icon={metric.icon}
                  label={metric.label}
                  value={metric.value}
                  accent={metric.accent}
                />
              ))}
            </div>
          ) : null}

          {notice?.detail ? (
            <div className={cn('rounded-xl border px-4 py-3 text-sm leading-6', variant.detailClass)}>
              {notice.detail}
            </div>
          ) : null}
        </div>

        <DialogFooter className="border-t border-[color:var(--border)] bg-[color:var(--card)]/78 px-5 py-4">
          <Button onClick={onClose}>
            {notice?.actionLabel || (notice?.variant === 'success' ? 'Done' : 'Close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default NoticeDialog;
