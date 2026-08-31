// UI primitives — restyled on the semantic design tokens ported from Ana's
// mockup (agxp-functional-ui): flat fills, one crisp shadow, no glossy
// gradients. Exactly one "primary" visual language, used consistently.

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
  const base = "inline-flex items-center justify-center gap-2 rounded-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50";
  const variants: Record<BtnVariant, string> = {
    default: "bg-primary text-primary-foreground font-semibold hover:bg-primary-soft shadow-sm active:scale-[0.97]",
    outline: "border border-border bg-secondary hover:bg-accent text-secondary-foreground shadow-sm",
    ghost: "hover:bg-accent text-secondary-foreground",
    secondary: "bg-secondary text-secondary-foreground border border-border hover:border-border-strong",
    destructive: "bg-destructive text-destructive-foreground hover:opacity-90",
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
    default: "bg-primary/15 text-primary border-primary/30",
    secondary: "bg-secondary text-secondary-foreground border-border",
    outline: "bg-transparent text-secondary-foreground border-border-strong",
    success: "bg-success/15 text-success border-success/30",
    destructive: "bg-destructive/15 text-destructive border-destructive/30",
  };
  return (
    <span className={cn("inline-flex items-center border rounded-pill px-2.5 py-0.5 text-xs font-semibold", variants[variant], className)} {...props}>
      {children}
    </span>
  );
}

// ── Card ────────────────────────────────────────────────────────────────────
export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-md border border-border bg-card shadow-sm", className)} {...props}>{children}</div>;
}
export function CardHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center justify-between px-5 py-4 border-b border-border", className)} {...props}>{children}</div>;
}
export function CardTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-sm font-semibold text-foreground", className)} {...props}>{children}</h3>;
}
export function CardContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props}>{children}</div>;
}

// ── Separator ───────────────────────────────────────────────────────────────
export function Separator({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("h-px bg-border w-full", className)} {...props} />;
}

// ── Input ───────────────────────────────────────────────────────────────────
export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input className={cn("flex h-9 w-full rounded-sm border border-input bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50", className)} {...props} />
  );
}

// ── Textarea ─────────────────────────────────────────────────────────────────
export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea className={cn("flex w-full rounded-sm border border-input bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 resize-none", className)} {...props} />
  );
}

// ── Avatar ───────────────────────────────────────────────────────────────────
export function Avatar({ initials, size = "md", className }: { initials: string; size?: "sm" | "md"; className?: string }) {
  const s = size === "sm" ? "w-7 h-7 text-xs" : "w-8 h-8 text-sm";
  return (
    <div className={cn("rounded-pill flex items-center justify-center font-bold shrink-0 bg-primary/15 text-primary border border-primary/30", s, className)}>
      {initials}
    </div>
  );
}

// ── Tabs ─────────────────────────────────────────────────────────────────────
export function TabGroup({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex bg-secondary rounded-sm p-0.5 gap-0.5", className)}>{children}</div>;
}
export function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={cn("px-3.5 py-1.5 rounded-xs text-xs font-semibold transition-all", active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-secondary-foreground")}>
      {children}
    </button>
  );
}

// ── KpiCard ──────────────────────────────────────────────────────────────────
export function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow duration-200">
      <CardContent className="p-5">
        <p className="text-xs tracking-widest uppercase text-muted-foreground mb-3">{label}</p>
        <p className="text-2xl font-bold text-foreground leading-none mb-1.5 tracking-tight break-words">{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}
