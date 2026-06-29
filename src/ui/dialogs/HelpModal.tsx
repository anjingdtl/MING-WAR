import { X, Keyboard } from "lucide-react";
import { Button } from "../common/Button";
import { GoldDivider } from "../common/decor/GoldDivider";

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
}

const HOTKEYS: Array<{ keys: string[]; action: string }> = [
  { keys: ["1"], action: "切换到势力 Lens" },
  { keys: ["2"], action: "切换到经济 Lens" },
  { keys: ["3"], action: "切换到军事 Lens" },
  { keys: ["4"], action: "切换到民生 Lens" },
  { keys: ["5"], action: "切换到朝堂 Lens" },
  { keys: ["F"], action: "展开/收起详情面板" },
  { keys: ["Esc"], action: "关闭详情面板" },
  { keys: ["Alt + 点击区域"], action: "居中聚焦该区域" },
  { keys: ["滚轮"], action: "缩放地图" },
  { keys: ["拖拽"], action: "平移地图" }
];

/**
 * 快捷键帮助弹窗 — Phase 6
 */
export function HelpModal({ open, onClose }: HelpModalProps) {
  if (!open) return null;
  return (
    <div className="dialog-backdrop" role="dialog" aria-modal="true" aria-label="快捷键帮助">
      <section className="help-modal">
        <header className="help-modal__header">
          <h2>
            <Keyboard aria-hidden="true" size={20} />
            快捷键
          </h2>
          <Button
            variant="tertiary"
            size="sm"
            onClick={onClose}
            iconLeft={<X aria-hidden="true" size={14} />}
            aria-label="关闭帮助"
          >
            关闭
          </Button>
        </header>
        <GoldDivider length="100%" />
        <dl className="help-modal__list">
          {HOTKEYS.map((h) => (
            <div key={h.action} className="help-modal__row">
              <dt>
                {h.keys.map((k) => (
                  <kbd key={k}>{k}</kbd>
                ))}
              </dt>
              <dd>{h.action}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
