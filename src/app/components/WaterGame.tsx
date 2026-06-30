import React, { useRef, useEffect, useCallback, useState } from "react";
import { GameHUD } from "./GameHUD";
import { UpgradeShop } from "./UpgradeShop";

// --- Constants ---
const WORLD_W = 1200;
const WORLD_H = 700;
const BASE_SPEED = 3;
const PLAYER_SIZE = 14;
const WATER_SOURCE_COUNT = 5;
const BASE_MAX_WATER = 100;
const COLLECT_RATE = 0.22;
const HEALTH_DECAY = 0.012;
const WATER_DECAY = 0.004;
const POP_PER_DELIVERY = 3;
const DONATION_PER_PERSON_PER_DAY = 0.10;
const DAY_DURATION = 60;
const DELIVER_RADIUS = 60;
const COLLECT_RADIUS = 28;
const SHOP_X = 120;
const SHOP_Y = 80;
const SHOP_RADIUS = 50;
const WELL_COST = 2000;
const MOBILE_VIEW_W = 460;
const MOBILE_VIEW_H = 700;
const CONTAM_WATER_PENALTY = 0.18;
const DIRTY_STATUS_HEALTH_MULTIPLIER = 3;
const RAIN_WELL_FILL_RATE = 0.4;   // per second
const DROUGHT_WELL_DRAIN_RATE = 0.75;
const RAIN_RIVER_FILL_RATE = 0.25;
const DROUGHT_RIVER_DRAIN_RATE = 0.5;

const SFX_DROUGHT_WIND = "/sfx/dragon-studio-eerie-wind-478386.mp3";
const SFX_RAIN_THUNDER = "/sfx/freesound_community-thunder-during-rainstorm-1-72024.mp3";
const SFX_WELL_FILL = "/sfx/a_a2005-flowing-water-345171.wav";
const SFX_CLEAN_DELIVERY = "/sfx/universfield-water-splash-02-352021.mp3";
const SFX_DIRTY_HOOK = "/sfx/warp3.wav";
const SFX_DIRTY_DELIVERY = "/sfx/freesound_community-dirt-pound-107984.mp3";
const SFX_BG_MUSIC = "/sfx/freesound_community-slow-ethereal-sequencer-music-fragment-50247.mp3";

const CW = {
  yellow: "#FFC907",
  navy: "#003366",
  blue: "#77A8BB",
  cream: "#FFF7E1",
  black: "#1A1A1A",
  tint: "#F7F3EA",
  peach: "#FED8C1",
  orange: "#BF6C46",
  gray: "#CBCDD1",
};

// --- Upgrades ---
export interface Upgrade { id: string; name: string; description: string; cost: number; icon: string; }
export const UPGRADES: Upgrade[] = [
  { id: "filter",  name: "Water Filter",    description: "Purifies brown water — safe collection", cost: 80,  icon: "🔵" },
  { id: "jug1",   name: "Jerry Can I",     description: "+50 water capacity",                     cost: 120, icon: "⛽" },
  { id: "jug2",   name: "Jerry Can II",    description: "+100 water capacity (req. Jerry Can I)",  cost: 280, icon: "⛽+" },
  { id: "speed1", name: "Sprint Boots I",  description: "+40% move speed",                         cost: 150, icon: "👟" },
  { id: "speed2", name: "Sprint Boots II", description: "+80% move speed (req. Boots I)",          cost: 350, icon: "🥾" },
  { id: "health1",name: "Canteen",         description: "Slower health drain (-45%)",              cost: 200, icon: "🧃" },
];

// --- Types ---
export type WeatherState = "clear" | "rain" | "drought";

export interface WaterSource {
  id: number; x: number; y: number;
  amount: number; maxAmount: number;
  type: "well" | "river" | "puddle";
  contaminated: boolean; built?: boolean;
}

interface Tree { x: number; y: number; size: number; }

interface Ripple { id: number; x: number; y: number; radius: number; maxRadius: number; alpha: number; color: string; }
interface DustPuff { id: number; x: number; y: number; radius: number; alpha: number; vx: number; vy: number; }
interface FloatText { id: number; x: number; y: number; text: string; color: string; age: number; }
interface DroughtCrack { x: number; y: number; angle: number; len: number; branches: Array<{ angle: number; len: number }>; }

interface GameState {
  px: number; py: number; facing: "left" | "right";
  walkFrame: number; walkTimer: number;
  health: number; water: number; maxWater: number; bucketContaminated: boolean;
  speed: number; healthDecay: number;
  money: number; moneyFrac: number; population: number;
  day: number; timeOfDay: number;
  sources: WaterSource[]; builtWells: Array<{ x: number; y: number }>; trees: Tree[];
  gameOver: boolean; deliveryFlash: number; collectingFrom: number | null;
  lastTime: number;
  ripples: Ripple[]; dusts: DustPuff[]; floatTexts: FloatText[];
  rippleTimer: number; dustTimer: number;
  purchasedUpgrades: Set<string>; nearShop: boolean; buildMode: boolean;
  weather: WeatherState;
  weatherIntensity: number;
  weatherElapsed: number;
  weatherDuration: number;
  nextWeatherTimer: number;
  lightningFlash: number;
  lightningTimer: number;
  droughtCracks: DroughtCrack[];
  lastRippleId: number; lastDustId: number; lastFloatId: number;
}

interface WeekSummary {
  week: number;
  populationGain: number;
  fundsRaised: number;
  goodWaterCollected: number;
  badWaterCollected: number;
}

// --- Helpers ---
function computeMaxWater(u: Set<string>) { let w = BASE_MAX_WATER; if (u.has("jug1")) w += 50; if (u.has("jug2")) w += 100; return w; }
function computeSpeed(u: Set<string>) { let s = BASE_SPEED; if (u.has("speed1")) s *= 1.4; if (u.has("speed2")) s *= 1.8; return s; }
function computeHealthDecay(u: Set<string>) { return u.has("health1") ? HEALTH_DECAY * 0.55 : HEALTH_DECAY; }

function makeCracks(): DroughtCrack[] {
  const cracks: DroughtCrack[] = [];
  for (let i = 0; i < 18; i++) {
    const cx = 60 + Math.random() * (WORLD_W - 120);
    const cy = 60 + Math.random() * (WORLD_H - 120);
    // avoid village & shop
    if (Math.hypot(cx - (WORLD_W - 170), cy - (WORLD_H - 170)) < 160) continue;
    if (Math.hypot(cx - SHOP_X, cy - SHOP_Y) < 80) continue;
    const angle = Math.random() * Math.PI * 2;
    const len = 20 + Math.random() * 50;
    const branches = Array.from({ length: 2 + Math.floor(Math.random() * 3) }, () => ({
      angle: angle + (Math.random() - 0.5) * 1.5,
      len: 10 + Math.random() * 25,
    }));
    cracks.push({ x: cx, y: cy, angle, len, branches });
  }
  return cracks;
}

function generateSources(day: number, builtWells: Array<{ x: number; y: number }>): WaterSource[] {
  const types: Array<"well" | "river" | "puddle"> = ["well", "river", "puddle"];
  const sources: WaterSource[] = [];
  const avoid = [{ x: WORLD_W - 200, y: WORLD_H - 200, r: 160 }, { x: SHOP_X, y: SHOP_Y, r: 100 }];
  const count = WATER_SOURCE_COUNT + Math.min(day - 1, 3);
  for (let i = 0; i < count; i++) {
    let x: number, y: number; let attempts = 0;
    do {
      x = 60 + Math.random() * (WORLD_W - 120);
      y = 60 + Math.random() * (WORLD_H - 120);
      attempts++;
    } while (
      attempts < 60 && (
        avoid.some(z => Math.hypot(x - z.x, y - z.y) < z.r) ||
        builtWells.some(w => Math.hypot(x - w.x, y - w.y) < 72) ||
        sources.some(src => Math.hypot(x - src.x, y - src.y) < 68)
      )
    );
    if (attempts >= 60) continue;
    const type = types[Math.floor(Math.random() * types.length)];
    const maxAmount = type === "river" ? 80 : type === "well" ? 50 : 25;
    // Wells are visually and behaviorally consistent: brown wells are always dirty, blue wells are clean.
    const contaminated = type === "well" ? Math.random() < 0.5 : Math.random() < (type === "river" ? 0.4 : 0.3);
    sources.push({ id: i, x, y, amount: maxAmount, maxAmount, type, contaminated });
  }
  builtWells.forEach((w, idx) => {
    sources.push({ id: 1000 + idx, x: w.x, y: w.y, amount: 80, maxAmount: 80, type: "well", contaminated: false, built: true });
  });
  return sources;
}

function generateTrees(): Tree[] {
  const trees: Tree[] = [];
  const avoid = [{ x: WORLD_W - 200, y: WORLD_H - 200, r: 160 }, { x: SHOP_X, y: SHOP_Y, r: 90 }];
  for (let i = 0; i < 40; i++) {
    let x: number, y: number; let tries = 0;
    do { x = 20 + Math.random() * (WORLD_W - 40); y = 20 + Math.random() * (WORLD_H - 40); tries++; }
    while (tries < 20 && avoid.some(z => Math.hypot(x - z.x, y - z.y) < z.r));
    trees.push({ x, y, size: 14 + Math.random() * 16 });
  }
  return trees;
}

function initState(prev?: GameState): GameState {
  const upgrades = prev?.purchasedUpgrades ?? new Set<string>();
  const builtWells = prev?.builtWells ?? [];
  return {
    px: 80, py: WORLD_H / 2, facing: "right", walkFrame: 0, walkTimer: 0,
    health: prev ? Math.min(100, prev.health + 25) : 100,
    water: 0, maxWater: computeMaxWater(upgrades), bucketContaminated: false,
    speed: computeSpeed(upgrades), healthDecay: computeHealthDecay(upgrades),
    money: prev?.money ?? 0, moneyFrac: prev?.moneyFrac ?? 0,
    population: prev?.population ?? 25,
    day: prev ? prev.day + 1 : 1, timeOfDay: 0,
    sources: generateSources(prev ? prev.day + 1 : 1, builtWells),
    builtWells, trees: prev?.trees ?? generateTrees(),
    gameOver: false, deliveryFlash: 0, collectingFrom: null, lastTime: 0,
    ripples: [], dusts: [], floatTexts: [],
    rippleTimer: 0, dustTimer: 0,
    purchasedUpgrades: upgrades, nearShop: false, buildMode: false,
    weather: "clear",
    weatherIntensity: 0,
    weatherElapsed: 0,
    weatherDuration: 0,
    nextWeatherTimer: 15 + Math.random() * 20,
    lightningFlash: 0,
    lightningTimer: 3 + Math.random() * 5,
    droughtCracks: [],
    lastRippleId: 0, lastDustId: 0, lastFloatId: 0,
  };
}

// ─── DRAW HELPERS ─────────────────────────────────────────────────────────────

function drawPixelText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size = 10, color = CW.cream, align: CanvasTextAlign = "center") {
  ctx.save(); ctx.font = `${size}px 'Press Start 2P', monospace`;
  ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(text, x, y); ctx.restore();
}

function drawTerrain(ctx: CanvasRenderingContext2D, trees: Tree[], droughtIntensity: number) {
  // Ground — yellowed during drought
  const gr = Math.floor(119 + droughtIntensity * 72);
  const gg = Math.floor(168 - droughtIntensity * 60);
  const gb = Math.floor(187 - droughtIntensity * 117);
  ctx.fillStyle = `rgb(${gr},${gg},${gb})`;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  const patches = [
    { x: 100, y: 80, w: 180, h: 100 }, { x: 400, y: 200, w: 220, h: 130 },
    { x: 700, y: 50, w: 160, h: 90 }, { x: 200, y: 400, w: 300, h: 120 },
    { x: 600, y: 350, w: 180, h: 140 },
  ];
  const pr = Math.floor(247 + droughtIntensity * 8);
  const pg = Math.floor(243 - droughtIntensity * 30);
  const pb = Math.floor(234 - droughtIntensity * 110);
  ctx.fillStyle = `rgb(${pr},${pg},${pb})`;
  patches.forEach(({ x, y, w, h }) => {
    ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); ctx.fill();
  });

  ctx.fillStyle = "#FFF7E144";
  for (let i = 0; i < 8; i++) {
    ctx.beginPath(); ctx.ellipse(80 + i * 140, WORLD_H / 2 + 20, 30, 15, 0.3, 0, Math.PI * 2); ctx.fill();
  }

  trees.forEach(({ x, y, size }) => {
    ctx.fillStyle = "#8E4F34"; ctx.fillRect(x - 3, y, 6, size * 0.5);
    const tc = droughtIntensity > 0.3 ? CW.peach : CW.blue;
    const tc2 = droughtIntensity > 0.3 ? CW.orange : CW.navy;
    ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2); ctx.fillStyle = tc; ctx.fill();
    ctx.beginPath(); ctx.arc(x - size * 0.3, y - size * 0.2, size * 0.7, 0, Math.PI * 2); ctx.fillStyle = tc2; ctx.fill();
  });
}

function drawDroughtCracks(ctx: CanvasRenderingContext2D, cracks: DroughtCrack[], intensity: number) {
  if (intensity < 0.25) return;
  const alpha = Math.min(1, (intensity - 0.25) / 0.4);
  ctx.save();
  ctx.strokeStyle = `rgba(100, 65, 20, ${alpha * 0.85})`;
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  cracks.forEach(c => {
    // Main crack
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(c.x + Math.cos(c.angle) * c.len, c.y + Math.sin(c.angle) * c.len);
    ctx.stroke();
    // Branch cracks
    c.branches.forEach(b => {
      const midX = c.x + Math.cos(c.angle) * c.len * 0.4;
      const midY = c.y + Math.sin(c.angle) * c.len * 0.4;
      ctx.beginPath();
      ctx.moveTo(midX, midY);
      ctx.lineTo(midX + Math.cos(b.angle) * b.len, midY + Math.sin(b.angle) * b.len);
      ctx.stroke();
    });
  });
  ctx.restore();
}

function drawShop(ctx: CanvasRenderingContext2D, nearShop: boolean, t: number) {
  const sx = SHOP_X - 36; const sy = SHOP_Y - 40; const w = 72; const h = 54;
  ctx.save(); ctx.beginPath(); ctx.ellipse(SHOP_X, SHOP_Y + 20, 80, 55, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#F7F3EA"; ctx.fill(); ctx.restore();
  ctx.fillStyle = CW.navy; ctx.fillRect(sx, sy, w, h);
  ctx.fillStyle = CW.orange; ctx.beginPath(); ctx.moveTo(sx - 6, sy); ctx.lineTo(SHOP_X, sy - h * 0.5); ctx.lineTo(sx + w + 6, sy); ctx.closePath(); ctx.fill();
  ctx.fillStyle = CW.yellow; ctx.fillRect(sx + 8, sy + 6, w - 16, 14);
  ctx.save(); ctx.font = "7px 'Press Start 2P', monospace"; ctx.fillStyle = CW.black; ctx.textAlign = "center"; ctx.fillText("SHOP", SHOP_X, sy + 16); ctx.restore();
  ctx.fillStyle = CW.black; ctx.fillRect(SHOP_X - 8, sy + h - 18, 16, 18);
  ctx.fillStyle = "#FFC907AA"; ctx.fillRect(sx + 6, sy + 22, 14, 14); ctx.fillRect(sx + w - 20, sy + 22, 14, 14);
  ctx.fillStyle = "#466B7A"; ctx.fillRect(sx - 14, sy + h - 20, 12, 16);
  ctx.fillStyle = CW.blue; ctx.fillRect(sx - 13, sy + h - 22, 10, 6);
  if (nearShop) {
    const pulse = 0.65 + Math.sin(t * 6) * 0.35;
    ctx.save(); ctx.beginPath(); ctx.arc(SHOP_X, SHOP_Y, SHOP_RADIUS, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,201,7,${pulse * 0.7})`; ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]); ctx.stroke(); ctx.setLineDash([]);
    ctx.font = "8px 'Press Start 2P', monospace"; ctx.fillStyle = `rgba(255,201,7,${pulse})`; ctx.textAlign = "center";
    ctx.fillText("[E] SHOP", SHOP_X, SHOP_Y - 56); ctx.restore();
  }
}

function drawVillage(ctx: CanvasRenderingContext2D, population: number) {
  const vx = WORLD_W - 230; const vy = WORLD_H - 230;
  ctx.save(); ctx.beginPath(); ctx.ellipse(vx + 60, vy + 60, 130, 100, 0, 0, Math.PI * 2); ctx.fillStyle = "#F7F3EA"; ctx.fill(); ctx.restore();
  ctx.save();
  const roadY = vy + 74;
  const roadH = 14;
  const roadStartX = 26;
  const roadEndX = vx + 8;
  ctx.fillStyle = "#6A727C";
  ctx.fillRect(roadStartX, roadY, roadEndX - roadStartX, roadH);
  ctx.fillStyle = "#8A929C";
  ctx.fillRect(roadStartX, roadY, roadEndX - roadStartX, 3);
  ctx.strokeStyle = "#555C65";
  ctx.lineWidth = 1;
  ctx.strokeRect(roadStartX, roadY, roadEndX - roadStartX, roadH);
  ctx.restore();
  const buildings = [
    { x: vx, y: vy + 20, w: 44, h: 38, color: CW.navy }, { x: vx + 55, y: vy, w: 52, h: 50, color: "#2A5A80" },
    { x: vx + 15, y: vy + 65, w: 38, h: 32, color: CW.blue }, { x: vx + 65, y: vy + 62, w: 46, h: 40, color: "#5A8EA6" },
    { x: vx + 115, y: vy + 25, w: 40, h: 45, color: CW.gray },
  ].slice(0, Math.min(5, Math.max(1, Math.ceil(population / 7))));
  buildings.forEach(({ x, y, w, h, color }) => {
    ctx.fillStyle = color; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = CW.orange; ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x + w / 2, y - h * 0.45); ctx.lineTo(x + w + 4, y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#FFC907AA"; ctx.fillRect(x + w / 2 - 5, y + 8, 10, 10);
    ctx.fillStyle = CW.black; ctx.fillRect(x + w / 2 - 5, y + h - 14, 10, 14);
  });
  ctx.save(); ctx.beginPath(); ctx.arc(vx + 100, vy + 100, 10, 0, Math.PI * 2); ctx.fillStyle = CW.navy; ctx.fill(); ctx.strokeStyle = CW.blue; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
  drawPixelText(ctx, "VILLAGE", vx + 60, vy - 14, 7, CW.yellow);
  ctx.save(); ctx.font = "11px 'VT323', monospace"; ctx.fillStyle = CW.cream; ctx.textAlign = "center"; ctx.fillText(`Pop: ${population}`, vx + 60, vy - 4); ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.arc(vx + 60, vy + 60, DELIVER_RADIUS, 0, Math.PI * 2);
  ctx.strokeStyle = "#FFC90744"; ctx.lineWidth = 2; ctx.setLineDash([6, 6]); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
}

function drawWaterSource(ctx: CanvasRenderingContext2D, src: WaterSource, collecting: boolean, t: number, hasFilter: boolean, weather: WeatherState, weatherIntensity: number) {
  const { x, y, type, amount, maxAmount, contaminated, built } = src;
  const pct = amount / maxAmount;
  if (pct <= 0 && weather !== "rain") return;

  // During drought, dry wells look cracked
  const isDry = pct <= 0;
  const waterBlue = contaminated ? "rgba(110, 70, 20," : "rgba(30, 100, 210,";
  const strokeBlue = contaminated ? "rgba(160, 100, 40," : "rgba(100, 190, 255,";
  // Rain makes water shimmer brighter
  const rainBoost = weather === "rain" ? 0.3 * weatherIntensity : 0;

  if (type === "river") {
    if (isDry) {
      // Dry river bed
      ctx.save(); ctx.beginPath(); ctx.ellipse(x, y, 32, 18, -0.3, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(160,120,60,0.5)"; ctx.fill(); ctx.restore();
      drawPixelText(ctx, "DRY", x, y - 24, 6, CW.orange);
    } else {
      const wave = Math.sin(t * 2.5) * 3;
      ctx.save();
      ctx.beginPath(); ctx.ellipse(x + wave, y, 32, 18, -0.3, 0, Math.PI * 2);
      ctx.fillStyle = `${waterBlue}${0.4 + pct * 0.5 + rainBoost})`;
      ctx.fill(); ctx.strokeStyle = `${strokeBlue}${0.6 + pct * 0.3})`; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(x + wave * 0.5, y - 4, 16, 5, -0.3, 0, Math.PI * 2);
      ctx.fillStyle = contaminated ? `rgba(180,130,60,${0.3 + Math.sin(t * 3) * 0.15})` : `rgba(160,220,255,${0.3 + Math.sin(t * 3) * 0.15 + rainBoost})`;
      ctx.fill(); ctx.restore();
      drawPixelText(ctx, contaminated ? "~DIRTY~" : "~RIVER~", x, y - 26, 6, contaminated ? CW.orange : CW.blue);
    }
  } else if (type === "well") {
    const wellBody = isDry ? "#3a2010" : contaminated ? "#5c4020" : "#1e4f8f";
    const wellStroke = isDry ? "#6a3010" : contaminated ? "#8b6230" : "#77A8BB";
    const beamColor = contaminated ? "#8b6230" : "#77A8BB";
    const bucketColor = contaminated ? "#6a3a10" : "#3B7FD6";
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, 16, 0, Math.PI * 2);
    ctx.fillStyle = wellBody; ctx.fill();
    ctx.strokeStyle = wellStroke; ctx.lineWidth = 3; ctx.stroke();
    if (built && !isDry) {
      ctx.strokeStyle = CW.yellow;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    const swing = isDry ? 0 : Math.sin(t * 1.8) * 6;
    if (!isDry) {
      ctx.strokeStyle = beamColor; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x + swing * 0.5, y - 16); ctx.lineTo(x + swing, y - 26); ctx.stroke();
      ctx.fillStyle = bucketColor; ctx.fillRect(x + swing - 4, y - 33, 8, 7);
    }
    ctx.strokeStyle = wellStroke; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(x - 14, y - 16); ctx.lineTo(x + 14, y - 16); ctx.stroke();
    ctx.restore();
    const label = isDry ? "EMPTY" : built ? "★ WELL" : contaminated ? "WELL!" : "WELL";
    const labelColor = isDry ? CW.orange : built ? CW.yellow : contaminated ? CW.orange : CW.blue;
    drawPixelText(ctx, label, x, y - 44, 6, labelColor);
  } else {
    if (isDry) {
      ctx.save(); ctx.beginPath(); ctx.ellipse(x, y, 14, 8, 0.2, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(140,100,50,0.3)"; ctx.fill(); ctx.restore();
    } else {
      const wv = Math.sin(t * 3) * 2;
      ctx.save(); ctx.beginPath(); ctx.ellipse(x, y, 20 + wv, 12, 0.2, 0, Math.PI * 2);
      ctx.fillStyle = `${waterBlue}${0.3 + pct * 0.5 + rainBoost})`; ctx.fill();
      ctx.strokeStyle = contaminated ? "#9a6020" : "#6ec6ff"; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
      drawPixelText(ctx, contaminated ? "☠" : "~", x, y - 18, 8, contaminated ? CW.orange : CW.blue);
    }
  }

  if (contaminated && !hasFilter && !isDry) {
    ctx.save(); ctx.font = "9px 'Press Start 2P', monospace"; ctx.fillStyle = "#e84040"; ctx.textAlign = "center";
    ctx.globalAlpha = 0.7 + Math.sin(t * 4) * 0.3; ctx.fillText("⚠ DIRTY", x, y + 38); ctx.restore();
  }

  if (!isDry) {
    const bw = 40; const bx = x - bw / 2; const by = y + 22;
    ctx.fillStyle = "#1a120a"; ctx.fillRect(bx, by, bw, 6);
    const barColor = contaminated ? (pct > 0.5 ? "#8b5020" : "#c03020") : (pct > 0.5 ? "#1e90ff" : pct > 0.2 ? "#f5a020" : "#e84040");
    ctx.fillStyle = barColor; ctx.fillRect(bx, by, bw * pct, 6);
    ctx.strokeStyle = "#5c4020"; ctx.lineWidth = 1; ctx.strokeRect(bx, by, bw, 6);
  }

  if (collecting) {
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, COLLECT_RADIUS, 0, Math.PI * 2);
    ctx.strokeStyle = contaminated ? "#b07030" : "#1e90ff"; ctx.lineWidth = 2.5;
    ctx.globalAlpha = 0.6 + Math.sin(t * 8) * 0.4; ctx.stroke(); ctx.restore();
  }

  ctx.save(); ctx.beginPath(); ctx.arc(x, y, COLLECT_RADIUS, 0, Math.PI * 2);
  ctx.strokeStyle = contaminated ? "#8b502222" : "#1e90ff22"; ctx.lineWidth = 1;
  ctx.setLineDash([4, 6]); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
}

function drawBuildMode(ctx: CanvasRenderingContext2D, px: number, py: number, canBuild: boolean, t: number) {
  ctx.save(); ctx.beginPath(); ctx.arc(px, py, WELL_COST / 40, 0, Math.PI * 2);
  ctx.strokeStyle = canBuild ? `rgba(100,220,60,${0.5 + Math.sin(t * 6) * 0.4})` : `rgba(220,60,60,${0.5 + Math.sin(t * 6) * 0.4})`;
  ctx.lineWidth = 2; ctx.setLineDash([8, 6]); ctx.stroke(); ctx.setLineDash([]);
  ctx.font = "8px 'Press Start 2P', monospace"; ctx.fillStyle = canBuild ? "#8be060" : "#e84040"; ctx.textAlign = "center";
  ctx.fillText(canBuild ? "[SPACE] Place Well" : "Too close!", px, py - PLAYER_SIZE - 24); ctx.restore();
}

function drawRipples(ctx: CanvasRenderingContext2D, ripples: Ripple[]) {
  ripples.forEach(r => {
    ctx.save(); ctx.beginPath(); ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
    ctx.strokeStyle = r.color; ctx.lineWidth = 1.5; ctx.globalAlpha = r.alpha; ctx.stroke(); ctx.restore();
  });
}

function drawDusts(ctx: CanvasRenderingContext2D, dusts: DustPuff[]) {
  dusts.forEach(d => {
    ctx.save(); ctx.beginPath(); ctx.arc(d.x, d.y, d.radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(200,160,80,${d.alpha})`; ctx.fill(); ctx.restore();
  });
}

function drawFloatTexts(ctx: CanvasRenderingContext2D, floatTexts: FloatText[]) {
  floatTexts.forEach(ft => {
    const fadeInDuration = 0.3;
    const fadeOutDuration = 1.4;
    const a = ft.age < fadeInDuration
      ? ft.age / fadeInDuration
      : 1 - (ft.age - fadeInDuration) / fadeOutDuration;
    const largeStatText = /HP|POP|NO POP|BOUGHT|WELL BUILT/.test(ft.text);
    const size = largeStatText ? 24 : 11;
    ctx.save(); ctx.font = `${size}px 'Press Start 2P', monospace`; ctx.fillStyle = ft.color;
    ctx.globalAlpha = Math.max(0, a); ctx.textAlign = "center"; ctx.fillText(ft.text, ft.x, ft.y); ctx.restore();
  });
}

function drawPlayer(ctx: CanvasRenderingContext2D, px: number, py: number, water: number, maxWater: number, bucketContaminated: boolean, collectingFrom: number | null, facing: "left" | "right", walkFrame: number) {
  const carrying = water > 0;
  const bobY = walkFrame === 1 ? -2 : 0;
  ctx.save(); ctx.beginPath(); ctx.ellipse(px, py + PLAYER_SIZE + 2, 9, 3.5, 0, 0, Math.PI * 2); ctx.fillStyle = "rgba(0,0,0,0.28)"; ctx.fill(); ctx.restore();
  const legOff = walkFrame === 1 ? 3 : walkFrame === 2 ? -3 : 0;
  ctx.save(); ctx.fillStyle = "#744733"; ctx.fillRect(px - 7 + legOff, py + PLAYER_SIZE - 4 + bobY, 6, 8); ctx.fillRect(px + 1 - legOff, py + PLAYER_SIZE - 4 + bobY, 6, 8); ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.arc(px, py + bobY, PLAYER_SIZE, 0, Math.PI * 2);
  ctx.fillStyle = carrying ? (bucketContaminated ? "#9A5C3E" : CW.navy) : CW.blue;
  ctx.fill(); ctx.strokeStyle = CW.cream; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
  const eyeOff = facing === "right" ? 1 : -1;
  ctx.save(); ctx.beginPath();
  ctx.arc(px - 3 + eyeOff, py - 3 + bobY, 2.5, 0, Math.PI * 2);
  ctx.arc(px + 3 + eyeOff, py - 3 + bobY, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = "#1a120a"; ctx.fill(); ctx.restore();
  if (carrying) {
    const canFill = water / maxWater;
    const canX = px - 6;
    const canY = py - PLAYER_SIZE - 16 + bobY;
    ctx.save();
    ctx.fillStyle = CW.yellow;
    ctx.beginPath(); ctx.roundRect(canX, canY, 12, 14, 2); ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.fillRect(canX + 2, canY + 2, 4, 2);
    ctx.fillStyle = bucketContaminated ? CW.orange : CW.blue;
    ctx.fillRect(canX + 2, canY + 12 - Math.round(canFill * 8), 8, Math.round(canFill * 8));
    ctx.strokeStyle = bucketContaminated ? CW.orange : CW.navy; ctx.lineWidth = 1.2; ctx.strokeRect(canX, canY, 12, 14);
    ctx.beginPath();
    ctx.moveTo(canX + 3, canY + 5); ctx.lineTo(canX + 9, canY + 11);
    ctx.moveTo(canX + 9, canY + 5); ctx.lineTo(canX + 3, canY + 11);
    ctx.strokeStyle = bucketContaminated ? "#8E4F34" : CW.cream;
    ctx.lineWidth = 1;
    ctx.stroke();
    if (bucketContaminated) { ctx.font = "9px serif"; ctx.fillStyle = CW.orange; ctx.textAlign = "center"; ctx.fillText("☠", px, canY - 1); }
    ctx.restore();
  }
  if (collectingFrom !== null) {
    ctx.save(); ctx.beginPath(); ctx.arc(px, py + bobY, PLAYER_SIZE + 7, 0, Math.PI * 2);
    ctx.strokeStyle = "#1e90ff"; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.5; ctx.stroke(); ctx.restore();
  }
}

function drawSkyOverlay(ctx: CanvasRenderingContext2D, timeOfDay: number) {
  let alpha = 0; let r = 20, g = 10, b = 60;
  if (timeOfDay < 0.15) { alpha = ((0.15 - timeOfDay) / 0.15) * 0.55; }
  else if (timeOfDay < 0.25) { alpha = 0.12; r = 200; g = 90; b = 20; }
  else if (timeOfDay > 0.75) { const n = (timeOfDay - 0.75) / 0.25; alpha = n * 0.6; }
  if (alpha > 0) { ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`; ctx.fillRect(0, 0, WORLD_W, WORLD_H); }
}

// ─── WEATHER VISUALS ──────────────────────────────────────────────────────────

function drawRainOverlay(ctx: CanvasRenderingContext2D, intensity: number, t: number, sources: WaterSource[]) {
  // Dark stormy sky layer
  ctx.fillStyle = `rgba(15, 30, 60, ${intensity * 0.45})`;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  // Animated storm clouds (dark rolling bands)
  for (let ci = 0; ci < 5; ci++) {
    const cx = ((ci * 280 + t * 30) % (WORLD_W + 200)) - 100;
    const cy = -20 + ci * 18;
    const cw = 200 + ci * 60;
    ctx.fillStyle = `rgba(20, 30, 55, ${0.25 * intensity})`;
    ctx.beginPath(); ctx.ellipse(cx, cy, cw, 50, 0, 0, Math.PI * 2); ctx.fill();
  }

  // Rain streaks — two layers: background (fine) + foreground (heavy)
  ctx.save();
  ctx.lineCap = "round";

  // Background layer — thin, fast, many
  const bgCount = Math.floor(intensity * 180);
  ctx.lineWidth = 0.8;
  for (let i = 0; i < bgCount; i++) {
    const speed = 480 + (i % 9) * 40;
    const len = 14 + (i % 5) * 3;
    const x = ((i * 131.7 + t * speed * 0.28) % (WORLD_W + 60)) - 30;
    const y = ((i * 73.1 + t * speed) % (WORLD_H + 40)) - 20;
    const alpha = (0.18 + (i % 6) * 0.05) * intensity;
    ctx.strokeStyle = `rgba(160, 210, 255, ${alpha})`;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 5, y + len); ctx.stroke();
  }

  // Foreground layer — thicker, slower, fewer, more visible
  const fgCount = Math.floor(intensity * 80);
  ctx.lineWidth = 1.5;
  for (let i = 0; i < fgCount; i++) {
    const speed = 350 + (i % 7) * 25;
    const len = 22 + (i % 4) * 6;
    const x = ((i * 199.3 + t * speed * 0.31) % (WORLD_W + 80)) - 40;
    const y = ((i * 113.7 + t * speed) % (WORLD_H + 50)) - 25;
    const alpha = (0.3 + (i % 4) * 0.08) * intensity;
    ctx.strokeStyle = `rgba(180, 225, 255, ${alpha})`;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 7, y + len); ctx.stroke();
  }
  ctx.restore();

  // Splash circles at ground level
  const splashCount = Math.floor(intensity * 30);
  for (let i = 0; i < splashCount; i++) {
    const speed = 380 + (i % 5) * 30;
    const sx = ((i * 211.9 + t * speed * 0.28) % WORLD_W);
    const phase = (t * speed / WORLD_H) % 1;
    if (phase > 0.85) {
      const splashR = (phase - 0.85) / 0.15 * 8;
      const alpha = (1 - (phase - 0.85) / 0.15) * 0.5 * intensity;
      ctx.save(); ctx.beginPath(); ctx.ellipse(sx, WORLD_H - 20 + (i % 40), splashR, splashR * 0.4, 0, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(180,225,255,${alpha})`; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
    }
  }

  // Extra ripples on water sources during rain
  sources.forEach(src => {
    const pr = ((t * 1.8 + src.id * 0.7) % 1);
    const ripR = pr * 30;
    const ripA = (1 - pr) * 0.6 * intensity;
    ctx.save(); ctx.beginPath(); ctx.arc(src.x, src.y, ripR, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(120, 200, 255, ${ripA})`; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
  });

  // Corner fog / mist
  const grad = ctx.createRadialGradient(WORLD_W / 2, -80, 0, WORLD_W / 2, -80, WORLD_H * 0.85);
  grad.addColorStop(0, `rgba(30, 50, 100, ${0.2 * intensity})`);
  grad.addColorStop(1, "rgba(30, 50, 100, 0)");
  ctx.fillStyle = grad; ctx.fillRect(0, 0, WORLD_W, WORLD_H);
}

function drawLightning(ctx: CanvasRenderingContext2D, flash: number) {
  if (flash <= 0) return;
  // Screen flash
  ctx.fillStyle = `rgba(200, 220, 255, ${flash * 0.65})`;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  // Draw a lightning bolt when flash is strong
  if (flash > 0.7) {
    const bx = 200 + Math.random() * (WORLD_W - 400);
    ctx.save(); ctx.strokeStyle = `rgba(240, 250, 255, ${flash})`; ctx.lineWidth = 3 + flash * 3;
    ctx.shadowColor = "#a0d0ff"; ctx.shadowBlur = 20;
    ctx.beginPath(); ctx.moveTo(bx, 0);
    let cx = bx, cy = 0;
    while (cy < WORLD_H * 0.6) {
      cx += (Math.random() - 0.5) * 60; cy += 30 + Math.random() * 40;
      ctx.lineTo(cx, cy);
    }
    ctx.stroke();
    // Branch
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx - 20, cy - 60);
    ctx.lineTo(cx - 20 + (Math.random() - 0.5) * 80, cy - 60 + 80); ctx.stroke();
    ctx.restore();
  }
}

function drawDroughtOverlay(ctx: CanvasRenderingContext2D, intensity: number, t: number) {
  if (intensity <= 0) return;

  // Warm amber tint over whole screen
  ctx.fillStyle = `rgba(255, 140, 20, ${intensity * 0.2})`;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  // Sun glare — blazing radial from top-right
  const sunX = WORLD_W - 80; const sunY = 60;
  const sunGrad = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 350);
  sunGrad.addColorStop(0, `rgba(255, 250, 180, ${intensity * 0.85})`);
  sunGrad.addColorStop(0.08, `rgba(255, 210, 60, ${intensity * 0.6})`);
  sunGrad.addColorStop(0.3, `rgba(255, 150, 20, ${intensity * 0.25})`);
  sunGrad.addColorStop(1, "rgba(255, 100, 0, 0)");
  ctx.fillStyle = sunGrad; ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  // Sun disc
  ctx.save();
  ctx.beginPath(); ctx.arc(sunX, sunY, 28 + Math.sin(t * 2) * 2, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255, 255, 200, ${intensity * 0.95})`; ctx.fill();
  ctx.strokeStyle = `rgba(255, 200, 80, ${intensity * 0.7})`; ctx.lineWidth = 4;
  ctx.shadowColor = "#ffe060"; ctx.shadowBlur = 30; ctx.stroke(); ctx.restore();

  // Sun rays
  ctx.save(); ctx.strokeStyle = `rgba(255, 220, 80, ${intensity * 0.35})`; ctx.lineWidth = 1.5;
  for (let r = 0; r < 12; r++) {
    const ang = (r / 12) * Math.PI * 2 + t * 0.3;
    const inner = 34; const outer = 60 + Math.sin(t * 3 + r) * 8;
    ctx.beginPath(); ctx.moveTo(sunX + Math.cos(ang) * inner, sunY + Math.sin(ang) * inner);
    ctx.lineTo(sunX + Math.cos(ang) * outer, sunY + Math.sin(ang) * outer); ctx.stroke();
  }
  ctx.restore();

  // Heat shimmer lines — horizontal wavy transparent bands
  ctx.save();
  for (let yi = 0; yi < WORLD_H; yi += 6) {
    const wave = Math.sin(yi * 0.07 + t * 5) * intensity * 3.5;
    const alpha = 0.025 * intensity * (0.5 + Math.sin(yi * 0.04 + t * 4) * 0.5);
    ctx.fillStyle = `rgba(255, 200, 100, ${alpha})`;
    ctx.fillRect(wave, yi, WORLD_W, 3);
  }
  ctx.restore();

  // Dust devils — 2 swirling columns
  for (let di = 0; di < 2; di++) {
    const dx = 200 + di * 600 + Math.sin(t * 0.5 + di * 3) * 80;
    const dy = WORLD_H - 100;
    ctx.save();
    for (let ring = 0; ring < 8; ring++) {
      const ry = dy - ring * 22;
      const rx = dx + Math.sin(t * 4 + ring * 0.9 + di) * (12 - ring * 1.2);
      const rw = Math.max(1, 18 - ring * 2);
      const alpha = (1 - ring / 8) * 0.12 * intensity;
      ctx.beginPath(); ctx.ellipse(rx, ry, rw, rw * 0.35, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(210, 170, 80, ${alpha})`; ctx.fill();
    }
    ctx.restore();
  }

  // Ground heat shimmer — bottom gradient
  const groundGrad = ctx.createLinearGradient(0, WORLD_H * 0.6, 0, WORLD_H);
  groundGrad.addColorStop(0, "rgba(255, 120, 0, 0)");
  groundGrad.addColorStop(1, `rgba(255, 120, 0, ${intensity * 0.12})`);
  ctx.fillStyle = groundGrad; ctx.fillRect(0, WORLD_H * 0.6, WORLD_W, WORLD_H * 0.4);
}

function drawWeatherBanner(ctx: CanvasRenderingContext2D, weather: WeatherState, intensity: number, t: number) {
  if (intensity < 0.3 || weather === "clear") return;
  const alpha = Math.min(1, (intensity - 0.3) / 0.2) * (0.7 + Math.sin(t * 3) * 0.3);
  ctx.save();
  if (weather === "rain") {
    ctx.fillStyle = `rgba(80, 160, 255, ${alpha * 0.9})`;
    ctx.font = "11px 'Press Start 2P', monospace";
    ctx.textAlign = "center";
    ctx.fillText("⛈ RAINSTORM — WELLS FILLING", WORLD_W / 2, 44);
  } else {
    ctx.fillStyle = `rgba(255, 160, 20, ${alpha * 0.9})`;
    ctx.font = "11px 'Press Start 2P', monospace";
    ctx.textAlign = "center";
    ctx.fillText("☀ DROUGHT — WELLS DRYING", WORLD_W / 2, 44);
  }
  ctx.restore();
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export function WaterGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState>(initState());
  const keysRef = useRef<Set<string>>(new Set());
  const animRef = useRef<number>(0);
  const shimmerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const touchMoveRef = useRef<{ x: number; y: number; active: boolean }>({ x: 0, y: 0, active: false });
  const droughtLoopRef = useRef<HTMLAudioElement | null>(null);
  const rainLoopRef = useRef<HTMLAudioElement | null>(null);
  const cleanWellLoopRef = useRef<HTMLAudioElement | null>(null);
  const cleanDeliveryRef = useRef<HTMLAudioElement | null>(null);
  const dirtyHookRef = useRef<HTMLAudioElement | null>(null);
  const dirtyDeliveryRef = useRef<HTMLAudioElement | null>(null);
  const bgMusicRef = useRef<HTMLAudioElement | null>(null);
  const prevWeatherRef = useRef<WeatherState>("clear");
  const prevGameOverRef = useRef(false);
  const wasCollectingCleanWellRef = useRef(false);
  const wasCollectingDirtyRef = useRef(false);
  const audioUnlockedRef = useRef(false);
  const totalGoodWaterCollectedRef = useRef(0);
  const totalBadWaterCollectedRef = useRef(0);
  const weekStartPopulationRef = useRef(25);
  const weekStartFundsRef = useRef(0);
  const weekStartGoodWaterRef = useRef(0);
  const weekStartBadWaterRef = useRef(0);
  const weekSummaryRef = useRef<WeekSummary | null>(null);

  const [uiState, setUiState] = useState({
    health: 100, water: 0, maxWater: BASE_MAX_WATER,
    bucketContaminated: false, hasFilter: false,
    money: 0, donationRate: 0,
    population: 25, day: 1, timeOfDay: 0,
    gameOver: false, nearShop: false,
    purchasedUpgrades: new Set<string>(),
    buildMode: false,
    weather: "clear" as WeatherState,
    weatherIntensity: 0,
  });
  const [shopOpen, setShopOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [stickPos, setStickPos] = useState({ x: 0, y: 0 });
  const [weekSummary, setWeekSummary] = useState<WeekSummary | null>(null);
  const viewW = isMobile ? MOBILE_VIEW_W : WORLD_W;
  const viewH = isMobile ? MOBILE_VIEW_H : WORLD_H;

  const updateMobileFlag = useCallback(() => {
    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    setIsMobile(coarsePointer || window.innerWidth <= 900);
  }, []);

  const placeWellAtPlayer = useCallback(() => {
    const s = stateRef.current;
    if (s.gameOver || !s.buildMode) return;
    if (s.money >= WELL_COST && canPlaceWell(s)) {
      const nw = { x: s.px, y: s.py };
      stateRef.current.money -= WELL_COST;
      stateRef.current.builtWells = [...s.builtWells, nw];
      const id = 1000 + stateRef.current.builtWells.length - 1;
      stateRef.current.sources = [...s.sources, { id, x: s.px, y: s.py, amount: 80, maxAmount: 80, type: "well", contaminated: false, built: true }];
      stateRef.current.buildMode = false;
      stateRef.current.floatTexts = [...s.floatTexts, { id: ++stateRef.current.lastFloatId, x: s.px, y: s.py - 50, text: "★ WELL BUILT!", color: CW.yellow, age: 0 }];
    }
  }, []);

  const updateStick = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const rawX = e.clientX - cx;
    const rawY = e.clientY - cy;
    const maxR = rect.width * 0.38;
    const dist = Math.hypot(rawX, rawY);
    const scale = dist > maxR ? maxR / dist : 1;
    const clampedX = rawX * scale;
    const clampedY = rawY * scale;
    touchMoveRef.current = {
      x: clampedX / maxR,
      y: clampedY / maxR,
      active: true,
    };
    setStickPos({ x: clampedX, y: clampedY });
  }, []);

  const releaseStick = useCallback(() => {
    touchMoveRef.current = { x: 0, y: 0, active: false };
    setStickPos({ x: 0, y: 0 });
  }, []);

  const safePlay = useCallback((audio: HTMLAudioElement | null) => {
    if (!audio) return;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {
        // Ignore autoplay errors until user interaction unlocks audio.
      });
    }
  }, []);

  const unlockAudio = useCallback(() => {
    if (audioUnlockedRef.current) return;
    audioUnlockedRef.current = true;

    const audios = [
      droughtLoopRef.current,
      rainLoopRef.current,
      cleanWellLoopRef.current,
      cleanDeliveryRef.current,
      dirtyHookRef.current,
      dirtyDeliveryRef.current,
      bgMusicRef.current,
    ].filter((a): a is HTMLAudioElement => a !== null);

    // Prime all audio elements inside a user gesture so later programmatic play works on mobile.
    audios.forEach((audio) => {
      const prevMuted = audio.muted;
      audio.muted = true;
      const p = audio.play();
      if (p && typeof p.then === "function") {
        p.then(() => {
          audio.pause();
          audio.currentTime = 0;
          audio.muted = prevMuted;
        }).catch(() => {
          audio.muted = prevMuted;
        });
      } else {
        audio.pause();
        audio.currentTime = 0;
        audio.muted = prevMuted;
      }
    });

    // Resync any currently active ambient/loop sounds immediately after unlock.
    const cur = stateRef.current;
    if (!cur.gameOver) {
      safePlay(bgMusicRef.current);
      if (cur.weather === "rain") safePlay(rainLoopRef.current);
      if (cur.weather === "drought") safePlay(droughtLoopRef.current);
    } else {
      safePlay(droughtLoopRef.current);
    }
    const activeSource = cur.collectingFrom === null
      ? null
      : cur.sources.find(src => src.id === cur.collectingFrom) ?? null;
    if (activeSource && activeSource.type === "well" && !activeSource.contaminated) {
      safePlay(cleanWellLoopRef.current);
    }
  }, [safePlay]);

  useEffect(() => {
    const drought = new Audio(SFX_DROUGHT_WIND);
    drought.loop = true;
    drought.volume = 0.35;

    const rain = new Audio(SFX_RAIN_THUNDER);
    rain.loop = true;
    rain.volume = 0.4;

    const cleanWell = new Audio(SFX_WELL_FILL);
    cleanWell.loop = true;
    cleanWell.volume = 0.35;

    const cleanDelivery = new Audio(SFX_CLEAN_DELIVERY);
    cleanDelivery.volume = 0.6;

    const dirtyHook = new Audio(SFX_DIRTY_HOOK);
    dirtyHook.volume = 0.65;

    const dirtyDelivery = new Audio(SFX_DIRTY_DELIVERY);
    dirtyDelivery.volume = 0.65;

    const bgMusic = new Audio(SFX_BG_MUSIC);
    bgMusic.loop = true;
    bgMusic.volume = 0.24;

    droughtLoopRef.current = drought;
    rainLoopRef.current = rain;
    cleanWellLoopRef.current = cleanWell;
    cleanDeliveryRef.current = cleanDelivery;
    dirtyHookRef.current = dirtyHook;
    dirtyDeliveryRef.current = dirtyDelivery;
    bgMusicRef.current = bgMusic;

    return () => {
      [drought, rain, cleanWell, cleanDelivery, dirtyHook, dirtyDelivery, bgMusic].forEach((audio) => {
        audio.pause();
        audio.currentTime = 0;
      });
      droughtLoopRef.current = null;
      rainLoopRef.current = null;
      cleanWellLoopRef.current = null;
      cleanDeliveryRef.current = null;
      dirtyHookRef.current = null;
      dirtyDeliveryRef.current = null;
      bgMusicRef.current = null;
    };
  }, []);

  useEffect(() => {
    const onFirstUserGesture = () => unlockAudio();
    window.addEventListener("pointerdown", onFirstUserGesture, { passive: true });
    window.addEventListener("touchstart", onFirstUserGesture, { passive: true });
    window.addEventListener("keydown", onFirstUserGesture);
    return () => {
      window.removeEventListener("pointerdown", onFirstUserGesture);
      window.removeEventListener("touchstart", onFirstUserGesture);
      window.removeEventListener("keydown", onFirstUserGesture);
    };
  }, [unlockAudio]);

  const handleNewDay = useCallback(() => {
    const s = stateRef.current;
    if (s.gameOver) {
      stateRef.current = initState();
      totalGoodWaterCollectedRef.current = 0;
      totalBadWaterCollectedRef.current = 0;
      weekStartPopulationRef.current = stateRef.current.population;
      weekStartFundsRef.current = stateRef.current.money;
      weekStartGoodWaterRef.current = 0;
      weekStartBadWaterRef.current = 0;
      setWeekSummary(null);
      weekSummaryRef.current = null;
      setShopOpen(false);
      return;
    }

    const nextState = initState(s);
    stateRef.current = nextState;

    if (nextState.day > 1 && (nextState.day - 1) % 7 === 0) {
      const summary: WeekSummary = {
        week: (nextState.day - 1) / 7,
        populationGain: Math.max(0, s.population - weekStartPopulationRef.current),
        fundsRaised: Math.max(0, s.money - weekStartFundsRef.current),
        goodWaterCollected: Math.max(0, totalGoodWaterCollectedRef.current - weekStartGoodWaterRef.current),
        badWaterCollected: Math.max(0, totalBadWaterCollectedRef.current - weekStartBadWaterRef.current),
      };
      setWeekSummary(summary);
      weekSummaryRef.current = summary;
      weekStartPopulationRef.current = s.population;
      weekStartFundsRef.current = s.money;
      weekStartGoodWaterRef.current = totalGoodWaterCollectedRef.current;
      weekStartBadWaterRef.current = totalBadWaterCollectedRef.current;
    }
    setShopOpen(false);
  }, []);

  const handleResetGame = useCallback(() => {
    stateRef.current = initState();
    setShopOpen(false);
    setWeekSummary(null);
    weekSummaryRef.current = null;
    totalGoodWaterCollectedRef.current = 0;
    totalBadWaterCollectedRef.current = 0;
    weekStartPopulationRef.current = stateRef.current.population;
    weekStartFundsRef.current = stateRef.current.money;
    weekStartGoodWaterRef.current = 0;
    weekStartBadWaterRef.current = 0;
    prevWeatherRef.current = "clear";
    prevGameOverRef.current = false;
    wasCollectingCleanWellRef.current = false;
    wasCollectingDirtyRef.current = false;
  }, []);

  const handleContinueAfterWeekSummary = useCallback(() => {
    setWeekSummary(null);
    weekSummaryRef.current = null;
  }, []);

  const handleBuy = useCallback((upgradeId: string) => {
    const s = stateRef.current;
    const upg = UPGRADES.find(u => u.id === upgradeId);
    if (!upg || s.purchasedUpgrades.has(upgradeId) || s.money < upg.cost) return;
    if (upgradeId === "jug2" && !s.purchasedUpgrades.has("jug1")) return;
    if (upgradeId === "speed2" && !s.purchasedUpgrades.has("speed1")) return;
    const nu = new Set(s.purchasedUpgrades);
    nu.add(upgradeId);
    stateRef.current.purchasedUpgrades = nu;
    stateRef.current.money = Math.max(0, s.money - upg.cost);
    stateRef.current.maxWater = computeMaxWater(nu);
    stateRef.current.speed = computeSpeed(nu);
    stateRef.current.healthDecay = computeHealthDecay(nu);
    stateRef.current.floatTexts = [...s.floatTexts, { id: ++stateRef.current.lastFloatId, x: SHOP_X, y: SHOP_Y - 70, text: `${upg.icon} BOUGHT!`, color: CW.yellow, age: 0 }];
  }, []);

  useEffect(() => {
    updateMobileFlag();
    window.addEventListener("resize", updateMobileFlag);
    return () => window.removeEventListener("resize", updateMobileFlag);
  }, [updateMobileFlag]);

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","w","a","s","d"," "].includes(e.key)) e.preventDefault();
      if ((e.key === "e" || e.key === "E") && stateRef.current.nearShop) setShopOpen(v => !v);
      if (e.key === "Escape") { setShopOpen(false); stateRef.current.buildMode = false; }
      if ((e.key === "b" || e.key === "B") && !stateRef.current.gameOver) stateRef.current.buildMode = !stateRef.current.buildMode;
      if (e.key === " " && stateRef.current.buildMode && !stateRef.current.gameOver) {
        placeWellAtPlayer();
      }
      keysRef.current.add(e.key);
    };
    const onUp = (e: KeyboardEvent) => keysRef.current.delete(e.key);
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => { window.removeEventListener("keydown", onDown); window.removeEventListener("keyup", onUp); };
  }, [placeWellAtPlayer]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    // Offscreen canvas for heat shimmer post-process
    const shimmerCanvas = document.createElement("canvas");
    shimmerCanvas.width = viewW; shimmerCanvas.height = viewH;
    shimmerCanvasRef.current = shimmerCanvas;
    const shimmerCtx = shimmerCanvas.getContext("2d")!;

    const loop = (timestamp: number) => {
      const s = stateRef.current;
      if (s.lastTime === 0) stateRef.current.lastTime = timestamp;
      const dt = Math.min((timestamp - s.lastTime) / 1000, 0.1);
      stateRef.current.lastTime = timestamp;
      const t = timestamp / 1000;

      if (!s.gameOver && !weekSummaryRef.current) {
        // Movement
        const keys = keysRef.current;
        let dx = 0, dy = 0;
        if (keys.has("ArrowLeft") || keys.has("a")) dx -= s.speed;
        if (keys.has("ArrowRight") || keys.has("d")) dx += s.speed;
        if (keys.has("ArrowUp") || keys.has("w")) dy -= s.speed;
        if (keys.has("ArrowDown") || keys.has("s")) dy += s.speed;
        if (touchMoveRef.current.active) {
          dx += touchMoveRef.current.x * s.speed;
          dy += touchMoveRef.current.y * s.speed;
        }
        if (dx !== 0 && dy !== 0) { dx *= 0.707; dy *= 0.707; }
        const moving = dx !== 0 || dy !== 0;
        if (dx !== 0) stateRef.current.facing = dx > 0 ? "right" : "left";
        stateRef.current.px = Math.max(PLAYER_SIZE, Math.min(WORLD_W - PLAYER_SIZE, s.px + dx));
        stateRef.current.py = Math.max(PLAYER_SIZE, Math.min(WORLD_H - PLAYER_SIZE, s.py + dy));

        // Walk animation
        if (moving) {
          stateRef.current.walkTimer += dt;
          if (stateRef.current.walkTimer > 0.18) { stateRef.current.walkTimer = 0; stateRef.current.walkFrame = (s.walkFrame + 1) % 3; }
        } else { stateRef.current.walkFrame = 0; }

        const hasFilter = s.purchasedUpgrades.has("filter");

        // Health decay
        const dirtyStatusMultiplier = s.bucketContaminated && !hasFilter ? DIRTY_STATUS_HEALTH_MULTIPLIER : 1;
        stateRef.current.health = Math.max(0, s.health - s.healthDecay * (moving ? 1.4 : 1) * dirtyStatusMultiplier);

        // Donations
        const donPerSec = (s.population * DONATION_PER_PERSON_PER_DAY) / DAY_DURATION;
        stateRef.current.moneyFrac += donPerSec * dt;
        if (stateRef.current.moneyFrac >= 0.01) {
          const cents = Math.floor(stateRef.current.moneyFrac * 100);
          stateRef.current.money += cents / 100;
          stateRef.current.moneyFrac -= cents / 100;
        }

        stateRef.current.timeOfDay = Math.min(1, s.timeOfDay + dt / DAY_DURATION);
        stateRef.current.nearShop = Math.hypot(s.px - SHOP_X, s.py - SHOP_Y) < SHOP_RADIUS;

        // ── Weather state machine ─────────────────────────────────
        stateRef.current.nextWeatherTimer -= dt;
        if (s.weather === "clear") {
          if (stateRef.current.nextWeatherTimer <= 0) {
            const pick: WeatherState = Math.random() < 0.55 ? "rain" : "drought";
            stateRef.current.weather = pick;
            stateRef.current.weatherElapsed = 0;
            stateRef.current.weatherDuration = 12 + Math.random() * 18;
            stateRef.current.weatherIntensity = 0;
            stateRef.current.nextWeatherTimer = 25 + Math.random() * 30;
            if (pick === "drought") stateRef.current.droughtCracks = makeCracks();
            stateRef.current.floatTexts = [...s.floatTexts, {
              id: ++stateRef.current.lastFloatId,
              x: WORLD_W / 2, y: WORLD_H / 2 - 60,
              text: pick === "rain" ? "⛈ RAINSTORM!" : "☀ DROUGHT!",
              color: pick === "rain" ? CW.blue : CW.orange,
              age: 0,
            }];
          }
        } else {
          stateRef.current.weatherElapsed += dt;
          const elapsed = stateRef.current.weatherElapsed;
          const dur = s.weatherDuration;
          const rampIn = Math.min(1, elapsed / 3);
          const rampOut = elapsed > dur - 3 ? Math.max(0, (dur - elapsed) / 3) : 1;
          stateRef.current.weatherIntensity = Math.min(rampIn, rampOut);

          if (elapsed >= dur) {
            stateRef.current.weather = "clear";
            stateRef.current.weatherIntensity = 0;
            stateRef.current.droughtCracks = [];
            stateRef.current.nextWeatherTimer = 20 + Math.random() * 25;
          }
        }

        // Lightning during rain
        if (s.weather === "rain" && s.weatherIntensity > 0.4) {
          stateRef.current.lightningTimer -= dt;
          if (stateRef.current.lightningTimer <= 0) {
            stateRef.current.lightningFlash = 1;
            stateRef.current.lightningTimer = 4 + Math.random() * 8;
          }
        }
        if (s.lightningFlash > 0) stateRef.current.lightningFlash = Math.max(0, s.lightningFlash - dt * 5);

        // Apply weather to water sources
        const wInt = s.weatherIntensity;
        const updatedSourcesWeather = s.sources.map(src => {
          if (s.weather === "rain") {
            const rate = src.type === "well" ? RAIN_WELL_FILL_RATE : src.type === "river" ? RAIN_RIVER_FILL_RATE : 0.08;
            return { ...src, amount: Math.min(src.maxAmount, src.amount + rate * wInt * dt) };
          } else if (s.weather === "drought") {
            // Drought dries non-built wells more than rivers; built wells still drain
            const rate = src.type === "well"
              ? (src.built ? DROUGHT_WELL_DRAIN_RATE * 0.5 : DROUGHT_WELL_DRAIN_RATE)
              : src.type === "river" ? DROUGHT_RIVER_DRAIN_RATE : 0.1;
            return { ...src, amount: Math.max(0, src.amount - rate * wInt * dt) };
          }
          return src;
        });
        stateRef.current.sources = updatedSourcesWeather;

        // Collect water
        let collectingFrom: number | null = null;
        let collectingContaminated = false;
        let filledCleanWellThisFrame = false;

        // Collect from only the nearest valid source so contamination + SFX are deterministic.
        let nearestIndex = -1;
        let nearestDist = Number.POSITIVE_INFINITY;
        for (let i = 0; i < stateRef.current.sources.length; i++) {
          const src = stateRef.current.sources[i];
          const dist = Math.hypot(s.px - src.x, s.py - src.y);
          if (dist < COLLECT_RADIUS && src.amount > 0 && s.water < s.maxWater && dist < nearestDist) {
            nearestDist = dist;
            nearestIndex = i;
          }
        }

        const updatedSources = stateRef.current.sources.map((src, idx) => {
          if (idx !== nearestIndex) return src;
          collectingFrom = src.id;
          if (src.contaminated && !hasFilter) collectingContaminated = true;
          const take = Math.min(COLLECT_RATE, src.amount, s.maxWater - s.water);
          stateRef.current.water = Math.min(s.maxWater, s.water + take);
          if (take > 0) {
            if (src.contaminated) totalBadWaterCollectedRef.current += take;
            else totalGoodWaterCollectedRef.current += take;
          }
          if (take > 0 && src.type === "well" && !src.contaminated) filledCleanWellThisFrame = true;
          return { ...src, amount: Math.max(0, src.amount - take) };
        });
        stateRef.current.sources = updatedSources;
        stateRef.current.collectingFrom = collectingFrom;

        if (collectingContaminated) {
          stateRef.current.bucketContaminated = true;
        }
        if (s.bucketContaminated && s.water > 0 && !hasFilter) {
          stateRef.current.water = Math.max(0, stateRef.current.water - CONTAM_WATER_PENALTY * dt);
        }
        if (hasFilter) stateRef.current.bucketContaminated = false;

        // Village delivery — health restores 1:1 with water delivered
        const vx = WORLD_W - 230 + 60; const vy = WORLD_H - 230 + 60;
        if (Math.hypot(s.px - vx, s.py - vy) < DELIVER_RADIUS && s.water > 0) {
          const deliveredWater = s.water;
          const contaminatedDelivery = s.bucketContaminated;
          const popGain = contaminatedDelivery ? 0 : POP_PER_DELIVERY;
          // Health restored 1:1 with water delivered
          const healthGain = deliveredWater * (contaminatedDelivery ? 0.3 : 1.0);
          stateRef.current.health = Math.min(100, stateRef.current.health + healthGain);
          stateRef.current.water = 0;
          stateRef.current.bucketContaminated = false;
          stateRef.current.population += popGain;
          stateRef.current.deliveryFlash = 1;
          const popText = contaminatedDelivery ? "NO POP (DIRTY WATER)" : `+${popGain} POP`;
          const healthText = `+${Math.round(healthGain)} HP`;
          stateRef.current.floatTexts = [
            ...s.floatTexts,
            { id: ++stateRef.current.lastFloatId, x: vx - 20, y: vy - 50, text: popText, color: contaminatedDelivery ? CW.orange : CW.yellow, age: 0 },
            { id: stateRef.current.lastFloatId + 1, x: vx + 20, y: vy - 68, text: healthText, color: CW.peach, age: 0 },
          ];
          stateRef.current.lastFloatId++;
          if (!contaminatedDelivery) {
            if (cleanDeliveryRef.current) cleanDeliveryRef.current.currentTime = 0;
            safePlay(cleanDeliveryRef.current);
          } else {
            if (dirtyDeliveryRef.current) dirtyDeliveryRef.current.currentTime = 0;
            safePlay(dirtyDeliveryRef.current);
          }
        }

        if (s.deliveryFlash > 0) stateRef.current.deliveryFlash = Math.max(0, s.deliveryFlash - dt * 1.8);
        if (s.water > 0) stateRef.current.water = Math.max(0, s.water - WATER_DECAY);
        if (stateRef.current.water <= 0) stateRef.current.bucketContaminated = false;
        if (s.health <= 0) stateRef.current.gameOver = true;

        // Ripples
        stateRef.current.rippleTimer += dt;
        if (stateRef.current.rippleTimer > (s.weather === "rain" ? 0.3 : 0.55)) {
          stateRef.current.rippleTimer = 0;
          const newRipples: Ripple[] = [];
          stateRef.current.sources.forEach(src => {
            if (src.amount > 0) {
              const c = src.contaminated ? "rgba(140,90,30," : "rgba(30,144,255,";
              newRipples.push({ id: ++stateRef.current.lastRippleId, x: src.x + (Math.random() - 0.5) * 20, y: src.y + (Math.random() - 0.5) * 10, radius: 4 + Math.random() * 6, maxRadius: src.type === "river" ? 28 + Math.random() * 16 : 16 + Math.random() * 10, alpha: 0.7, color: `${c}0.6)` });
            }
          });
          if (collectingFrom !== null) {
            newRipples.push({ id: ++stateRef.current.lastRippleId, x: s.px, y: s.py, radius: 2, maxRadius: 22, alpha: 0.8, color: "rgba(100,200,255,0.8)" });
          }
          stateRef.current.ripples = [...s.ripples, ...newRipples];
        }
        stateRef.current.ripples = stateRef.current.ripples.map(r => ({ ...r, radius: r.radius + (r.maxRadius - r.radius) * dt * 2.5, alpha: r.alpha - dt * 0.8 })).filter(r => r.alpha > 0.02);

        // Dust (walk)
        if (moving) {
          stateRef.current.dustTimer += dt;
          if (stateRef.current.dustTimer > 0.12) {
            stateRef.current.dustTimer = 0;
            stateRef.current.dusts = [...s.dusts, { id: ++stateRef.current.lastDustId, x: s.px + (Math.random() - 0.5) * 10, y: s.py + PLAYER_SIZE + 2, radius: 2 + Math.random() * 3, alpha: 0.55, vx: (Math.random() - 0.5) * 20, vy: Math.random() * -15 }];
          }
        }
        stateRef.current.dusts = stateRef.current.dusts.map(d => ({ ...d, x: d.x + d.vx * dt, y: d.y + d.vy * dt, radius: d.radius + dt * 6, alpha: d.alpha - dt * 1.4 })).filter(d => d.alpha > 0.02);

        stateRef.current.floatTexts = stateRef.current.floatTexts.map(ft => ({ ...ft, y: ft.y - 24 * dt, age: ft.age + dt })).filter(ft => ft.age < 3.0);

        // ── Sound triggers ───────────────────────────────────────
        if (prevWeatherRef.current !== stateRef.current.weather) {
          const rainLoop = rainLoopRef.current;
          const droughtLoop = droughtLoopRef.current;
          if (rainLoop) {
            rainLoop.pause();
            rainLoop.currentTime = 0;
          }
          if (droughtLoop) {
            droughtLoop.pause();
            droughtLoop.currentTime = 0;
          }
          if (stateRef.current.weather === "rain") safePlay(rainLoop);
          if (stateRef.current.weather === "drought") safePlay(droughtLoop);
          prevWeatherRef.current = stateRef.current.weather;
        }

        // Background music while alive.
        if (bgMusicRef.current?.paused) safePlay(bgMusicRef.current);

        const activeSource = stateRef.current.collectingFrom === null
          ? null
          : stateRef.current.sources.find(src => src.id === stateRef.current.collectingFrom) ?? null;
        const collectingCleanWell = filledCleanWellThisFrame || (!!activeSource && activeSource.type === "well" && !activeSource.contaminated);
        const collectingDirtySite = !!activeSource && activeSource.contaminated;

        if (collectingCleanWell) {
          if (!wasCollectingCleanWellRef.current && cleanWellLoopRef.current) {
            cleanWellLoopRef.current.currentTime = 0;
          }
          if (cleanWellLoopRef.current?.paused) {
            safePlay(cleanWellLoopRef.current);
          }
        } else if (wasCollectingCleanWellRef.current && cleanWellLoopRef.current) {
          cleanWellLoopRef.current.pause();
          cleanWellLoopRef.current.currentTime = 0;
        }
        wasCollectingCleanWellRef.current = collectingCleanWell;

        if (collectingDirtySite && !wasCollectingDirtyRef.current) {
          if (dirtyHookRef.current) dirtyHookRef.current.currentTime = 0;
          safePlay(dirtyHookRef.current);
        }
        wasCollectingDirtyRef.current = collectingDirtySite;
      }

      if (stateRef.current.gameOver) {
        if (cleanWellLoopRef.current && !cleanWellLoopRef.current.paused) {
          cleanWellLoopRef.current.pause();
          cleanWellLoopRef.current.currentTime = 0;
        }
      }

      // Game over audio state management.
      if (!prevGameOverRef.current && stateRef.current.gameOver) {
        if (rainLoopRef.current) { rainLoopRef.current.pause(); rainLoopRef.current.currentTime = 0; }
        if (cleanWellLoopRef.current) { cleanWellLoopRef.current.pause(); cleanWellLoopRef.current.currentTime = 0; }
        if (bgMusicRef.current) { bgMusicRef.current.pause(); bgMusicRef.current.currentTime = 0; }
        if (droughtLoopRef.current) droughtLoopRef.current.currentTime = 0;
        safePlay(droughtLoopRef.current);
      } else if (prevGameOverRef.current && !stateRef.current.gameOver) {
        if (droughtLoopRef.current) { droughtLoopRef.current.pause(); droughtLoopRef.current.currentTime = 0; }
        if (bgMusicRef.current) bgMusicRef.current.currentTime = 0;
        safePlay(bgMusicRef.current);
      }
      prevGameOverRef.current = stateRef.current.gameOver;

      // ─── DRAW ─────────────────────────────────────────────────────────────
      const cur = stateRef.current;
      ctx.clearRect(0, 0, viewW, viewH);

      const camX = isMobile ? Math.max(0, Math.min(WORLD_W - viewW, cur.px - viewW / 2)) : 0;
      const camY = isMobile ? Math.max(0, Math.min(WORLD_H - viewH, cur.py - viewH / 2)) : 0;

      ctx.save();
      ctx.translate(-camX, -camY);

      drawTerrain(ctx, cur.trees, cur.weather === "drought" ? cur.weatherIntensity : 0);
      drawDroughtCracks(ctx, cur.droughtCracks, cur.weatherIntensity);
      drawSkyOverlay(ctx, cur.timeOfDay);
      drawRipples(ctx, cur.ripples);
      drawShop(ctx, cur.nearShop, t);
      cur.sources.forEach(src => drawWaterSource(ctx, src, cur.collectingFrom === src.id, t, cur.purchasedUpgrades.has("filter"), cur.weather, cur.weatherIntensity));
      drawVillage(ctx, cur.population);
      drawDusts(ctx, cur.dusts);
      if (cur.buildMode) drawBuildMode(ctx, cur.px, cur.py, canPlaceWell(cur) && cur.money >= WELL_COST, t);
      drawPlayer(ctx, cur.px, cur.py, cur.water, cur.maxWater, cur.bucketContaminated, cur.collectingFrom, cur.facing, cur.walkFrame);
      drawFloatTexts(ctx, cur.floatTexts);

      // Heat shimmer post-process (drought) — copy viewport, redraw in sinusoidal strips
      if (cur.weather === "drought" && cur.weatherIntensity > 0.15) {
        shimmerCtx.clearRect(0, 0, viewW, viewH);
        shimmerCtx.drawImage(canvas, 0, 0);
        const stripH = 3;
        const maxOff = cur.weatherIntensity * 7;
        for (let sy = 0; sy < viewH; sy += stripH) {
          const xOff = Math.sin(sy * 0.06 + t * 6) * maxOff;
          ctx.clearRect(camX, camY + sy, viewW, stripH);
          ctx.drawImage(shimmerCanvas, 0, sy, viewW, stripH, camX + xOff, camY + sy, viewW, stripH);
        }
      }

      // Drought overlay (sun, glow, dust devils)
      drawDroughtOverlay(ctx, cur.weather === "drought" ? cur.weatherIntensity : 0, t);

      // Rain (drawn after shimmer so drops are sharp)
      if (cur.weather === "rain" && cur.weatherIntensity > 0) {
        drawRainOverlay(ctx, cur.weatherIntensity, t, cur.sources);
      }

      // Lightning
      drawLightning(ctx, cur.lightningFlash);

      ctx.restore();

      // Weather banner text
      if (!isMobile) drawWeatherBanner(ctx, cur.weather, cur.weatherIntensity, t);

      // Delivery flash
      if (cur.deliveryFlash > 0) {
        ctx.save();
        ctx.fillStyle = `rgba(90,200,80,${cur.deliveryFlash * 0.18})`; ctx.fillRect(0, 0, viewW, viewH);
        ctx.font = "13px 'Press Start 2P', monospace"; ctx.fillStyle = `rgba(245,200,66,${cur.deliveryFlash})`; ctx.textAlign = "center";
        ctx.fillText("WATER DELIVERED!", viewW / 2, viewH / 2 - 20); ctx.restore();
      }

      // Game over
      if (cur.gameOver) {
        ctx.fillStyle = "rgba(0,0,0,0.65)"; ctx.fillRect(0, 0, viewW, viewH);
        const gameOverY = isMobile ? viewH * 0.64 : viewH / 2;
        ctx.save(); ctx.font = "34px 'Press Start 2P', monospace"; ctx.fillStyle = CW.orange; ctx.textAlign = "center";
        ctx.fillText("GAME OVER", viewW / 2, gameOverY - 30);
        ctx.font = "11px 'Press Start 2P', monospace"; ctx.fillStyle = CW.peach;
        ctx.fillText("Cause of death: Health reached 0", viewW / 2, gameOverY + 6);
        ctx.font = "10px 'Press Start 2P', monospace"; ctx.fillStyle = CW.cream;
        ctx.fillText(`Day ${cur.day}  ·  $${cur.money.toFixed(2)}  ·  Pop: ${cur.population}`, viewW / 2, gameOverY + 30); ctx.restore();
      }

      const donationRate = cur.population * DONATION_PER_PERSON_PER_DAY;
      setUiState({
        health: Math.round(cur.health), water: Math.round(cur.water), maxWater: cur.maxWater,
        bucketContaminated: cur.bucketContaminated, hasFilter: cur.purchasedUpgrades.has("filter"),
        money: cur.money, donationRate,
        population: cur.population, day: cur.day, timeOfDay: cur.timeOfDay,
        gameOver: cur.gameOver, nearShop: cur.nearShop,
        purchasedUpgrades: cur.purchasedUpgrades, buildMode: cur.buildMode,
        weather: cur.weather, weatherIntensity: cur.weatherIntensity,
      });

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [isMobile, viewH, viewW]);

  return (
    <div className="relative flex items-center justify-center w-full h-full" style={{ background: CW.black, minHeight: "100vh", touchAction: "none" }}>
      <div style={{ width: isMobile ? "min(96vw, 560px)" : "min(100vw, 1200px)" }}>
      <div className="relative" style={{ width: "100%", aspectRatio: `${viewW} / ${viewH}` }}>
        <canvas ref={canvasRef} width={viewW} height={viewH} style={{ width: "100%", height: "100%", display: "block", imageRendering: "pixelated", border: `3px solid ${CW.navy}`, boxShadow: "0 0 40px rgba(0,0,0,0.8)" }} />
        <GameHUD
          health={uiState.health} waterCollected={uiState.water} maxWater={uiState.maxWater}
          bucketContaminated={uiState.bucketContaminated} hasFilter={uiState.hasFilter}
          moneyRaised={uiState.money} donationRate={uiState.donationRate}
          population={uiState.population} day={uiState.day} timeOfDay={uiState.timeOfDay}
          onNewDay={handleNewDay} onResetGame={handleResetGame} gameOver={uiState.gameOver}
          nearShop={uiState.nearShop} onOpenShop={() => setShopOpen(v => !v)}
          buildMode={uiState.buildMode} onToggleBuild={() => { stateRef.current.buildMode = !stateRef.current.buildMode; }}
          wellCost={WELL_COST} weather={uiState.weather} weatherIntensity={uiState.weatherIntensity}
          isMobile={isMobile}
          healthDrainMultiplier={DIRTY_STATUS_HEALTH_MULTIPLIER}
        />
        {isMobile && !shopOpen && !uiState.gameOver && (
          <>
            <div
              style={{
                position: "absolute",
                left: 14,
                bottom: 14,
                width: 124,
                height: 124,
                borderRadius: "50%",
                background: "rgba(20,12,5,0.48)",
                border: "2px solid rgba(232,213,163,0.35)",
                boxShadow: "0 0 10px rgba(0,0,0,0.45)",
                touchAction: "none",
                pointerEvents: "auto",
                zIndex: 18,
              }}
              onPointerDown={updateStick}
              onPointerMove={(e) => {
                if (e.buttons !== 0 || e.pointerType === "touch") updateStick(e);
              }}
              onPointerUp={releaseStick}
              onPointerCancel={releaseStick}
              onPointerLeave={(e) => {
                if (e.pointerType === "mouse") releaseStick();
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  width: 52,
                  height: 52,
                  borderRadius: "50%",
                  transform: `translate(calc(-50% + ${stickPos.x}px), calc(-50% + ${stickPos.y}px))`,
                  background: "rgba(245,200,66,0.65)",
                  border: "2px solid rgba(245,200,66,0.9)",
                  boxShadow: "0 0 8px rgba(245,200,66,0.5)",
                }}
              />
            </div>
            <div style={{ position: "absolute", right: 14, bottom: 14, display: "flex", flexDirection: "column", gap: 8, zIndex: 18, pointerEvents: "auto" }}>
              <button
                onClick={() => { if (stateRef.current.nearShop) setShopOpen(v => !v); }}
                disabled={!uiState.nearShop}
                style={{
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: "9px",
                  padding: "10px 12px",
                  borderRadius: "6px",
                  border: `2px solid ${uiState.nearShop ? CW.yellow : CW.navy}`,
                  background: uiState.nearShop ? CW.navy : "rgba(26,26,26,0.92)",
                  color: uiState.nearShop ? CW.yellow : CW.blue,
                }}
              >
                SHOP
              </button>
              <button
                onClick={() => { stateRef.current.buildMode = !stateRef.current.buildMode; }}
                style={{
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: "8px",
                  padding: "10px 12px",
                  borderRadius: "6px",
                  border: `2px solid ${uiState.buildMode ? CW.yellow : CW.blue}`,
                  background: uiState.buildMode ? CW.navy : "#10263A",
                  color: uiState.buildMode ? CW.yellow : CW.blue,
                }}
              >
                {uiState.buildMode ? "BUILD ON" : "BUILD"}
              </button>
              {uiState.buildMode && (
                <button
                  onClick={placeWellAtPlayer}
                  style={{
                    fontFamily: "'Press Start 2P', monospace",
                    fontSize: "8px",
                    padding: "10px 12px",
                    borderRadius: "6px",
                    border: `2px solid ${CW.yellow}`,
                    background: CW.navy,
                    color: CW.yellow,
                  }}
                >
                  PLACE
                </button>
              )}
            </div>
          </>
        )}
        {shopOpen && (
          <UpgradeShop money={uiState.money} purchasedUpgrades={uiState.purchasedUpgrades} onBuy={handleBuy} onClose={() => setShopOpen(false)} isMobile={isMobile} />
        )}
        {weekSummary && (
          <div
            onClick={handleContinueAfterWeekSummary}
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.76)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 40,
              pointerEvents: "auto",
            }}
          >
            <div style={{
              width: isMobile ? "84%" : "420px",
              border: `3px solid ${CW.yellow}`,
              background: "rgba(15,15,15,0.92)",
              padding: isMobile ? "14px 12px" : "18px 16px",
              textAlign: "center",
              boxShadow: "0 0 24px rgba(0,0,0,0.65)",
            }}>
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: isMobile ? "10px" : "11px", color: CW.yellow, marginBottom: "10px" }}>
                WEEK {weekSummary.week} COMPLETE!
              </div>
              <div style={{ fontFamily: "'VT323', monospace", fontSize: isMobile ? "20px" : "24px", color: CW.cream, marginBottom: "10px" }}>
                Great work keeping water moving.
              </div>
              <div style={{ fontFamily: "'VT323', monospace", fontSize: isMobile ? "18px" : "20px", color: CW.blue, lineHeight: 1.4 }}>
                +{weekSummary.populationGain} population<br />
                ${weekSummary.fundsRaised.toFixed(2)} raised<br />
                {Math.round(weekSummary.goodWaterCollected)} good water<br />
                {Math.round(weekSummary.badWaterCollected)} bad water
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleContinueAfterWeekSummary(); }}
                style={{
                  marginTop: "12px",
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: "7px",
                  padding: "8px 12px",
                  borderRadius: "4px",
                  border: `2px solid ${CW.blue}`,
                  background: CW.navy,
                  color: CW.blue,
                  cursor: "pointer",
                }}
              >
                CONTINUE
              </button>
            </div>
          </div>
        )}
      </div>
      <div style={{
        marginTop: "8px",
        height: isMobile ? "52px" : "60px",
        border: `3px solid ${CW.navy}`,
        borderTop: `2px solid ${CW.blue}`,
        background: "linear-gradient(180deg, rgba(26,26,26,0.98) 0%, rgba(14,14,14,0.98) 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 0 24px rgba(0,0,0,0.45)",
      }}>
        <div style={{
          fontFamily: "'Avenir Next', 'Trebuchet MS', sans-serif",
          fontWeight: 800,
          letterSpacing: "0.12em",
          fontSize: isMobile ? "18px" : "24px",
          textTransform: "uppercase",
        }}>
          <span style={{ color: CW.yellow }}>Water</span>
          <span style={{ color: CW.cream, margin: "0 8px" }}>Source</span>
        </div>
      </div>
      </div>
    </div>
  );
}

function canPlaceWell(s: GameState): boolean {
  const avoid = [
    { x: WORLD_W - 230 + 60, y: WORLD_H - 230 + 60, r: 100 },
    { x: SHOP_X, y: SHOP_Y, r: 80 },
    ...s.sources.map(src => ({ x: src.x, y: src.y, r: 50 })),
  ];
  return !avoid.some(z => Math.hypot(s.px - z.x, s.py - z.y) < z.r);
}
