import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WindowRoot } from "./WindowRoot";

describe("WindowRoot", () => {
  it("renders the preferences window for the current Tauri window label", () => {
    render(<WindowRoot />);

    expect(screen.getByRole("heading", { name: "OmniTranslate 设置" })).toBeInTheDocument();
  });
});
