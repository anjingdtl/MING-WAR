import type { GameState, RegionId } from "../../core/types";
import { StatBadge } from "../common/StatBadge";

interface RegionPanelProps {
  state: GameState;
  selectedRegionId: RegionId | null;
}

export function RegionPanel({ state, selectedRegionId }: RegionPanelProps) {
  const region = selectedRegionId ? state.regions[selectedRegionId] : null;
  if (!region) {
    return <section className="side-panel"><h2>区域详情</h2><p>请选择地图区域。</p></section>;
  }
  const faction = state.factions[region.controllerFactionId];
  return (
    <section className="side-panel">
      <h2>区域详情</h2>
      <p className="muted">{region.name} · 控制者：{faction.name}</p>
      <div className="stat-grid">
        <StatBadge label="人口" value={region.population.toLocaleString()} />
        <StatBadge label="粮食" value={region.grainStock.toLocaleString()} />
        <StatBadge label="税力" value={region.taxCapacity} />
        <StatBadge label="驻军" value={region.garrison.toLocaleString()} />
        <StatBadge label="稳定" value={region.stability} tone={region.stability < 50 ? "warning" : "default"} />
        <StatBadge label="控制" value={region.control} tone={region.control < 50 ? "warning" : "default"} />
      </div>
    </section>
  );
}
