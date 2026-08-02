import './header-stage.css';

/** Banner artwork only — used in Visuals previews + JPG export. */
export function ReadmeHeaderArt() {
  return (
    <div id="wt-readme-header" className="wt-readme-header" aria-label="Watchtower README header artwork">
      <div className="wt-readme-header__sky" aria-hidden />
      <div className="wt-readme-header__blocks" aria-hidden />
      <div className="wt-readme-header__horizon" aria-hidden />
      <div className="wt-readme-header__beam" aria-hidden />
      <div className="wt-readme-header__grid" aria-hidden />
      <div className="wt-readme-header__noise" aria-hidden />

      <div className="wt-readme-header__body">
        <div className="wt-readme-header__brand">
          <div className="wt-readme-header__mark">
            <div>
              <div className="wt-readme-header__name">Watchtower</div>
              <div className="wt-readme-header__eyebrow">For NeoForge Minecraft servers</div>
            </div>
          </div>

          <p className="wt-readme-header__headline">
            Keep your Minecraft server healthy — without digging through logs all night.
          </p>
          <p className="wt-readme-header__sub">
            See lag, crashes, mod trouble, and backups in one dashboard on your server. Built for dedicated hosts —
            works with or without a big mod list. No cloud account.
          </p>
        </div>

        <div className="wt-readme-header__product" aria-hidden>
          <div className="wt-readme-header__chrome">
            <span className="wt-readme-header__dot" />
            <span className="wt-readme-header__dot" />
            <span className="wt-readme-header__dot" />
            <span className="wt-readme-header__chrome-title">localhost:8787 · Overview</span>
          </div>

          <div className="wt-readme-header__mission">
            <div className="wt-readme-header__mission-top">
              <div className="wt-readme-header__grade">B+</div>
              <div className="wt-readme-header__verdict">Server needs a few fixes</div>
            </div>
            <div className="wt-readme-header__vitals">
              <div className="wt-readme-header__vital">
                <div className="wt-readme-header__vital-k">TPS</div>
                <div className="wt-readme-header__vital-v">19.8</div>
              </div>
              <div className="wt-readme-header__vital">
                <div className="wt-readme-header__vital-k">MSPT</div>
                <div className="wt-readme-header__vital-v">12.4</div>
              </div>
              <div className="wt-readme-header__vital">
                <div className="wt-readme-header__vital-k">Online</div>
                <div className="wt-readme-header__vital-v">6</div>
              </div>
              <div className="wt-readme-header__vital">
                <div className="wt-readme-header__vital-k">Mods</div>
                <div className="wt-readme-header__vital-v">148</div>
              </div>
            </div>
          </div>

          <div className="wt-readme-header__rows">
            <div className="wt-readme-header__row">
              <strong>Server can&apos;t keep up</strong>
              <span className="wt-readme-header__tone wt-readme-header__tone--warn">Lag</span>
            </div>
            <div className="wt-readme-header__row">
              <strong>World backup is fresh</strong>
              <span className="wt-readme-header__tone wt-readme-header__tone--ok">OK</span>
            </div>
            <div className="wt-readme-header__row">
              <strong>Crash report to review</strong>
              <span className="wt-readme-header__tone wt-readme-header__tone--accent">Open</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
