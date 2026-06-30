import {
  defineConfig,
  presetAttributify,
  presetIcons,
  presetUno,
  transformerVariantGroup,
} from "unocss";

export default defineConfig({
  presets: [presetUno(), presetAttributify(), presetIcons()],
  transformers: [transformerVariantGroup()],
  theme: {
    colors: {
      accent: "var(--accent)",
      "accent-press": "var(--accent-press)",
      fg: {
        DEFAULT: "var(--fg)",
        2: "var(--fg2)",
        3: "var(--fg3)",
      },
      panel: "var(--panel)",
      field: "var(--field)",
      sep: "var(--sep)",
      hairline: "var(--hairline)",
      hover: "var(--hover)",
      control: "var(--control)",
      success: "var(--success)",
      danger: "var(--danger)",
      hi: "var(--hi)",
      "win-bg": "var(--win-bg)",
      "win-solid": "var(--win-solid)",
      warn: {
        bg: "var(--warn-bg)",
        fg: "var(--warn-fg)",
        bd: "var(--warn-bd)",
      },
    },
    borderRadius: {
      sm: "var(--radius-sm)",
      DEFAULT: "var(--radius)",
    },
    fontFamily: {
      sans: "var(--font)",
      mono: "var(--mono)",
    },
    transitionTimingFunction: {
      mac: "var(--ease)",
    },
    boxShadow: {
      win: "var(--shadow-win)",
    },
  },
  shortcuts: {
    btn: [
      "appearance-none border-0 cursor-pointer font-inherit text-[13.5px] font-510",
      "px-4 py-2 rounded-sm inline-flex items-center justify-center gap-[7px]",
      "bg-control text-fg transition-all duration-[120ms] ease-[var(--ease)]",
      "hover:brightness-108 active:translate-y-px",
      "disabled:opacity-40 disabled:cursor-not-allowed disabled:brightness-100 disabled:transform-none",
    ].join(" "),
    "btn-primary":
      "btn bg-accent text-white shadow-[0_1px_3px_rgba(0,0,0,0.12)] hover:bg-accent hover:brightness-106",
    "btn-ghost": "btn bg-transparent text-accent hover:bg-hover hover:brightness-100",
    "btn-danger":
      "btn bg-[color-mix(in_srgb,var(--danger)_16%,transparent)] text-danger hover:brightness-100",
    "btn-lg": "px-5 py-[11px] text-[14.5px]",
    "btn-block": "w-full",
    field: [
      "appearance-none w-full font-inherit text-[13.5px] text-fg bg-field",
      "border-[0.5px] border-hairline border-solid rounded-sm px-3 py-2",
      "transition-[border-color,box-shadow] duration-150",
      "placeholder:text-fg-3",
      "focus:outline-none focus:border-accent",
      "focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_28%,transparent)]",
    ].join(" "),
    "field-mono": "field font-mono text-[12.5px]",
    pill: "inline-flex items-center gap-[5px] text-[11.5px] font-590 px-[9px] py-[3px] rounded-full",
    "pill-ok": "pill bg-[color-mix(in_srgb,var(--success)_18%,transparent)] text-success",
    "pill-bad": "pill bg-[color-mix(in_srgb,var(--danger)_16%,transparent)] text-danger",
    "pill-info": "pill bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] text-accent",
    banner: [
      "flex gap-3 items-start bg-warn-bg text-warn-fg",
      "border border-warn-bd border-solid rounded-sm px-[14px] py-3",
      "text-[13px] leading-normal overflow-hidden",
      "[&_svg]:flex-none [&_svg]:mt-px",
    ].join(" "),
    "win-shell":
      "min-h-full bg-win-bg backdrop-blur-[42px] backdrop-saturate-180 [-webkit-backdrop-filter:blur(42px)_saturate(180%)]",
    formcard: "bg-field border-[0.5px] border-hairline border-solid rounded overflow-hidden",
    frow: "flex items-center justify-between gap-4 px-4 py-[13px] border-b-[0.5px] border-sep border-solid last:border-b-0",
    "frow-col": "flex-col items-stretch",
    footbar: "flex justify-end gap-[10px] pt-[18px] mt-[22px]",
    "field-row":
      "flex flex-col gap-[6px] px-4 py-[13px] border-b-[0.5px] border-sep border-solid last:border-b-0",
    "field-textarea": "field font-mono text-[12.5px] leading-normal resize-y",
    eyebrow: "text-[11px] font-590 uppercase tracking-[0.08em] text-fg-3",
    muted: "text-fg-2",
    mono: "font-mono tabular-nums",
    "icon-box":
      "w-[26px] h-[26px] rounded-[7px] grid place-items-center flex-none bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] text-accent",
    "icon-box-lg":
      "w-[30px] h-[30px] rounded-sm grid place-items-center flex-none bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] text-accent",
    "icon-box-xl":
      "w-[58px] h-[58px] rounded-[14px] grid place-items-center flex-none bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] text-accent",
  },
  safelist: [
    "animate-fade",
    "animate-pop",
    "animate-nudge",
    "animate-fadein",
    "ocr-sel",
    "subtitle-locked-text",
    "subtitle-locked-hl",
  ],
});
