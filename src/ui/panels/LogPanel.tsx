import { memo, useMemo } from "react";
import { ScrollText } from "lucide-react";
import type { MonthlyReport } from "../../core/types";

interface LogPanelProps {
  reports: MonthlyReport[];
}

const SEVERITY_RANK: Record<MonthlyReport["severity"], number> = {
  danger: 0,
  warning: 1,
  info: 2
};

const SEVERITY_LABEL: Record<MonthlyReport["severity"], string> = {
  danger: "急报",
  warning: "要闻",
  info: "通报"
};

/**
 * 邸报 — Phase 2 视觉升级
 *
 * 借鉴 V3 的 Journal 系统和 V3 Dev Diary #30 的"报纸 + 老旧纸张"风格。
 * 布局:
 *  - 报头:邸报名 + 期号
 *  - 头条:本月最严重事件
 *  - 二条:warning 级别
 *  - 短讯:info 级别
 */
export const LogPanel = memo(function LogPanel({ reports }: LogPanelProps) {
  // Memoize: only re-sort when reports array reference changes
  const sorted = useMemo(
    () =>
      [...reports]
        .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
        .slice(0, 12),
    [reports]
  );

  const entries = sorted.slice(0, 5);

  return (
    <section className="log-panel" aria-label="邸报">
      <header className="gazette-header">
        <h2>
          <ScrollText aria-hidden="true" size={15} />
          邸报
        </h2>
        <span className="gazette-issue">
          {reports.length > 0 ? `第 ${reports.length} 期` : "创刊号"}
        </span>
      </header>

      {reports.length === 0 ? (
        <p className="gazette-empty">天下一时无事,推演伊始。</p>
      ) : (
        <ul className="gazette-feed">
          {entries.map((entry) => (
            <li key={entry.id} className={`gazette-feed__item gazette-feed__item--${entry.severity}`}>
              <span className="gazette-feed__kicker">{SEVERITY_LABEL[entry.severity]}</span>
              <span className="gazette-feed__title">{entry.title}</span>
              <span className="gazette-feed__date">{entry.date}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
});
