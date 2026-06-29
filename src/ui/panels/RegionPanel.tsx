import type { GameState, RegionId } from "../../core/types";
import { StatBadge } from "../common/StatBadge";

interface RegionPanelProps {
  state: GameState;
  selectedRegionId: RegionId | null;
}

export function RegionPanel({ state, selectedRegionId }: RegionPanelProps) {
  const region = selectedRegionId ? state.regions[selectedRegionId] : null;
  if (!region) {
    return (
      <section className="side-panel">
        <h2>区域详情</h2>
        <p className="muted">请选择地图区域。</p>
      </section>
    );
  }
  const faction = state.factions[region.controllerFactionId];
  return (
    <section className="side-panel">
      <h2>区域详情</h2>
      <p className="muted">{region.name} · 控制者:{faction.name}</p>
      <div className="stat-grid">
        <StatBadge
          label="人口"
          value={region.population}
          format="wan"
          title="区域人口(万)"
        />
        <StatBadge
          label="粮储"
          value={region.grainStock}
          format="wan"
          thresholds={{ danger: 0, warning: 5000 }}
          title="本区粮储(万石)"
        />
        <StatBadge
          label="税力"
          value={region.taxCapacity}
          title="税收能力"
        />
        <StatBadge
          label="驻军"
          value={region.garrison}
          format="wan"
          title="本区驻军(万)"
        />
        <StatBadge
          label="稳定"
          value={region.stability}
          thresholds={{ danger: 30, warning: 50 }}
          title="社会稳定性(0-100)"
        />
        <StatBadge
          label="控制"
          value={region.control}
          thresholds={{ danger: 30, warning: 50 }}
          title="朝廷控制度(0-100)"
        />
        <StatBadge
          label="叛乱"
          value={region.rebelPressure}
          thresholds={{ warning: 50, danger: 75 }}
          tone={region.rebelPressure > 0 ? "default" : "default"}
          title="叛乱压力(0-100)"
        />
        <StatBadge
          label="核心"
          value={region.coreFactionIds.length}
          title="核心势力数"
        />
      </div>
    </section>
  );
}
