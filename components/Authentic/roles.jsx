import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Users,
  ShieldCheck,
  KeyRound,
  UserPlus,
  Trash2,
  Loader2,
  AlertTriangle,
  Search,
  Check,
  X,
  User as UserIcon,
  Lock,
  IdCard,
  Building2,
  MapPin,
  Mail,
  UserCog,
  CheckCircle2,
  Pencil,
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

/**
 * User & Asset-Access Management — rendered inside the Settings modal.
 *
 * All writes go through SECURITY DEFINER RPCs defined in migration
 * 20260423000001_app_users_and_permissions.sql. The anon key cannot
 * read password_hash / salt and cannot bypass the admin check.
 */

function Roles({ currentUser, onClose }) {
  const isAdmin = currentUser?.role === 'admin';

  const [users, setUsers] = useState([]);
  const [transformers, setTransformers] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('users');

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
        supabase.from('transformers').select('id, tx_name, site_name').order('tx_name', { ascending: true }),
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

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!isAdmin) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-[color:var(--border)] bg-[var(--warning-soft)] px-4 py-3 text-sm text-[var(--warning-strong)]">
        <ShieldCheck className="h-4 w-4" />
        Only administrators can manage users and permissions.
      </div>
    );
  }

  return (
    <Tabs.Root value={activeTab} onValueChange={setActiveTab} className="flex h-full min-h-0 flex-col">
      <Tabs.List className="mb-4 flex gap-1 rounded-md bg-[var(--card-muted)] p-1">
        <TabTrigger value="users" icon={Users}>Users</TabTrigger>
        <TabTrigger value="permissions" icon={ShieldCheck}>Asset Access</TabTrigger>
      </Tabs.List>

      {error ? (
        <div className="mb-3 flex items-start gap-2 rounded-md border border-[color:var(--danger-soft)] bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger-strong)]">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <Tabs.Content value="users" className="min-h-0 flex-1 overflow-auto">
        <UsersPanel users={users} loading={loading} currentUser={currentUser} onChanged={refresh} onError={setError} />
      </Tabs.Content>

      <Tabs.Content value="permissions" className="min-h-0 flex-1 overflow-auto">
        <PermissionsPanel
          users={users}
          transformers={transformers}
          permissions={permissions}
          loading={loading}
          currentUser={currentUser}
          onChanged={refresh}
          onError={setError}
        />
      </Tabs.Content>

      {onClose ? (
        <div className="mt-4 flex justify-end border-t border-[color:var(--border)] pt-3">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      ) : null}
    </Tabs.Root>
  );
}

function getRoleBadgeVariant(role) {
  if (role === 'admin') {
    return 'success';
  }
  if (role === 'viewer') {
    return 'outline';
  }
  return 'secondary';
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

/* ─────────────────────── Users panel ─────────────────────── */

function UsersPanel({ users, loading, currentUser, onChanged, onError }) {
  const [addOpen, setAddOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [resetUser, setResetUser] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const activeCount = useMemo(() => users.filter((u) => u.is_active).length, [users]);

  const handleToggleActive = async (user) => {
    setBusyId(user.id);
    onError(null);
    try {
      const { error } = await supabase.rpc('admin_set_active', {
        p_admin_id: currentUser.id,
        p_target_id: user.id,
        p_is_active: !user.is_active,
      });
      if (error) throw error;
      await onChanged();
    } catch (err) {
      onError(err.message);
    } finally {
      setBusyId(null);
    }
  };



  const handleDelete = async (user) => {
    if (user.id === currentUser?.id) {
      onError('You cannot delete your own account.');
      return;
    }
    if (!window.confirm(`Delete user "${user.username}"? This cannot be undone.`)) return;
    setBusyId(user.id);
    onError(null);
    try {
      const { error } = await supabase.rpc('admin_delete_user', {
        p_admin_id: currentUser.id,
        p_target_id: user.id,
      });
      if (error) throw error;
      await onChanged();
    } catch (err) {
      onError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[color:var(--border)] bg-[var(--card)] px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-[var(--primary-soft)] text-[var(--primary-strong)]">
            <Users className="h-5 w-5" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-[var(--foreground)]">Team members</p>
            <p className="text-xs text-[var(--muted)]">
              {loading
                ? 'Loading accounts…'
                : `${users.length} ${users.length === 1 ? 'account' : 'accounts'} · ${activeCount} active`}
            </p>
          </div>
        </div>
        <Button onClick={() => setAddOpen(true)} className="gap-2">
          <UserPlus className="h-4 w-4" />
          Add user
        </Button>
      </div>

      <AddUserDialog
        open={addOpen}
        currentUser={currentUser}
        onClose={() => setAddOpen(false)}
        onCreated={async () => {
          setAddOpen(false);
          await onChanged();
        }}
      />

      <EditUserDialog
        user={editUser}
        currentUser={currentUser}
        onClose={() => setEditUser(null)}
        onSaved={async () => {
          setEditUser(null);
          await onChanged();
        }}
        onError={onError}
      />

      <ResetPasswordDialog
        user={resetUser}
        currentUser={currentUser}
        onClose={() => setResetUser(null)}
        onSaved={() => setResetUser(null)}
        onError={onError}
      />

      <div className="overflow-hidden rounded-md border border-[color:var(--border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--card-muted)] text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]">
            <tr>
              <th className="px-3 py-2 text-left">Username</th>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Role</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="p-6 text-center text-[var(--muted)]"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={5} className="p-6 text-center text-[var(--muted)]">No users yet.</td></tr>
            ) : users.map((user) => (
              <tr key={user.id} className="border-t border-[color:var(--border)]">
                <td className="px-3 py-2 font-semibold">{user.username}</td>
                <td className="px-3 py-2 text-[var(--muted)]">{user.full_name || '—'}</td>
                <td className="px-3 py-2">
                  <Badge variant={getRoleBadgeVariant(user.role)}>{user.role}</Badge>
                </td>
                <td className="px-3 py-2">
                  <Badge variant={user.is_active ? 'success' : 'danger'}>
                    {user.is_active ? 'Active' : 'Disabled'}
                  </Badge>
                </td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="outline" onClick={() => setEditUser(user)} disabled={busyId === user.id} aria-label="Edit user" title="Edit user">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setResetUser(user)} disabled={busyId === user.id} aria-label="Reset password" title="Reset password">
                      <KeyRound className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleToggleActive(user)} disabled={busyId === user.id}>
                      {user.is_active ? 'Disable' : 'Enable'}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDelete(user)} disabled={busyId === user.id || user.id === currentUser?.id}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─────────────────────── Permissions panel ─────────────────────── */

function PermissionsPanel({ users, transformers, permissions, loading, currentUser, onChanged, onError }) {
  const pageSize = 10;
  const regularUsers = useMemo(() => users.filter((u) => u.role !== 'admin'), [users]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!selectedUserId && regularUsers.length > 0) {
      setSelectedUserId(regularUsers[0].id);
    }
  }, [regularUsers, selectedUserId]);

  const grantedIds = useMemo(() => {
    const set = new Set();
    permissions.forEach((p) => {
      if (p.user_id === selectedUserId) set.add(p.transformer_id);
    });
    return set;
  }, [permissions, selectedUserId]);

  const filteredTransformers = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return transformers;
    return transformers.filter(
      (t) =>
        (t.tx_name || '').toLowerCase().includes(q) ||
        (t.site_name || '').toLowerCase().includes(q)
    );
  }, [transformers, filter]);

  useEffect(() => {
    setPage(1);
  }, [selectedUserId, filter]);

  const totalPages = Math.max(1, Math.ceil(filteredTransformers.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const pagedTransformers = filteredTransformers.slice(pageStart, pageStart + pageSize);

  const toggle = async (transformerId) => {
    if (!selectedUserId) return;
    onError(null);
    try {
      const fn = grantedIds.has(transformerId) ? 'admin_revoke_access' : 'admin_grant_access';
      const { error } = await supabase.rpc(fn, {
        p_admin_id: currentUser.id,
        p_user_id: selectedUserId,
        p_transformer_id: transformerId,
      });
      if (error) throw error;
      await onChanged();
    } catch (err) {
      onError(err.message);
    }
  };

  const setAll = async (grant) => {
    if (!selectedUserId) return;
    onError(null);
    try {
      const ids = grant
        ? filteredTransformers.filter((t) => !grantedIds.has(t.id)).map((t) => t.id)
        : filteredTransformers.map((t) => t.id);
      if (ids.length === 0) return;
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
    }
  };

  if (loading) {
    return <div className="flex justify-center p-6 text-[var(--muted)]"><Loader2 className="h-4 w-4 animate-spin" /></div>;
  }

  if (regularUsers.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-[color:var(--border)] bg-[var(--card-muted)] p-6 text-center text-sm text-[var(--muted)]">
        Create a non-admin user to start assigning asset access.
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      <aside className="flex flex-col gap-1 rounded-md border border-[color:var(--border)] bg-[var(--card)] p-2">
        <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Select user</p>
        {regularUsers.map((user) => (
          <button
            key={user.id}
            type="button"
            onClick={() => setSelectedUserId(user.id)}
            className={cn(
              'flex items-center justify-between rounded-md px-3 py-2 text-left text-sm transition',
              selectedUserId === user.id
                ? 'bg-[var(--primary-soft)] text-[var(--primary-strong)]'
                : 'text-[var(--foreground)] hover:bg-[var(--card-muted)]'
            )}
          >
            <span className="truncate">
              <span className="block font-medium">{user.username}</span>
              <span className="block text-xs text-[var(--muted)]">{user.full_name}</span>
            </span>
            {!user.is_active ? <Badge variant="danger">off</Badge> : null}
          </button>
        ))}
      </aside>

      <section className="flex min-h-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
            <Input className="pl-9" placeholder="Filter by transformer or site" value={filter} onChange={(e) => setFilter(e.target.value)} />
          </div>
          <Button variant="outline" size="sm" onClick={() => setAll(true)}>
            <Check className="h-3.5 w-3.5" /> Grant all
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAll(false)}>
            <X className="h-3.5 w-3.5" /> Revoke all
          </Button>
        </div>

        <div className="overflow-hidden rounded-md border border-[color:var(--border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--card-muted)] text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]">
              <tr>
                <th className="w-[60px] px-3 py-2 text-center">Access</th>
                <th className="px-3 py-2 text-left">Transformer</th>
                <th className="px-3 py-2 text-left">Site</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransformers.length === 0 ? (
                <tr><td colSpan={3} className="p-6 text-center text-[var(--muted)]">No transformers match the filter.</td></tr>
              ) : pagedTransformers.map((tx) => {
                const granted = grantedIds.has(tx.id);
                return (
                  <tr key={tx.id} className="border-t border-[color:var(--border)]">
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => toggle(tx.id)}
                        className={cn(
                          'inline-flex h-6 w-10 items-center rounded-full border transition',
                          granted ? 'border-transparent bg-[var(--primary)]' : 'border-[color:var(--border)] bg-[var(--card-muted)]'
                        )}
                        aria-pressed={granted}
                        aria-label={granted ? 'Revoke access' : 'Grant access'}
                      >
                        <span className={cn('h-5 w-5 rounded-full bg-white shadow transition', granted ? 'translate-x-4' : 'translate-x-0.5')} />
                      </button>
                    </td>
                    <td className="px-3 py-2 font-semibold">{tx.tx_name}</td>
                    <td className="px-3 py-2 text-[var(--muted)]">{tx.site_name}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredTransformers.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[var(--muted)]">
            <p>
              Showing {pageStart + 1}-{pageStart + pagedTransformers.length} of {filteredTransformers.length}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={currentPage === 1}>
                Previous
              </Button>
              <span>
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

/* ─────────────────────── Add user dialog ─────────────────────── */

const ROLE_OPTIONS = [
  {
    value: 'user',
    label: 'User',
    description: 'Can view and edit assets that admins grant access to.',
  },
  {
    value: 'viewer',
    label: 'Viewer',
    description: 'Read-only access. Cannot upload, edit, or delete.',
  },
  {
    value: 'admin',
    label: 'Admin',
    description: 'Full access, including user management and access control.',
  },
];

const EMPTY_FORM = {
  username: '',
  fullName: '',
  password: '',
  confirm: '',
  role: 'user',
  companyName: '',
  companyAddress: '',
  picEmail: '',
};

function AddUserDialog({ open, currentUser, onClose, onCreated }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setForm(EMPTY_FORM);
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  const setField = (key) => (event) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const selectRole = (role) =>
    setForm((current) => ({ ...current, role }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);

    const username = form.username.trim().toLowerCase();
    if (!/^[a-z0-9_.\-]{3,32}$/.test(username)) {
      setError('Username must be 3–32 chars: letters, digits, and . _ -');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (form.password !== form.confirm) {
      setError('Passwords do not match.');
      return;
    }
    const picEmail = form.picEmail.trim();
    if (picEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(picEmail)) {
      setError('PIC email does not look valid.');
      return;
    }

    setSubmitting(true);
    try {
      const { error: rpcError } = await supabase.rpc('admin_create_user', {
        p_admin_id: currentUser.id,
        p_username: username,
        p_full_name: form.fullName.trim(),
        p_password: form.password,
        p_role: form.role,
        p_company_name: form.companyName.trim() || null,
        p_company_address: form.companyAddress.trim() || null,
        p_pic_email: picEmail || null,
      });
      if (rpcError) throw rpcError;
      await onCreated?.();
    } catch (err) {
      setError(err.message || 'Unable to create user.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : null)}>
      <DialogContent className="max-w-[680px] p-0">
        <DialogHeader className="bg-[var(--card-muted)]/40">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary-strong)] shadow-sm">
              <UserPlus className="h-5 w-5" />
            </span>
            <div>
              <DialogTitle>Register a new account</DialogTitle>
              <DialogDescription>
                Create login credentials and capture the organization the user belongs to.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:max-h-[calc(100vh-260px)]">
            <SectionCard
              icon={UserIcon}
              title="Account credentials"
              description="Used to sign in. Username is lowercase and must be unique."
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <LabeledInput
                  icon={UserIcon}
                  label="Username"
                  placeholder="e.g. john.doe"
                  value={form.username}
                  onChange={setField('username')}
                  autoComplete="off"
                  required
                />
                <LabeledInput
                  icon={IdCard}
                  label="Full name"
                  placeholder="e.g. John Doe"
                  value={form.fullName}
                  onChange={setField('fullName')}
                  autoComplete="off"
                />
                <LabeledInput
                  icon={Lock}
                  label="Password"
                  type="password"
                  placeholder="Min. 6 characters"
                  value={form.password}
                  onChange={setField('password')}
                  autoComplete="new-password"
                  minLength={6}
                  required
                />
                <LabeledInput
                  icon={Lock}
                  label="Confirm password"
                  type="password"
                  placeholder="Re-enter password"
                  value={form.confirm}
                  onChange={setField('confirm')}
                  autoComplete="new-password"
                  minLength={6}
                  required
                />
              </div>
            </SectionCard>

            <SectionCard
              icon={UserCog}
              title="Role"
              description="Controls what this account can do inside the workspace."
            >
              <div className="grid gap-2 sm:grid-cols-3">
                {ROLE_OPTIONS.map((option) => {
                  const active = form.role === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => selectRole(option.value)}
                      className={cn(
                        'group relative flex flex-col items-start gap-1 rounded-md border px-3 py-2.5 text-left transition',
                        active
                          ? 'border-[var(--primary)] bg-[var(--primary-soft)] shadow-sm'
                          : 'border-[color:var(--border)] bg-[var(--card)] hover:border-[var(--primary)]/40 hover:bg-[var(--card-muted)]'
                      )}
                      aria-pressed={active}
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className={cn('text-sm font-semibold', active ? 'text-[var(--primary-strong)]' : 'text-[var(--foreground)]')}>
                          {option.label}
                        </span>
                        {active ? <CheckCircle2 className="h-4 w-4 text-[var(--primary-strong)]" /> : null}
                      </div>
                      <span className="text-[11px] leading-snug text-[var(--muted)]">
                        {option.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </SectionCard>

            <SectionCard
              icon={Building2}
              title="Organization"
              description="Optional — helps you track who this account represents."
            >
              <div className="grid gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <LabeledInput
                    icon={Building2}
                    label="Company name"
                    placeholder="e.g. PRefChem Sdn Bhd"
                    value={form.companyName}
                    onChange={setField('companyName')}
                  />
                  <LabeledInput
                    icon={Mail}
                    label="PIC email"
                    type="email"
                    placeholder="person@company.com"
                    value={form.picEmail}
                    onChange={setField('picEmail')}
                    autoComplete="off"
                  />
                </div>
                <LabeledInput
                  icon={MapPin}
                  label="Company address"
                  placeholder="Street, city, state, postcode"
                  value={form.companyAddress}
                  onChange={setField('companyAddress')}
                />
              </div>
            </SectionCard>

            {error ? (
              <div className="flex items-start gap-2 rounded-md border border-[color:var(--danger-soft)] bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger-strong)]">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}
          </div>

          <DialogFooter className="bg-[var(--card-muted)]/40">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="gap-2">
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Creating…
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" /> Create account
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────────── Reset password dialog ─────────────────────── */

function ResetPasswordDialog({ user, currentUser, onClose, onSaved, onError }) {
  const [form, setForm] = useState({ oldPassword: '', newPassword: '', confirm: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({ oldPassword: '', newPassword: '', confirm: '' });
      setError(null);
      setSuccess(false);
      setSubmitting(false);
    }
  }, [user]);

  const setField = (key) => (event) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);

    if (form.newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    if (form.newPassword !== form.confirm) {
      setError('New passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      // Verify old password against the target user
      const { data: verified, error: verifyError } = await supabase.rpc('verify_app_user', {
        p_username: user.username,
        p_password: form.oldPassword,
      });
      if (verifyError) throw verifyError;
      if (!verified || verified.length === 0) {
        setError('Current password is incorrect.');
        setSubmitting(false);
        return;
      }

      // Set new password
      const { error: setError_ } = await supabase.rpc('admin_set_password', {
        p_admin_id: currentUser.id,
        p_target_id: user.id,
        p_new_password: form.newPassword,
      });
      if (setError_) throw setError_;

      setSuccess(true);
      setTimeout(() => onSaved?.(), 1200);
    } catch (err) {
      setError(err.message || 'Unable to reset password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={!!user} onOpenChange={(next) => (!next ? onClose() : null)}>
      <DialogContent className="max-w-[440px] p-0">
        <DialogHeader className="bg-[var(--card-muted)]/40">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary-strong)] shadow-sm">
              <KeyRound className="h-5 w-5" />
            </span>
            <div>
              <DialogTitle>Reset password — {user?.username}</DialogTitle>
              <DialogDescription>
                Verify the current password, then set a new one.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="space-y-4 px-5 py-5">
            {success ? (
              <div className="flex items-center gap-2 rounded-md border border-[color:var(--success-soft)] bg-[var(--success-soft)] px-3 py-3 text-sm text-[var(--success-strong)]">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                Password updated successfully.
              </div>
            ) : (
              <>
                <LabeledInput
                  icon={Lock}
                  label="Current password"
                  type="password"
                  placeholder="Enter current password"
                  value={form.oldPassword}
                  onChange={setField('oldPassword')}
                  autoComplete="current-password"
                  required
                />
                <div className="border-t border-[color:var(--border)]" />
                <LabeledInput
                  icon={Lock}
                  label="New password"
                  type="password"
                  placeholder="Min. 6 characters"
                  value={form.newPassword}
                  onChange={setField('newPassword')}
                  autoComplete="new-password"
                  minLength={6}
                  required
                />
                <LabeledInput
                  icon={Lock}
                  label="Confirm new password"
                  type="password"
                  placeholder="Re-enter new password"
                  value={form.confirm}
                  onChange={setField('confirm')}
                  autoComplete="new-password"
                  minLength={6}
                  required
                />
                {error ? (
                  <div className="flex items-start gap-2 rounded-md border border-[color:var(--danger-soft)] bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger-strong)]">
                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                ) : null}
              </>
            )}
          </div>

          <DialogFooter className="bg-[var(--card-muted)]/40">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              {success ? 'Close' : 'Cancel'}
            </Button>
            {!success ? (
              <Button type="submit" disabled={submitting} className="gap-2">
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Verifying…
                  </>
                ) : (
                  <>
                    <KeyRound className="h-4 w-4" /> Save password
                  </>
                )}
              </Button>
            ) : null}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────────── Edit user dialog ─────────────────────── */

function EditUserDialog({ user, currentUser, onClose, onSaved, onError }) {
  const [form, setForm] = useState({ fullName: '', role: 'user', companyName: '', companyAddress: '', picEmail: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user) {
      setForm({
        fullName: user.full_name || '',
        role: user.role || 'user',
        companyName: user.company_name || '',
        companyAddress: user.company_address || '',
        picEmail: user.pic_email || '',
      });
      setError(null);
      setSubmitting(false);
    }
  }, [user]);

  const setField = (key) => (event) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const selectRole = (role) =>
    setForm((current) => ({ ...current, role }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    const picEmail = form.picEmail.trim();
    if (picEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(picEmail)) {
      setError('PIC email does not look valid.');
      return;
    }
    setSubmitting(true);
    try {
      const { error: rpcError } = await supabase.rpc('admin_update_user', {
        p_admin_id: currentUser.id,
        p_target_id: user.id,
        p_full_name: form.fullName.trim(),
        p_role: form.role,
        p_company_name: form.companyName.trim() || null,
        p_company_address: form.companyAddress.trim() || null,
        p_pic_email: picEmail || null,
      });
      if (rpcError) throw rpcError;
      await onSaved?.();
    } catch (err) {
      setError(err.message || 'Unable to update user.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={!!user} onOpenChange={(next) => (!next ? onClose() : null)}>
      <DialogContent className="max-w-[620px] p-0">
        <DialogHeader className="bg-[var(--card-muted)]/40">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary-strong)] shadow-sm">
              <Pencil className="h-5 w-5" />
            </span>
            <div>
              <DialogTitle>Edit user — {user?.username}</DialogTitle>
              <DialogDescription>
                Update the display name and role for this account.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="space-y-5 overflow-y-auto px-5 py-5 sm:max-h-[calc(100vh-260px)]">
            <SectionCard
              icon={IdCard}
              title="Display name"
              description="Shown in the users table and asset access panel."
            >
              <LabeledInput
                icon={IdCard}
                label="Full name"
                placeholder="e.g. John Doe"
                value={form.fullName}
                onChange={setField('fullName')}
                autoComplete="off"
              />
            </SectionCard>

            <SectionCard
              icon={UserCog}
              title="Role"
              description="Controls what this account can do inside the workspace."
            >
              <div className="grid gap-2 sm:grid-cols-3">
                {ROLE_OPTIONS.map((option) => {
                  const active = form.role === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => selectRole(option.value)}
                      className={cn(
                        'group relative flex flex-col items-start gap-1 rounded-md border px-3 py-2.5 text-left transition',
                        active
                          ? 'border-[var(--primary)] bg-[var(--primary-soft)] shadow-sm'
                          : 'border-[color:var(--border)] bg-[var(--card)] hover:border-[var(--primary)]/40 hover:bg-[var(--card-muted)]'
                      )}
                      aria-pressed={active}
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className={cn('text-sm font-semibold', active ? 'text-[var(--primary-strong)]' : 'text-[var(--foreground)]')}>
                          {option.label}
                        </span>
                        {active ? <CheckCircle2 className="h-4 w-4 text-[var(--primary-strong)]" /> : null}
                      </div>
                      <span className="text-[11px] leading-snug text-[var(--muted)]">
                        {option.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </SectionCard>

            <SectionCard
              icon={Building2}
              title="Organization"
              description="Optional — helps you track who this account represents."
            >
              <div className="grid gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <LabeledInput
                    icon={Building2}
                    label="Company name"
                    placeholder="e.g. PRefChem Sdn Bhd"
                    value={form.companyName}
                    onChange={setField('companyName')}
                  />
                  <LabeledInput
                    icon={Mail}
                    label="PIC email"
                    type="email"
                    placeholder="person@company.com"
                    value={form.picEmail}
                    onChange={setField('picEmail')}
                    autoComplete="off"
                  />
                </div>
                <LabeledInput
                  icon={MapPin}
                  label="Company address"
                  placeholder="Street, city, state, postcode"
                  value={form.companyAddress}
                  onChange={setField('companyAddress')}
                />
              </div>
            </SectionCard>

            {error ? (
              <div className="flex items-start gap-2 rounded-md border border-[color:var(--danger-soft)] bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger-strong)]">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}
          </div>

          <DialogFooter className="bg-[var(--card-muted)]/40">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="gap-2">
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                </>
              ) : (
                <>
                  <Pencil className="h-4 w-4" /> Save changes
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SectionCard({ icon: Icon, title, description, children }) {
  return (
    <section className="rounded-lg border border-[color:var(--border)] bg-[var(--card)] p-4">
      <header className="mb-3 flex items-start gap-3">
        <span className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-[var(--card-muted)] text-[var(--muted)]">
          <Icon className="h-4 w-4" />
        </span>
        <div className="leading-tight">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">{title}</h3>
          {description ? (
            <p className="text-xs text-[var(--muted)]">{description}</p>
          ) : null}
        </div>
      </header>
      {children}
    </section>
  );
}

function LabeledInput({ icon: Icon, label, className, ...props }) {
  const id = React.useId();
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
        {label}
      </span>
      <div className="relative">
        {Icon ? (
          <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
        ) : null}
        <Input id={id} className={cn(Icon ? 'pl-9' : '', className)} {...props} />
      </div>
    </label>
  );
}

export { Roles };
export default Roles;
