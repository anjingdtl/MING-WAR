import { useEffect, useRef, useState } from "react";
import {
  ClipboardList,
  Landmark,
  MapPin,
  ScrollText,
  Swords,
  X
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type {
  GameState,
  PlayerDecision,
  RegionId
} from "../../core/types";
import { cliqueTemplates } from "../../data/cliques";
import { Button } from "../common/Button";
import { CliqueBar } from "../panels/CliqueBar";
import { DecisionPanel } from "../panels/DecisionPanel";
import { RegionPanel } from "../panels/RegionPanel";

export type SidePanelTab = "region" | "decision" | "court" | "gazette" | "chronicle";

interface SidePanelProps {
  state: GameState;
  decision: PlayerDecision;
  onDecisionChange: (decision: Partial<PlayerDecision>) => void;
  selectedRegionId: RegionId | null;
  onSelectRegion: (regionId: RegionId | null) => void;
  /** 控制开合(由父级控制,TopBar 触发) */
  open: boolean;
  onClose: () => void;
  /** 默认 tab(由父级控制) */
  initialTab?: SidePanelTab;
  onTabChange?: (tab: SidePanelTab) => void;
}

interface TabDef {
  id: SidePanelTab;
  label: string;
  Icon: LucideIcon;
}

const TABS: TabDef[] = [
  { id: "region", label: "区域", Icon: MapPin },
  { id: "decision", label: "决策", Icon: Swords },
  { id: "court", label: "朝堂", Icon: Landmark },
  { id: "gazette", label: "邸报", Icon: ClipboardList },
  { id: "chronicle", label: "大事记", Icon: ScrollText }
];

/**
 * 侧滑详情面板 — Phase 2 核心组件
 *
 * 取代之前塞在地图右下角的 map-command-panel。
 * 5 个 Tab 统一详情通道:
 *  - 区域(选中区域时默认)
 *  - 决策(战略、军略、内政)
 *  - 朝堂(派系、Modifier)
 *  - 邸报(月度事件流)
 *  - 大事记(历史时间线)
 *
 * 借鉴 V3 的"地图简洁 + 详情面板信息密集"路线。
 */
export function SidePanel({
  state,
  decision,
  onDecisionChange,
  selectedRegionId,
  onSelectRegion,
  open,
  onClose,
  initialTab = "region",
  onTabChange
}: SidePanelProps) {
  const [activeTab, setActiveTab] = useState<SidePanelTab>(initialTab);

  // 同步外部 initialTab 变化(用 ref 防止初次 render 立刻覆盖用户选择)
  const lastInitialTab = useRef(initialTab);
  useEffect(() => {
    if (initialTab !== lastInitialTab.current) {
      lastInitialTab.current = initialTab;
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  if (!open) return null;

  const handleTabChange = (tab: SidePanelTab) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  return (
    <aside
      className="side-panel-container"
      role="complementary"
      aria-label="详情面板"
    >
      <header className="side-panel-tabs" role="tablist">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            className={`side-panel-tab ${activeTab === id ? "is-active" : ""}`}
            onClick={() => handleTabChange(id)}
          >
            <Icon aria-hidden="true" size={16} />
            <span>{label}</span>
          </button>
        ))}
        <Button
          variant="tertiary"
          size="sm"
          onClick={onClose}
          iconLeft={<X aria-hidden="true" size={14} />}
          aria-label="关闭详情面板"
        >
          关闭
        </Button>
      </header>

      <div className="side-panel-content" role="tabpanel">
        {activeTab === "region" && (
          <RegionPanel state={state} selectedRegionId={selectedRegionId} />
        )}
        {activeTab === "decision" && (
          <DecisionPanel
            state={state}
            decision={decision}
            onChange={onDecisionChange}
            selectedRegionId={selectedRegionId}
            onSelectRegion={onSelectRegion}
          />
        )}
        {activeTab === "court" && (
          <CourtTabContent state={state} />
        )}
        {activeTab === "gazette" && (
          <GazetteTabContent state={state} />
        )}
        {activeTab === "chronicle" && (
          <ChronicleTabContent state={state} />
        )}
      </div>
    </aside>
  );
}

/* ============================================================== */
/* Tab 内容组件                                                    */
/* ============================================================== */

function CourtTabContent({ state }: { state: GameState }) {
  const faction = state.factions[state.playerFactionId];
  const cliques = faction?.cliques ?? [];
  return (
    <section className="side-panel">
      <h2>朝堂派系</h2>
      <p className="muted">
        各派系支持度反映朝廷态势。低于 25 即可能生乱,低于 15 为极度危险。
      </p>
      <CliqueBar cliques={cliques} cliqueDefs={cliqueTemplates} />
    </section>
  );
}

function GazetteTabContent({ state }: { state: GameState }) {
  const reports = state.reports.slice(0, 30);
  return (
    <section className="side-panel">
      <h2>邸报</h2>
      <p className="muted">本月与近月军政要闻。颜色代表轻重:朱=危,黄=警,缥=常。</p>
      <ul className="gazette-list">
        {reports.length === 0 ? (
          <li className="gazette-empty">暂无邸报条目</li>
        ) : (
          reports.map((report) => (
            <li
              key={report.id}
              className={`gazette-item gazette-item--${report.severity}`}
            >
              <header>
                <span className="gazette-item__date">{report.date}</span>
                <span className="gazette-item__title">{report.title}</span>
              </header>
              <p>{report.body}</p>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}

function ChronicleTabContent({ state }: { state: GameState }) {
  const history = state.history ?? [];
  return (
    <section className="side-panel">
      <h2>大事记</h2>
      <p className="muted">按时间顺序排列的关键节点。</p>
      <ol className="chronicle-list">
        {history.length === 0 ? (
          <li className="chronicle-empty">推演尚未有大事发生。</li>
        ) : (
          history.map((entry, idx) => (
            <li key={`${entry.date}-${idx}`} className="chronicle-item">
              <span className="chronicle-item__date">{entry.date}</span>
              <p>{entry.summary}</p>
            </li>
          ))
        )}
      </ol>
    </section>
  );
}
