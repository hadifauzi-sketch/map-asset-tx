import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronsDownUp,
  ChevronsUpDown,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  Users,
  X,
  Zap,
} from 'lucide-react';
import * as Tabs from '@radix-ui/react-tabs';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { cn } from '../../lib/utils';
import { AssetHoverCard, useAssetHoverPreview } from './AssetHoverCard';
import { AssetAccessTree } from './AssetAccessTree';
import { ASSET_OWNER_FILTERS, normalizeAssetOwnerType } from '../../lib/assetOwner';

/**
 * Owner-type writes go straight to `transformers`, whose ids travel in the
 * PostgREST query string. A state-wide retype can carry 300 uuids, so they are
 * sent in chunks rather than as one over-long URL.
 */
const OWNER_WRITE_CHUNK = 80;

/**
 * Asset Management — a standalone admin workspace, reached from the sidebar
 * rather than from Settings.
 *
 * Access assignment used to live inside the Settings modal, where it was two
 * levels deep and cramped against the account panels. It is its own surface now
 * so the tree gets the full dialog height, and so later asset-wide functions
 * have somewhere to land: add a tab to `ASSET_MANAGEMENT_TABS` and render a
 * matching <Tabs.Content>.
 *
 * All writes go through the SECURITY DEFINER RPCs defined in migration
 * 20260423000001_app_users_and_permissions.sql. The anon key cannot bypass the
 * admin check inside them.
 */

const ASSET_MANAGEMENT_TABS = [
  {
    value: 'access',
    label: 'User Access',
    icon: ShieldCheck,
    description: 'Grant or revoke per-user access to individual assets.',
  },
];

export function AssetManagementDialog({ open, onOpenChange, currentUser, onAssetOwnerChanged }) {
  const isAdmin = currentUser?.role === 'admin';

  const [users, setUsers] = useState([]);
  const [transformers, setTransformers] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(ASSET_MANAGEMENT_TABS[0].value);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setError('Supabase is not configured.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [usersRes, txRes, permsRes] = await Promise.all([
        supabase.rpc('admin_list_users', { p_admin_id: currentUser.id }),
        supabase
          .from('transformers')
          .select(
            'id, tx_name, site_name, state, mnemonic, serial_number, voltage, load_mva, maker, year_built, owner_type, latitude, longitude'
          )
          .order('tx_name', { ascending: true }),
        supabase.rpc('admin_list_permissions', { p_admin_id: currentUser.id }),
      ]);
      if (usersRes.error) throw usersRes.error;
      if (txRes.error) throw txRes.error;
      if (permsRes.error) throw permsRes.error;
      setUsers(usersRes.data ?? []);
      setTransformers(txRes.data ?? []);
      setPermissions(permsRes.data ?? []);
    } catch (err) {
      setError(err.message || 'Failed to load.');
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id]);

  // Loaded on open rather than on mount: the dialog stays mounted for the whole
  // session, and access granted elsewhere should be visible on the next open.
  useEffect(() => {
    if (open && isAdmin) refresh();
  }, [open, isAdmin, refresh]);

  /**
   * Permission writes only ever change the permissions table, so they re-read
   * that alone. A full `refresh()` would flip `loading` and unmount the access
   * tree, collapsing every branch the admin had opened.
   */
  const refreshPermissions = useCallback(async () => {
    const { data, error: rpcError } = await supabase.rpc('admin_list_permissions', {
      p_admin_id: currentUser.id,
    });
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setPermissions(data ?? []);
  }, [currentUser?.id]);

  /**
   * Retypes assets TNB ↔ Non-TNB.
   *
   * Unlike the permission writes this touches the asset itself, so there is no
   * admin RPC to go through — `transformers` is the same table the asset editor
   * writes. Rows are patched in place instead of re-read for the same reason
   * `refreshPermissions` exists: a `refresh()` here would collapse the tree.
   */
  const applyOwnerType = useCallback(
    async (transformerIds, ownerType) => {
      const owner = normalizeAssetOwnerType(ownerType);
      const ids = Array.from(new Set(transformerIds));
      if (ids.length === 0) return;

      // Chunks that landed before a failure are still applied, so the tree does
      // not claim assets are unchanged when the database says otherwise.
      const written = [];
      try {
        for (let index = 0; index < ids.length; index += OWNER_WRITE_CHUNK) {
          const chunk = ids.slice(index, index + OWNER_WRITE_CHUNK);
          const { error: writeError } = await supabase
            .from('transformers')
            .update({ owner_type: owner })
            .in('id', chunk);
          if (writeError) throw writeError;
          written.push(...chunk);
        }
      } finally {
        if (written.length > 0) {
          const changed = new Set(written);
          setTransformers((current) =>
            current.map((tx) => (changed.has(tx.id) ? { ...tx, owner_type: owner } : tx))
          );
          onAssetOwnerChanged?.(written, owner);
        }
      }
    },
    [onAssetOwnerChanged]
  );

  const managedUserCount = useMemo(
    () => users.filter((user) => user.role !== 'admin').length,
    [users]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="mobile-form-dialog max-w-[1080px]"
        onInteractOutside={(event) => {
          // The asset hover card is portalled to <body>; dragging its minimap
          // must not dismiss the dialog underneath it.
          if (event.target instanceof Element && event.target.closest('[data-asset-hover-card]')) {
            event.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <div className="flex flex-col gap-3 pr-8 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary-strong)] shadow-sm">
                <Zap className="h-5 w-5" />
              </span>
              <div>
                <DialogTitle>Asset Management</DialogTitle>
                <DialogDescription>
                  Assign which assets each account can see and work on.
                </DialogDescription>
              </div>
            </div>

            {isAdmin ? (
              <div className="flex flex-wrap items-center gap-2">
                <SummaryChip icon={Zap} label="Assets" value={loading ? '—' : transformers.length} />
                <SummaryChip icon={Users} label="Users" value={loading ? '—' : managedUserCount} />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={refresh}
                  disabled={loading}
                  aria-label="Reload assets and permissions"
                  title="Reload assets and permissions"
                >
                  <RefreshCw className={cn('h-3.5 w-3.5', loading ? 'animate-spin' : '')} />
                </Button>
              </div>
            ) : null}
          </div>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-2 pt-4 sm:px-5">
          {!isAdmin ? (
            <div className="flex items-center gap-2 rounded-md border border-[color:var(--border)] bg-[var(--warning-soft)] px-4 py-3 text-sm text-[var(--warning-strong)]">
              <ShieldCheck className="h-4 w-4" />
              Only administrators can manage asset access.
            </div>
          ) : (
            <Tabs.Root
              value={activeTab}
              onValueChange={setActiveTab}
              className="flex h-full min-h-0 flex-col"
            >
              <Tabs.List className="mb-3 flex gap-1 rounded-md bg-[var(--card-muted)] p-1">
                {ASSET_MANAGEMENT_TABS.map((tab) => (
                  <TabTrigger key={tab.value} value={tab.value} icon={tab.icon}>
                    {tab.label}
                  </TabTrigger>
                ))}
              </Tabs.List>

              {error ? (
                <div className="mb-3 flex items-start gap-2 rounded-md border border-[color:var(--danger-soft)] bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger-strong)]">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              ) : null}

              <Tabs.Content value="access" className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <UserAccessPanel
                  users={users}
                  transformers={transformers}
                  permissions={permissions}
                  loading={loading}
                  currentUser={currentUser}
                  onChanged={refreshPermissions}
                  onSetOwnerType={applyOwnerType}
                  onError={setError}
                />
              </Tabs.Content>
            </Tabs.Root>
          )}
        </div>

        <DialogFooter className="bg-[var(--card-muted)]/40">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SummaryChip({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-[color:var(--border)] bg-[var(--card-muted)] px-3 py-1.5">
      <Icon className="h-4 w-4 text-[var(--muted)]" />
      <div className="leading-tight">
        <div className="text-sm font-semibold text-[var(--foreground)]">{value}</div>
        <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--muted)]">
          {label}
        </div>
      </div>
    </div>
  );
}

function TabTrigger({ value, icon: Icon, children }) {
  return (
    <Tabs.Trigger
      value={value}
      className={cn(
        'inline-flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-[var(--muted)] transition',
        'data-[state=active]:bg-[var(--card)] data-[state=active]:text-[var(--foreground)] data-[state=active]:shadow-[var(--shadow-card)]'
      )}
    >
      <Icon className="h-4 w-4" />
      {children}
    </Tabs.Trigger>
  );
}

/* ─────────────────────── User access panel ─────────────────────── */

function UserAccessPanel({
  users,
  transformers,
  permissions,
  loading,
  currentUser,
  onChanged,
  onSetOwnerType,
  onError,
}) {
  const regularUsers = useMemo(() => users.filter((u) => u.role !== 'admin'), [users]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [filter, setFilter] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [expandAll, setExpandAll] = useState(false);
  const hoverPreview = useAssetHoverPreview();

  useEffect(() => {
    if (!selectedUserId && regularUsers.length > 0) {
      setSelectedUserId(regularUsers[0].id);
    }
  }, [regularUsers, selectedUserId]);

  // Writes in flight, laid over the server state so a switch flips on click
  // instead of a beat later when the re-read lands. Keyed by transformer id.
  const [pending, setPending] = useState(() => new Map());

  useEffect(() => {
    setPending(new Map());
  }, [selectedUserId]);

  // Every user's total, so the picker shows who has what without a second read.
  const grantedCountByUser = useMemo(() => {
    const counts = new Map();
    permissions.forEach((p) => {
      counts.set(p.user_id, (counts.get(p.user_id) || 0) + 1);
    });
    return counts;
  }, [permissions]);

  const grantedIds = useMemo(() => {
    const set = new Set();
    permissions.forEach((p) => {
      if (p.user_id === selectedUserId) set.add(p.transformer_id);
    });
    pending.forEach((grant, id) => {
      if (grant) set.add(id);
      else set.delete(id);
    });
    return set;
  }, [permissions, selectedUserId, pending]);

  const markPending = useCallback((ids, grant) => {
    setPending((current) => {
      const next = new Map(current);
      ids.forEach((id) => next.set(id, grant));
      return next;
    });
  }, []);

  // Dropped once the re-read has landed, so the server state takes over again.
  const clearPending = useCallback((ids) => {
    setPending((current) => {
      const next = new Map(current);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  }, []);

  // Owner type is a property of the asset, not of the grant, so this pending map
  // is *not* cleared when the selected user changes — only when its write ends.
  const [ownerPending, setOwnerPending] = useState(() => new Map());

  const ownerById = useMemo(() => {
    const map = new Map();
    transformers.forEach((tx) => map.set(tx.id, normalizeAssetOwnerType(tx.owner_type)));
    ownerPending.forEach((owner, id) => map.set(id, owner));
    return map;
  }, [transformers, ownerPending]);

  const setOwner = useCallback(
    async (transformerIds, ownerType) => {
      const owner = normalizeAssetOwnerType(ownerType);
      const ids = transformerIds.filter((id) => ownerById.get(id) !== owner);
      if (ids.length === 0) return;
      onError(null);
      setOwnerPending((current) => {
        const next = new Map(current);
        ids.forEach((id) => next.set(id, owner));
        return next;
      });
      try {
        await onSetOwnerType(ids, owner);
      } catch (err) {
        onError(err.message || 'Failed to change owner type.');
      } finally {
        setOwnerPending((current) => {
          const next = new Map(current);
          ids.forEach((id) => next.delete(id));
          return next;
        });
      }
    },
    [ownerById, onSetOwnerType, onError]
  );

  const searchMatches = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return transformers;
    return transformers.filter(
      (t) =>
        (t.tx_name || '').toLowerCase().includes(q) ||
        (t.site_name || '').toLowerCase().includes(q) ||
        (t.state || '').toLowerCase().includes(q) ||
        (t.mnemonic || '').toLowerCase().includes(q)
    );
  }, [transformers, filter]);

  // Counted before the owner filter is applied, so each button shows what it
  // would reveal rather than what is on screen right now.
  const ownerCounts = useMemo(() => {
    const counts = { all: searchMatches.length };
    searchMatches.forEach((t) => {
      const owner = ownerById.get(t.id);
      counts[owner] = (counts[owner] || 0) + 1;
    });
    return counts;
  }, [searchMatches, ownerById]);

  const filteredTransformers = useMemo(() => {
    if (ownerFilter === 'all') return searchMatches;
    return searchMatches.filter((t) => ownerById.get(t.id) === ownerFilter);
  }, [searchMatches, ownerFilter, ownerById]);

  const grantedInView = useMemo(
    () => filteredTransformers.reduce((total, t) => (grantedIds.has(t.id) ? total + 1 : total), 0),
    [filteredTransformers, grantedIds]
  );

  // The card is anchored to a row rect, so anything that re-flows the tree dismisses it.
  const closePreview = hoverPreview.close;
  useEffect(() => {
    closePreview();
  }, [closePreview, selectedUserId, filter, ownerFilter, expandAll]);

  const toggle = useCallback(
    async (transformerId) => {
      if (!selectedUserId) return;
      const grant = !grantedIds.has(transformerId);
      onError(null);
      markPending([transformerId], grant);
      try {
        const fn = grant ? 'admin_grant_access' : 'admin_revoke_access';
        const { error } = await supabase.rpc(fn, {
          p_admin_id: currentUser.id,
          p_user_id: selectedUserId,
          p_transformer_id: transformerId,
        });
        if (error) throw error;
        await onChanged();
      } catch (err) {
        onError(err.message);
      } finally {
        clearPending([transformerId]);
      }
    },
    [selectedUserId, grantedIds, currentUser?.id, onChanged, onError, markPending, clearPending]
  );

  // Only send the ids that would actually change, so a branch toggle on a
  // partially-granted site does not re-write rows that are already correct.
  const setMany = useCallback(
    async (transformerIds, grant) => {
      if (!selectedUserId) return;
      onError(null);
      const ids = transformerIds.filter((id) => grantedIds.has(id) !== grant);
      if (ids.length === 0) return;
      markPending(ids, grant);
      try {
        const fn = grant ? 'admin_grant_many' : 'admin_revoke_many';
        const { error } = await supabase.rpc(fn, {
          p_admin_id: currentUser.id,
          p_user_id: selectedUserId,
          p_transformer_ids: ids,
        });
        if (error) throw error;
        await onChanged();
      } catch (err) {
        onError(err.message);
      } finally {
        clearPending(ids);
      }
    },
    [selectedUserId, grantedIds, currentUser?.id, onChanged, onError, markPending, clearPending]
  );

  const setAll = (grant) => setMany(filteredTransformers.map((t) => t.id), grant);

  const selectedUser = useMemo(
    () => regularUsers.find((u) => u.id === selectedUserId) || null,
    [regularUsers, selectedUserId]
  );

  if (loading) {
    return (
      <div className="flex justify-center p-6 text-[var(--muted)]">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  if (regularUsers.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-[color:var(--border)] bg-[var(--card-muted)] p-6 text-center text-sm text-[var(--muted)]">
        Create a non-admin user in Settings → Users to start assigning asset access.
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[250px_1fr]">
      <aside className="flex max-h-[520px] flex-col gap-1 overflow-y-auto rounded-md border border-[color:var(--border)] bg-[var(--card)] p-2">
        <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
          Select user
        </p>
        {regularUsers.map((user) => {
          const active = selectedUserId === user.id;
          const granted = grantedCountByUser.get(user.id) || 0;
          return (
            <button
              key={user.id}
              type="button"
              onClick={() => setSelectedUserId(user.id)}
              className={cn(
                'flex items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition',
                active
                  ? 'bg-[var(--primary-soft)] text-[var(--primary-strong)]'
                  : 'text-[var(--foreground)] hover:bg-[var(--card-muted)]'
              )}
            >
              <span className="min-w-0 truncate">
                <span className="block truncate font-medium">{user.username}</span>
                <span className="block truncate text-xs text-[var(--muted)]">{user.full_name}</span>
              </span>
              <span className="flex flex-shrink-0 items-center gap-1.5">
                {!user.is_active ? <Badge variant="danger">off</Badge> : null}
                <span
                  className={cn(
                    'rounded-full px-1.5 py-px font-mono text-[10px]',
                    granted > 0
                      ? 'bg-[var(--primary)] text-white'
                      : 'bg-[var(--card-muted)] text-[var(--muted)]'
                  )}
                  title={`${granted} of ${transformers.length} assets granted`}
                >
                  {granted}
                </span>
              </span>
            </button>
          );
        })}
      </aside>

      <section className="flex min-h-0 flex-col gap-3">
        {selectedUser ? (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-[color:var(--border)] bg-[var(--card)] px-3 py-2">
            <UserCheck className="h-4 w-4 text-[var(--primary-strong)]" />
            <span className="text-sm font-semibold text-[var(--foreground)]">
              {selectedUser.full_name || selectedUser.username}
            </span>
            <span className="text-xs text-[var(--muted)]">@{selectedUser.username}</span>
            <Badge variant="outline" className="ml-auto">
              {selectedUser.role}
            </Badge>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
            <Input
              className="pl-9"
              placeholder="Filter by transformer, site, or state"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpandAll((current) => !current)}
            disabled={!!filter.trim()}
          >
            {expandAll || filter.trim() ? (
              <>
                <ChevronsDownUp className="h-3.5 w-3.5" /> Collapse
              </>
            ) : (
              <>
                <ChevronsUpDown className="h-3.5 w-3.5" /> Expand
              </>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAll(true)}>
            <Check className="h-3.5 w-3.5" /> Grant all
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAll(false)}>
            <X className="h-3.5 w-3.5" /> Revoke all
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex items-center rounded-md border border-[color:var(--border)] bg-[var(--card-muted)] p-0.5">
            {ASSET_OWNER_FILTERS.map((option) => {
              const active = ownerFilter === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setOwnerFilter(option.value)}
                  aria-pressed={active}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-semibold transition',
                    active
                      ? 'bg-[var(--primary-soft)] text-[var(--primary-strong)] shadow-sm'
                      : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                  )}
                >
                  {option.shortLabel}
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-px font-mono text-[10px]',
                      active ? 'bg-[var(--primary)] text-white' : 'bg-[var(--card)] text-[var(--muted)]'
                    )}
                  >
                    {ownerCounts[option.value] ?? 0}
                  </span>
                </button>
              );
            })}
          </div>

          <p className="text-xs text-[var(--muted)]">
            <span className="font-semibold text-[var(--foreground)]">{grantedInView}</span> of{' '}
            {filteredTransformers.length} {filteredTransformers.length === 1 ? 'asset' : 'assets'} granted
            {filter.trim() || ownerFilter !== 'all' ? ' in this filter' : ''} · grouped by state and site
          </p>
        </div>

        {/* Access is per user; owner type is not. Worth saying once, above a tree
            where the two switches sit in adjacent columns. */}
        <p className="-mt-1 text-[11px] text-[var(--muted)]">
          <span className="font-semibold text-[var(--foreground)]">Owner</span> switches the asset
          between TNB and Non-TNB for every account — a state or site row retypes everything under
          it. <span className="font-semibold text-[var(--foreground)]">Access</span> applies to the
          selected account only.
        </p>

        <AssetAccessTree
          transformers={filteredTransformers}
          grantedIds={grantedIds}
          ownerById={ownerById}
          onToggleAsset={toggle}
          onSetMany={setMany}
          onSetOwner={setOwner}
          expandAllSignal={expandAll}
          filterActive={!!filter.trim()}
          hoverPreview={hoverPreview}
        />
      </section>

      <AssetHoverCard
        preview={hoverPreview.preview}
        zoom={hoverPreview.zoom}
        layerKey={hoverPreview.layerKey}
        onZoomChange={hoverPreview.setZoom}
        onLayerChange={hoverPreview.setLayerKey}
        onPointerEnter={hoverPreview.cancelClose}
        onPointerLeave={hoverPreview.scheduleClose}
        onClose={hoverPreview.close}
      />
    </div>
  );
}

export { UserAccessPanel };
export default AssetManagementDialog;
