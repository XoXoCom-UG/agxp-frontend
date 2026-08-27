// Shadcn-style UI primitives — hand-crafted to match ui.shadcn.com aesthetics

import { cn } from "@/lib/utils";
import React from "react";

// ── Button ──────────────────────────────────────────────────────────────────
type BtnVariant = "default" | "outline" | "ghost" | "secondary" | "destructive";
type BtnSize = "sm" | "md" | "lg" | "icon";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
  size?: BtnSize;
}

export function Button({ variant = "default", size = "md", className, children, ...props }: ButtonProps) {
  const base = "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";
  const variants: Record<BtnVariant, string> = {
    default: "bg-green-600 text-white hover:bg-green-700 shadow-sm active:scale-[0.98]",
    outline: "border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 shadow-sm",
    ghost: "hover:bg-gray-100 text-gray-700",
    secondary: "bg-gray-100 text-gray-700 hover:bg-gray-200",
    destructive: "bg-red-500 text-white hover:bg-red-600",
  };
  const sizes: Record<BtnSize, string> = {
    sm: "h-8 px-3 text-xs",
    md: "h-9 px-4 text-sm",
    lg: "h-10 px-5 text-sm",
    icon: "h-9 w-9 p-0",
  };
  return (
    <button className={cn(base, variants[variant], sizes[size], className)} {...props}>
      {children}
    </button>
  );
}

// ── Badge ───────────────────────────────────────────────────────────────────
type BadgeVariant = "default" | "secondary" | "outline" | "success" | "destructive";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ variant = "default", className, children, ...props }: BadgeProps) {
  const variants: Record<BadgeVariant, string> = {
    default: "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800",
    secondary: "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700",
    outline: "bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700",
    success: "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
    destructive: "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800",
  };
  return (
    <span className={cn("inline-flex items-center border rounded-full px-2.5 py-0.5 text-xs font-semibold", variants[variant], className)} {...props}>
      {children}
    </span>
  );
}

// ── Card ────────────────────────────────────────────────────────────────────
export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-xl border border-gray-200 bg-white shadow-sm", className)} {...props}>{children}</div>;
}
export function CardHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center justify-between px-5 py-4 border-b border-gray-100", className)} {...props}>{children}</div>;
}
export function CardTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-sm font-semibold text-gray-900", className)} {...props}>{children}</h3>;
}
export function CardContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props}>{children}</div>;
}

// ── Separator ───────────────────────────────────────────────────────────────
export function Separator({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("h-px bg-gray-100 w-full", className)} {...props} />;
}

// ── Input ───────────────────────────────────────────────────────────────────
export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input className={cn("flex h-9 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50", className)} {...props} />
  );
}

// ── Textarea ─────────────────────────────────────────────────────────────────
export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea className={cn("flex w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 resize-none", className)} {...props} />
  );
}

// ── Avatar ───────────────────────────────────────────────────────────────────
export function Avatar({ initials, size = "md", className }: { initials: string; size?: "sm" | "md"; className?: string }) {
  const s = size === "sm" ? "w-7 h-7 text-xs" : "w-8 h-8 text-sm";
  return (
    <div className={cn("rounded-full flex items-center justify-center font-bold shrink-0", s, className)}
      style={{ background: "var(--green-light)", color: "var(--green-dark)", border: "1px solid var(--green-mid)" }}>
      {initials}
    </div>
  );
}

// ── Tabs ─────────────────────────────────────────────────────────────────────
export function TabGroup({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex bg-zinc-100 dark:bg-zinc-800 rounded-lg p-0.5 gap-0.5", className)}>{children}</div>;
}
export function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={cn("px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all", active ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50 shadow-sm" : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200")}>
      {children}
    </button>
  );
}

// ── KpiCard ──────────────────────────────────────────────────────────────────
export function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow duration-200">
      <CardContent className="p-5">
        <p className="text-xs tracking-widest uppercase text-zinc-500 mb-3">{label}</p>
        <p className="text-2xl font-bold text-zinc-900 leading-none mb-1.5 tracking-tight break-words">{value}</p>
        {sub && <p className="text-xs text-zinc-400">{sub}</p>}
      </CardContent>
    </Card>
  );
}
