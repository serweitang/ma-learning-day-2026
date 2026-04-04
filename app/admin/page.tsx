"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { AdminGuard } from "@/components/AdminGuard";
import { useAuth } from "@/components/AuthProvider";
import { createMa, createUserInvite, deleteMa, listMas, listUsers, updateUserRole } from "@/lib/firestore";
import type { ForumUser, MA, UserRole } from "@/types";

// ── CSV helpers ──────────────────────────────────────────────────────────────

interface CsvRow {
  name: string;
  joinYear: number | null;
  department: string;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') {
      inQuotes = !inQuotes;
    } else if (line[i] === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += line[i];
    }
  }
  result.push(current.trim());
  return result;
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, ""));
  const nameIdx = headers.findIndex((h) => h.includes("name"));
  const yearIdx = headers.findIndex((h) => h.includes("year"));
  const rotationIdx = headers.findIndex((h) => h.includes("rotation") || h.includes("presenting"));
  return lines
    .slice(1)
    .map((line) => {
      const cols = parseCsvLine(line);
      const rawYear = parseInt(cols[yearIdx] ?? "", 10);
      return {
        name: cols[nameIdx]?.trim() ?? "",
        joinYear: isNaN(rawYear) ? null : rawYear,
        department: cols[rotationIdx]?.trim() ?? "",
      };
    })
    .filter((r) => r.name);
}

export default function AdminPage() {
  return (
    <AdminGuard>
      <AdminPanel />
    </AdminGuard>
  );
}

function AdminPanel() {
  const { refreshForumUser } = useAuth();
  const [users, setUsers] = useState<ForumUser[]>([]);
  const [mas, setMas] = useState<MA[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("viewer");
  const [inviteMaId, setInviteMaId] = useState<string>("");
  const [inviteBusy, setInviteBusy] = useState(false);

  // Add MA form
  const [maName, setMaName] = useState("");
  const [maDepartment, setMaDepartment] = useState("");
  const [maJoinYear, setMaJoinYear] = useState<string>("");
  const [maBio, setMaBio] = useState("");
  const [maBusy, setMaBusy] = useState(false);
  const [maSuccess, setMaSuccess] = useState<string | null>(null);

  // CSV bulk import
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvResult, setCsvResult] = useState<string | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setError(null);
    try {
      const [userList, maList] = await Promise.all([listUsers(), listMas()]);
      setUsers(userList.sort((a, b) => a.email.localeCompare(b.email)));
      setMas(maList);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const onSave = async (uid: string, role: UserRole, maId: string | null) => {
    setError(null);
    try {
      await updateUserRole(uid, role, maId);
      await load();
      await refreshForumUser();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update role");
    }
  };

  const onInvite = async (e: FormEvent) => {
    e.preventDefault();
    setInviteBusy(true);
    setError(null);
    try {
      await createUserInvite(
        inviteEmail,
        inviteRole,
        inviteRole === "ma" ? inviteMaId || null : null
      );
      setInviteEmail("");
      setInviteMaId("");
      setInviteRole("viewer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invite failed");
    } finally {
      setInviteBusy(false);
    }
  };

  const onAddMa = async (e: FormEvent) => {
    e.preventDefault();
    setMaBusy(true);
    setMaSuccess(null);
    setError(null);
    try {
      const parsedYear = parseInt(maJoinYear, 10);
      await createMa({
        name: maName,
        department: maDepartment,
        bio: maBio,
        joinYear: isNaN(parsedYear) ? null : parsedYear,
      });
      setMaName("");
      setMaDepartment("");
      setMaJoinYear("");
      setMaBio("");
      setMaSuccess(`Profile for "${maName}" added successfully.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add profile");
    } finally {
      setMaBusy(false);
    }
  };

  const onCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      setCsvRows(parseCsv(text));
      setCsvResult(null);
      setCsvError(null);
    };
    reader.readAsText(file);
  };

  const onBulkImport = async () => {
    setCsvImporting(true);
    setCsvResult(null);
    setCsvError(null);
    try {
      const existing = await listMas();
      const existingNames = new Set(existing.map((m) => m.name.trim().toLowerCase()));
      const toImport = csvRows.filter((r) => !existingNames.has(r.name.trim().toLowerCase()));
      await Promise.all(
        toImport.map((r) => createMa({ name: r.name, department: r.department, bio: "", joinYear: r.joinYear }))
      );
      const skipped = csvRows.length - toImport.length;
      setCsvResult(
        `Imported ${toImport.length} profile(s).${skipped > 0 ? ` Skipped ${skipped} duplicate(s).` : ""}`
      );
      setCsvRows([]);
      if (csvInputRef.current) csvInputRef.current.value = "";
      await load();
    } catch (err) {
      setCsvError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setCsvImporting(false);
    }
  };

  const onDeleteMa = async (ma: MA) => {
    if (!confirm(`Delete profile for "${ma.name}"? This cannot be undone.`)) return;
    setError(null);
    try {
      await deleteMa(ma.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete profile");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-garena-dark/60">Loading…</div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold text-garena-dark">Admin panel</h1>

      {error && (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      )}

      {/* ── Add MA Profile ── */}
      <section className="mt-10 rounded-xl border border-black/10 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-garena-dark">Add MA profile</h2>
        <p className="mt-1 text-xs text-garena-dark/55">Creates a new MA entry in the database.</p>
        {maSuccess && (
          <p className="mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
            {maSuccess}
          </p>
        )}
        <form className="mt-4 flex flex-col gap-3" onSubmit={(e) => void onAddMa(e)}>
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="flex min-w-[200px] flex-1 flex-col text-sm font-medium text-garena-dark">
              Name
              <input
                className="mt-1 rounded-md border border-black/15 px-3 py-2 font-normal"
                type="text"
                required
                placeholder="Full name"
                value={maName}
                onChange={(e) => setMaName(e.target.value)}
              />
            </label>
            <label className="flex min-w-[180px] flex-1 flex-col text-sm font-medium text-garena-dark">
              Presenting Rotation
              <input
                className="mt-1 rounded-md border border-black/15 px-3 py-2 font-normal"
                type="text"
                required
                placeholder="e.g. Free Fire Regional Ops"
                value={maDepartment}
                onChange={(e) => setMaDepartment(e.target.value)}
              />
            </label>
            <label className="flex w-28 flex-col text-sm font-medium text-garena-dark">
              Join Year
              <input
                className="mt-1 rounded-md border border-black/15 px-3 py-2 font-normal"
                type="number"
                placeholder="2026"
                min={2020}
                max={2100}
                value={maJoinYear}
                onChange={(e) => setMaJoinYear(e.target.value)}
              />
            </label>
          </div>
          <label className="flex flex-col text-sm font-medium text-garena-dark">
            Bio (optional)
            <textarea
              className="mt-1 rounded-md border border-black/15 px-3 py-2 font-normal"
              rows={3}
              placeholder="Short bio…"
              value={maBio}
              onChange={(e) => setMaBio(e.target.value)}
            />
          </label>
          <div>
            <button
              type="submit"
              disabled={maBusy}
              className="rounded-md bg-garena-red px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {maBusy ? "Adding…" : "Add profile"}
            </button>
          </div>
        </form>
      </section>

      {/* ── MA Profiles List ── */}
      <section className="mt-10 overflow-x-auto rounded-xl border border-black/10 bg-white shadow-sm">
        <div className="px-6 py-4 border-b border-black/10">
          <h2 className="text-lg font-semibold text-garena-dark">MA profiles ({mas.length})</h2>
        </div>
        <table className="min-w-full divide-y divide-black/10 text-left text-sm">
          <thead className="bg-garena-bg/80 text-xs font-semibold uppercase tracking-wide text-garena-dark/60">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Rotation</th>
              <th className="px-4 py-3">Join Year</th>
              <th className="px-4 py-3">Memo</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {mas.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-garena-dark/50">
                  No profiles yet — add one above or use bulk import.
                </td>
              </tr>
            )}
            {mas.map((m) => (
              <tr key={m.id} className="text-garena-dark">
                <td className="px-4 py-3 font-medium">{m.name}</td>
                <td className="px-4 py-3 text-garena-dark/70">{m.department || "—"}</td>
                <td className="px-4 py-3 text-garena-dark/70">{m.joinYear ?? "—"}</td>
                <td className="px-4 py-3">
                  {m.hasMemo ? (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Uploaded</span>
                  ) : (
                    <span className="text-xs text-garena-dark/40">None</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => void onDeleteMa(m)}
                    className="rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* ── Bulk Import CSV ── */}
      <section className="mt-10 rounded-xl border border-black/10 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-garena-dark">Bulk import from CSV</h2>
        <p className="mt-1 text-xs text-garena-dark/55">
          Expected columns: <code className="rounded bg-black/5 px-1">Full Name</code>,{" "}
          <code className="rounded bg-black/5 px-1">Join Year</code>,{" "}
          <code className="rounded bg-black/5 px-1">Presenting Rotation</code>. Duplicates matched by name are skipped.
        </p>

        {csvError && (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{csvError}</p>
        )}
        {csvResult && (
          <p className="mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{csvResult}</p>
        )}

        <div className="mt-4">
          <input ref={csvInputRef} type="file" accept=".csv" className="text-sm text-garena-dark" onChange={onCsvFile} />
        </div>

        {csvRows.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-sm text-garena-dark/70">{csvRows.length} row(s) parsed — review before importing:</p>
            <div className="overflow-x-auto rounded-md border border-black/10">
              <table className="min-w-full text-sm">
                <thead className="bg-garena-bg/80">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-garena-dark/60">Name</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-garena-dark/60">Join Year</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-garena-dark/60">Rotation</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-garena-dark/60">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {csvRows.map((r, i) => {
                    const isDup = mas.some((m) => m.name.trim().toLowerCase() === r.name.trim().toLowerCase());
                    return (
                      <tr key={i} className={isDup ? "opacity-40" : ""}>
                        <td className="px-3 py-2 font-medium text-garena-dark">{r.name}</td>
                        <td className="px-3 py-2 text-garena-dark/70">{r.joinYear ?? "—"}</td>
                        <td className="px-3 py-2 text-garena-dark/70">{r.department}</td>
                        <td className="px-3 py-2">
                          {isDup ? (
                            <span className="text-xs text-garena-dark/40">skip (duplicate)</span>
                          ) : (
                            <span className="text-xs font-medium text-green-600">will import</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              onClick={() => void onBulkImport()}
              disabled={csvImporting || csvRows.every((r) => mas.some((m) => m.name.trim().toLowerCase() === r.name.trim().toLowerCase()))}
              className="mt-3 rounded-md bg-garena-red px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {csvImporting ? "Importing…" : "Import profiles"}
            </button>
          </div>
        )}
      </section>

      {/* ── Invite by email ── */}
      <section className="mt-10 rounded-xl border border-black/10 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-garena-dark">Add / invite by email</h2>
        <p className="mt-1 text-xs text-garena-dark/55">
          Creates a <code className="rounded bg-black/5 px-1">userInvites</code> document. On first successful login with
          that email, the role (and optional MA link) is applied, then the invite is removed.
        </p>
        <form className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end" onSubmit={(e) => void onInvite(e)}>
          <label className="flex min-w-[220px] flex-1 flex-col text-sm font-medium text-garena-dark">
            Email
            <input
              className="mt-1 rounded-md border border-black/15 px-3 py-2 font-normal"
              type="email"
              required
              placeholder="colleague@garena.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
          </label>
          <label className="flex flex-col text-sm font-medium text-garena-dark">
            Role
            <select
              className="mt-1 rounded-md border border-black/15 px-3 py-2 font-normal"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as UserRole)}
            >
              <option value="viewer">viewer</option>
              <option value="ma">ma</option>
              <option value="admin">admin</option>
            </select>
          </label>
          {inviteRole === "ma" && (
            <label className="flex min-w-[180px] flex-col text-sm font-medium text-garena-dark">
              MA profile
              <select
                className="mt-1 rounded-md border border-black/15 px-3 py-2 font-normal"
                value={inviteMaId}
                onChange={(e) => setInviteMaId(e.target.value)}
                required
              >
                <option value="">Select…</option>
                {mas.length === 0 && (
                  <option disabled>No profiles yet — add one above</option>
                )}
                {mas.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name || m.id}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            type="submit"
            disabled={inviteBusy}
            className="rounded-md bg-garena-red px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Save invite
          </button>
        </form>
      </section>

      {/* ── Users table ── */}
      <section className="mt-10 overflow-x-auto rounded-xl border border-black/10 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-black/10 text-left text-sm">
          <thead className="bg-garena-bg/80 text-xs font-semibold uppercase tracking-wide text-garena-dark/60">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">MA profile</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {users.map((u) => (
              <UserRow key={u.uid} user={u} mas={mas} onSave={onSave} />
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-garena-dark/50">
                  No users yet — sign in once after configuring Firebase to bootstrap the first account.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function UserRow({
  user,
  mas,
  onSave,
}: {
  user: ForumUser;
  mas: MA[];
  onSave: (uid: string, role: UserRole, maId: string | null) => void;
}) {
  const [role, setRole] = useState<UserRole>(user.role);
  const [maId, setMaId] = useState<string>(user.maId ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setRole(user.role);
    setMaId(user.maId ?? "");
  }, [user.uid, user.role, user.maId]);

  const dirty =
    role !== user.role || (role === "ma" && maId !== (user.maId ?? ""));
  const canSave = dirty && !(role === "ma" && !maId);

  const save = async () => {
    setSaving(true);
    try {
      await onSave(user.uid, role, role === "ma" ? maId || null : null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr className="text-garena-dark">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {user.photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.photoURL} alt="" className="h-8 w-8 rounded-full border border-black/10" />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-garena-bg text-xs font-bold">
              {user.displayName?.charAt(0)?.toUpperCase() ?? "?"}
            </span>
          )}
          <span className="font-medium">{user.displayName ?? "—"}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-garena-dark/80">{user.email ?? "—"}</td>
      <td className="px-4 py-3">
        <select
          className="rounded-md border border-black/15 px-2 py-1"
          value={role}
          onChange={(e) => setRole(e.target.value as UserRole)}
        >
          <option value="viewer">viewer</option>
          <option value="ma">ma</option>
          <option value="admin">admin</option>
        </select>
      </td>
      <td className="px-4 py-3">
        {role === "ma" ? (
          <select
            className="w-full min-w-[160px] rounded-md border border-black/15 px-2 py-1"
            value={maId}
            onChange={(e) => setMaId(e.target.value)}
          >
            <option value="">Select…</option>
            {mas.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name || m.id}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-garena-dark/40">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <button
          type="button"
          disabled={!canSave || saving}
          onClick={() => void save()}
          className="rounded-md bg-garena-dark px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
        >
          Save
        </button>
      </td>
    </tr>
  );
}
