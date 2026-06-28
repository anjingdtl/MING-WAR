import type { MonthlyReport } from "../../core/types";

interface LogPanelProps {
  reports: MonthlyReport[];
}

export function LogPanel({ reports }: LogPanelProps) {
  return (
    <section className="log-panel">
      <h2>月度日志</h2>
      <div className="log-list">
        {reports.slice(0, 12).map((report) => (
          <article key={report.id} className={`log-item log-item--${report.severity}`}>
            <strong>{report.title}</strong>
            <span>{report.date}</span>
            <p>{report.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
