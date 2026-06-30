import React from "react";
import type { WeatherState } from "./WaterGame";

const CW = {
  yellow: "#FFC907",
  navy: "#003366",
  blue: "#77A8BB",
  cream: "#FFF7E1",
  black: "#1A1A1A",
  peach: "#FED8C1",
  orange: "#BF6C46",
  gray: "#CBCDD1",
};

interface HUDProps {
  health: number;
  waterCollected: number;
  maxWater: number;
  bucketContaminated: boolean;
  hasFilter: boolean;
  moneyRaised: number;
  donationRate: number;
  population: number;
  day: number;
  timeOfDay: number;
  onNewDay: () => void;
  onResetGame: () => void;
  gameOver: boolean;
  nearShop: boolean;
  onOpenShop: () => void;
  buildMode: boolean;
  onToggleBuild: () => void;
  wellCost: number;
  weather: WeatherState;
  weatherIntensity: number;
  isMobile: boolean;
  healthDrainMultiplier: number;
}

function MetricBar({ label, value, max, color, icon, warn }: {
  label: string; value: number; max: number; color: string; icon: string; warn?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="mb-1">
      <div className="flex items-center justify-between mb-1">
        <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "8px", color: warn ? CW.orange : CW.cream }}>
          {icon} {label}
        </span>
        <span style={{ fontFamily: "'VT323', monospace", fontSize: "15px", color: warn ? CW.orange : CW.cream }}>
          {Math.floor(value)}/{max}
        </span>
      </div>
      <div style={{ height: "6px", background: CW.black, border: `1px solid ${warn ? CW.orange : CW.navy}`, overflow: "hidden" }}>
        <div className="h-full transition-all duration-200" style={{
          width: `${pct}%`, background: color,
          boxShadow: `0 0 6px ${color}88`,
        }} />
      </div>
    </div>
  );
}

function FilterBadge({ hasFilter, contaminated }: { hasFilter: boolean; contaminated: boolean }) {
  const bg = hasFilter ? "rgba(0,51,102,0.62)" : contaminated ? "rgba(191,108,70,0.65)" : "rgba(26,26,26,0.65)";
  const border = hasFilter ? CW.blue : contaminated ? CW.orange : CW.navy;
  const label = hasFilter ? "🔵 FILTER: ON" : contaminated ? "☠ DIRTY WATER" : "🔵 FILTER: NONE";
  const textColor = hasFilter ? CW.blue : contaminated ? CW.peach : CW.gray;
  return (
    <div style={{
      background: bg, border: `2px solid ${border}`, borderRadius: "3px",
      padding: "3px 7px", marginTop: "6px",
      display: "flex", alignItems: "center", gap: "6px",
    }}>
      <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "6px", color: textColor }}>
        {label}
      </span>
    </div>
  );
}

function WeatherBadge({ weather, intensity }: { weather: WeatherState; intensity: number }) {
  const isRain = weather === "rain";
  const alpha = Math.min(1, intensity * 1.5);
  const show = weather !== "clear" && intensity >= 0.1;
  return (
    <div style={{ marginTop: "6px", minHeight: "27px" }}>
      <div style={{
        visibility: show ? "visible" : "hidden",
        background: isRain ? `rgba(0,51,102,${alpha * 0.7})` : `rgba(191,108,70,${alpha * 0.7})`,
        border: `2px solid ${isRain ? `rgba(119,168,187,${alpha})` : `rgba(255,201,7,${alpha})`}`,
        borderRadius: "3px", padding: "4px 8px",
        display: "flex", alignItems: "center", gap: "6px",
        boxShadow: isRain ? `0 0 10px rgba(119,168,187,${alpha * 0.5})` : `0 0 10px rgba(255,201,7,${alpha * 0.5})`,
      }}>
        <span style={{ fontSize: "14px" }}>{isRain ? "⛈" : "☀"}</span>
        <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "6px", color: isRain ? CW.blue : CW.yellow }}>
          {isRain ? "RAIN — WELLS FILL" : "DROUGHT — WELLS DRY"}
        </span>
        <div style={{ marginLeft: "auto", width: "36px", height: "5px", background: CW.black, border: `1px solid ${CW.navy}`, overflow: "hidden" }}>
          <div style={{ width: `${intensity * 100}%`, height: "100%", background: isRain ? CW.blue : CW.yellow }} />
        </div>
      </div>
    </div>
  );
}

export function GameHUD({
  health, waterCollected, maxWater, bucketContaminated, hasFilter,
  moneyRaised, donationRate, population, day, timeOfDay,
  onNewDay, onResetGame, gameOver, nearShop, onOpenShop, buildMode, onToggleBuild, wellCost,
  weather, weatherIntensity,
  isMobile,
  healthDrainMultiplier,
}: HUDProps) {
  const hourDisplay = Math.floor(timeOfDay * 24);
  const ampm = hourDisplay >= 12 ? "PM" : "AM";
  const hour12 = hourDisplay % 12 === 0 ? 12 : hourDisplay % 12;
  const displayMoney = moneyRaised.toFixed(2);
  const displayRate = donationRate.toFixed(2);
  const canBuildWell = moneyRaised >= wellCost;
  const panelBg = "rgba(26,26,26,0.50)";

  return (
    <div
      className="absolute top-0 left-0 right-0 z-10 flex items-start justify-between p-3 pointer-events-none"
      style={{ background: isMobile ? "transparent" : "linear-gradient(to bottom, rgba(10,6,2,0.6) 0%, transparent 100%)" }}
    >
      {/* Left: Metrics panel */}
      <div className="pointer-events-auto" style={{
        background: panelBg, border: `2px solid ${CW.navy}`,
          borderRadius: "4px", padding: isMobile ? "7px 8px" : "9px 12px", minWidth: isMobile ? "152px" : "152px",
        boxShadow: "0 0 16px rgba(0,0,0,0.6)",
          maxWidth: "152px",
          position: isMobile ? "absolute" : "static",
          left: isMobile ? "8px" : "auto",
          top: isMobile ? "calc(env(safe-area-inset-top, 0px) + 8px)" : "auto",
          transform: "none",
      }}>
        <MetricBar label="HEALTH" value={health} max={100} color={CW.orange} icon="❤" />
        <MetricBar
          label="WATER" value={waterCollected} max={maxWater}
          color={bucketContaminated && !hasFilter ? CW.orange : CW.blue} icon="⛽"
          warn={bucketContaminated && !hasFilter}
        />
        <FilterBadge hasFilter={hasFilter} contaminated={bucketContaminated && !hasFilter} />
        {bucketContaminated && !hasFilter && (
          <div style={{ marginTop: "6px", textAlign: "center" }}>
            <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "6px", color: CW.orange }}>
              HEALTH DRAIN x{healthDrainMultiplier}
            </span>
          </div>
        )}
        <WeatherBadge weather={weather} intensity={weatherIntensity} />

        <div className="mt-3 pt-2" style={{ borderTop: `1px solid ${CW.navy}` }}>
          {/* Money */}
          <div className="flex justify-between items-end mb-1">
            <div>
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "6px", color: CW.gray }}>💰 FUNDS</div>
                <div style={{ fontFamily: "'VT323', monospace", fontSize: isMobile ? "20px" : "24px", color: CW.yellow, lineHeight: 1 }}>
                ${displayMoney}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "6px", color: CW.gray }}>DONATIONS/DAY</div>
                <div style={{ fontFamily: "'VT323', monospace", fontSize: isMobile ? "15px" : "18px", color: CW.blue, lineHeight: 1 }}>
                +${displayRate}
              </div>
            </div>
          </div>
          {/* Population */}
          <div>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "6px", color: CW.gray }}>🏘 POPULATION</div>
              <div style={{ fontFamily: "'VT323', monospace", fontSize: isMobile ? "18px" : "22px", color: CW.peach }}>{population}</div>
          </div>
        </div>

      </div>

      {/* Center: Day & Time */}
      <div className="pointer-events-auto text-center" style={{
        background: panelBg, border: `2px solid ${CW.navy}`,
        borderRadius: "4px", padding: isMobile ? "6px 10px" : "8px 16px",
        boxShadow: "0 0 16px rgba(0,0,0,0.6)",
          position: isMobile ? "absolute" : "static",
          right: isMobile ? "8px" : "auto",
          top: isMobile ? "8px" : "auto",
          transform: "none",
      }}>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "9px", color: CW.gray }}>DAY</div>
        <div style={{ fontFamily: "'VT323', monospace", fontSize: "36px", color: CW.yellow, lineHeight: 1 }}>{day}</div>
        <div style={{ fontFamily: "'VT323', monospace", fontSize: "16px", color: CW.cream }}>{hour12}:00 {ampm}</div>
        <div style={{ height: "6px", background: CW.black, border: `1px solid ${CW.navy}`, width: "80px", margin: "4px auto 0", overflow: "hidden" }}>
          <div style={{
            width: `${timeOfDay * 100}%`, height: "100%",
            background: timeOfDay < 0.5 ? CW.yellow : CW.orange,
          }} />
        </div>
        {/* Donation ticker */}
        <div style={{ marginTop: "8px", borderTop: `1px solid ${CW.navy}`, paddingTop: "6px" }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "6px", color: CW.gray }}>EARNINGS RATE</div>
          <div style={{ fontFamily: "'VT323', monospace", fontSize: "14px", color: CW.blue }}>
            ${(donationRate / DAY_DURATION).toFixed(4)}/sec
          </div>
        </div>
        <div style={{
          marginTop: "8px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "6px",
          width: isMobile ? "88px" : "84px",
          marginLeft: "auto",
          marginRight: "auto",
        }}>
          {gameOver && (
            <button onClick={onNewDay} style={{
              width: "100%",
              fontFamily: "'Press Start 2P', monospace", fontSize: "6px",
              background: CW.navy, color: CW.yellow, border: `2px solid ${CW.yellow}`,
              borderRadius: "2px", padding: isMobile ? "7px 0" : "6px 0", cursor: "pointer",
            }}>
              RESTART
            </button>
          )}
          {!gameOver && isMobile && (
            <button onClick={onNewDay} style={{
              width: "100%",
              fontFamily: "'Press Start 2P', monospace", fontSize: "6px",
              background: CW.navy, color: CW.blue, border: `2px solid ${CW.blue}`,
              borderRadius: "2px", padding: "7px 0", cursor: "pointer",
            }}>
              NEW DAY
            </button>
          )}
          <button onClick={onResetGame} style={{
            width: "100%",
            fontFamily: "'Press Start 2P', monospace", fontSize: "6px",
            background: "#2A1010", color: CW.peach, border: `2px solid ${CW.orange}`,
            borderRadius: "2px", padding: isMobile ? "7px 0" : "6px 0", cursor: "pointer",
          }}>
            RESET
          </button>
        </div>
      </div>

      {/* Right: Controls */}
        <div className="pointer-events-auto text-right" style={{
        background: panelBg, border: `2px solid ${CW.navy}`,
        borderRadius: "4px", padding: isMobile ? "8px 10px" : "10px 14px",
        boxShadow: "0 0 16px rgba(0,0,0,0.6)",
        display: isMobile ? "none" : "block",
        position: "static",
      }}>
        {gameOver ? (
          <div>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "8px", color: CW.orange, marginBottom: "6px" }}>GAME OVER</div>
            <button onClick={onNewDay} style={{
              fontFamily: "'Press Start 2P', monospace", fontSize: "7px",
              background: CW.navy, color: CW.yellow, border: `2px solid ${CW.yellow}`,
              borderRadius: "2px", padding: "6px 10px", cursor: "pointer",
            }}>RESTART</button>
          </div>
        ) : (
          <div>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "6px", color: CW.gray, marginBottom: "5px" }}>CONTROLS</div>
            <div style={{ fontFamily: "'VT323', monospace", fontSize: "13px", color: CW.cream, lineHeight: 1.8, textAlign: "right" }}>
              WASD / ↑↓←→ Move<br />
              Touch joystick to move<br />
              Walk to ⛽ Collect<br />
              Deliver to 🏘 Village<br />
              [E] Open Shop<br />
              [B] Build Well Mode
            </div>
            <div style={{ marginTop: "8px", borderTop: `1px solid ${CW.navy}`, paddingTop: "6px" }}>
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "6px", color: CW.gray }}>
                ⚠ BROWN WATER = DIRTY
              </div>
              <div style={{ fontFamily: "'VT323', monospace", fontSize: "12px", color: CW.orange }}>
                Buy Filter to purify
              </div>
            </div>
            <button onClick={onNewDay} style={{
              marginTop: "8px",
              fontFamily: "'Press Start 2P', monospace", fontSize: "7px",
              background: CW.navy, color: CW.blue, border: `2px solid ${CW.blue}`,
              borderRadius: "2px", padding: "6px 10px", cursor: "pointer",
            }}>NEW DAY</button>
          </div>
        )}
      </div>
    </div>
  );
}

const DAY_DURATION = 60;
