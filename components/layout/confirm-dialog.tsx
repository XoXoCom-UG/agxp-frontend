"use client";

import { createPortal } from "react-dom";

export interface ConfirmDialogProps {
  title: string;
  body: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ title, body, confirmLabel, onConfirm, onCancel }: ConfirmDialogProps) {
  return createPortal(
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal" style={{ width: 380 }} role="alertdialog" aria-modal="true">
        <h2>{title}</h2>
        <div className="sub">{body}</div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn btn-plum" onClick={onConfirm}>{confirmLabel || "Confirm"}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
