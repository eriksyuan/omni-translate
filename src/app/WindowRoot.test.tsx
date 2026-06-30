import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WindowRoot } from "./WindowRoot";

describe("WindowRoot", () => {
  it("renders the tray menu for the current Tauri window label", () => {
    render(<WindowRoot />);

    expect(screen.getByRole("navigation", { name: "OmniTranslate 菜单" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /音频实时翻译/ })).toBeInTheDocument();
  });
});
