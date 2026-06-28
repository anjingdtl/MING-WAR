interface StatBadgeProps {
  label: string;
  value: string | number;
  tone?: "default" | "warning" | "danger";
}

export function StatBadge({ label, value, tone = "default" }: StatBadgeProps) {
  return (
    <div className={`stat-badge stat-badge--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
