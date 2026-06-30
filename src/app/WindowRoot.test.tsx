import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import i18n from "@/i18n";
import { WindowRoot } from "./WindowRoot";

describe("WindowRoot", () => {
  it("renders the preferences window for the current Tauri window label", () => {
    render(<WindowRoot />);

    expect(screen.getByRole("tablist", { name: i18n.t("preferences.title") })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: i18n.t("preferences.nav.general") })).toBeInTheDocument();
    expect(screen.getByLabelText(i18n.t("generalSettings.language.label"))).toBeInTheDocument();
  });
});
