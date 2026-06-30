import { memo, useMemo } from "react";
import type { MonthlyReport } from "../../core/types";
import { StatBadge } from "../common/StatBadge";

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

  const headline = sorted[0];
  const subhead = sorted.find((r) => r.severity === "warning");
  const briefs = sorted.filter((r) => r.severity === "info").slice(0, 8);

  return (
    <section className="log-panel" aria-label="邸报">
      <header className="gazette-header">
        <h2>邸报</h2>
        <span className="gazette-issue">
          {reports.length > 0 ? `第 ${reports.length} 期` : "创刊号"}
        </span>
      </header>

      {reports.length === 0 ? (
        <p className="gazette-empty">天下一时无事,推演伊始。</p>
      ) : (
        <>
          {headline && (
            <article className={`gazette-headline gazette-headline--${headline.severity}`}>
              <div className="gazette-headline__meta">
                <span className="gazette-headline__kicker">{SEVERITY_LABEL[headline.severity]}</span>
                <span className="gazette-headline__date">{headline.date}</span>
              </div>
              <h3>{headline.title}</h3>
              <p>{headline.body}</p>
            </article>
          )}

          {subhead && subhead.id !== headline?.id && (
            <article className="gazette-subhead">
              <strong>要闻</strong>
              <span>{subhead.date}</span>
              <p>{subhead.title} — {subhead.body}</p>
            </article>
          )}

          {briefs.length > 0 && (
            <ul className="gazette-briefs">
              {briefs.map((b) => (
                <li key={b.id}>
                  <span className="gazette-briefs__date">{b.date}</span>
                  <span className="gazette-briefs__text">{b.title}</span>
                </li>
              ))}
            </ul>
          )}

          <footer className="gazette-footer">
            <StatBadge
              label="本月条数"
              value={reports.length}
              size="sm"
            />
          </footer>
        </>
      )}
    </section>
  );
});
