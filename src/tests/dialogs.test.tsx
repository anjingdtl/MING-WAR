import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EventDialog } from "../ui/dialogs/EventDialog";
import { StartDialog } from "../ui/dialogs/StartDialog";
import { mvpEvents } from "../data/events";

describe("dialogs", () => {
  it("starts a game with selected faction", () => {
    const onStart = vi.fn();
    render(<StartDialog onStart={onStart} />);
    fireEvent.click(screen.getByText("开始推演"));
    expect(onStart).toHaveBeenCalledWith("ming", 157301);
  });

  it("resolves event options", () => {
    const onResolve = vi.fn();
    render(<EventDialog event={mvpEvents[0]} onResolve={onResolve} />);
    fireEvent.click(screen.getByText(mvpEvents[0].options[0].name));
    expect(onResolve).toHaveBeenCalledWith(mvpEvents[0].options[0].id);
  });
});
