import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/workflow";

type Variant = "gold" | "maroon" | "dark" | "outline" | "ghost" | "danger" | "outline-light";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  gold: "bg-gold text-ink hover:bg-[#ffd55e] shadow-[0_8px_30px_-8px_rgba(255,198,39,0.6)]",
  maroon: "bg-maroon text-white hover:bg-maroon-700",
  dark: "bg-ink text-white hover:bg-ink-700",
  outline: "border border-ink/20 text-ink hover:border-ink hover:bg-ink/5",
  "outline-light": "border border-white/30 text-white hover:border-white hover:bg-white/10",
  ghost: "text-ink hover:bg-ink/5",
  danger: "bg-[#b42318] text-white hover:bg-[#912018]",
};
const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-[15px]",
  lg: "h-14 px-8 text-base",
};

export function buttonClass(variant: Variant = "gold", size: Size = "md", className?: string) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-full font-bold tracking-tight transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] cursor-pointer",
    variants[variant],
    sizes[size],
    className,
  );
}

export function Button({
  variant = "gold",
  size = "md",
  className,
  ...props
}: React.ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  href,
  variant = "gold",
  size = "md",
  className,
  children,
  ...rest
}: { href: string; variant?: Variant; size?: Size; className?: string; children: React.ReactNode } & Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  "href"
>) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-2xl border border-ink/10 bg-white p-6 shadow-sm", className)} {...props} />;
}

const tones: Record<Tone, string> = {
  neutral: "bg-ink/5 text-ink/70 ring-ink/10",
  info: "bg-sky-50 text-sky-800 ring-sky-200",
  progress: "bg-gold/20 text-[#7a5a00] ring-gold/50",
  success: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  danger: "bg-red-50 text-red-800 ring-red-200",
  warn: "bg-orange-50 text-orange-800 ring-orange-200",
};

export function Badge({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ring-inset whitespace-nowrap", tones[tone], className)}>
      {children}
    </span>
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("block text-sm font-bold text-ink", className)} {...props} />;
}

const fieldBase =
  "mt-1.5 block w-full rounded-xl border border-ink/15 bg-white px-4 text-[15px] text-ink placeholder:text-ink/40 transition focus:border-maroon focus:outline-none focus:ring-4 focus:ring-maroon/10 disabled:bg-ink/5";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn(fieldBase, "h-12", className)} {...props} />;
});

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(fieldBase, "h-12 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%228%22><path d=%22M1 1l5 5 5-5%22 stroke=%22%23191919%22 stroke-width=%222%22 fill=%22none%22/></svg>')] bg-[position:right_1rem_center] bg-no-repeat pr-10", className)} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldBase, "min-h-24 py-3", className)} {...props} />;
}

export function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <p className="mt-1.5 text-sm font-medium text-red-700">{children}</p>;
}

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: "info" | "success" | "danger" | "warn";
  title?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const t = {
    info: "border-sky-200 bg-sky-50 text-sky-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    danger: "border-red-200 bg-red-50 text-red-900",
    warn: "border-orange-200 bg-orange-50 text-orange-900",
  }[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("rounded-xl border px-4 py-3 text-sm", t, className)}>
      {title && <p className="font-bold">{title}</p>}
      {children && <div className={title ? "mt-1" : ""}>{children}</div>}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.2em] text-maroon">{eyebrow}</p>}
        <h1 className="mt-1 text-3xl font-black tracking-tight text-ink sm:text-4xl">{title}</h1>
        {description && <div className="mt-2 max-w-2xl text-ink/60">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-ink/15 bg-mist px-6 py-12 text-center">
      <p className="font-bold text-ink">{title}</p>
      {children && <div className="mt-1 text-sm text-ink/60">{children}</div>}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <Card className="p-5">
      <p className="text-xs font-bold uppercase tracking-wider text-ink/50">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-tight text-ink">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink/50">{hint}</p>}
    </Card>
  );
}
