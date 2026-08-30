import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronRight, Building2, MapPin, Zap } from 'lucide-react';
import { UNASSIGNED_STATE } from '../../lib/malaysiaStates';
import { branchOwnerState, branchState, buildAssetTree, UNASSIGNED_SITE } from '../../lib/assetAccessTree';
import { ASSET_OWNER_TYPES, normalizeAssetOwnerType } from '../../lib/assetOwner';
import { cn } from '../../lib/utils';

/**
 * Asset access as a State → Site → Transformer tree.
 *
 * A flat 300-row table makes it hard to see *where* an asset lives, so access is
 * grouped by location instead. Every branch carries a tri-state switch: full,
 * partial, or no access for everything beneath it, and toggling a branch grants
 * or revokes the whole subtree in one RPC.
 *
 * The Owner column sits beside it and reclassifies assets TNB ↔ Non-TNB in the
 * same place. That used to mean opening each asset's edit form one at a time;
 * here a branch segment retypes its whole subtree in one write. Note the two
 * controls are not the same kind of thing: access belongs to the selected user,
 * owner type belongs to the asset and so is the same for everyone.
 */

/**
 * Segment labels stay in their natural case — upper-cased, `NON-TNB` was wide
 * enough to paint over the pill's own border.
 *
 * The two segments are not equal halves. `Non-TNB` is more than twice the
 * length of `TNB`, so splitting the track down the middle starved the longer
 * label into `Non-…` while the shorter one sat in empty space. The `grow`
 * weights hand each segment room proportional to what it has to say.
 */
const OWNER_SEGMENTS = [
  { value: ASSET_OWNER_TYPES.TNB, label: 'TNB', grow: 'flex-[2]' },
  { value: ASSET_OWNER_TYPES.NON_TNB, label: 'Non-TNB', grow: 'flex-[3]' },
];

export function AssetAccessTree({
  transformers,
  grantedIds,
  ownerById,
  onToggleAsset,
  onSetMany,
  onSetOwner,
  expandAllSignal,
  filterActive,
  hoverPreview,
}) {
  const tree = useMemo(() => buildAssetTree(transformers), [transformers]);
  // Branches whose open state differs from the current default. Which default
  // applies flips with `openByDefault`, so the overrides are cleared on flip.
  const [overrides, setOverrides] = useState(() => new Set());
  const [busyKey, setBusyKey] = useState(null);
  const [ownerBusyKey, setOwnerBusyKey] = useState(null);

  // A filter narrows the tree to matches only, so every surviving branch opens.
  const openByDefault = filterActive || expandAllSignal;

  useEffect(() => {
    setOverrides(new Set());
  }, [openByDefault]);

  const isOpen = useCallback(
    (key) => (openByDefault ? !overrides.has(key) : overrides.has(key)),
    [openByDefault, overrides]
  );

  const toggleOpen = useCallback((key) => {
    setOverrides((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleBranch = useCallback(
    async (node, status) => {
      setBusyKey(node.key);
      try {
        await onSetMany(node.ids, status !== 'on');
      } finally {
        setBusyKey(null);
      }
    },
    [onSetMany]
  );

  const setBranchOwner = useCallback(
    async (node, ownerType) => {
      setOwnerBusyKey(node.key);
      try {
        await onSetOwner(node.ids, ownerType);
      } finally {
        setOwnerBusyKey(null);
      }
    },
    [onSetOwner]
  );

  if (tree.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-[color:var(--border)] bg-[var(--card-muted)] p-6 text-center text-sm text-[var(--muted)]">
        No transformers match the filter.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-[color:var(--border)]">
      {/* The three right-hand labels drop to 9px with tighter tracking: at the
          body size `Access` was wider than the 44px switch column it names, and
          spilled into `Granted` beside it. */}
      <div className="flex items-center gap-2 bg-[var(--card-muted)] px-3 py-2 font-semibold uppercase text-[var(--muted)]">
        <span className="min-w-0 flex-1 truncate text-[11px] tracking-[0.08em]">
          State · Site · Transformer
        </span>
        <span
          className="w-[128px] text-center text-[9px] tracking-[0.06em] sm:w-[146px]"
          title="Owner type belongs to the asset itself — changing it here applies to every user."
        >
          Owner
        </span>
        <span className="w-[70px] text-right text-[9px] tracking-[0.06em]">Granted</span>
        <span className="w-[44px] text-center text-[9px] tracking-[0.06em]">Access</span>
      </div>

      <div className="max-h-[420px] overflow-y-auto">
        {tree.map((stateNode) => {
          const stateOpen = isOpen(stateNode.key);
          const state = branchState(stateNode.ids, grantedIds);
          const stateOwner = branchOwnerState(stateNode.ids, ownerById);
          return (
            <div key={stateNode.key} className="border-t border-[color:var(--border)] first:border-t-0">
              <TreeRow
                depth={0}
                icon={MapPin}
                label={stateNode.label}
                muted={stateNode.label === UNASSIGNED_STATE}
                open={stateOpen}
                onToggleOpen={() => toggleOpen(stateNode.key)}
                granted={state.granted}
                total={stateNode.ids.length}
                status={state.status}
                busy={busyKey === stateNode.key}
                onToggleAccess={() => toggleBranch(stateNode, state.status)}
                owner={stateOwner}
                ownerBusy={ownerBusyKey === stateNode.key}
                onSetOwner={(ownerType) => setBranchOwner(stateNode, ownerType)}
                emphasis="state"
              />

              {stateOpen ? (
                <div className="ml-[26px] border-l border-[color:var(--border)]">
                  {stateNode.children.map((siteNode) => {
                    const siteOpen = isOpen(siteNode.key);
                    const site = branchState(siteNode.ids, grantedIds);
                    const siteOwner = branchOwnerState(siteNode.ids, ownerById);
                    return (
                      <div key={siteNode.key}>
                        <TreeRow
                          depth={1}
                          icon={Building2}
                          label={siteNode.label}
                          muted={siteNode.label === UNASSIGNED_SITE}
                          open={siteOpen}
                          onToggleOpen={() => toggleOpen(siteNode.key)}
                          granted={site.granted}
                          total={siteNode.ids.length}
                          status={site.status}
                          busy={busyKey === siteNode.key}
                          onToggleAccess={() => toggleBranch(siteNode, site.status)}
                          owner={siteOwner}
                          ownerBusy={ownerBusyKey === siteNode.key}
                          onSetOwner={(ownerType) => setBranchOwner(siteNode, ownerType)}
                          emphasis="site"
                        />

                        {siteOpen ? (
                          <div className="ml-[26px] border-l border-[color:var(--border)]">
                            {siteNode.assets.map((tx) => (
                              <AssetRow
                                key={tx.id}
                                asset={tx}
                                granted={grantedIds.has(tx.id)}
                                owner={normalizeAssetOwnerType(ownerById.get(tx.id))}
                                onToggle={() => onToggleAsset(tx.id)}
                                onSetOwner={(ownerType) => onSetOwner([tx.id], ownerType)}
                                hoverPreview={hoverPreview}
                              />
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TreeRow({
  depth,
  icon: Icon,
  label,
  muted,
  open,
  onToggleOpen,
  granted,
  total,
  status,
  busy,
  onToggleAccess,
  owner,
  ownerBusy,
  onSetOwner,
  emphasis,
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 pr-3 transition-colors hover:bg-[var(--card-muted)]/60',
        emphasis === 'state' ? 'bg-[var(--card-muted)]/35 py-2 pl-3' : 'py-1.5 pl-2'
      )}
    >
      <button
        type="button"
        onClick={onToggleOpen}
        aria-expanded={open}
        className="flex min-w-0 flex-1 items-center gap-2 rounded text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
      >
        <ChevronRight
          className={cn(
            'h-3.5 w-3.5 flex-shrink-0 text-[var(--muted)] transition-transform',
            open ? 'rotate-90' : ''
          )}
        />
        <Icon
          className={cn(
            'h-3.5 w-3.5 flex-shrink-0',
            status === 'off' ? 'text-[var(--muted)]' : 'text-[var(--primary-strong)]'
          )}
        />
        <span
          className={cn(
            'truncate',
            emphasis === 'state'
              ? 'text-[13px] font-bold uppercase tracking-[0.04em]'
              : 'text-[13px] font-semibold',
            muted ? 'text-[var(--muted)]' : 'text-[var(--foreground)]'
          )}
        >
          {label}
        </span>
      </button>

      <OwnerSwitch
        status={owner.status}
        busy={ownerBusy}
        onSelect={onSetOwner}
        target={`all ${total} ${total === 1 ? 'asset' : 'assets'} in ${label}`}
        mixedHint={`${owner.tnb} TNB · ${owner.nonTnb} Non-TNB`}
      />

      {/* The count moves optimistically on click, so it is the progress signal —
          a spinner here would just hide the number the admin wants to read. */}
      <span
        className={cn(
          'w-[70px] flex-shrink-0 text-right font-mono text-[11px] transition-opacity',
          busy ? 'opacity-60' : '',
          status === 'on'
            ? 'text-[var(--primary-strong)]'
            : status === 'partial'
              ? 'text-[var(--foreground)]'
              : 'text-[var(--muted)]'
        )}
      >
        {granted}/{total}
      </span>

      <AccessSwitch
        status={status}
        disabled={busy}
        onClick={onToggleAccess}
        label={
          status === 'on'
            ? `Revoke access to all ${total} assets in ${label}`
            : `Grant access to all ${total} assets in ${label}`
        }
      />
    </div>
  );
}

function AssetRow({ asset, granted, owner, onToggle, onSetOwner, hoverPreview }) {
  const previewed = hoverPreview?.preview?.asset?.id === asset.id;
  const rowProps = hoverPreview ? hoverPreview.getRowProps(asset) : {};
  const [ownerBusy, setOwnerBusy] = useState(false);

  const selectOwner = async (ownerType) => {
    setOwnerBusy(true);
    try {
      await onSetOwner(ownerType);
    } finally {
      setOwnerBusy(false);
    }
  };

  return (
    <div
      {...rowProps}
      data-asset-row=""
      className={cn(
        'flex items-center gap-2 py-1.5 pl-2 pr-3 transition-colors',
        previewed ? 'bg-[var(--card-muted)]' : 'hover:bg-[var(--card-muted)]/60'
      )}
    >
      <span className="h-px w-3 flex-shrink-0 bg-[color:var(--border)]" />
      <Zap
        className={cn(
          'h-3.5 w-3.5 flex-shrink-0',
          granted ? 'text-[var(--primary-strong)]' : 'text-[var(--muted)]'
        )}
      />
      <button
        type="button"
        onClick={(event) =>
          hoverPreview?.togglePinned(asset, event.currentTarget.closest('[data-asset-row]'))
        }
        className="min-w-0 flex-1 truncate rounded text-left text-[13px] font-medium text-[var(--foreground)] underline-offset-4 outline-none transition hover:underline focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
        aria-label={`Preview ${asset.tx_name}`}
      >
        {asset.tx_name}
      </button>

      <OwnerSwitch
        status={owner}
        busy={ownerBusy}
        onSelect={selectOwner}
        target={asset.tx_name}
      />

      <span className="w-[70px] flex-shrink-0 truncate text-right text-[11px] text-[var(--muted)]">
        {asset.voltage || '—'}
      </span>

      <AccessSwitch
        status={granted ? 'on' : 'off'}
        onClick={onToggle}
        label={granted ? `Revoke access to ${asset.tx_name}` : `Grant access to ${asset.tx_name}`}
      />
    </div>
  );
}

/**
 * TNB ↔ Non-TNB segmented switch.
 *
 * Deliberately not the sliding `AccessSwitch` shape: the two controls sit side
 * by side, and a second slider would read as a second access toggle. Both
 * targets are always one click away, so a branch that is currently mixed can be
 * settled either way without first cycling through a state nobody asked for.
 */
function OwnerSwitch({ status, onSelect, busy, target, mixedHint }) {
  const mixed = status !== ASSET_OWNER_TYPES.TNB && status !== ASSET_OWNER_TYPES.NON_TNB;

  return (
    <div
      role="group"
      aria-label={`Owner type for ${target}${mixed ? ' — mixed' : ` — ${status}`}`}
      title={mixed && mixedHint ? `Mixed: ${mixedHint}` : undefined}
      className={cn(
        // Fixed track height so the pill lines up with the h-5 access switch on
        // the same row, and overflow-hidden so a label can never paint outside
        // the border it belongs to.
        'inline-flex h-5 w-[128px] flex-shrink-0 items-center gap-px overflow-hidden rounded-full border bg-[var(--card-muted)] p-px transition sm:w-[146px]',
        mixed ? 'border-dashed border-[color:var(--primary)]' : 'border-[color:var(--border)]',
        busy ? 'opacity-60' : ''
      )}
    >
      {OWNER_SEGMENTS.map(({ value, label, grow }) => {
        const active = status === value;
        return (
          <button
            key={value}
            type="button"
            disabled={busy}
            onClick={() => onSelect(value)}
            aria-pressed={active}
            title={active ? `${target} is ${value}` : `Set ${target} to ${value}`}
            className={cn(
              'flex h-full min-w-0 items-center justify-center rounded-full px-1 outline-none transition',
              grow,
              'text-[9px] font-semibold leading-none tracking-[-0.01em]',
              'focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[var(--primary)] disabled:cursor-not-allowed',
              active && value === ASSET_OWNER_TYPES.NON_TNB
                ? 'bg-[var(--primary)] text-white'
                : active
                  ? 'bg-[var(--card)] text-[var(--foreground)] shadow-sm'
                  : 'text-[var(--muted)] hover:text-[var(--foreground)]'
            )}
          >
            <span className="truncate">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Switch with a third, half-way position for branches that are only partly granted. */
function AccessSwitch({ status, onClick, disabled, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={status === 'on'}
      className={cn(
        'inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full border transition disabled:opacity-50',
        status === 'on'
          ? 'border-transparent bg-[var(--primary)]'
          : status === 'partial'
            ? 'border-[var(--primary)] bg-[var(--primary-soft)]'
            : 'border-[color:var(--border)] bg-[var(--card-muted)]'
      )}
    >
      <span
        className={cn(
          'block h-4 w-4 rounded-full shadow transition-transform',
          status === 'partial' ? 'bg-[var(--primary-strong)]' : 'bg-white',
          status === 'on'
            ? 'translate-x-[18px]'
            : status === 'partial'
              ? 'translate-x-[10px]'
              : 'translate-x-[2px]'
        )}
      />
    </button>
  );
}

export default AssetAccessTree;
