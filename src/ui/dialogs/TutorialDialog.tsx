import { useState } from "react";
import { ChevronLeft, ChevronRight, ScrollText, X } from "lucide-react";
import { Button } from "../common/Button";
import { GoldDivider } from "../common/decor/GoldDivider";
import { SealStamp } from "../common/decor/SealStamp";
import { RuyiCorner } from "../common/decor/RuyiCorner";

/* 5 折奏折 — 借鉴 V3 Dev Diary #30 的"报纸 + 老旧纸张"风格 */
interface TutorialStep {
  id: number;
  /** 奏折抬头(圣旨) */
  title: string;
  /** 印章文案 */
  seal: string;
  /** 主要内容(可以包含 JSX) */
  body: React.ReactNode;
  /** 关键词(key takeaways) */
  takeaways: string[];
}

const STEPS: TutorialStep[] = [
  {
    id: 1,
    title: "圣旨:万历朝推演",
    seal: "圣旨",
    body: (
      <>
        <p>奉天承运,皇帝诏曰:</p>
        <p>
          大明万历年间,朝堂暗流涌动,辽东边患日深,国库渐空,民变四起。
          尔受命推演,当知"治大国若烹小鲜",不可不察。
        </p>
        <p>
          本界面将引导尔认识推演的五大要素:国库、粮储、军队、朝堂、邸报。
          点击"下一页"开始。
        </p>
      </>
    ),
    takeaways: ["5 折引导,大约 2 分钟", "可在任何时候跳过", "完成后可重看"]
  },
  {
    id: 2,
    title: "帝国概览:TopBar",
    seal: "钦此",
    body: (
      <>
        <p>顶部状态条(TopBar)显示帝国命脉:</p>
        <ul>
          <li><strong>国库</strong> — 存银(两),破产时军队哗变</li>
          <li><strong>粮食</strong> — 粮储(石),耗尽时区域人口死亡</li>
          <li><strong>军队</strong> — 全军兵力(万)</li>
          <li><strong>民望</strong> — 朝廷合法性,低于 20 易生民变</li>
          <li><strong>天命</strong> — 中央集权,低则朝令难达地方</li>
          <li><strong>疲劳</strong> — 战争疲劳,长期作战会侵蚀国力</li>
        </ul>
        <p>徽章变成红色或黄色,代表危机或警示。</p>
      </>
    ),
    takeaways: ["颜色编码:朱=危,黄=警,缥=常", "点击徽章查看明细"]
  },
  {
    id: 3,
    title: "战略地图",
    seal: "准奏",
    body: (
      <>
        <p>中央地图展示万历朝的两京十三省。可:</p>
        <ul>
          <li><strong>滚轮</strong> — 缩放</li>
          <li><strong>拖拽</strong> — 平移</li>
          <li><strong>点击区域</strong> — 选中并查看详情(右侧抽屉打开)</li>
          <li><strong>Alt+点击</strong> — 居中聚焦到该区域</li>
          <li><strong>悬停</strong> — 浮动信息卡,根据当前 Lens 显示</li>
        </ul>
        <p>左侧 Lens 栏(1-5 数字键)切换视角:势力 / 经济 / 军事 / 民生 / 朝堂。</p>
      </>
    ),
    takeaways: ["5 个 Lens,各显不同色板", "右侧详情面板同步切换 Tab"]
  },
  {
    id: 4,
    title: "朝堂派系",
    seal: "御览",
    body: (
      <>
        <p>每个势力背后都有派系。派系支持度反映其对朝政的满意度:</p>
        <ul>
          <li><strong>支持度 60+</strong> — 派系稳定,基本无扰</li>
          <li><strong>25-60</strong> — 中间派,可拉拢可弹压</li>
          <li><strong>15-25</strong> — 不满,可能生事</li>
          <li><strong>&lt; 15</strong> — 极度危险,需立即安抚或清洗</li>
        </ul>
        <p>
          切换"内政重点"会触发派系反应 — 在决策 Tab 的"下月预估"中可预览:
          财政派系喜欢整顿财政,军方派系喜欢整军备战。
        </p>
      </>
    ),
    takeaways: ["选择政策 = 选择得罪谁", "安抚派系需要时间和资源"]
  },
  {
    id: 5,
    title: "邸报与日志",
    seal: "呈览",
    body: (
      <>
        <p>左下角"邸报"显示本月及近月军政要闻:</p>
        <ul>
          <li><strong>头条(急报)</strong> — 危险级别,如边关失守、粮尽</li>
          <li><strong>要闻</strong> — 重要级别,如政策生效、战役开始</li>
          <li><strong>短讯</strong> — 日常通报</li>
        </ul>
        <p>
          右侧详情面板的"邸报"Tab 显示完整月度报告流;"大事记"Tab 则是
          长期历史时间线。
        </p>
        <p>现在,你已掌握推演基础。开始吧 — 推进一月,看帝国风云变幻。</p>
      </>
    ),
    takeaways: ["邸报 = 时代史", "推演历史会写进大事记"]
  }
];

interface TutorialDialogProps {
  /** 起始 step(默认 0) */
  initialStep?: number;
  onComplete: () => void;
  onSkip: () => void;
}

/**
 * 新手引导 — Phase 5
 *
 * 借鉴 V3 Dev Diary #30 的"报纸+老旧纸张"风格,用奏折形式引导。
 * 5 折,从圣旨欢迎到邸报介绍。
 */
export function TutorialDialog({ initialStep = 0, onComplete, onSkip }: TutorialDialogProps) {
  const [stepIdx, setStepIdx] = useState(initialStep);
  const step = STEPS[stepIdx];
  const isLast = stepIdx === STEPS.length - 1;
  const isFirst = stepIdx === 0;

  const next = () => {
    if (isLast) onComplete();
    else setStepIdx((i) => i + 1);
  };
  const prev = () => {
    if (!isFirst) setStepIdx((i) => i - 1);
  };

  return (
    <div className="dialog-backdrop" role="dialog" aria-modal="true" aria-label="新手引导">
      <section className="tutorial-dialog" data-testid="tutorial-dialog">
        <RuyiCorner position="tl" />
        <RuyiCorner position="tr" />
        <RuyiCorner position="bl" />
        <RuyiCorner position="br" />

        <header className="tutorial-dialog__header">
          <div>
            <span className="tutorial-dialog__eyebrow">第 {step.id} 折</span>
            <h2>{step.title}</h2>
          </div>
          <div className="tutorial-dialog__seal">
            <SealStamp text={step.seal} size={42} color="var(--color-imperial-red)" />
          </div>
        </header>

        <div className="tutorial-dialog__divider">
          <GoldDivider length="100%" />
        </div>

        <div className="tutorial-dialog__body">{step.body}</div>

        {step.takeaways.length > 0 && (
          <aside className="tutorial-dialog__takeaways">
            <strong>
              <ScrollText aria-hidden="true" size={14} />
              提示
            </strong>
            <ul>
              {step.takeaways.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </aside>
        )}

        <footer className="tutorial-dialog__footer">
          <Button variant="tertiary" size="sm" onClick={onSkip} iconLeft={<X size={14} />}>
            跳过引导
          </Button>
          <div className="tutorial-dialog__steps">
            {STEPS.map((s, i) => (
              <span
                key={s.id}
                className={`tutorial-dialog__dot ${i === stepIdx ? "is-active" : ""}`}
                aria-hidden="true"
              />
            ))}
          </div>
          <div className="tutorial-dialog__nav">
            {!isFirst && (
              <Button variant="tertiary" size="sm" onClick={prev} iconLeft={<ChevronLeft size={14} />}>
                上一页
              </Button>
            )}
            <Button variant="primary" size="sm" onClick={next} iconRight={<ChevronRight size={14} />}>
              {isLast ? "开始推演" : "下一页"}
            </Button>
          </div>
        </footer>
      </section>
    </div>
  );
}
