import React from "react";
import type { WeatherState } from "./WaterGame";

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
  gameOver: boolean;
  nearShop: boolean;
  onOpenShop: () => void;
  buildMode: boolean;
  onToggleBuild: () => void;
  wellCost: number;
  weather: WeatherState;
  weatherIntensity: number;
}

function MetricBar({ label, value, max, color, icon, warn }: {
  label: string; value: number; max: number; color: string; icon: string; warn?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between mb-1">
        <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "7px", color: warn ? "#e84040" : "#e8d5a3" }}>
          {icon} {label}
        </span>
        <span style={{ fontFamily: "'VT323', monospace", fontSize: "13px", color: warn ? "#e84040" : "#e8d5a3" }}>
          {Math.floor(value)}/{max}
        </span>
      </div>
      <div style={{ height: "9px", background: "#1a120a", border: `2px solid ${warn ? "#e84040" : "#5c4020"}`, overflow: "hidden" }}>
        <div className="h-full transition-all duration-200" style={{
          width: `${pct}%`, background: color,
          boxShadow: `0 0 6px ${color}88`,
        }} />
      </div>
    </div>
  );
}

function FilterBadge({ hasFilter, contaminated }: { hasFilter: boolean; contaminated: boolean }) {
  const bg = hasFilter ? "rgba(30,90,30,0.5)" : contaminated ? "rgba(120,20,10,0.6)" : "rgba(50,30,10,0.5)";
  const border = hasFilter ? "#5a9a30" : contaminated ? "#e84040" : "#5c4020";
  const label = hasFilter ? "🔵 FILTER: ON" : contaminated ? "☠ DIRTY WATER" : "🔵 FILTER: NONE";
  const textColor = hasFilter ? "#8be060" : contaminated ? "#e84040" : "#7c5030";
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
  if (weather === "clear" || intensity < 0.1) return null;
  const isRain = weather === "rain";
  const alpha = Math.min(1, intensity * 1.5);
  return (
    <div style={{
      marginTop: "6px",
      background: isRain ? `rgba(20,50,120,${alpha * 0.7})` : `rgba(120,60,0,${alpha * 0.7})`,
      border: `2px solid ${isRain ? `rgba(100,180,255,${alpha})` : `rgba(255,160,20,${alpha})`}`,
      borderRadius: "3px", padding: "4px 8px",
      display: "flex", alignItems: "center", gap: "6px",
      boxShadow: isRain ? `0 0 10px rgba(80,150,255,${alpha * 0.5})` : `0 0 10px rgba(255,140,0,${alpha * 0.5})`,
    }}>
      <span style={{ fontSize: "14px" }}>{isRain ? "⛈" : "☀"}</span>
      <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "6px", color: isRain ? "#a0d0ff" : "#f5b030" }}>
        {isRain ? "RAIN — WELLS FILL" : "DROUGHT — WELLS DRY"}
      </span>
      <div style={{ marginLeft: "auto", width: "36px", height: "5px", background: "#1a120a", border: "1px solid #3a2810", overflow: "hidden" }}>
        <div style={{ width: `${intensity * 100}%`, height: "100%", background: isRain ? "#6ec6ff" : "#f5a020" }} />
      </div>
    </div>
  );
}

export function GameHUD({
  health, waterCollected, maxWater, bucketContaminated, hasFilter,
  moneyRaised, donationRate, population, day, timeOfDay,
  onNewDay, gameOver, nearShop, onOpenShop, buildMode, onToggleBuild, wellCost,
  weather, weatherIntensity,
}: HUDProps) {
  const hourDisplay = Math.floor(timeOfDay * 24);
  const ampm = hourDisplay >= 12 ? "PM" : "AM";
  const hour12 = hourDisplay % 12 === 0 ? 12 : hourDisplay % 12;
  const displayMoney = moneyRaised.toFixed(2);
  const displayRate = donationRate.toFixed(2);
  const canBuildWell = moneyRaised >= wellCost;

  return (
    <div
      className="absolute top-0 left-0 right-0 z-10 flex items-start justify-between p-3 pointer-events-none"
      style={{ background: "linear-gradient(to bottom, rgba(10,6,2,0.92) 0%, transparent 100%)" }}
    >
      {/* Left: Metrics panel */}
      <div className="pointer-events-auto" style={{
        background: "rgba(20,12,5,0.92)", border: "2px solid #5c4020",
        borderRadius: "4px", padding: "10px 13px", minWidth: "215px",
        boxShadow: "0 0 16px rgba(0,0,0,0.6)",
      }}>
        <MetricBar label="HEALTH" value={health} max={100} color="#e84040" icon="❤" />
        <MetricBar
          label="WATER" value={waterCollected} max={maxWater}
          color={bucketContaminated && !hasFilter ? "#8b5020" : "#1e90ff"} icon="💧"
          warn={bucketContaminated && !hasFilter}
        />
        <FilterBadge hasFilter={hasFilter} contaminated={bucketContaminated && !hasFilter} />
        <WeatherBadge weather={weather} intensity={weatherIntensity} />

        <div className="mt-3 pt-2" style={{ borderTop: "1px solid #5c4020" }}>
          {/* Money */}
          <div className="flex justify-between items-end mb-1">
            <div>
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "6px", color: "#a0826a" }}>💰 FUNDS</div>
              <div style={{ fontFamily: "'VT323', monospace", fontSize: "24px", color: "#f5c842", lineHeight: 1 }}>
                ${displayMoney}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "6px", color: "#a0826a" }}>DONATIONS/DAY</div>
              <div style={{ fontFamily: "'VT323', monospace", fontSize: "18px", color: "#c0a030", lineHeight: 1 }}>
                +${displayRate}
              </div>
            </div>
          </div>
          {/* Population */}
          <div>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "6px", color: "#a0826a" }}>🏘 POPULATION</div>
            <div style={{ fontFamily: "'VT323', monospace", fontSize: "22px", color: "#8be060" }}>{population}</div>
          </div>
        </div>

        {/* Shop button */}
        <button onClick={onOpenShop} style={{
          marginTop: "6px", width: "100%",
          fontFamily: "'Press Start 2P', monospace", fontSize: "6px",
          background: nearShop ? "#3d2a00" : "#1e150a",
          color: nearShop ? "#f5c842" : "#5c4020",
          border: `2px solid ${nearShop ? "#f5c842" : "#3a2810"}`,
          borderRadius: "2px", padding: "5px 8px", cursor: "pointer",
          transition: "all 0.2s", boxShadow: nearShop ? "0 0 10px #f5c84260" : "none",
        }}>
          🛒 SHOP {nearShop ? "(NEAR!)" : ""}
        </button>

        {/* Build Well button */}
        <button onClick={onToggleBuild} style={{
          marginTop: "5px", width: "100%",
          fontFamily: "'Press Start 2P', monospace", fontSize: "6px",
          background: buildMode ? "#1a3a10" : (canBuildWell ? "#0e1e30" : "#100a06"),
          color: buildMode ? "#8be060" : (canBuildWell ? "#6ec6ff" : "#3a2810"),
          border: `2px solid ${buildMode ? "#8be060" : (canBuildWell ? "#4a8ab0" : "#2a1808")}`,
          borderRadius: "2px", padding: "5px 8px", cursor: "pointer",
          boxShadow: buildMode ? "0 0 8px #8be06050" : "none",
        }}>
          {buildMode ? "★ PLACING WELL [B]" : `⛏ BUILD WELL $${wellCost}`}
        </button>
        {buildMode && (
          <div style={{ fontFamily: "'VT323', monospace", fontSize: "12px", color: "#8be060", textAlign: "center", marginTop: "3px" }}>
            Walk to spot → [SPACE]
          </div>
        )}
      </div>

      {/* Center: Day & Time */}
      <div className="pointer-events-auto text-center" style={{
        background: "rgba(20,12,5,0.92)", border: "2px solid #5c4020",
        borderRadius: "4px", padding: "8px 16px",
        boxShadow: "0 0 16px rgba(0,0,0,0.6)",
      }}>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "9px", color: "#a0826a" }}>DAY</div>
        <div style={{ fontFamily: "'VT323', monospace", fontSize: "36px", color: "#f5c842", lineHeight: 1 }}>{day}</div>
        <div style={{ fontFamily: "'VT323', monospace", fontSize: "16px", color: "#e8d5a3" }}>{hour12}:00 {ampm}</div>
        <div style={{ height: "6px", background: "#1a120a", border: "1px solid #5c4020", width: "80px", margin: "4px auto 0", overflow: "hidden" }}>
          <div style={{
            width: `${timeOfDay * 100}%`, height: "100%",
            background: timeOfDay < 0.5 ? `hsl(${40 + timeOfDay * 100},80%,55%)` : `hsl(${40 + (1 - timeOfDay) * 100},60%,35%)`,
          }} />
        </div>
        {/* Donation ticker */}
        <div style={{ marginTop: "8px", borderTop: "1px solid #3a2810", paddingTop: "6px" }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "6px", color: "#6a5030" }}>EARNINGS RATE</div>
          <div style={{ fontFamily: "'VT323', monospace", fontSize: "14px", color: "#c0a030" }}>
            ${(donationRate / DAY_DURATION).toFixed(4)}/sec
          </div>
        </div>
      </div>

      {/* Right: Controls */}
      <div className="pointer-events-auto text-right" style={{
        background: "rgba(20,12,5,0.92)", border: "2px solid #5c4020",
        borderRadius: "4px", padding: "10px 14px",
        boxShadow: "0 0 16px rgba(0,0,0,0.6)",
      }}>
        {gameOver ? (
          <div>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "8px", color: "#e84040", marginBottom: "6px" }}>GAME OVER</div>
            <button onClick={onNewDay} style={{
              fontFamily: "'Press Start 2P', monospace", fontSize: "7px",
              background: "#3a5c20", color: "#8be060", border: "2px solid #8be060",
              borderRadius: "2px", padding: "6px 10px", cursor: "pointer",
            }}>RESTART</button>
          </div>
        ) : (
          <div>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "6px", color: "#a0826a", marginBottom: "5px" }}>CONTROLS</div>
            <div style={{ fontFamily: "'VT323', monospace", fontSize: "13px", color: "#e8d5a3", lineHeight: 1.8, textAlign: "right" }}>
              WASD / ↑↓←→ Move<br />
              Walk to 💧 Collect<br />
              Deliver to 🏘 Village<br />
              [E] Open Shop<br />
              [B] Build Well Mode
            </div>
            <div style={{ marginTop: "8px", borderTop: "1px solid #3a2810", paddingTop: "6px" }}>
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "6px", color: "#6a5030" }}>
                ⚠ BROWN WATER = DIRTY
              </div>
              <div style={{ fontFamily: "'VT323', monospace", fontSize: "12px", color: "#8b5020" }}>
                Buy Filter to purify
              </div>
            </div>
            <button onClick={onNewDay} style={{
              marginTop: "8px",
              fontFamily: "'Press Start 2P', monospace", fontSize: "7px",
              background: "#1e4070", color: "#6ec6ff", border: "2px solid #6ec6ff",
              borderRadius: "2px", padding: "6px 10px", cursor: "pointer",
            }}>NEW DAY</button>
          </div>
        )}
      </div>
    </div>
  );
}

const DAY_DURATION = 60;
