"use client";

import { useState, useEffect, useCallback } from "react";
import { GlassCard } from "@/components/ui/GlassCard";

type AdminRole = "admin" | "viewer";
type AdminUser = {
  id: string;
  username: string;
  role: AdminRole;
  assigned_client_ids: string[];
  created_at: string;
};
type ClientItem = { id: string; name: string };

const inputClass =
  "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white placeholder:text-slate-300";

function RoleBadge({ role }: { role: AdminRole }) {
  return role === "admin" ? (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
      Admin
    </span>
  ) : (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
      Viewer
    </span>
  );
}

function EditPanel({
  user,
  clients,
  onSave,
  onClose,
}: {
  user: AdminUser;
  clients: ClientItem[];
  onSave: () => void;
  onClose: () => void;
}) {
  const [role, setRole] = useState<AdminRole>(user.role);
  const [selectedClients, setSelectedClients] = useState<Set<string>>(
    new Set(user.assigned_client_ids)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetPw, setResetPw] = useState("");
  const [resetPwConfirm, setResetPwConfirm] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [clientSearch, setClientSearch] = useState("");

  const toggleClient = (id: string) => {
    setSelectedClients((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  async function handleSave() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/admin/users?id=${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role,
        assigned_client_ids: role === "viewer" ? Array.from(selectedClients) : [],
      }),
    });
    setSaving(false);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to save");
    } else {
      onSave();
    }
  }

  async function handleResetPassword() {
    setResetError(null);
    if (resetPw !== resetPwConfirm) {
      setResetError("Passwords do not match");
      return;
    }
    if (resetPw.length < 8) {
      setResetError("Password must be at least 8 characters");
      return;
    }
    setResetting(true);
    const res = await fetch(`/api/admin/users?id=${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ new_password: resetPw }),
    });
    setResetting(false);
    const data = await res.json();
    if (!res.ok) {
      setResetError(data.error || "Failed to reset password");
    } else {
      setResetSuccess(true);
      setResetPw("");
      setResetPwConfirm("");
    }
  }

  const filteredClients = clients.filter((c) =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase())
  );

  return (
    <div className="border-t border-slate-100 bg-slate-50 px-5 py-5 space-y-5">
      {/* Role */}
      <div>
        <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
          Role
        </div>
        <div className="flex gap-3">
          {(["admin", "viewer"] as AdminRole[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                role === r
                  ? r === "admin"
                    ? "bg-violet-600 text-white border-violet-600"
                    : "bg-slate-700 text-white border-slate-700"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
              }`}
            >
              {r === "admin" ? "Admin — full access" : "Viewer — assigned clients only"}
            </button>
          ))}
        </div>
      </div>

      {/* Client assignment (viewer only) */}
      {role === "viewer" && (
        <div>
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
            Assigned Clients
            <span className="ml-2 font-normal normal-case text-slate-400">
              ({selectedClients.size} selected)
            </span>
          </div>
          <input
            type="text"
            placeholder="Search clients…"
            value={clientSearch}
            onChange={(e) => setClientSearch(e.target.value)}
            className="w-full mb-2 border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <div className="border border-slate-200 rounded-xl bg-white max-h-48 overflow-y-auto divide-y divide-slate-100">
            {filteredClients.length === 0 ? (
              <div className="px-4 py-3 text-sm text-slate-400">No clients found</div>
            ) : (
              filteredClients.map((c) => (
                <label
                  key={c.id}
                  className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedClients.has(c.id)}
                    onChange={() => toggleClient(c.id)}
                    className="accent-indigo-600"
                  />
                  <span className="text-sm text-slate-700">{c.name}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-white text-slate-600 text-sm rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
        >
          Cancel
        </button>
      </div>

      {/* Reset password */}
      <div className="border-t border-slate-200 pt-4 space-y-3">
        <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">
          Reset Password for {user.username}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">New password</label>
            <input
              type="password"
              value={resetPw}
              onChange={(e) => setResetPw(e.target.value)}
              className={inputClass}
              autoComplete="new-password"
              minLength={8}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Confirm</label>
            <input
              type="password"
              value={resetPwConfirm}
              onChange={(e) => setResetPwConfirm(e.target.value)}
              className={inputClass}
              autoComplete="new-password"
            />
          </div>
        </div>
        {resetError && (
          <div className="text-sm text-red-600">{resetError}</div>
        )}
        {resetSuccess && (
          <div className="text-sm text-emerald-600">Password reset successfully.</div>
        )}
        <button
          onClick={handleResetPassword}
          disabled={resetting || !resetPw}
          className="px-4 py-2 bg-slate-700 text-white text-sm rounded-xl hover:bg-slate-800 disabled:opacity-50 transition-colors"
        >
          {resetting ? "Resetting…" : "Reset Password"}
        </button>
      </div>
    </div>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Create form
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [newRole, setNewRole] = useState<AdminRole>("viewer");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  // Change my password form
  const [currentPw, setCurrentPw] = useState("");
  const [changePw, setChangePw] = useState("");
  const [changePwConfirm, setChangePwConfirm] = useState("");
  const [changingPw, setChangingPw] = useState(false);
  const [changePwError, setChangePwError] = useState<string | null>(null);
  const [changePwSuccess, setChangePwSuccess] = useState(false);

  const loadData = useCallback(async () => {
    const [usersRes, clientsRes] = await Promise.all([
      fetch("/api/admin/users"),
      fetch("/api/admin/clients-list"),
    ]);
    if (usersRes.ok) {
      const data = await usersRes.json();
      setUsers(data.users);
    }
    if (clientsRes.ok) {
      const data = await clientsRes.json();
      setClients(data.clients);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreateSuccess(null);
    if (newPassword !== newPasswordConfirm) {
      setCreateError("Passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      setCreateError("Password must be at least 8 characters");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: newUsername, password: newPassword, role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error || "Failed to create user");
      } else {
        setCreateSuccess(`Account "${newUsername}" created`);
        setNewUsername("");
        setNewPassword("");
        setNewPasswordConfirm("");
        setNewRole("viewer");
        loadData();
      }
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string, uname: string) {
    if (!confirm(`Delete account "${uname}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/admin/users?id=${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) alert(data.error || "Failed to delete user");
    else loadData();
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setChangePwError(null);
    setChangePwSuccess(false);
    if (changePw !== changePwConfirm) {
      setChangePwError("Passwords do not match");
      return;
    }
    setChangingPw(true);
    try {
      const res = await fetch("/api/admin/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: currentPw, new_password: changePw }),
      });
      const data = await res.json();
      if (!res.ok) {
        setChangePwError(data.error || "Failed to change password");
      } else {
        setChangePwSuccess(true);
        setCurrentPw("");
        setChangePw("");
        setChangePwConfirm("");
      }
    } finally {
      setChangingPw(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-10">
      <div>
        <h1 className="text-2xl font-semibold">Admin Accounts</h1>
        <p className="text-slate-500 text-sm mt-1">
          Manage who can access this dashboard and what they can see.
        </p>
      </div>

      {/* ── Accounts list ── */}
      <section>
        <h2 className="text-sm font-medium text-slate-600 uppercase tracking-wider mb-3">
          Accounts
        </h2>
        <GlassCard>
          {loading ? (
            <div className="px-5 py-8 text-center text-slate-400 text-sm">Loading…</div>
          ) : users.length === 0 ? (
            <div className="px-5 py-8 text-center text-slate-400 text-sm">No accounts yet</div>
          ) : (
            <div>
              {users.map((u) => (
                <div key={u.id}>
                  <div className="px-5 py-3.5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div>
                        <div className="text-sm font-medium">{u.username}</div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          Since {new Date(u.created_at).toLocaleDateString()}
                          {u.role === "viewer" && u.assigned_client_ids.length > 0 && (
                            <span className="ml-2">
                              · {u.assigned_client_ids.length} client
                              {u.assigned_client_ids.length !== 1 ? "s" : ""} assigned
                            </span>
                          )}
                        </div>
                      </div>
                      <RoleBadge role={u.role} />
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() =>
                          setEditingId(editingId === u.id ? null : u.id)
                        }
                        className="text-xs text-slate-500 hover:text-indigo-600 transition-colors px-2 py-1 rounded-lg hover:bg-indigo-50 border border-transparent hover:border-indigo-100"
                      >
                        {editingId === u.id ? "Close" : "Edit"}
                      </button>
                      <button
                        onClick={() => handleDelete(u.id, u.username)}
                        className="text-xs text-red-400 hover:text-red-600 transition-colors px-2 py-1 rounded-lg hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  {editingId === u.id && (
                    <EditPanel
                      user={u}
                      clients={clients}
                      onSave={() => {
                        setEditingId(null);
                        loadData();
                      }}
                      onClose={() => setEditingId(null)}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </section>

      {/* ── Create account ── */}
      <section>
        <h2 className="text-sm font-medium text-slate-600 uppercase tracking-wider mb-3">
          Create Account
        </h2>
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
                <input
                  type="text"
                  className={inputClass}
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  required
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                <select
                  className={inputClass}
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as AdminRole)}
                >
                  <option value="viewer">Viewer — assigned clients only</option>
                  <option value="admin">Admin — full access</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  className={inputClass}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  minLength={8}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Confirm Password</label>
                <input
                  type="password"
                  className={inputClass}
                  value={newPasswordConfirm}
                  onChange={(e) => setNewPasswordConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>
            </div>

            {createError && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                {createError}
              </div>
            )}
            {createSuccess && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-700">
                {createSuccess}
              </div>
            )}

            <button
              type="submit"
              disabled={creating}
              className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {creating ? "Creating…" : "Create Account"}
            </button>
          </form>
        </div>
      </section>

      {/* ── Change my password ── */}
      <section>
        <h2 className="text-sm font-medium text-slate-600 uppercase tracking-wider mb-3">
          Change My Password
        </h2>
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Current Password</label>
              <input
                type="password"
                className={inputClass}
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
                <input
                  type="password"
                  className={inputClass}
                  value={changePw}
                  onChange={(e) => setChangePw(e.target.value)}
                  required
                  autoComplete="new-password"
                  minLength={8}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  className={inputClass}
                  value={changePwConfirm}
                  onChange={(e) => setChangePwConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>
            </div>

            {changePwError && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                {changePwError}
              </div>
            )}
            {changePwSuccess && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-700">
                Password changed successfully.
              </div>
            )}

            <button
              type="submit"
              disabled={changingPw}
              className="px-5 py-2.5 bg-slate-700 text-white text-sm font-medium rounded-xl hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              {changingPw ? "Updating…" : "Update Password"}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
