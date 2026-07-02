import { useEffect, useState } from "react";
import { ArrowLeft, FolderOpen, LogOut, Play } from "lucide-react";
import { listSaves, type SaveGame } from "../../save/saveManager";
import menuBackground from "../../assets/art/menu/main-menu-palace-dusk.png";

interface MainMenuProps {
  onStart: () => void;
  onLoad: (saveId: string) => void | Promise<unknown>;
}

type MenuMode = "root" | "load";

export function MainMenu({ onStart, onLoad }: MainMenuProps) {
  const [mode, setMode] = useState<MenuMode>("root");
  const [saves, setSaves] = useState<SaveGame[]>([]);
  const [loadingSaves, setLoadingSaves] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (mode !== "load") return;
    let cancelled = false;
    setLoadingSaves(true);
    setMessage("");
    listSaves()
      .then((items) => {
        if (cancelled) return;
        setSaves(items);
        if (items.length === 0) setMessage("没有可载入进度");
      })
      .catch(() => {
        if (!cancelled) setMessage("存档列表读取失败");
      })
      .finally(() => {
        if (!cancelled) setLoadingSaves(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mode]);

  const handleExit = () => {
    window.close();
    setMessage("浏览器可能会阻止直接退出，请关闭当前窗口。");
  };

  const handleLoad = async (save: SaveGame) => {
    await onLoad(save.id);
  };

  return (
    <section className="main-menu" aria-label="主菜单">
      <img className="main-menu__background" src={menuBackground} alt="" aria-hidden="true" />
      <div className="main-menu__shade" />
      <div className="main-menu__content">
        <div className="main-menu__title-block">
          <span className="main-menu__kicker">1573 · 山河将倾</span>
          <h1>万历：山河崩塌</h1>
          <p>内廷灯火未熄，边关烽烟已起。</p>
        </div>

        {mode === "root" ? (
          <nav className="main-menu__actions" aria-label="游戏菜单">
            <button className="main-menu__button main-menu__button--primary" onClick={onStart}>
              <Play size={18} aria-hidden="true" />
              <span>开始游戏</span>
            </button>
            <button className="main-menu__button" onClick={() => setMode("load")}>
              <FolderOpen size={18} aria-hidden="true" />
              <span>载入进度</span>
            </button>
            <button className="main-menu__button" onClick={handleExit}>
              <LogOut size={18} aria-hidden="true" />
              <span>退出游戏</span>
            </button>
          </nav>
        ) : (
          <div className="main-menu__load-panel">
            <button className="main-menu__back" onClick={() => setMode("root")}>
              <ArrowLeft size={16} aria-hidden="true" />
              <span>返回</span>
            </button>
            <h2>载入进度</h2>
            {loadingSaves ? <p className="main-menu__message">读取存档中...</p> : null}
            {!loadingSaves && message ? <p className="main-menu__message">{message}</p> : null}
            <div className="main-menu__save-list">
              {saves.map((save) => (
                <button
                  key={`${save.id}-${save.savedAt}`}
                  className="main-menu__save"
                  onClick={() => void handleLoad(save)}
                  aria-label={`载入 ${save.name}`}
                >
                  <strong>{save.name}</strong>
                  <span>{save.state.currentDate} · {save.state.factions[save.state.playerFactionId]?.name ?? "未知势力"}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {mode === "root" && message ? <p className="main-menu__message">{message}</p> : null}
      </div>
    </section>
  );
}
