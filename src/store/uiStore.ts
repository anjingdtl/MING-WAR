/**
 * useUiStore — v0.6-stability-design §3.4
 *
 * UI 状态层：纯界面状态，不参与游戏模拟。
 * - selectedRegionId：当前选中的地区
 * - mapLayer：当前地图图层
 * - simulationStatus：模拟运行状态
 * - simulationProgress：连续推进进度 (0-1)
 * - pendingEventId：等待处理的事件
 * - sidePanelOpen / activePanel：侧边面板状态
 */

import { create } from "zustand";
import type { MapLayer, RegionId } from "../core/types";

export type SimulationStatus = "idle" | "running" | "paused";

export interface UiState {
  selectedRegionId: RegionId | null;
  mapLayer: MapLayer;
  pendingEventId: string | null;
  simulationStatus: SimulationStatus;
  simulationProgress: number;
  sidePanelOpen: boolean;
  activePanel: string | null;
}

export interface UiActions {
  selectRegion: (regionId: RegionId | null) => void;
  setMapLayer: (layer: MapLayer) => void;
  setPendingEventId: (id: string | null) => void;
  setSimulationStatus: (status: SimulationStatus) => void;
  setSimulationProgress: (progress: number) => void;
  setSidePanelOpen: (open: boolean) => void;
  setActivePanel: (panel: string | null) => void;
}

export const useUiStore = create<UiState & UiActions>((set) => ({
  selectedRegionId: "beizhili",
  mapLayer: "control",
  pendingEventId: null,
  simulationStatus: "idle",
  simulationProgress: 0,
  sidePanelOpen: true,
  activePanel: "region",

  selectRegion: (regionId) => set({ selectedRegionId: regionId }),
  setMapLayer: (layer) => set({ mapLayer: layer }),
  setPendingEventId: (id) => set({ pendingEventId: id }),
  setSimulationStatus: (status) => set({ simulationStatus: status }),
  setSimulationProgress: (progress) => set({ simulationProgress: Math.max(0, Math.min(1, progress)) }),
  setSidePanelOpen: (open) => set({ sidePanelOpen: open }),
  setActivePanel: (panel) => set({ activePanel: panel })
}));
