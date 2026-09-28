"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { useDialogFocus } from "@/lib/use-dialog-focus";

export interface ConfirmDialogProps {
  title: string;
  body: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ title, body, confirmLabel, onConfirm, onCancel }: ConfirmDialogProps) {
  const ref = useRef<HTMLDivElement>(null);
  // Per instance: two dialogs (or one closing while the next opens) must not
  // share an id, or the label points at the wrong heading.
  const titleId = useId();
  const bodyId = useId();
  // Focus lands on Cancel — the safe choice — and Escape backs out.
  useDialogFocus(ref);
  // onCancel is usually an inline arrow; a ref keeps the listener attached
  // once instead of re-adding it on every parent render.
  const cancelRef = useRef(onCancel);
  useEffect(() => { cancelRef.current = onCancel; }, [onCancel]);
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") cancelRef.current(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  return createPortal(
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div ref={ref} className="modal modal-sm" role="alertdialog" aria-modal="true"
        aria-labelledby={titleId} aria-describedby={bodyId}>
        <h2 id={titleId}>{title}</h2>
        <div className="sub" id={bodyId}>{body}</div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn btn-plum" onClick={onConfirm}>{confirmLabel || "Confirm"}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
