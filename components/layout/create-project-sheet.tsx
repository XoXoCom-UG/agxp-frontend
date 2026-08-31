"use client";

import { useState } from "react";
import { Button, Input, Textarea } from "@/components/ui";
import { ArrowRight } from "lucide-react";

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

  if (!open) return null;

  async function submit() {
    setTouched(true);
    if (!name.trim() || loading) return;
    setLoading(true);
    try {
      await onSubmit(name.trim(), description.trim(), type);
      setName(""); setDescription(""); setType(PROJECT_TYPES[0]); setTouched(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80]" onClick={onClose}>
      <div
        className="fixed top-[60px] right-0 bottom-0 w-[440px] max-w-[92vw] bg-popover border-l border-border flex flex-col shadow-2xl"
        role="dialog" aria-modal="true" aria-label="Create New Project" onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-border shrink-0">
          <h2 className="text-xl font-semibold text-foreground mb-1.5">Create New Project</h2>
          <p className="text-xs text-secondary-foreground leading-relaxed">
            Set up a new AI transformation initiative — your existing projects stay visible on the left.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
          <div>
            <label className="flex justify-between text-[11px] font-bold tracking-wide text-muted-foreground uppercase mb-2">
              Project Name <span className="text-primary-soft">Required</span>
            </label>
            <Input value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") submit(); }}
              placeholder="e.g. Customer Onboarding Transformation" />
            {touched && !name.trim() && <p className="text-[11px] text-destructive mt-1.5">Project name is required.</p>}
          </div>
          <div>
            <label className="block text-[11px] font-bold tracking-wide text-muted-foreground uppercase mb-2">Project Description</label>
            <Textarea rows={3} value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Briefly describe the objective of this project" />
          </div>
          <div>
            <label className="block text-[11px] font-bold tracking-wide text-muted-foreground uppercase mb-2">Project Type</label>
            <select value={type} onChange={e => setType(e.target.value)}
              className="w-full h-9 rounded-sm border border-input bg-secondary px-3 text-sm text-foreground outline-none">
              {PROJECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div className="flex gap-2.5 p-5 border-t border-border shrink-0">
          <Button variant="secondary" className="flex-1 justify-center" onClick={onClose}>Cancel</Button>
          <Button className="flex-1 justify-center" disabled={!name.trim() || loading} onClick={submit}>
            {loading ? <span className="thinking-spinner" style={{ width: 13, height: 13 }} /> : <>Create Project <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.2} /></>}
          </Button>
        </div>
      </div>
    </div>
  );
}
