import { useEffect, useRef, useState } from "react";
import { ChevronRight, UserRound, X } from "lucide-react";
import { fetchMyAccount } from "../lib/api";
import { cacheAccount, getToken } from "../lib/auth";
import type { AuthUser } from "../types/domain";

export function AccountDetails({ user }: { user: AuthUser }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [account, setAccount] = useState(user);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user.role !== "student") return;
    let cancelled = false;
    const token = getToken();
    const refresh = async () => {
      if (!navigator.onLine || !token) return;
      setLoading(true);
      try {
        const result = await fetchMyAccount();
        if (cancelled || getToken() !== token || result.user?.id !== user.id) return;
        setAccount(result.user);
        cacheAccount(token, result.user);
      } catch {
        // Keep the last known enrollment available when offline.
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void refresh();
    window.addEventListener("online", refresh);
    return () => { cancelled = true; window.removeEventListener("online", refresh); };
  }, [user.id, user.role, refreshVersion]);

  const enrollmentLabel = (value: string | null | undefined) => value === undefined
    ? (loading ? "Loading…" : "Connect to the internet to load this detail.")
    : value || "Not assigned";
  const role = user.role === "teacher" ? "Teacher" : "Student";
  const createdAt = new Date(user.createdAt);
  const joined = Number.isNaN(createdAt.getTime()) ? "Not available" : createdAt.toLocaleDateString(undefined, {
    year: "numeric", month: "long", day: "numeric",
  });

  return (
    <>
      <button
        type="button"
        className="account-indicator"
        aria-label={`View account details for ${user.name} (@${user.username}), ${role}`}
        aria-haspopup="dialog"
        onClick={() => { dialog.current?.showModal(); setRefreshVersion(current => current + 1); }}
      >
        <span className="account-avatar" aria-hidden="true"><UserRound size={20} /></span>
        <span className="account-identity">
          <strong>{user.name}</strong>
          <span>@{user.username}</span>
        </span>
        <span className="account-details-label"><strong>{role}</strong><span>Account details</span></span>
        <ChevronRight size={18} aria-hidden="true" />
      </button>
      <dialog ref={dialog} className="account-dialog" aria-labelledby="account-details-title">
        <div className="account-dialog-heading">
          <div>
            <p className="eyebrow">Signed in as {role}</p>
            <h2 id="account-details-title">Account details</h2>
          </div>
          <button type="button" className="account-close" aria-label="Close account details" onClick={() => dialog.current?.close()}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <dl className="account-fields">
          <div><dt>Full name</dt><dd>{user.name}</dd></div>
          <div><dt>Username</dt><dd>@{user.username}</dd></div>
          <div><dt>Account type</dt><dd>{role}</dd></div>
          {user.role === "student" && <>
            <div><dt>Teacher</dt><dd>{enrollmentLabel(account.teacherName)}</dd></div>
            <div><dt>Section / Class</dt><dd>{enrollmentLabel(account.sectionName)}</dd></div>
          </>}
          <div><dt>Account created</dt><dd>{joined}</dd></div>
        </dl>
      </dialog>
    </>
  );
}
