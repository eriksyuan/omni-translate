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
} from "@/windows/shared/icons";
import styles from "./audio-config.module.css";

type DepState = "idle" | "installing" | "done";

function InstallProgress() {
  const [full, setFull] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setFull(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <div className={`${styles.progress} ${full ? styles.progressFull : ""}`}>
      <i />
    </div>
  );
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
    <main className={styles.panel}>
      <div className={styles.body}>
        <div className={styles.title}>
          <span className={styles.gico}>
            <MicIcon size={17} />
          </span>
          {t("audioConfig.panelTitle")}
        </div>

        <div className={`banner ${styles.banner} ${ready ? styles.bannerCollapsed : ""}`}>
          <div className={styles.bannerInner}>
            <WarningIcon size={18} />
            <div style={{ flex: 1 }}>
              <b className={styles.bannerTitle}>{t("audioConfig.banner.title")}</b>
              <div className={styles.deps}>
                <div className={`${styles.dep} ${mic === "done" ? styles.depDone : ""}`}>
                  <span className={styles.dico}>
                    {mic === "done" ? <CircleCheckIcon size={15} /> : <MicIcon size={15} />}
                  </span>
                  <span className={styles.dname}>{t("audioConfig.dep.mic")}</span>
                  {mic === "done" ? (
                    <span className="pill pill--ok">
                      <CheckIcon size={11} />
                      {t("audioConfig.dep.granted")}
                    </span>
                  ) : (
                    <button type="button" className="btn" onClick={grantMic}>
                      {t("audioConfig.dep.grant")}
                    </button>
                  )}
                </div>

                <div className={`${styles.dep} ${black === "done" ? styles.depDone : ""}`}>
                  <span className={styles.dico}>
                    {black === "done" ? <CircleCheckIcon size={15} /> : <SpeakerIcon size={15} />}
                  </span>
                  <span className={styles.dname}>{t("audioConfig.dep.blackhole")}</span>
                  {black === "done" ? (
                    <span className="pill pill--ok">
                      <CheckIcon size={11} />
                      {t("audioConfig.dep.installed")}
                    </span>
                  ) : black === "installing" ? (
                    <InstallProgress />
                  ) : (
                    <button type="button" className="btn" onClick={installBlack}>
                      {t("audioConfig.dep.install")}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {ready ? (
          <div className={styles.readyPills}>
            <span className="pill pill--ok">
              <CheckIcon size={12} />
              {t("audioConfig.ready.mic")}
            </span>
            <span className="pill pill--ok">
              <CheckIcon size={12} />
              {t("audioConfig.ready.blackhole")}
            </span>
          </div>
        ) : null}

        <div className={`${styles.ctl} ${ready ? "" : styles.ctlDisabled}`}>
          <span className={styles.ctlLabel}>{t("audioConfig.field.source")}</span>
          {ready ? (
            <div className="select">
              <select aria-label={t("audioConfig.field.source")}>
                <option>{t("audioConfig.source.blackhole")}</option>
                <option>{t("audioConfig.source.mic")}</option>
              </select>
            </div>
          ) : (
            <div className={styles.lockedField}>
              <MicIcon size={14} />
              {t("audioConfig.field.locked")}
            </div>
          )}
        </div>

        <div className={styles.ctl}>
          <span className={styles.ctlLabel}>{t("audioConfig.field.asr")}</span>
          <div className="select">
            <select aria-label={t("audioConfig.field.asr")}>
              <option>{t("audioConfig.asr.whisperBase")}</option>
              <option>{t("audioConfig.asr.whisperLarge")}</option>
              <option>{t("audioConfig.asr.aliyun")}</option>
            </select>
          </div>
        </div>

        <div className={styles.ctl}>
          <span className={styles.ctlLabel}>{t("audioConfig.field.mt")}</span>
          <div className="select">
            <select aria-label={t("audioConfig.field.mt")}>
              <option>{t("audioConfig.mt.deepseek")}</option>
              <option>{t("audioConfig.mt.localLlm")}</option>
              <option>{t("audioConfig.mt.deepl")}</option>
            </select>
          </div>
        </div>

        <button
          type="button"
          className={`btn btn--primary btn--lg btn--block ${styles.startBtn}`}
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
        </button>

        {ready ? (
          <div className={styles.okNote}>
            <CheckIcon size={16} />
            {t("audioConfig.okNote")}
          </div>
        ) : null}
      </div>
    </main>
  );
}
