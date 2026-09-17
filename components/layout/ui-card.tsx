// Small compound Card family for the picker screens — same shape as the
// shadcn-style reference (Card > CardHeader > CardTitle/CardDescription,
// CardFooter), but styled with app/agxp-design.css's own CSS-custom-property
// tokens instead of Tailwind, so it matches the rest of the live app.
// Deliberately NOT the Tailwind Card family in components/ui/index.tsx —
// that one is unused by any live route and pulls colors from a separate
// token set (app/globals.css) that isn't guaranteed to match the graphite
// palette tuned in agxp-design.css.

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`picker-card ${className ?? ""}`} {...props}>{children}</div>;
}

export function CardHeader({ children }: { children: React.ReactNode }) {
  return <div className="picker-card-head">{children}</div>;
}

export function CardTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="picker-card-title">{children}</h3>;
}

export function CardDescription({ children }: { children: React.ReactNode }) {
  return <p className="picker-card-desc">{children}</p>;
}

export function CardFooter({ children }: { children: React.ReactNode }) {
  return <div className="picker-card-footer">{children}</div>;
}
