export function Marquee({ items }: { items: string[] }) {
  const row = [...items, ...items];
  return (
    <div className="relative overflow-hidden border-y border-white/10 bg-gold py-4">
      <div className="flex w-max animate-marquee gap-10 whitespace-nowrap">
        {row.map((t, i) => (
          <span key={i} className="flex items-center gap-10 text-lg font-black uppercase tracking-tight text-ink">
            {t}
            <span className="inline-block h-2.5 w-2.5 rotate-45 bg-maroon" aria-hidden />
          </span>
        ))}
      </div>
    </div>
  );
}
