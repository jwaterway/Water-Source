import React from "react";
import { UPGRADES } from "./WaterGame";

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

interface UpgradeShopProps {
  money: number;
  purchasedUpgrades: Set<string>;
  onBuy: (id: string) => void;
  onClose: () => void;
  isMobile: boolean;
}

const PREREQS: Record<string, string> = {
  jug2: "jug1",
  speed2: "speed1",
};

export function UpgradeShop({ money, purchasedUpgrades, onBuy, onClose, isMobile }: UpgradeShopProps) {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center z-20"
      style={{ background: "rgba(0,0,0,0.65)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: CW.black, border: `3px solid ${CW.navy}`, borderRadius: "6px",
        minWidth: isMobile ? "0" : "480px", maxWidth: "92vw", width: isMobile ? "92vw" : "auto",
        maxHeight: isMobile ? "86vh" : "none",
        boxShadow: "0 0 40px rgba(0,0,0,0.9)", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          background: "linear-gradient(135deg,#003366,#204f73)",
          borderBottom: `2px solid ${CW.blue}`,
          padding: isMobile ? "10px 12px" : "14px 20px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: "10px",
        }}>
          <div>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: isMobile ? "9px" : "12px", color: CW.yellow }}>🛒 UPGRADE SHOP</div>
            <div style={{ fontFamily: "'VT323', monospace", fontSize: isMobile ? "13px" : "15px", color: CW.cream, marginTop: "3px" }}>
              Invest donations to help your villager survive
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "7px", color: CW.gray }}>YOUR FUNDS</div>
            <div style={{ fontFamily: "'VT323', monospace", fontSize: isMobile ? "24px" : "28px", color: CW.yellow, lineHeight: 1 }}>
              ${money.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Grid */}
        <div style={{ padding: isMobile ? "10px 10px" : "14px 18px", display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "10px", overflowY: isMobile ? "auto" : "visible", maxHeight: isMobile ? "55vh" : "none" }}>
          {UPGRADES.map((upg) => {
            const bought = purchasedUpgrades.has(upg.id);
            const prereq = PREREQS[upg.id];
            const prereqMet = !prereq || purchasedUpgrades.has(prereq);
            const canAfford = money >= upg.cost && prereqMet;
            const locked = !prereqMet;

            return (
              <div key={upg.id} style={{
                background: bought ? "rgba(255,201,7,0.16)" : locked ? "rgba(26,26,26,0.75)" : canAfford ? "rgba(0,51,102,0.45)" : "rgba(40,50,60,0.45)",
                border: `2px solid ${bought ? CW.yellow : locked ? "#2b3340" : canAfford ? CW.blue : CW.navy}`,
                borderRadius: "4px", padding: "11px 13px",
                opacity: locked ? 0.5 : 1,
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                  <div style={{ fontSize: "26px", lineHeight: 1 }}>{upg.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "6px", color: bought ? CW.yellow : locked ? CW.gray : CW.cream, marginBottom: "3px" }}>
                      {upg.name}
                    </div>
                    <div style={{ fontFamily: "'VT323', monospace", fontSize: "13px", color: CW.gray, marginBottom: "7px" }}>
                      {locked ? `Requires: ${UPGRADES.find(u => u.id === prereq)?.name}` : upg.description}
                    </div>
                    {bought ? (
                      <div style={{
                        fontFamily: "'Press Start 2P', monospace", fontSize: "6px", color: CW.yellow,
                        padding: "3px 7px", background: "rgba(255,201,7,0.2)", border: `1px solid ${CW.yellow}`,
                        borderRadius: "2px", display: "inline-block",
                      }}>✓ OWNED</div>
                    ) : (
                      <button
                        onClick={() => onBuy(upg.id)}
                        disabled={!canAfford}
                        style={{
                          fontFamily: "'Press Start 2P', monospace", fontSize: "6px",
                          background: canAfford ? CW.navy : "#131a22",
                          color: canAfford ? CW.blue : CW.gray,
                          border: `2px solid ${canAfford ? CW.blue : "#2b3340"}`,
                          borderRadius: "2px", padding: "5px 9px",
                          cursor: canAfford ? "pointer" : "not-allowed",
                        }}
                        onMouseEnter={e => { if (canAfford) (e.currentTarget as HTMLButtonElement).style.background = "#1A4A70"; }}
                        onMouseLeave={e => { if (canAfford) (e.currentTarget as HTMLButtonElement).style.background = CW.navy; }}
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
        <div style={{ margin: isMobile ? "0 10px 10px" : "0 18px 10px", padding: "8px 12px", background: "rgba(0,51,102,0.22)", border: `1px solid ${CW.navy}`, borderRadius: "3px" }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "6px", color: CW.gray }}>
            HOW INCOME WORKS
          </div>
          <div style={{ fontFamily: "'VT323', monospace", fontSize: "13px", color: CW.cream, marginTop: "3px" }}>
            Village donates $0.10 × population per day. Deliver water → grow population → earn more.
            Dirty water (no filter) = less population gain. Build a well for $2,000 to add a permanent clean source.
          </div>
        </div>

        {/* Footer */}
        <div style={{ borderTop: `2px solid ${CW.navy}`, padding: isMobile ? "10px" : "10px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
          <div style={{ fontFamily: "'VT323', monospace", fontSize: "13px", color: CW.gray }}>[E] or [ESC] to close</div>
          <button onClick={onClose} style={{
            fontFamily: "'Press Start 2P', monospace", fontSize: "6px",
            background: CW.navy, color: CW.cream, border: `2px solid ${CW.blue}`,
            borderRadius: "2px", padding: "5px 12px", cursor: "pointer",
          }}>CLOSE</button>
        </div>
      </div>
    </div>
  );
}
