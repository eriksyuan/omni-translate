import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CheckIcon,
  CircleCheckIcon,
  MicIcon,
  PlayIcon,
  SpeakerIcon,
  SpinnerIcon,
  WarningIcon,
} from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Select } from "@/components/ui/select";
import { WindowShell } from "@/components/ui/window-shell";
import { cn } from "@/lib/cn";

type DepState = "idle" | "installing" | "done";

function InstallProgress() {
  const [full, setFull] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setFull(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return <ProgressBar value={full ? 100 : 0} animated className="w-24 shrink-0" />;
}

export function AudioConfigWindow() {
  const { t } = useTranslation();
  const [mic, setMic] = useState<DepState>("idle");
  const [black, setBlack] = useState<DepState>("idle");
  const [listening, setListening] = useState(false);
  const installTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (installTimer.current) clearTimeout(installTimer.current);
    };
  }, []);

  const ready = mic === "done" && black === "done";

  const grantMic = () => setMic("done");
  const installBlack = () => {
    if (black !== "idle") return;
    setBlack("installing");
    installTimer.current = setTimeout(() => setBlack("done"), 950);
  };

  return (
    <WindowShell>
      <div className="p-[18px] flex flex-col gap-4">
        <div className="flex items-center gap-2.5 text-[15px] font-600">
          <span className="icon-box-lg">
            <MicIcon size={17} />
          </span>
          {t("audioConfig.panelTitle")}
        </div>

        <Banner
          className={cn(
            "transition-[max-height,opacity,padding,margin,border-width] duration-300 ease-mac overflow-hidden",
            ready ? "max-h-0 opacity-0 py-0 border-0 m-0" : "max-h-80",
          )}
        >
          <div className="flex gap-[11px] items-start">
            <WarningIcon size={18} />
            <div className="flex-1">
              <b className="font-600">{t("audioConfig.banner.title")}</b>
              <div className="flex flex-col gap-[9px] mt-2.5">
                <div className={cn("flex items-center gap-2.5 text-[12.5px]", mic === "done" && "text-fg-2")}>
                  <span className={cn("w-5 inline-flex justify-center flex-none", mic === "done" ? "text-success" : "text-warn-fg")}>
                    {mic === "done" ? <CircleCheckIcon size={15} /> : <MicIcon size={15} />}
                  </span>
                  <span className="flex-1">{t("audioConfig.dep.mic")}</span>
                  {mic === "done" ? (
                    <Badge variant="ok">
                      <CheckIcon size={11} />
                      {t("audioConfig.dep.granted")}
                    </Badge>
                  ) : (
                    <Button className="px-[11px] py-[5px] text-[12px]" onClick={grantMic}>
                      {t("audioConfig.dep.grant")}
                    </Button>
                  )}
                </div>

                <div className={cn("flex items-center gap-2.5 text-[12.5px]", black === "done" && "text-fg-2")}>
                  <span className={cn("w-5 inline-flex justify-center flex-none", black === "done" ? "text-success" : "text-warn-fg")}>
                    {black === "done" ? <CircleCheckIcon size={15} /> : <SpeakerIcon size={15} />}
                  </span>
                  <span className="flex-1">{t("audioConfig.dep.blackhole")}</span>
                  {black === "done" ? (
                    <Badge variant="ok">
                      <CheckIcon size={11} />
                      {t("audioConfig.dep.installed")}
                    </Badge>
                  ) : black === "installing" ? (
                    <InstallProgress />
                  ) : (
                    <Button className="px-[11px] py-[5px] text-[12px]" onClick={installBlack}>
                      {t("audioConfig.dep.install")}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Banner>

        {ready ? (
          <div className="flex gap-2.5">
            <Badge variant="ok">
              <CheckIcon size={12} />
              {t("audioConfig.ready.mic")}
            </Badge>
            <Badge variant="ok">
              <CheckIcon size={12} />
              {t("audioConfig.ready.blackhole")}
            </Badge>
          </div>
        ) : null}

        <div className={cn("flex flex-col gap-[7px]", !ready && "opacity-50")}>
          <span className="text-[12px] font-510 text-fg-2">{t("audioConfig.field.source")}</span>
          {ready ? (
            <Select
              ariaLabel={t("audioConfig.field.source")}
              options={[
                { value: "blackhole", label: t("audioConfig.source.blackhole") },
                { value: "mic", label: t("audioConfig.source.mic") },
              ]}
              defaultValue="blackhole"
            />
          ) : (
            <div className="flex items-center gap-2 bg-field border border-dashed border-hairline rounded-sm px-3 py-2 text-[12.5px] text-fg-3">
              <MicIcon size={14} />
              {t("audioConfig.field.locked")}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-[7px]">
          <span className="text-[12px] font-510 text-fg-2">{t("audioConfig.field.asr")}</span>
          <Select
            ariaLabel={t("audioConfig.field.asr")}
            options={[
              { value: "whisperBase", label: t("audioConfig.asr.whisperBase") },
              { value: "whisperLarge", label: t("audioConfig.asr.whisperLarge") },
              { value: "aliyun", label: t("audioConfig.asr.aliyun") },
            ]}
            defaultValue="whisperBase"
          />
        </div>

        <div className="flex flex-col gap-[7px]">
          <span className="text-[12px] font-510 text-fg-2">{t("audioConfig.field.mt")}</span>
          <Select
            ariaLabel={t("audioConfig.field.mt")}
            options={[
              { value: "deepseek", label: t("audioConfig.mt.deepseek") },
              { value: "localLlm", label: t("audioConfig.mt.localLlm") },
              { value: "deepl", label: t("audioConfig.mt.deepl") },
            ]}
            defaultValue="deepseek"
          />
        </div>

        <Button
          variant="primary"
          size="lg"
          block
          className="mt-1"
          disabled={!ready}
          aria-disabled={!ready}
          onClick={() => ready && setListening(true)}
        >
          {listening ? (
            <>
              <SpinnerIcon size={15} />
              {t("audioConfig.start.listening")}
            </>
          ) : (
            <>
              <PlayIcon size={16} />
              {t("audioConfig.start.idle")}
            </>
          )}
        </Button>

        {ready ? (
          <div className="flex items-center gap-2 text-[12.5px] text-success font-510 animate-pop">
            <CheckIcon size={16} />
            {t("audioConfig.okNote")}
          </div>
        ) : null}
      </div>
    </WindowShell>
  );
}
