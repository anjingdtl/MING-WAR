import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RuyiCorner } from "../ui/common/decor/RuyiCorner";
import { GoldDivider } from "../ui/common/decor/GoldDivider";
import { SealStamp } from "../ui/common/decor/SealStamp";

describe("decor / RuyiCorner", () => {
  it("renders 4 positions", () => {
    const { container: c1 } = render(<RuyiCorner position="tl" />);
    const { container: c2 } = render(<RuyiCorner position="tr" />);
    const { container: c3 } = render(<RuyiCorner position="bl" />);
    const { container: c4 } = render(<RuyiCorner position="br" />);
    expect(c1.querySelector("svg")).toBeTruthy();
    expect(c2.querySelector("svg")).toBeTruthy();
    expect(c3.querySelector("svg")).toBeTruthy();
    expect(c4.querySelector("svg")).toBeTruthy();
  });

  it("respects custom size", () => {
    const { container } = render(<RuyiCorner position="tl" size={32} />);
    const svg = container.querySelector("svg") as SVGElement;
    expect(svg.style.width).toBe("32px");
  });

  it("applies rotation per position", () => {
    const { container: tl } = render(<RuyiCorner position="tl" />);
    const { container: tr } = render(<RuyiCorner position="tr" />);
    const { container: br } = render(<RuyiCorner position="br" />);
    const tlSvg = tl.querySelector("svg") as SVGElement;
    const trSvg = tr.querySelector("svg") as SVGElement;
    const brSvg = br.querySelector("svg") as SVGElement;
    expect(tlSvg.style.transform).toContain("rotate(0deg)");
    expect(trSvg.style.transform).toContain("rotate(90deg)");
    expect(brSvg.style.transform).toContain("rotate(180deg)");
  });
});

describe("decor / GoldDivider", () => {
  it("renders horizontal by default", () => {
    const { container } = render(<GoldDivider />);
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
  });

  it("renders vertical when specified", () => {
    const { container } = render(<GoldDivider orientation="vertical" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
  });

  it("respects custom length", () => {
    const { container } = render(<GoldDivider length={120} />);
    const svg = container.querySelector("svg") as SVGElement;
    expect(svg.style.width).toBe("120px");
  });
});

describe("decor / SealStamp", () => {
  it("renders the requested text", () => {
    const { container } = render(<SealStamp text="批准" />);
    const text = container.querySelector("text");
    expect(text?.textContent).toBe("批准");
  });

  it("truncates text to 4 chars", () => {
    const { container } = render(<SealStamp text="六字长文" />);
    const text = container.querySelector("text");
    expect(text?.textContent).toBe("六字长文");
  });

  it("respects custom size", () => {
    const { container } = render(<SealStamp text="X" size={48} />);
    const svg = container.querySelector("svg") as SVGElement;
    expect(svg.style.width).toBe("48px");
    expect(svg.style.height).toBe("48px");
  });
});
