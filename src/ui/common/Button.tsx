import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "tertiary" | "danger" | "gold";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  type?: "button" | "submit" | "reset";
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  block?: boolean;
  /** 加载态 */
  loading?: boolean;
  children?: ReactNode;
}

/**
 * 按钮 — Phase 1 基础组件
 *
 * 五变体(借鉴 V3 行动/导航/高优先级分类):
 *  - primary: 帝王朱,主行动(推进一月、宣战)
 *  - secondary: 缥色描边,次行动(切 Lens、切 Tab)
 *  - tertiary: 透明文字,弱行动(关闭、取消)
 *  - danger: 深朱,破坏性(撤军、贬谪)
 *  - gold: 御黄描金,高优先级(关键事件、批准奏折)
 *
 * 三态:default / hover / active / disabled(加 loading)
 */
export function Button({
  variant = "secondary",
  size = "md",
  type = "button",
  iconLeft,
  iconRight,
  block,
  loading,
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <button
      {...rest}
      type={type}
      disabled={isDisabled}
      className={[
        "ming-btn",
        `ming-btn--${variant}`,
        `ming-btn--${size}`,
        block ? "ming-btn--block" : "",
        loading ? "ming-btn--loading" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {loading ? <span className="ming-btn__spinner" aria-hidden="true" /> : iconLeft}
      {children}
      {iconRight}
    </button>
  );
}
