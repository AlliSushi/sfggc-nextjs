import { useEffect, useRef } from "react";
import styles from "./PortalShell.module.scss";

const PortalShell = ({ title, subtitle, children }) => {
  const lastPingRef = useRef(0);

  useEffect(() => {
    document.body.classList.add("portal-mode");
    const handleActivity = () => {
      const now = Date.now();
      if (now - lastPingRef.current < 60 * 1000) return;
      lastPingRef.current = now;
      // Use raw fetch — PortalShell wraps public pages (login, ack) too,
      // so a 401 on the refresh ping should be silently ignored, not redirect.
      fetch("/api/portal/admin/refresh").catch(() => {});
    };

    const events = ["click", "keydown", "scroll", "touchstart"];
    events.forEach((event) => window.addEventListener(event, handleActivity, true));
    return () => {
      document.body.classList.remove("portal-mode");
      events.forEach((event) => window.removeEventListener(event, handleActivity, true));
    };
  }, []);

  return (
    <section className={`${styles.PortalShell} container`}>
      <div className="row">
        <div className="col-12 col-lg-10">
          <h1 className="section-heading">{title}</h1>
          {subtitle && <p className="lead">{subtitle}</p>}
        </div>
      </div>
      <div className="row">
        <div className="col-12">{children}</div>
      </div>
    </section>
  );
};

export default PortalShell;
