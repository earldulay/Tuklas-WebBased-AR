import { useRef } from "react";
import { ChevronRight, UserRound, X } from "lucide-react";
import type { AuthUser } from "../types/domain";

export function AccountDetails({ user }: { user: AuthUser }) {
  const dialog = useRef<HTMLDialogElement>(null);
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
        onClick={() => dialog.current?.showModal()}
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
          <div><dt>Account created</dt><dd>{joined}</dd></div>
        </dl>
      </dialog>
    </>
  );
}
