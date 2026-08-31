"use client";

import { useState } from "react";
import { IconArrow, IconFolder } from "@/components/layout/agxp-icons";

const PROJECT_TYPES = [
  "AI Transformation",
  "Software Modernization",
  "Digital Strategy",
  "Process Improvement",
  "Knowledge Management",
  "Other",
];

export function CreateProjectSheet({ open, onClose, onSubmit }: {
  open: boolean;
  onClose: () => void;
  onSubmit: (name: string, description: string, type: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState(PROJECT_TYPES[0]);
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;
  const nameErr = touched && !name.trim();

  async function submit() {
    setTouched(true);
    setError(null);
    if (!name.trim() || loading) return;
    setLoading(true);
    try {
      await onSubmit(name.trim(), description.trim(), type);
      setName(""); setDescription(""); setType(PROJECT_TYPES[0]); setTouched(false);
    } catch (e) {
      setError((e as Error).message || "Projekt konnte nicht erstellt werden.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="sheet-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Create New Project">
        <div className="sheet-head">
          <div className="sheet-icon"><IconFolder size={19} /></div>
          <div>
            <h2>Create New Project</h2>
            <div className="sub">Set up a new AI transformation initiative — your existing projects stay visible on the left.</div>
          </div>
        </div>

        <div className="sheet-body">
          <div className="field">
            <label>Project Name <span className="req">Required</span></label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") submit(); }}
              placeholder="e.g. Customer Onboarding Transformation" />
            <div className={`err ${nameErr ? "show" : ""}`}>Project name is required.</div>
          </div>
          <div className="field">
            <label>Project Description</label>
            <textarea rows={5} value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Briefly describe the objective of this project" />
          </div>
          <div className="field">
            <label>Project Type</label>
            <select value={type} onChange={e => setType(e.target.value)}>
              {PROJECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          {error && <div className="err show">{error}</div>}
        </div>

        <div className="sheet-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-hero" disabled={!name.trim() || loading} onClick={submit}>
            {loading ? <span className="spinner" /> : <>Create Project <IconArrow /></>}
          </button>
        </div>
      </div>
    </div>
  );
}
