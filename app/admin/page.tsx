"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { AdminGuard } from "@/components/AdminGuard";
import { useAuth } from "@/components/AuthProvider";
import { createMa, createUser, deleteMa, getUserByEmail, listMas, listUsers, updateMaBulk, updateMaProfile, updateUserRole } from "@/lib/firestore";
import type { ForumUser, MA, Rotation, RotationLabel, UserRole } from "@/types";

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

interface UserCsvRow {
  name: string;
  email: string;
  role: UserRole;
  error: string | null;
}

function parseUserCsv(text: string): UserCsvRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, ""));
  const nameIdx = headers.findIndex((h) => h.includes("name"));
  const emailIdx = headers.findIndex((h) => h.includes("email"));
  const roleIdx = headers.findIndex((h) => h.includes("role"));

  return lines.slice(1).map((line) => {
    const cols = parseCsvLine(line);
    const name = cols[nameIdx]?.trim() ?? "";
    const email = cols[emailIdx]?.trim().toLowerCase() ?? "";
    const rawRole = cols[roleIdx]?.trim().toLowerCase() ?? "viewer";
    const role: UserRole = ["admin", "ma", "viewer"].includes(rawRole) ? (rawRole as UserRole) : "viewer";

    let error: string | null = null;
    if (!name) error = "Missing name";
    else if (!email || !email.includes("@")) error = "Invalid email";

    return { name, email, role, error };
  }).filter((r) => r.name || r.email);
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

  // MA table (order + presenting)
  const [tableRows, setTableRows] = useState<MA[]>([]);
  const [tableSaving, setTableSaving] = useState(false);
  const [tableSaved, setTableSaved] = useState(false);

  // Create user form
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createRole, setCreateRole] = useState<UserRole>("viewer");
  const [createMaId, setCreateMaId] = useState<string>("");
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  // User CSV import
  const [userCsvRows, setUserCsvRows] = useState<UserCsvRow[]>([]);
  const [userCsvImporting, setUserCsvImporting] = useState(false);
  const [userCsvResult, setUserCsvResult] = useState<string | null>(null);
  const [userCsvError, setUserCsvError] = useState<string | null>(null);
  const [userCsvDuplicates, setUserCsvDuplicates] = useState<string[]>([]);
  const [userCsvConfirming, setUserCsvConfirming] = useState(false);
  const userCsvInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    setTableRows(mas);
    setTableSaved(false);
  }, [mas]);

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

  const onCreateUser = async (e: FormEvent) => {
    e.preventDefault();
    setCreateBusy(true);
    setCreateError(null);
    setCreateSuccess(null);
    try {
      const existing = await getUserByEmail(createEmail);
      if (existing) {
        const confirmed = confirm(`A pending account for ${createEmail} already exists. Overwrite it?`);
        if (!confirmed) {
          setCreateBusy(false);
          return;
        }
      }
      await createUser({
        name: createName,
        email: createEmail,
        role: createRole,
        maId: createRole === "ma" ? createMaId || null : null,
      });
      setCreateSuccess(`Account created for ${createEmail}. They will receive their role on first login.`);
      setCreateName("");
      setCreateEmail("");
      setCreateRole("viewer");
      setCreateMaId("");
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create user. Please try again.");
    } finally {
      setCreateBusy(false);
    }
  };

  const onUserCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      setUserCsvRows(parseUserCsv(text));
      setUserCsvResult(null);
      setUserCsvError(null);
      setUserCsvDuplicates([]);
      setUserCsvConfirming(false);
    };
    reader.readAsText(file);
  };

  const onUserBulkImport = async (overwrite: boolean) => {
    setUserCsvImporting(true);
    setUserCsvResult(null);
    setUserCsvError(null);
    try {
      const existingUsers = await listUsers();
      const existingEmails = new Set(existingUsers.map((u) => u.email?.toLowerCase()));

      const duplicates = userCsvRows.filter((r) => existingEmails.has(r.email.toLowerCase())).map((r) => r.email);

      if (!overwrite && duplicates.length > 0) {
        setUserCsvDuplicates(duplicates);
        setUserCsvConfirming(true);
        setUserCsvImporting(false);
        return;
      }

      const toImport = overwrite ? userCsvRows : userCsvRows.filter((r) => !existingEmails.has(r.email.toLowerCase()));
      await Promise.all(toImport.map((r) => createUser({ name: r.name, email: r.email, role: r.role })));
      const skipped = userCsvRows.length - toImport.length;
      setUserCsvResult(`Created ${toImport.length} account(s).${skipped > 0 ? ` Skipped ${skipped} duplicate(s).` : ""}`);
      setUserCsvRows([]);
      setUserCsvDuplicates([]);
      setUserCsvConfirming(false);
      if (userCsvInputRef.current) userCsvInputRef.current.value = "";
    } catch (err) {
      setUserCsvError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setUserCsvImporting(false);
    }
  };

  const moveRow = (index: number, direction: -1 | 1) => {
    const next = [...tableRows];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setTableRows(next);
    setTableSaved(false);
  };

  const setRowPresenting = (index: number, value: boolean | null) => {
    const next = [...tableRows];
    next[index] = { ...next[index], isPresenting: value };
    setTableRows(next);
    setTableSaved(false);
  };

  const saveTable = async () => {
    setTableSaving(true);
    try {
      await updateMaBulk(tableRows.map((m, i) => ({ id: m.id, order: i, isPresenting: m.isPresenting })));
      setTableSaved(true);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save changes");
    } finally {
      setTableSaving(false);
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

      {/* ── MA Profiles — order, presenting tag, memo, delete ── */}
      <section className="mt-10 rounded-xl border border-black/10 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-black/10 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-garena-dark">MA profiles ({mas.length})</h2>
            <p className="mt-0.5 text-xs text-garena-dark/55">Reorder with arrows, set presenting status, then click Save changes.</p>
          </div>
          <div className="flex items-center gap-3">
            {tableSaved && <span className="text-sm text-green-600">Saved.</span>}
            <button
              type="button"
              onClick={() => void saveTable()}
              disabled={tableSaving}
              className="rounded-md bg-garena-red px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {tableSaving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-black/10 text-left text-sm">
            <thead className="bg-garena-bg/80 text-xs font-semibold uppercase tracking-wide text-garena-dark/60">
              <tr>
                <th className="px-4 py-3 w-10">#</th>
                <th className="px-4 py-3 w-16">Order</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Rotation</th>
                <th className="px-4 py-3">Presenting</th>
                <th className="px-4 py-3">Memo</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {tableRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-garena-dark/50">
                    No profiles yet — add one above or use bulk import.
                  </td>
                </tr>
              )}
              {tableRows.map((m, i) => (
                <MATableRow
                  key={m.id}
                  m={m}
                  i={i}
                  total={tableRows.length}
                  onMoveUp={() => moveRow(i, -1)}
                  onMoveDown={() => moveRow(i, 1)}
                  onPresenting={(v) => setRowPresenting(i, v)}
                  onDelete={() => void onDeleteMa(m)}
                  onProfileSaved={load}
                />
              ))}
            </tbody>
          </table>
        </div>
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

      {/* ── Create user (manual) ── */}
      <section className="mt-10 rounded-xl border border-black/10 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-garena-dark">Create user account</h2>
        <p className="mt-1 text-xs text-garena-dark/55">
          Pre-creates an account. The role and MA link are applied automatically when they first sign in with Google.
        </p>
        <form className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end" onSubmit={(e) => void onCreateUser(e)}>
          <label className="flex min-w-[180px] flex-1 flex-col text-sm font-medium text-garena-dark">
            Name
            <input
              className="mt-1 rounded-md border border-black/15 px-3 py-2 font-normal"
              type="text"
              required
              placeholder="Full name"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
            />
          </label>
          <label className="flex min-w-[220px] flex-1 flex-col text-sm font-medium text-garena-dark">
            Email
            <input
              className="mt-1 rounded-md border border-black/15 px-3 py-2 font-normal"
              type="email"
              required
              placeholder="colleague@garena.com"
              value={createEmail}
              onChange={(e) => setCreateEmail(e.target.value)}
            />
          </label>
          <label className="flex flex-col text-sm font-medium text-garena-dark">
            Role
            <select
              className="mt-1 rounded-md border border-black/15 px-3 py-2 font-normal"
              value={createRole}
              onChange={(e) => setCreateRole(e.target.value as UserRole)}
            >
              <option value="viewer">viewer</option>
              <option value="ma">ma</option>
              <option value="admin">admin</option>
            </select>
          </label>
          {createRole === "ma" && (
            <label className="flex min-w-[180px] flex-col text-sm font-medium text-garena-dark">
              MA profile
              <select
                className="mt-1 rounded-md border border-black/15 px-3 py-2 font-normal"
                value={createMaId}
                onChange={(e) => setCreateMaId(e.target.value)}
                required
              >
                <option value="">Select…</option>
                {mas.map((m) => (
                  <option key={m.id} value={m.id}>{m.name || m.id}</option>
                ))}
              </select>
            </label>
          )}
          <button
            type="submit"
            disabled={createBusy}
            className="rounded-md bg-garena-red px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {createBusy ? "Creating…" : "Create account"}
          </button>
        </form>
        {createError && (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{createError}</p>
        )}
        {createSuccess && (
          <p className="mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{createSuccess}</p>
        )}
      </section>

      {/* ── Bulk create users from CSV ── */}
      <section className="mt-10 rounded-xl border border-black/10 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-garena-dark">Bulk create users from CSV</h2>
        <p className="mt-1 text-xs text-garena-dark/55">
          Expected columns: <code className="rounded bg-black/5 px-1">Name</code>,{" "}
          <code className="rounded bg-black/5 px-1">Email</code>,{" "}
          <code className="rounded bg-black/5 px-1">Role</code> (viewer / ma / admin).
        </p>

        {userCsvError && (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{userCsvError}</p>
        )}
        {userCsvResult && (
          <p className="mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{userCsvResult}</p>
        )}

        <div className="mt-4">
          <input ref={userCsvInputRef} type="file" accept=".csv" className="text-sm text-garena-dark" onChange={onUserCsvFile} />
        </div>

        {userCsvRows.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-sm text-garena-dark/70">{userCsvRows.length} row(s) parsed — review before importing:</p>
            <div className="overflow-x-auto rounded-md border border-black/10">
              <table className="min-w-full text-sm">
                <thead className="bg-garena-bg/80">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-garena-dark/60">Name</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-garena-dark/60">Email</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-garena-dark/60">Role</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-garena-dark/60">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {userCsvRows.map((r, i) => (
                    <tr key={i} className={r.error ? "bg-red-50" : ""}>
                      <td className="px-3 py-2 font-medium text-garena-dark">{r.name || "—"}</td>
                      <td className="px-3 py-2 text-garena-dark/70">{r.email || "—"}</td>
                      <td className="px-3 py-2 text-garena-dark/70">{r.role}</td>
                      <td className="px-3 py-2">
                        {r.error ? (
                          <span className="text-xs font-medium text-red-600">{r.error}</span>
                        ) : (
                          <span className="text-xs font-medium text-green-600">will create</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {userCsvConfirming && (
              <div className="mt-3 rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3">
                <p className="text-sm font-medium text-yellow-800">
                  The following emails already have accounts and will be overwritten:{" "}
                  <span className="font-normal">{userCsvDuplicates.join(", ")}</span>
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => void onUserBulkImport(true)}
                    disabled={userCsvImporting}
                    className="rounded-md bg-yellow-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Yes, overwrite
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUserCsvRows([]);
                      setUserCsvConfirming(false);
                      setUserCsvDuplicates([]);
                      if (userCsvInputRef.current) userCsvInputRef.current.value = "";
                    }}
                    className="rounded-md border border-black/15 px-3 py-1.5 text-sm font-semibold text-garena-dark"
                  >
                    No, re-upload
                  </button>
                </div>
              </div>
            )}

            {!userCsvConfirming && (
              <button
                type="button"
                onClick={() => void onUserBulkImport(false)}
                disabled={userCsvImporting || userCsvRows.every((r) => !!r.error)}
                className="mt-3 rounded-md bg-garena-red px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {userCsvImporting ? "Creating…" : "Create accounts"}
              </button>
            )}
          </div>
        )}
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

// ── URL validation helper ─────────────────────────────────────────────────────

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// ── MA Table Row (with inline profile editor) ─────────────────────────────────

const ROTATION_LABELS: RotationLabel[] = ["R1", "R2", "R3", "R4"];

function emptyRotation(label: RotationLabel): Rotation {
  return { label, department: "", learningMemoUrl: null, presentationUrl: null };
}

function MATableRow({
  m,
  i,
  total,
  onMoveUp,
  onMoveDown,
  onPresenting,
  onDelete,
  onProfileSaved,
}: {
  m: MA;
  i: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onPresenting: (v: boolean | null) => void;
  onDelete: () => void;
  onProfileSaved: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [joinYear, setJoinYear] = useState<string>(m.joinYear?.toString() ?? "");
  const [school, setSchool] = useState<string>(m.school ?? "");
  const [rotations, setRotations] = useState<Rotation[]>(
    m.rotations.length > 0 ? m.rotations : []
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Reset local state when parent MA changes (e.g. after reload)
  useEffect(() => {
    setJoinYear(m.joinYear?.toString() ?? "");
    setSchool(m.school ?? "");
    setRotations(m.rotations.length > 0 ? m.rotations : []);
  }, [m.joinYear, m.school, m.rotations]);

  const addRotation = () => {
    const usedLabels = new Set(rotations.map((r) => r.label));
    const next = ROTATION_LABELS.find((l) => !usedLabels.has(l));
    if (!next) return;
    setRotations([...rotations, emptyRotation(next)]);
  };

  const removeRotation = (idx: number) => {
    setRotations(rotations.filter((_, i) => i !== idx));
  };

  const updateRotation = (idx: number, patch: Partial<Rotation>) => {
    setRotations(rotations.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const onSaveProfile = async () => {
    setSaveError(null);
    setSaveSuccess(false);

    // Validate URLs
    for (const r of rotations) {
      if (!r.department.trim()) {
        setSaveError(`${r.label}: department name is required.`);
        return;
      }
      if (r.learningMemoUrl && !isValidUrl(r.learningMemoUrl)) {
        setSaveError(`${r.label}: Learning Memo URL is not a valid URL.`);
        return;
      }
      if (r.presentationUrl && !isValidUrl(r.presentationUrl)) {
        setSaveError(`${r.label}: Presentation URL is not a valid URL.`);
        return;
      }
    }

    const parsedYear = parseInt(joinYear, 10);
    setSaving(true);
    try {
      await updateMaProfile(m.id, {
        joinYear: isNaN(parsedYear) ? null : parsedYear,
        school: school.trim() || null,
        rotations,
      });
      setSaveSuccess(true);
      await onProfileSaved();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <tr className="text-garena-dark">
        <td className="px-4 py-3 text-xs text-garena-dark/40">{i + 1}</td>
        <td className="px-4 py-3">
          <div className="flex gap-1">
            <button
              type="button"
              onClick={onMoveUp}
              disabled={i === 0}
              className="rounded px-1.5 py-0.5 text-xs hover:bg-black/5 disabled:opacity-20"
              title="Move up"
            >▲</button>
            <button
              type="button"
              onClick={onMoveDown}
              disabled={i === total - 1}
              className="rounded px-1.5 py-0.5 text-xs hover:bg-black/5 disabled:opacity-20"
              title="Move down"
            >▼</button>
          </div>
        </td>
        <td className="px-4 py-3 font-medium">{m.name}</td>
        <td className="px-4 py-3 text-garena-dark/70">{m.department || "—"}</td>
        <td className="px-4 py-3">
          <select
            className="rounded-md border border-black/15 px-2 py-1 text-xs"
            value={m.isPresenting === null ? "" : m.isPresenting ? "true" : "false"}
            onChange={(e) => onPresenting(e.target.value === "" ? null : e.target.value === "true")}
          >
            <option value="">Not set</option>
            <option value="true">Presenting MA</option>
            <option value="false">Non-Presenting MA</option>
          </select>
        </td>
        <td className="px-4 py-3">
          {m.hasMemo ? (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Uploaded</span>
          ) : (
            <span className="text-xs text-garena-dark/40">None</span>
          )}
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditing(!editing)}
              className="rounded-md border border-black/15 px-3 py-1 text-xs font-medium text-garena-dark hover:bg-black/5"
            >
              {editing ? "Close" : "Edit profile"}
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
            >
              Delete
            </button>
          </div>
        </td>
      </tr>
      {editing && (
        <tr className="bg-garena-bg/40">
          <td colSpan={7} className="px-6 py-4">
            <div className="max-w-2xl space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-garena-dark/50">
                Profile details — {m.name}
              </p>

              {saveError && (
                <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{saveError}</p>
              )}
              {saveSuccess && (
                <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">Saved.</p>
              )}

              {/* Join Year + School */}
              <div className="flex flex-wrap gap-3">
                <label className="flex w-36 flex-col text-xs font-medium text-garena-dark">
                  Join Year
                  <input
                    className="mt-1 rounded-md border border-black/15 px-2 py-1.5 text-sm font-normal"
                    type="number"
                    placeholder="2026"
                    min={2020}
                    max={2100}
                    value={joinYear}
                    onChange={(e) => setJoinYear(e.target.value)}
                  />
                </label>
                <label className="flex min-w-[200px] flex-1 flex-col text-xs font-medium text-garena-dark">
                  School
                  <input
                    className="mt-1 rounded-md border border-black/15 px-2 py-1.5 text-sm font-normal"
                    type="text"
                    placeholder="e.g. NUS Business School"
                    value={school}
                    onChange={(e) => setSchool(e.target.value)}
                  />
                </label>
              </div>

              {/* Rotations */}
              <div>
                <p className="mb-2 text-xs font-medium text-garena-dark">Past Rotations (max 4)</p>
                <div className="space-y-3">
                  {rotations.map((r, idx) => (
                    <div key={r.label} className="rounded-lg border border-black/10 bg-white p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="rounded-full bg-garena-red/10 px-2 py-0.5 text-xs font-semibold text-garena-red">
                          {r.label}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeRotation(idx)}
                          className="text-xs text-red-500 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="space-y-2">
                        <input
                          className="w-full rounded-md border border-black/15 px-2 py-1.5 text-sm"
                          type="text"
                          placeholder="Department name"
                          value={r.department}
                          onChange={(e) => updateRotation(idx, { department: e.target.value })}
                        />
                        <input
                          className="w-full rounded-md border border-black/15 px-2 py-1.5 text-sm"
                          type="url"
                          placeholder="Learning Memo URL (optional)"
                          value={r.learningMemoUrl ?? ""}
                          onChange={(e) => updateRotation(idx, { learningMemoUrl: e.target.value || null })}
                        />
                        <input
                          className="w-full rounded-md border border-black/15 px-2 py-1.5 text-sm"
                          type="url"
                          placeholder="Presentation URL (optional)"
                          value={r.presentationUrl ?? ""}
                          onChange={(e) => updateRotation(idx, { presentationUrl: e.target.value || null })}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                {rotations.length < 4 && (
                  <button
                    type="button"
                    onClick={addRotation}
                    className="mt-2 rounded-md border border-black/15 px-3 py-1.5 text-xs font-medium text-garena-dark hover:bg-black/5"
                  >
                    + Add rotation
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => void onSaveProfile()}
                disabled={saving}
                className="rounded-md bg-garena-red px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save profile"}
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
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
