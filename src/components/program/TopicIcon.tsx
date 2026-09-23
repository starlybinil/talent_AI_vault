import { Activity, Cpu, Gauge, Radar, Shield, Wind, Wrench, Zap, type LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = { shield: Shield, zap: Zap, radar: Radar, wind: Wind, gauge: Gauge, activity: Activity, wrench: Wrench, cpu: Cpu };

export function TopicIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Cpu;
  return <Icon className={className} aria-hidden />;
}
