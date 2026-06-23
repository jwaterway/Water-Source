import React from "react";
import { UPGRADES } from "./WaterGame";

interface UpgradeShopProps {
  money: number;
  purchasedUpgrades: Set<string>;
  onBuy: (id: string) => void;
  onClose: () => void;
}

const PREREQS: Record<string, string> = {
  jug2: "jug1",
  speed2: "speed1",
};

export function UpgradeShop({ money, purchasedUpgrades, onBuy, onClose }: UpgradeShopProps) {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center z-20"
      style={{ background: "rgba(0,0,0,0.65)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "#1a0e06", border: "3px solid #8b6230", borderRadius: "6px",
        minWidth: "480px", maxWidth: "92vw",
        boxShadow: "0 0 40px rgba(0,0,0,0.9)", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          background: "linear-gradient(135deg,#3d1e0a,#5c3018)",
          borderBottom: "2px solid #8b6230",
          padding: "14px 20px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "12px", color: "#f5c842" }}>🛒 UPGRADE SHOP</div>
            <div style={{ fontFamily: "'VT323', monospace", fontSize: "15px", color: "#a0826a", marginTop: "3px" }}>
              Invest donations to help your villager survive
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "7px", color: "#a0826a" }}>YOUR FUNDS</div>
            <div style={{ fontFamily: "'VT323', monospace", fontSize: "28px", color: "#f5c842", lineHeight: 1 }}>
              ${money.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Grid */}
        <div style={{ padding: "14px 18px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          {UPGRADES.map((upg) => {
            const bought = purchasedUpgrades.has(upg.id);
            const prereq = PREREQS[upg.id];
            const prereqMet = !prereq || purchasedUpgrades.has(prereq);
            const canAfford = money >= upg.cost && prereqMet;
            const locked = !prereqMet;

            return (
              <div key={upg.id} style={{
                background: bought ? "rgba(60,120,30,0.22)" : locked ? "rgba(10,8,4,0.6)" : canAfford ? "rgba(30,50,80,0.3)" : "rgba(30,20,10,0.4)",
                border: `2px solid ${bought ? "#4a9c20" : locked ? "#2a1808" : canAfford ? "#3a6080" : "#3a2810"}`,
                borderRadius: "4px", padding: "11px 13px",
                opacity: locked ? 0.5 : 1,
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                  <div style={{ fontSize: "26px", lineHeight: 1 }}>{upg.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "6px", color: bought ? "#8be060" : locked ? "#4a3020" : "#e8d5a3", marginBottom: "3px" }}>
                      {upg.name}
                    </div>
                    <div style={{ fontFamily: "'VT323', monospace", fontSize: "13px", color: "#a0826a", marginBottom: "7px" }}>
                      {locked ? `Requires: ${UPGRADES.find(u => u.id === prereq)?.name}` : upg.description}
                    </div>
                    {bought ? (
                      <div style={{
                        fontFamily: "'Press Start 2P', monospace", fontSize: "6px", color: "#8be060",
                        padding: "3px 7px", background: "rgba(60,120,30,0.3)", border: "1px solid #4a9c20",
                        borderRadius: "2px", display: "inline-block",
                      }}>✓ OWNED</div>
                    ) : (
                      <button
                        onClick={() => onBuy(upg.id)}
                        disabled={!canAfford}
                        style={{
                          fontFamily: "'Press Start 2P', monospace", fontSize: "6px",
                          background: canAfford ? "#1e4070" : "#1a1208",
                          color: canAfford ? "#6ec6ff" : "#3a2810",
                          border: `2px solid ${canAfford ? "#6ec6ff" : "#2a1808"}`,
                          borderRadius: "2px", padding: "5px 9px",
                          cursor: canAfford ? "pointer" : "not-allowed",
                        }}
                        onMouseEnter={e => { if (canAfford) (e.currentTarget as HTMLButtonElement).style.background = "#2a5a9a"; }}
                        onMouseLeave={e => { if (canAfford) (e.currentTarget as HTMLButtonElement).style.background = "#1e4070"; }}
                      >
                        💰 ${upg.cost}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Economy note */}
        <div style={{ margin: "0 18px 10px", padding: "8px 12px", background: "rgba(10,6,2,0.6)", border: "1px solid #3a2810", borderRadius: "3px" }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "6px", color: "#6a5030" }}>
            HOW INCOME WORKS
          </div>
          <div style={{ fontFamily: "'VT323', monospace", fontSize: "13px", color: "#8b6230", marginTop: "3px" }}>
            Village donates $0.10 × population per day. Deliver water → grow population → earn more.
            Dirty water (no filter) = less population gain. Build a well for $2,000 to add a permanent clean source.
          </div>
        </div>

        {/* Footer */}
        <div style={{ borderTop: "2px solid #5c4020", padding: "10px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontFamily: "'VT323', monospace", fontSize: "13px", color: "#4a3020" }}>[E] or [ESC] to close</div>
          <button onClick={onClose} style={{
            fontFamily: "'Press Start 2P', monospace", fontSize: "6px",
            background: "#3d1e0a", color: "#a0826a", border: "2px solid #5c4020",
            borderRadius: "2px", padding: "5px 12px", cursor: "pointer",
          }}>CLOSE</button>
        </div>
      </div>
    </div>
  );
}
