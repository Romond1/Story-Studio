import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Boxes, Check, Crown, Download, Eye, Flame, Ghost, ImagePlus, Music, Play, Save, Settings2, Shield, Sparkles, Swords, TimerReset, Trophy, Upload, Users, Volume2, VolumeX, X, Zap } from "lucide-react";
import { burstConfetti, playSound, setSoundEnabled, startMusic, stopMusic, setCustomSound, setMusicTrack, hasCustomSound, hasMusicTrack } from "./effects";
import {
  COLS,
  ROWS,
  COOP_CRASH_TIME_PENALTY,
  COOP_START_TIME,
  HERO_CROWN_CHALLENGES,
  HERO_CROWN_DEFAULT_SETTINGS,
  awardHeroCrown,
  advanceCoopTimer,
  buildFoodFromQuestions,
  calculateCrownBonus,
  chooseReachableHeroCrownCell,
  canRunCoopTimer,
  canPlayerMove,
  createFoodQuestionForIndex,
  createCoopState,
  createPlayers,
  createPlayerDirectionLabelMap,
  describeOutcomeResult,
  ENEMY_DEFAULT_SETTINGS,
  getEnemySettings,
  chooseEnemySpawn,
  stepEnemyToward,
  getEnemyCatch,
  getStreakTier,
  expireHeroCrown,
  getActiveTurnAfterMove,
  getCoopOutcome,
  getCrashResolution,
  getHeroCrownSettings,
  getFoodType,
  getNextHead,
  getNextTurn,
  getPlayerSpawnAnchors,
  getReverseDirection,
  isIllegalReverseMove,
  isOutOfBounds,
  posKey,
  randomSpacedCells,
  resolveCrystalEffect,
  segmentsContain,
  shouldSpawnHeroCrown,
  shouldSpawnBattleBomb,
  updatePlayerDirectionLabel,
} from "./gameLogic";

const DEFAULT_DIRECTION_LABELS = { up: "UP", down: "DOWN", left: "LEFT", right: "RIGHT" };
const SAVE_STORAGE_KEY = "story-studio-language-snake-save-v1";
const SAVE_FILE_VERSION = 1;
const DEFAULT_QUESTION_LINES = [
  "CLUE: They followed the glowing s__________ through the forest.",
  "Answer: shard",
  "",
  "UNSCRAMBLE: deeper / The / forest / into / shard / moving / is",
  "Answer: The shard is moving deeper into the forest.",
  "",
  "WHO SAID: \"Do not rush, Yuki?\"",
  "Answer: Kage",
  "",
  "FINISH: The kids found a big old c__________ in the forest.",
  "Answer: castle",
];
const HERO_CROWN_SHORTCUTS = { spawn: "C", player1: "1", player2: "2", both: "B", cancel: "Esc" };
const DEFAULT_SPLASH_SETUP = {
  mode: "versus",
  lessonType: "solo",
  boardWidth: COLS,
  boardHeight: ROWS,
  crystalCount: 36,
  coopTimerSeconds: COOP_START_TIME,
  playerCount: 2,
  playerNames: ["Student", "Teacher"],
};
const PLAYER_KEY_SETS = [
  { label: "W A S D", up: ["w"], left: ["a"], down: ["s"], right: ["d"] },
  { label: "Arrow keys", up: ["arrowup"], left: ["arrowleft"], down: ["arrowdown"], right: ["arrowright"] },
  { label: "Numpad 8 4 5 6", up: ["8"], left: ["4"], down: ["5"], right: ["6"] },
  { label: "I J K L", up: ["i"], left: ["j"], down: ["k"], right: ["l"] },
];
const SOUND_SLOTS = [
  ["correct", "Correct answer"],
  ["wrong", "Wrong answer"],
  ["eat", "Eat crystal"],
  ["crash", "Crash"],
  ["crown", "Crown"],
  ["congrats", "Congratulations / win"],
  ["cheer", "Cheer meter"],
  ["confetti", "Confetti"],
  ["villain", "Villain appears"],
];
function directionKeysFromSet(set) { return { up: [...set.up], down: [...set.down], left: [...set.left], right: [...set.right] }; }
function keyLabel(keys) { return (keys || []).map((k) => k === " " ? "Space" : k.length === 1 ? k.toUpperCase() : k.replace("arrow", "")).join("/") || "—"; }
const PLAYER_HUES = { student: 192, teacher: 270, mint: 150, sun: 40 };
const glass = {
  background: "linear-gradient(180deg, rgba(15,23,42,.18), rgba(15,23,42,.08))",
  border: "1px solid rgba(255,255,255,.12)",
  borderRadius: 24,
  boxShadow: "0 24px 80px rgba(2,6,23,.22)",
  backdropFilter: "blur(10px) saturate(1.08)",
  WebkitBackdropFilter: "blur(10px) saturate(1.08)",
};
const button = { border: "none", borderRadius: 14, padding: "11px 16px", color: "#fff", cursor: "pointer", fontWeight: 700 };
const input = { width: "100%", background: "rgba(2,6,23,.62)", color: "#f8fafc", border: "1px solid rgba(255,255,255,.14)", borderRadius: 14, padding: "10px 12px" };
const badge = { display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 11px", borderRadius: 999, fontSize: 12, background: "rgba(15,23,42,.26)", border: "1px solid rgba(255,255,255,.12)", color: "#f8fafc" };

function InfoBadge({ children, style = {} }) { return <span style={{ ...badge, ...style }}>{children}</span>; }
function StatTile({ icon, label, value, gradient, glow, flashUntil = 0 }) {
  const flashing = flashUntil && Date.now() < flashUntil;
  return (
    <motion.div
      animate={flashing
        ? { scale: [1, 1.22, 1], filter: ["brightness(1)", "brightness(1.6)", "brightness(1)"] }
        : { scale: [1, 1.035, 1], filter: ["brightness(1)", "brightness(1.16)", "brightness(1)"] }}
      transition={{ duration: flashing ? 0.5 : 1.8, repeat: Infinity, ease: "easeInOut" }}
      style={{
        minHeight: 68,
        borderRadius: 16,
        padding: "9px 10px",
        background: gradient,
        color: "#ffffff",
        display: "grid",
        alignContent: "center",
        justifyItems: "center",
        gap: 2,
        border: flashing ? "1px solid rgba(255,255,255,.85)" : "1px solid rgba(255,255,255,.28)",
        boxShadow: flashing ? `0 0 46px ${glow}, 0 0 22px #fff, inset 0 0 18px rgba(255,255,255,.3)` : `0 0 24px ${glow}, inset 0 0 18px rgba(255,255,255,.12)`,
        textShadow: "0 1px 8px rgba(0,0,0,.28)",
      }}
    >
      <div className="game-stat-label" style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 900, letterSpacing: ".08em", textTransform: "uppercase" }}>{icon}{label}</div>
      <div style={{ fontSize: 28, fontWeight: 950, lineHeight: 1 }}>{value}</div>
    </motion.div>
  );
}
function lines(text) { const parsed = text.split("\n").map((v) => v.trim()); return parsed.some(Boolean) ? parsed : DEFAULT_QUESTION_LINES; }
function playerConfigs(setup) { return Array.from({ length: setup.playerCount }).map((_, i) => ({ name: setup.playerNames[i]?.trim() || `Player ${i + 1}` })); }
function secondsLabel(seconds) { const n = Math.max(0, Math.ceil(seconds)); return `${Math.floor(n / 60)}:${`${n % 60}`.padStart(2, "0")}`; }
function tone(player) { const hue = PLAYER_HUES[player.colorKey] ?? 200; return { hue, bg: `linear-gradient(135deg, hsla(${hue},90%,58%,1), hsla(${(hue + 18) % 360},88%,46%,1))`, glow: `hsla(${hue},90%,62%,.34)` }; }
function segmentStyle(player, index, time, isActive = false, depth = 0) {
  const hue = PLAYER_HUES[player.colorKey] ?? 200;
  const crowned = (player.crownEffectUntil || 0) > Date.now();
  const wave = (Math.sin(time * 4.4 - index * .72) + 1) / 2;
  const crownHue = (time * 180 + index * 48) % 360;
  const head = index === 0;
  const l = head ? 42 + wave * 10 : 52 + wave * 22;
  const eatAge = head && player.eatAt ? Date.now() - player.eatAt : Infinity;
  const eatPop = eatAge < 420 ? 1 + Math.sin((eatAge / 420) * Math.PI) * 0.32 : 1;
  const z = depth + (head ? 8 : 0);
  return {
    background: crowned
      ? `radial-gradient(circle at 32% 26%, #ffffff, transparent 28%), conic-gradient(from ${time * 120}deg, #facc15, #22d3ee, #a855f7, #fb7185, #34d399, #facc15)`
      : `radial-gradient(circle at 35% 28%, rgba(255,255,255,.52), transparent 32%), linear-gradient(135deg, hsla(${hue},96%,${l}%,.98), hsla(${(hue + 24) % 360},92%,${Math.max(34, l - 12)}%,.98))`,
    border: `${head ? 2 : 1}px solid ${crowned ? `hsla(${crownHue},100%,86%,.96)` : `hsla(${hue},100%,${head ? 90 : 82}%,${head ? .9 : .58})`}`,
    boxShadow: head
      ? `0 0 0 2px rgba(255,255,255,.3), 0 0 ${crowned ? 46 : isActive ? 32 : 22}px ${crowned ? `hsla(${crownHue},100%,68%,.9)` : `hsla(${hue},100%,64%,${isActive ? .8 : .48})`}`
      : `inset 0 0 12px hsla(${hue},100%,72%,.2), 0 0 ${crowned ? 30 : 8 + wave * 12}px ${crowned ? `hsla(${crownHue},100%,68%,.72)` : `hsla(${hue},96%,62%,${isActive ? .42 : .24})`}`,
    transform: `translateZ(${z}px) scale(${(head ? 1.12 : 1 + wave * .1) * eatPop}) rotate(${crowned ? Math.sin(time * 5 + index) * 3 : 0}deg)`,
    transition: "background 1.5s ease, border-color 1.5s ease, box-shadow 1.5s ease, transform .45s ease",
  };
}
function heroCrownTileStyle(time, remainingMoves = 5) {
  const urgent = remainingMoves <= 2;
  const pulse = (Math.sin(time * (urgent ? 15 : 7)) + 1) / 2;
  return {
    background: `radial-gradient(circle at 35% 25%, #ffffff, transparent 28%), conic-gradient(from ${time * 220}deg, #fef08a, #facc15, #fb7185, #a855f7, #22d3ee, #fef08a)`,
    border: `${urgent ? 3 : 2}px solid rgba(254,240,138,${0.72 + pulse * .28})`,
    boxShadow: `0 0 ${22 + pulse * (urgent ? 42 : 26)}px rgba(250,204,21,.86), inset 0 0 18px rgba(255,255,255,.38)`,
    transform: `scale(${1.02 + pulse * (urgent ? .16 : .1)}) rotate(${Math.sin(time * 4) * 4}deg)`,
    animation: urgent ? ".38s heroCrownFlash ease-in-out infinite alternate" : "1.2s heroCrownFlash ease-in-out infinite alternate",
  };
}
function mysteryStyle(time, x, y) { const hue = (time * 120 + (x + y) * 18) % 360; return { background: `linear-gradient(135deg, hsla(${hue},92%,64%,.98), hsla(${(hue + 70) % 360},95%,62%,.92), hsla(${(hue + 150) % 360},95%,64%,.98))`, border: `1px solid hsla(${(hue + 35) % 360},100%,85%,.85)` }; }
function getSearchSetup() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  if (!params.has("skipSplash")) return null;
  const playerCount = Math.min(4, Math.max(2, Number(params.get("players") || DEFAULT_SPLASH_SETUP.playerCount)));
  const names = Array.from({ length: playerCount }).map((_, index) => params.get(`name${index + 1}`) || DEFAULT_SPLASH_SETUP.playerNames[index] || `Player ${index + 1}`);
  return {
    autoStart: params.get("autoStart") === "1",
    setup: {
      mode: params.get("mode") === "coop" ? "coop" : "versus",
      boardWidth: Math.max(4, Number(params.get("width") || DEFAULT_SPLASH_SETUP.boardWidth)),
      boardHeight: Math.max(4, Number(params.get("height") || DEFAULT_SPLASH_SETUP.boardHeight)),
      crystalCount: Math.max(1, Number(params.get("crystals") || DEFAULT_SPLASH_SETUP.crystalCount)),
      coopTimerSeconds: Math.max(10, Number(params.get("timer") || DEFAULT_SPLASH_SETUP.coopTimerSeconds)),
      playerCount,
      playerNames: names,
    },
  };
}

function Head({ heading, hue }) {
  const rotation = { right: "rotate(0deg)", down: "rotate(90deg)", left: "rotate(180deg)", up: "rotate(-90deg)" }[heading] || "rotate(0deg)";
  return (
    <div style={{ position: "relative", width: "92%", height: "92%", transform: rotation, display: "grid", placeItems: "center" }}>
      <div style={{ position: "absolute", right: "-16%", width: 0, height: 0, borderTop: "10px solid transparent", borderBottom: "10px solid transparent", borderLeft: "18px solid #ffffff", filter: `drop-shadow(0 0 8px hsla(${hue},100%,72%,.9))` }} />
      <div style={{ position: "absolute", inset: "8% 22% 8% 6%", borderRadius: "52% 44% 44% 52%", background: `linear-gradient(135deg, #ffffff, hsla(${hue},100%,88%,.96))`, boxShadow: "inset -5px -5px 10px rgba(15,23,42,.22)" }} />
      <div style={{ position: "absolute", top: "29%", right: "34%", width: 5, height: 5, borderRadius: 999, background: "#020617" }} />
      <div style={{ position: "absolute", bottom: "29%", right: "34%", width: 5, height: 5, borderRadius: 999, background: "#020617" }} />
    </div>
  );
}

function Splash({ setup, setSetup, onContinue }) {
  const valid = setup.boardWidth > 3 && setup.boardHeight > 3 && setup.crystalCount > 0 && setup.coopTimerSeconds > 0 && setup.playerCount >= 2 && setup.playerCount <= 4 && setup.playerNames.slice(0, setup.playerCount).every((v) => v.trim());
  return (
    <div className="game-overlay" style={{ position: "fixed", inset: 0, zIndex: 70, padding: 18, display: "grid", placeItems: "center", background: "rgba(2,6,23,.52)", backdropFilter: "blur(16px)" }}>
      <motion.div initial={{ opacity: 0, scale: .96, y: 18 }} animate={{ opacity: 1, scale: 1, y: 0 }} style={{ ...glass, width: "min(960px, 100%)", padding: 28 }}>
        <div style={{ display: "grid", gap: 22 }}>
          <div><h1 style={{ margin: 0, fontSize: 38, display: "flex", gap: 12, alignItems: "center" }}><Swords size={32} /> Language Snake Duel</h1><p style={{ margin: "8px 0 0", color: "#cbd5e1" }}>Choose the mode, board size, crystal count, and active players before entering the question setup panel.</p></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
            {[["solo", "Solo (1-on-1)", "You + one child. Praise is personal."], ["group", "Group class", "Multiple kids. Cheers are class-wide."]].map(([value, title, sub]) => <button key={value} style={{ ...button, background: setup.lessonType === value ? "linear-gradient(135deg,#f97316,#c2410c)" : "rgba(15,23,42,.42)", minHeight: 64, textAlign: "left" }} onClick={() => setSetup((p) => ({ ...p, lessonType: value }))}><div style={{ fontSize: 17 }}>{title}</div><div style={{ fontSize: 12, opacity: .86 }}>{sub}</div></button>)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
            {["versus", "coop"].map((mode) => <button id={`mode-${mode}`} key={mode} style={{ ...button, background: setup.mode === mode ? "linear-gradient(135deg,#22d3ee,#0f766e)" : "rgba(15,23,42,.42)", minHeight: 72, textAlign: "left" }} onClick={() => setSetup((p) => ({ ...p, mode }))}><div style={{ fontSize: 18 }}>{mode === "versus" ? "Versus" : "Co-op"}</div><div style={{ fontSize: 12, opacity: .86 }}>{mode === "versus" ? "Compete for points, then survive the bomb phase." : "Clear every crystal before the timer expires."}</div></button>)}
          </div>
          <div className="game-setup-fields" style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 12 }}>
            {[
              ["Board Width", "boardWidth"],
              ["Board Height", "boardHeight"],
              ["Crystals", "crystalCount"],
              ["Timer (sec)", "coopTimerSeconds"],
              ["Players", "playerCount"],
            ].map(([label, key]) => <div key={key} style={{ display: "grid", gap: 6 }}><label style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: ".08em", color: "#cbd5e1" }}>{label}</label><input type="number" min={key === "playerCount" ? 2 : 1} max={key === "playerCount" ? 4 : undefined} value={setup[key]} onChange={(e) => setSetup((p) => ({ ...p, [key]: Number(e.target.value) || 0, playerNames: key === "playerCount" ? Array.from({ length: Math.min(4, Math.max(2, Number(e.target.value) || 0)) }, (_, i) => p.playerNames[i] || `Player ${i + 1}`) : p.playerNames }))} style={input} /></div>)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
            {Array.from({ length: setup.playerCount }).map((_, i) => <input key={i} value={setup.playerNames[i] ?? ""} onChange={(e) => setSetup((p) => { const names = [...p.playerNames]; names[i] = e.target.value; return { ...p, playerNames: names }; })} placeholder={`Player ${i + 1}`} style={input} />)}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}><div style={{ color: "#cbd5e1", fontSize: 14 }}>Questions stay in the next setup panel. If crystals exceed questions, prompts repeat automatically.</div><button id="splash-continue" style={{ ...button, background: valid ? "linear-gradient(135deg,#10b981,#059669)" : "rgba(71,85,105,.72)", minWidth: 180 }} onClick={onContinue} disabled={!valid}>Continue</button></div>
        </div>
      </motion.div>
    </div>
  );
}

export default function App() {
  const [questionText, setQuestionText] = useState(DEFAULT_QUESTION_LINES.join("\n"));
  const [backgroundControls, setBackgroundControls] = useState({ blur: 2, brightness: 1, overlay: 0.18, panelOpacity: 0.62, boardOpacity: 0.42 });
  const [heroCrownSettings, setHeroCrownSettings] = useState(HERO_CROWN_DEFAULT_SETTINGS);
  const [heroCrownChallengeText, setHeroCrownChallengeText] = useState(HERO_CROWN_CHALLENGES.join("\n"));
  const [heroCrownTile, setHeroCrownTile] = useState(null);
  const [heroCrownChallenge, setHeroCrownChallenge] = useState(null);
  const [pendingTurnAfterCrown, setPendingTurnAfterCrown] = useState(null);
  const [nextHeroCrownTargetIndex, setNextHeroCrownTargetIndex] = useState(0);
  const [splashSetup, setSplashSetup] = useState(DEFAULT_SPLASH_SETUP);
  const [matchSetup, setMatchSetup] = useState(DEFAULT_SPLASH_SETUP);
  const [splashVisible, setSplashVisible] = useState(true);
  const [gameStarted, setGameStarted] = useState(false);
  const [players, setPlayers] = useState(() => createPlayers(playerConfigs(DEFAULT_SPLASH_SETUP), DEFAULT_SPLASH_SETUP));
  const [playerDirectionLabels, setPlayerDirectionLabels] = useState(() => createPlayerDirectionLabelMap(createPlayers(playerConfigs(DEFAULT_SPLASH_SETUP), DEFAULT_SPLASH_SETUP), DEFAULT_DIRECTION_LABELS));
  const [playerKeyBindings, setPlayerKeyBindings] = useState({});
  const [capturingKey, setCapturingKey] = useState(null);
  const [activeTurn, setActiveTurn] = useState("player-1");
  const [phase, setPhase] = useState("setup");
  const [foods, setFoods] = useState(() => buildFoodFromQuestions(DEFAULT_QUESTION_LINES, DEFAULT_SPLASH_SETUP));
  const [battleBombs, setBattleBombs] = useState([]);
  const [battleMoveCount, setBattleMoveCount] = useState(0);
  const [pendingPickup, setPendingPickup] = useState(null);
  const [pickupAnswerRevealed, setPickupAnswerRevealed] = useState(false);
  const [pickupResolution, setPickupResolution] = useState(null);
  const [pendingTurnAfterPickup, setPendingTurnAfterPickup] = useState(null);
  const [resultOverlay, setResultOverlay] = useState(null);
  const [messageLog, setMessageLog] = useState([{ text: "Set questions, choose a background, and start the game.", tone: "info" }]);
  const [backgroundImage, setBackgroundImage] = useState("");
  const [animationTime, setAnimationTime] = useState(0);
  const [coopState, setCoopState] = useState(() => createCoopState(DEFAULT_SPLASH_SETUP.coopTimerSeconds));
  const [coopPaused, setCoopPaused] = useState(false);
  const backgroundUrlRef = useRef("");
  const [board3D, setBoard3D] = useState(true);
  const [cameraTilt, setCameraTilt] = useState(30);
  const [cameraZoom, setCameraZoom] = useState(1);
  const [cameraPan, setCameraPan] = useState({ x: 0, y: 0 });
  const [cameraFollow, setCameraFollow] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef(null);
  const boardRef = useRef(null);

  function onBoardPointerDown(event) {
    if (!board3D) return;
    event.preventDefault();
    dragRef.current = { x: event.clientX, y: event.clientY };
    setDragging(true);
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* noop */ }
  }
  function onBoardPointerMove(event) {
    if (!dragRef.current) return;
    const dx = event.clientX - dragRef.current.x;
    const dy = event.clientY - dragRef.current.y;
    dragRef.current = { x: event.clientX, y: event.clientY };
    const el = boardRef.current;
    const maxX = el ? el.offsetWidth * 0.75 : 600;
    const maxY = el ? el.offsetHeight * 0.75 : 500;
    const clamp = (v, m) => Math.max(-m, Math.min(m, v));
    setCameraPan((p) => ({ x: clamp(p.x + dx, maxX), y: clamp(p.y + dy, maxY) }));
  }
  function onBoardPointerUp() { dragRef.current = null; setDragging(false); }
  function resetCamera() { setCameraTilt(30); setCameraZoom(1); setCameraPan({ x: 0, y: 0 }); }
  function bindingForPlayer(playerId, index) { return playerKeyBindings[playerId] || directionKeysFromSet(PLAYER_KEY_SETS[index] || PLAYER_KEY_SETS[0]); }
  function handleSoundUpload(name, event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { setCustomSound(name, String(reader.result || "")); setCustomAudioFlags((p) => ({ ...p, [name]: file.name })); addMessage(`Custom sound set for "${name}".`, "success"); };
    reader.readAsDataURL(file);
    event.target.value = "";
  }
  function clearSoundUpload(name) { setCustomSound(name, null); setCustomAudioFlags((p) => { const n = { ...p }; delete n[name]; return n; }); }
  function handleMusicUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { setMusicTrack(String(reader.result || "")); setCustomMusicName(file.name); addMessage(`Background music set: ${file.name}`, "success"); };
    reader.readAsDataURL(file);
    event.target.value = "";
  }
  function clearMusicUpload() { setMusicTrack(null); setCustomMusicName(""); addMessage("Reverted to built-in music.", "info"); }
  const [soundOn, setSoundOn] = useState(true);
  const [musicOn, setMusicOn] = useState(false);
  const [shake, setShake] = useState({ key: 0, type: "soft" });
  const [flash, setFlash] = useState({ key: 0, color: "" });
  const [enemySettings, setEnemySettings] = useState(ENEMY_DEFAULT_SETTINGS);
  const [enemy, setEnemy] = useState(null);
  const [enemyRespawnIn, setEnemyRespawnIn] = useState(0);
  const [turnTick, setTurnTick] = useState(0);
  const [cheer, setCheer] = useState(0);
  const [streakBanner, setStreakBanner] = useState(null);
  const [customAudioFlags, setCustomAudioFlags] = useState({});
  const [customMusicName, setCustomMusicName] = useState("");
  const enemyConf = useMemo(() => getEnemySettings(enemySettings), [enemySettings]);

  function triggerShake(type = "soft") { setShake((s) => ({ key: s.key + 1, type })); }
  function triggerFlash(color) { setFlash((f) => ({ key: f.key + 1, color })); }
  function celebrate(playerId) { updatePlayer(playerId, (entry) => ({ ...entry, celebrateUntil: Date.now() + 1300 })); }
  function passTurnTick() { setTurnTick((t) => t + 1); }
  function addCheer(amount) {
    setCheer((prev) => {
      const next = prev + amount;
      if (next >= 100) {
        playSound("cheer");
        playSound("confetti");
        burstConfetti({ count: 200, spread: 160, originY: 0.3, power: 16 });
        addMessage(matchSetup.lessonType === "group" ? "CLASS CHEER MAXED! Everyone earns a bonus!" : "CHEER MAXED! Bonus unlocked!", "success");
        setPlayers((list) => list.map((p) => ({ ...p, score: p.score + 1, celebrateUntil: Date.now() + 1300 })));
        return 0;
      }
      return Math.max(0, next);
    });
  }
  function spawnEnemy() {
    const blocked = new Set([...players.flatMap((p) => p.snake.map(posKey)), ...foods.map(posKey), ...battleBombs.map(posKey)]);
    const cell = chooseEnemySpawn(players, blocked, buildConfig());
    if (!cell) return;
    setEnemy({ id: `enemy-${Date.now()}`, ...cell });
    setEnemyRespawnIn(0);
    playSound("villain");
    addMessage("A villain appeared! Catch it with your snake's HEAD to eat it. Don't let it touch your body!", "error");
  }
  function killEnemy() {
    setEnemy(null);
    setEnemyRespawnIn(enemyConf.respawnDelayTurns);
  }
  // Villain touched a body segment: lose a segment (shield blocks the loss), and the villain dies regardless.
  function biteSnake(playerId) {
    const player = players.find((p) => p.id === playerId);
    if (!player) { killEnemy(); return; }
    triggerShake("soft");
    triggerFlash("rgba(239,68,68,.35)");
    playSound("wrong");
    if (player.shield > 0) {
      updatePlayer(playerId, (p) => ({ ...p, shield: p.shield - 1 }));
      addMessage(`${player.name}'s shield blocked the villain — and the villain was destroyed!`, "success");
    } else {
      updatePlayer(playerId, (p) => ({ ...p, snake: p.snake.slice(0, Math.max(2, p.snake.length - 1)), streak: 0 }));
      addMessage(`${player.name} was hit by the villain and lost a segment! The villain is gone.`, "error");
    }
    killEnemy();
  }
  // Player caught the villain with the snake's head: eat it for a reward (bonus if Charged).
  function defeatEnemy(playerId, charged = false) {
    const player = players.find((p) => p.id === playerId);
    killEnemy();
    playSound("crown");
    playSound("confetti");
    burstConfetti({ count: 160, spread: 150, originY: 0.4, power: 15, colors: ["#22d3ee", "#a855f7", "#f97316", "#facc15", "#34d399"] });
    triggerFlash("rgba(34,211,238,.3)");
    const reward = enemyConf.defeatReward + (charged ? enemyConf.defeatReward : 0);
    if (matchSetup.mode === "coop") setCoopState((prev) => ({ ...prev, timerRemaining: prev.timerRemaining + reward }));
    else if (player) updatePlayer(playerId, (p) => ({ ...p, score: p.score + reward, celebrateUntil: Date.now() + 1300 }));
    addCheer(20);
    addMessage(`${player?.name ?? "A player"} ate the villain!${charged ? " CHARGED BONUS!" : ""} ${matchSetup.mode === "coop" ? `+${reward}s` : `+${reward} points`}`, "success");
  }
  function registerStreak(playerId, playerName, correct) {
    if (!correct) { updatePlayer(playerId, (p) => ({ ...p, streak: 0 })); return; }
    let nextStreak = 0;
    setPlayers((list) => list.map((p) => {
      if (p.id !== playerId) return p;
      nextStreak = (p.streak || 0) + 1;
      return { ...p, streak: nextStreak, charged: true };
    }));
    setTimeout(() => {
      if (nextStreak >= 2) {
        setStreakBanner({ key: Date.now(), playerName, count: nextStreak, tier: getStreakTier(nextStreak) });
        playSound("correct");
        window.setTimeout(() => setStreakBanner(null), 2200);
      }
    }, 0);
  }

  useEffect(() => { setSoundEnabled(soundOn); }, [soundOn]);
  useEffect(() => { if (musicOn) startMusic(); else stopMusic(); return () => stopMusic(); }, [musicOn]);
  useEffect(() => { if (resultOverlay) { playSound("congrats"); playSound("confetti"); burstConfetti({ count: 240, spread: 170, originY: 0.32, power: 17 }); } }, [resultOverlay]);

  useEffect(() => {
    if (!turnTick || !gameStarted || !enemyConf.enabled || resultOverlay) return;
    if (!enemy) {
      setEnemyRespawnIn((n) => {
        if (n <= 1) { spawnEnemy(); return 0; }
        return n - 1;
      });
      return;
    }
    if (enemyConf.speed === "slow" && turnTick % 2 !== 0) return;
    const blocked = new Set(battleBombs.map(posKey));
    const next = stepEnemyToward(enemy, players, blocked, buildConfig());
    setEnemy(next);
    const caughtId = getEnemyCatch(next, players);
    if (caughtId) {
      const caught = players.find((p) => p.id === caughtId);
      const head = caught?.snake?.[0];
      if (head && head.x === next.x && head.y === next.y) defeatEnemy(caughtId);
      else biteSnake(caughtId);
    }
  }, [turnTick]);

  useEffect(() => {
    if (!cameraFollow || !board3D || !boardRef.current) return;
    const active = players.find((p) => p.id === activeTurn);
    const head = active?.snake?.[0];
    if (!head) return;
    const nx = cols > 1 ? head.x / (cols - 1) : 0.5;
    const ny = rows > 1 ? head.y / (rows - 1) : 0.5;
    const w = boardRef.current.offsetWidth;
    const h = boardRef.current.offsetHeight;
    setCameraPan({ x: (0.5 - nx) * w * 0.5, y: (0.62 - ny) * h * 0.36 });
  }, [activeTurn, cameraFollow, board3D]);

  const questionLines = useMemo(() => lines(questionText), [questionText]);
  const heroSettings = useMemo(() => getHeroCrownSettings(heroCrownSettings), [heroCrownSettings]);
  const heroChallengeLines = useMemo(() => lines(heroCrownChallengeText), [heroCrownChallengeText]);
  const glassPanel = useMemo(() => ({
    ...glass,
    background: `linear-gradient(180deg, rgba(15,23,42,${backgroundControls.panelOpacity * .34}), rgba(15,23,42,${backgroundControls.panelOpacity * .16}))`,
  }), [backgroundControls.panelOpacity]);
  const teamScore = players.reduce((sum, player) => sum + player.score, 0);
  const progress = ((teamScore) / Math.max(1, foods.length + teamScore)) * 100;
  const allOccupied = useMemo(() => { const map = new Map(); players.forEach((player) => player.snake.forEach((segment, index) => map.set(posKey(segment), { playerId: player.id, index }))); return map; }, [players]);

  function addMessage(text, tone = "info") { setMessageLog((prev) => [{ text, tone }, ...prev].slice(0, 6)); }
  function buildConfig(setup = matchSetup) { return { mode: setup.mode, boardWidth: setup.boardWidth, boardHeight: setup.boardHeight, crystalCount: setup.crystalCount, playerCount: setup.playerCount, coopTimerSeconds: setup.coopTimerSeconds }; }
  function resetBoard(setup = matchSetup) { const nextPlayers = createPlayers(playerConfigs(setup), setup); setPlayers(nextPlayers.map((player) => ({ ...player, crowns: 0, crownEffectUntil: 0 }))); setPlayerDirectionLabels((prev) => createPlayerDirectionLabelMap(nextPlayers, DEFAULT_DIRECTION_LABELS, prev)); setActiveTurn(nextPlayers[0]?.id ?? "player-1"); setFoods(buildFoodFromQuestions(questionLines, buildConfig(setup))); setBattleBombs([]); setBattleMoveCount(0); setHeroCrownTile(null); setHeroCrownChallenge(null); setPendingTurnAfterCrown(null); setNextHeroCrownTargetIndex(0); setPendingPickup(null); setPickupAnswerRevealed(false); setPickupResolution(null); setPendingTurnAfterPickup(null); setResultOverlay(null); setCoopState(createCoopState(setup.coopTimerSeconds)); setCoopPaused(false); setEnemy(null); setEnemyRespawnIn(0); setTurnTick(0); setCheer(0); setStreakBanner(null); setPhase(setup.mode === "coop" ? "coop" : "collection"); }
  function continueFromSplash() { const cleaned = { ...splashSetup, boardWidth: Math.max(4, splashSetup.boardWidth), boardHeight: Math.max(4, splashSetup.boardHeight), crystalCount: Math.max(1, splashSetup.crystalCount), coopTimerSeconds: Math.max(10, splashSetup.coopTimerSeconds), playerCount: Math.min(4, Math.max(2, splashSetup.playerCount)), playerNames: splashSetup.playerNames.slice(0, Math.min(4, Math.max(2, splashSetup.playerCount))).map((name, i) => name.trim() || `Player ${i + 1}`) }; setMatchSetup(cleaned); setSplashSetup(cleaned); setSplashVisible(false); setGameStarted(false); resetBoard(cleaned); addMessage(`${cleaned.mode === "coop" ? "Co-op" : "Versus"} setup loaded. Add questions, then start the game.`); }
  function startGame() { resetBoard(matchSetup); setGameStarted(true); setCoopPaused(false); if (enemyConf.enabled) setEnemyRespawnIn(2); addMessage(matchSetup.mode === "coop" ? "Co-op started. Clear every crystal before time runs out." : "Versus started. Collect points, then survive the bomb phase."); }
  function returnToSplash() { setGameStarted(false); setCoopPaused(false); setSplashVisible(true); setResultOverlay(null); }
  function toggleCoopPause() { const next = !coopPaused; setCoopPaused(next); addMessage(next ? "Co-op paused." : "Co-op resumed."); }
  function updatePlayer(id, fn) { setPlayers((prev) => prev.map((player) => player.id === id ? fn(player) : player)); }
  function nextTurnId(id, list = players) { return getNextTurn(id, list); }
  function buildRespawnSnake(index, length) { const anchors = getPlayerSpawnAnchors(players.length, matchSetup.boardWidth, matchSetup.boardHeight); const anchor = anchors[(index + 1) % anchors.length] ?? anchors[0]; const snake = [anchor.head]; for (let i = 1; i < length; i += 1) snake.push(anchor.heading === "right" ? { x: Math.max(0, anchor.head.x - i), y: anchor.head.y } : { x: Math.min(matchSetup.boardWidth - 1, anchor.head.x + i), y: anchor.head.y }); return snake; }
  function openCell(extraBlocked = new Set()) { return randomSpacedCells(extraBlocked, 1, 1, buildConfig())[0] ?? { x: 1, y: 1 }; }
  function spawnHeroCrown(force = false) {
    if (!force && (!heroSettings.enabled || heroCrownTile || heroCrownChallenge)) return;
    const blocked = new Set([...players.flatMap((player) => player.snake.map(posKey)), ...foods.map(posKey), ...battleBombs.map(posKey)]);
    const targetIndex = players.length ? nextHeroCrownTargetIndex % players.length : 0;
    const targetPlayer = players[targetIndex] ?? players[0];
    const cell = chooseReachableHeroCrownCell({
      player: targetPlayer,
      blockedKeys: blocked,
      maxMoves: heroSettings.expiresAfterMoves,
      config: buildConfig(),
    }) ?? openCell(blocked);
    setHeroCrownTile({ id: `hero-crown-${Date.now()}`, ...cell, targetPlayerId: targetPlayer?.id, targetPlayerName: targetPlayer?.name, remainingMoves: heroSettings.expiresAfterMoves });
    setNextHeroCrownTargetIndex((index) => players.length ? (index + 1) % players.length : 0);
    addMessage(`Hero Crown appeared near ${targetPlayer?.name ?? "a player"} at ${cell.x + 1}, ${cell.y + 1}.`, "success");
  }
  function expireHeroCrownTile(movedPlayerId = null) {
    setHeroCrownTile((prev) => {
      const next = expireHeroCrown(prev, movedPlayerId);
      if (prev && !next) addMessage("The Hero Crown disappeared.", "info");
      return next;
    });
  }
  function maybeSpawnHeroCrown() {
    if (!heroSettings.enabled || heroCrownTile || heroCrownChallenge || pendingPickup || pickupResolution || resultOverlay) return;
    if (shouldSpawnHeroCrown(heroSettings.frequency)) spawnHeroCrown();
  }
  function finishTurnAfterCrown(playerId, text) {
    if (matchSetup.mode === "coop") setCoopState((prev) => advanceCoopTimer(prev, { movesConsumed: 1, seconds: 0 }));
    setActiveTurn(nextTurnId(playerId));
    expireHeroCrownTile(playerId);
    maybeSpawnHeroCrown();
    passTurnTick();
    if (text) addMessage(text);
  }
  function finalizeTurn(playerId, text) { if (matchSetup.mode === "coop") setCoopState((prev) => advanceCoopTimer(prev, { movesConsumed: 1, seconds: 0 })); setActiveTurn(nextTurnId(playerId)); expireHeroCrownTile(playerId); maybeSpawnHeroCrown(); passTurnTick(); if (text) addMessage(text); }
  function startHeroCrownChallenge(triggeredBy = null) {
    const instruction = heroChallengeLines[Math.floor(Math.random() * heroChallengeLines.length)] || HERO_CROWN_CHALLENGES[0];
    setHeroCrownChallenge({ instruction, triggeredBy, mode: matchSetup.mode });
    setHeroCrownTile(null);
    setPendingTurnAfterCrown(triggeredBy ? nextTurnId(triggeredBy) : activeTurn);
    addMessage("Hero Crown Challenge started.", "success");
  }
  function applyCrownCosmetic(playerId) {
    const now = Date.now();
    updatePlayer(playerId, (player) => awardHeroCrown(player, now, heroSettings.cosmeticDurationSeconds));
  }
  function awardHeroCrownToPlayers(playerIds) {
    const ids = playerIds.filter(Boolean);
    if (!ids.length) { cancelHeroCrownChallenge("Hero Crown Challenge ended with no crown."); return; }
    playSound("crown");
    playSound("confetti");
    burstConfetti({ count: 180, spread: 150, originY: 0.4, power: 15, colors: ["#fef08a", "#facc15", "#f97316", "#fb7185", "#a855f7", "#22d3ee"] });
    ids.forEach(celebrate);
    ids.forEach(applyCrownCosmetic);
    const names = players.filter((player) => ids.includes(player.id)).map((player) => player.name).join(", ");
    const resumeTurn = pendingTurnAfterCrown || activeTurn;
    if (heroCrownChallenge?.triggeredBy && matchSetup.mode === "coop") setCoopState((prev) => advanceCoopTimer(prev, { movesConsumed: 1, seconds: 0 }));
    setHeroCrownChallenge(null);
    setPendingTurnAfterCrown(null);
    setActiveTurn(resumeTurn);
    addMessage(`${names} earned the Hero Crown.`, "success");
  }
  function awardHeroCrownToBoth() {
    awardHeroCrownToPlayers(players.slice(0, 2).map((player) => player.id));
  }
  function cancelHeroCrownChallenge(text = "Hero Crown Challenge cancelled.") {
    if (heroCrownChallenge?.triggeredBy && matchSetup.mode === "coop") setCoopState((prev) => advanceCoopTimer(prev, { movesConsumed: 1, seconds: 0 }));
    setHeroCrownChallenge(null);
    if (pendingTurnAfterCrown) setActiveTurn(pendingTurnAfterCrown);
    setPendingTurnAfterCrown(null);
    if (text) addMessage(text, "info");
  }
  function clearCrownEffects() {
    setPlayers((prev) => prev.map((player) => ({ ...player, crownEffectUntil: 0 })));
    addMessage("Hero Crown effects cleared.", "info");
  }
  function spawnExtraCrystals(count) {
    if (count <= 0) return;
    const blocked = new Set([...players.flatMap((player) => player.snake.map(posKey)), ...foods.map(posKey), ...battleBombs.map(posKey)]);
    const cells = randomSpacedCells(blocked, count, 1, buildConfig());
    setFoods((prev) => [...prev, ...cells.map((cell, index) => {
      const foodIndex = prev.length + index;
      const foodType = getFoodType(foodIndex, Math.max(matchSetup.crystalCount, foodIndex + 1));
      return { id: `extra-food-${Date.now()}-${index}`, ...cell, foodType, effect: resolveCrystalEffect(matchSetup.mode, foodType), question: createFoodQuestionForIndex(questionLines, foodIndex) };
    })]);
  }
  function removeCrystals(count) { if (count > 0) setFoods((prev) => prev.slice(0, Math.max(0, prev.length - count))); }
  function finishVersusBattle(reason) {
    const scoreWithCrowns = (player) => player.score + calculateCrownBonus(player, heroSettings.bonusValue);
    const sorted = [...players].sort((a, b) => scoreWithCrowns(b) - scoreWithCrowns(a));
    const top = sorted[0] ? scoreWithCrowns(sorted[0]) : 0;
    const leaders = sorted.filter((player) => scoreWithCrowns(player) === top);
    setResultOverlay({ title: leaders.length > 1 ? "Versus Draw" : `${leaders[0]?.name ?? "Player"} Wins`, subtitle: reason, mode: "versus" });
    addMessage(reason, "error");
  }
  function handleCrash(playerId, reason) {
    const player = players.find((entry) => entry.id === playerId);
    if (!player) return;
    playSound("crash");
    triggerShake("hard");
    triggerFlash("rgba(239,68,68,.45)");
    if (player.shield > 0) {
      updatePlayer(playerId, (entry) => ({ ...entry, shield: entry.shield - 1 }));
      finalizeTurn(playerId, `${player.name} used a shield and survived.`);
      return;
    }
    const resolution = getCrashResolution(matchSetup.mode, player);
    if (matchSetup.mode === "coop") {
      const playerIndex = players.findIndex((entry) => entry.id === playerId);
      updatePlayer(playerId, (entry) => ({ ...entry, snake: buildRespawnSnake(playerIndex, resolution.nextLength) }));
      setCoopState((prev) => ({ ...advanceCoopTimer(prev, { movesConsumed: 1, seconds: 0 }), timerRemaining: Math.max(0, prev.timerRemaining - resolution.timePenalty) }));
      finalizeTurn(playerId, `${player.name} crashed. ${COOP_CRASH_TIME_PENALTY} seconds lost.`);
      return;
    }
    if (phase === "battle") { finishVersusBattle(reason); return; }
    const nextPlayers = players.map((entry, index) => ({ ...entry, shield: 0, skipTurn: false, reverseControls: false, snake: buildRespawnSnake(index, 2) }));
    setPlayers(nextPlayers);
    setBattleBombs([]);
    setBattleMoveCount(0);
    setActiveTurn(nextPlayers[0]?.id ?? playerId);
    addMessage(`${player.name} crashed. Round reset with small snakes.`, "error");
  }
  function applyCrystalEffect(playerId, effectDetails) {
    if (!effectDetails?.effect) return;
    const { effect } = effectDetails;
    if (matchSetup.mode === "coop") {
      if (effect.key === "shield") updatePlayer(playerId, (entry) => ({ ...entry, shield: entry.shield + 1 }));
      if (effect.key === "addTime") setCoopState((prev) => ({ ...prev, timerRemaining: prev.timerRemaining + effect.amount }));
      if (effect.key === "removeTime") setCoopState((prev) => ({ ...prev, timerRemaining: Math.max(0, prev.timerRemaining - effect.amount) }));
      if (effect.key === "freezeTime") setCoopState((prev) => ({ ...prev, frozenMovesRemaining: effect.moves ?? 1 }));
      if (effect.key === "addCrystals") spawnExtraCrystals(effect.amount ?? 2);
      if (effect.key === "removeCrystals") removeCrystals(effect.amount ?? 2);
      return;
    }
    if (effect.key === "doubleGrow") updatePlayer(playerId, (entry) => ({ ...entry, snake: [...entry.snake, entry.snake[entry.snake.length - 1]] }));
    if (effect.key === "shield") updatePlayer(playerId, (entry) => ({ ...entry, shield: entry.shield + 1 }));
    if (effect.key === "bonusPoint") updatePlayer(playerId, (entry) => ({ ...entry, score: entry.score + 1 }));
    if (effect.key === "loseSegment") updatePlayer(playerId, (entry) => ({ ...entry, snake: entry.snake.slice(0, Math.max(2, entry.snake.length - 1)) }));
    if (effect.key === "skipTurn") updatePlayer(playerId, (entry) => ({ ...entry, skipTurn: true }));
    if (effect.key === "reverseControls") updatePlayer(playerId, (entry) => ({ ...entry, reverseControls: true }));
  }
  function moveSnake(playerId, incomingDir) {
    if (!gameStarted || heroCrownChallenge || pendingPickup || pickupResolution || resultOverlay || (matchSetup.mode === "coop" && coopPaused)) return;
    if (!canPlayerMove(activeTurn, playerId)) { const activePlayer = players.find((player) => player.id === activeTurn); addMessage(`${activePlayer?.name ?? "Another player"} must move first.`, "error"); return; }
    const player = players.find((entry) => entry.id === playerId);
    if (!player) return;
    if (player.skipTurn) { updatePlayer(playerId, (entry) => ({ ...entry, skipTurn: false })); finalizeTurn(playerId, `${player.name} loses this turn.`); return; }
    const dir = player.reverseControls ? getReverseDirection(incomingDir) : incomingDir;
    const nextHead = getNextHead(player.snake[0], dir);
    if (isIllegalReverseMove(player.snake, nextHead)) { addMessage(`${player.name} cannot reverse into its own neck.`, "error"); return; }
    if (isOutOfBounds(nextHead, buildConfig())) { handleCrash(playerId, `${player.name} hit the wall.`); return; }
    if (battleBombs.some((bomb) => bomb.x === nextHead.x && bomb.y === nextHead.y)) { handleCrash(playerId, `${player.name} hit a black square.`); return; }
    if (players.some((entry) => segmentsContain(entry.snake, nextHead))) { handleCrash(playerId, `${player.name} crashed into a snake.`); return; }
    const wasCharged = !!player.charged;
    if (enemy && enemy.x === nextHead.x && enemy.y === nextHead.y) defeatEnemy(playerId, wasCharged);
    const food = foods.find((item) => item.x === nextHead.x && item.y === nextHead.y);
    const foundCrown = heroCrownTile && heroCrownTile.x === nextHead.x && heroCrownTile.y === nextHead.y;
    const nextSnake = food ? [nextHead, ...player.snake] : [nextHead, ...player.snake.slice(0, Math.max(1, player.snake.length - 1))];
    setPlayers((prev) => prev.map((entry) => entry.id === playerId ? { ...entry, snake: nextSnake, heading: dir, reverseControls: false, charged: false, eatAt: food ? Date.now() : entry.eatAt } : entry));
    if (foundCrown) { playSound("crown"); startHeroCrownChallenge(playerId); return; }
    if (food) { playSound("eat"); const nextTurn = nextTurnId(playerId); setFoods((prev) => prev.filter((item) => item.id !== food.id)); setPendingPickup({ playerId, playerName: player.name, food, question: food.question }); setPickupAnswerRevealed(false); setPendingTurnAfterPickup(nextTurn); setActiveTurn(getActiveTurnAfterMove(playerId, true)); addMessage(`${player.name} found a ${food.foodType === "mystery" ? "mystery" : food.foodType} crystal.`, "success"); return; }
    playSound("move");
    if (matchSetup.mode === "versus" && phase === "battle") {
      const nextCount = battleMoveCount + 1;
      setBattleMoveCount(nextCount);
      if (shouldSpawnBattleBomb("battle", nextCount)) {
        const blocked = new Set([...players.flatMap((entry) => entry.id === playerId ? nextSnake.map(posKey) : entry.snake.map(posKey)), ...battleBombs.map(posKey)]);
        const bomb = openCell(blocked);
        setBattleBombs((prev) => [...prev, bomb]);
        addMessage(`A black square appeared at ${bomb.x + 1}, ${bomb.y + 1}.`, "error");
      }
    }
    finalizeTurn(playerId, `${player.name} moved ${dir}.`);
  }
  function resolveQuestion(correct) {
    if (!pendingPickup || !pickupAnswerRevealed) return;
    const { playerId, playerName, food } = pendingPickup;
    if (correct) {
      playSound("correct");
      playSound("confetti");
      burstConfetti({ count: 110, spread: 110, originY: 0.42, power: 13 });
      celebrate(playerId);
      registerStreak(playerId, playerName, true);
      addCheer(12);
      updatePlayer(playerId, (entry) => ({ ...entry, score: entry.score + 1 }));
      applyCrystalEffect(playerId, food.effect);
      if (food.effect?.effect) { setPickupResolution({ playerName, ...describeOutcomeResult(food.effect) }); return; }
      setPendingPickup(null); setPickupAnswerRevealed(false); if (pendingTurnAfterPickup) setActiveTurn(pendingTurnAfterPickup); setPendingTurnAfterPickup(null); expireHeroCrownTile(playerId); maybeSpawnHeroCrown(); passTurnTick(); if (matchSetup.mode === "coop") setCoopState((prev) => advanceCoopTimer(prev, { movesConsumed: 1, seconds: 0 })); addMessage(`${playerName} answered correctly and keeps the crystal growth.`, "success"); return;
    }
    playSound("wrong");
    triggerShake("soft");
    registerStreak(playerId, playerName, false);
    updatePlayer(playerId, (entry) => ({ ...entry, snake: entry.snake.slice(0, Math.max(2, entry.snake.length - 1)) }));
    setPendingPickup(null); setPickupAnswerRevealed(false); if (pendingTurnAfterPickup) setActiveTurn(pendingTurnAfterPickup); setPendingTurnAfterPickup(null); expireHeroCrownTile(playerId); maybeSpawnHeroCrown(); passTurnTick(); if (matchSetup.mode === "coop") setCoopState((prev) => advanceCoopTimer(prev, { movesConsumed: 1, seconds: 0 })); addMessage(`${playerName} answered incorrectly and loses the new segment.`, "error");
  }
  function closePickupModal() { const movedPlayerId = pendingPickup?.playerId; setPendingPickup(null); setPickupAnswerRevealed(false); setPickupResolution(null); if (pendingTurnAfterPickup) setActiveTurn(pendingTurnAfterPickup); setPendingTurnAfterPickup(null); expireHeroCrownTile(movedPlayerId); maybeSpawnHeroCrown(); passTurnTick(); addMessage("Back to the board."); }
  function handleBackgroundChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (backgroundUrlRef.current) URL.revokeObjectURL(backgroundUrlRef.current);
    const reader = new FileReader();
    reader.onload = () => setBackgroundImage(String(reader.result || ""));
    reader.readAsDataURL(file);
  }
  function buildSavePayload() {
    return {
      version: SAVE_FILE_VERSION,
      savedAt: new Date().toISOString(),
      questionText,
      splashSetup,
      matchSetup,
      game: {
        gameStarted,
        players,
        activeTurn,
        phase,
        foods,
        battleBombs,
        battleMoveCount,
        heroCrownTile,
        nextHeroCrownTargetIndex,
        coopState,
        coopPaused,
      },
      playerDirectionLabels,
      playerKeyBindings,
      heroCrownSettings,
      heroCrownChallengeText,
      enemySettings,
      backgroundControls,
      backgroundImage,
    };
  }
  function applySavePayload(payload) {
    if (!payload || typeof payload !== "object") return false;
    const nextSetup = {
      ...DEFAULT_SPLASH_SETUP,
      ...(payload.matchSetup || payload.splashSetup || {}),
    };
    nextSetup.playerCount = Math.min(4, Math.max(2, Number(nextSetup.playerCount) || DEFAULT_SPLASH_SETUP.playerCount));
    nextSetup.playerNames = Array.from({ length: nextSetup.playerCount }, (_, index) => nextSetup.playerNames?.[index] || DEFAULT_SPLASH_SETUP.playerNames[index] || `Player ${index + 1}`);
    setQuestionText(typeof payload.questionText === "string" ? payload.questionText : DEFAULT_QUESTION_LINES.join("\n"));
    setSplashSetup(nextSetup);
    setMatchSetup(nextSetup);
    setHeroCrownSettings({ ...HERO_CROWN_DEFAULT_SETTINGS, ...(payload.heroCrownSettings || {}) });
    setHeroCrownChallengeText(typeof payload.heroCrownChallengeText === "string" ? payload.heroCrownChallengeText : HERO_CROWN_CHALLENGES.join("\n"));
    setEnemySettings({ ...ENEMY_DEFAULT_SETTINGS, ...(payload.enemySettings || {}) });
    setBackgroundControls({ blur: 2, brightness: 1, overlay: 0.18, panelOpacity: 0.62, boardOpacity: 0.42, ...(payload.backgroundControls || {}) });
    setBackgroundImage(typeof payload.backgroundImage === "string" ? payload.backgroundImage : "");
    const savedGame = payload.game && typeof payload.game === "object" ? payload.game : null;
    const basePlayers = createPlayers(playerConfigs(nextSetup), nextSetup).map((player) => ({ ...player, crowns: 0, crownEffectUntil: 0 }));
    const nextPlayers = Array.isArray(savedGame?.players) && savedGame.players.length
      ? savedGame.players.map((player, index) => ({ ...basePlayers[index], ...player, crownEffectUntil: 0 }))
      : basePlayers;
    setPlayers(nextPlayers);
    setPlayerDirectionLabels(createPlayerDirectionLabelMap(nextPlayers, DEFAULT_DIRECTION_LABELS, payload.playerDirectionLabels || {}));
    setPlayerKeyBindings(payload.playerKeyBindings && typeof payload.playerKeyBindings === "object" ? payload.playerKeyBindings : {});
    setFoods(Array.isArray(savedGame?.foods) ? savedGame.foods : buildFoodFromQuestions(lines(typeof payload.questionText === "string" ? payload.questionText : DEFAULT_QUESTION_LINES.join("\n")), { mode: nextSetup.mode, boardWidth: nextSetup.boardWidth, boardHeight: nextSetup.boardHeight, crystalCount: nextSetup.crystalCount, playerCount: nextSetup.playerCount, coopTimerSeconds: nextSetup.coopTimerSeconds }));
    setActiveTurn(savedGame?.activeTurn || nextPlayers[0]?.id || "player-1");
    setPhase(savedGame?.phase || (nextSetup.mode === "coop" ? "coop" : "collection"));
    setSplashVisible(false);
    setGameStarted(Boolean(savedGame?.gameStarted));
    setBattleBombs(Array.isArray(savedGame?.battleBombs) ? savedGame.battleBombs : []);
    setBattleMoveCount(Number(savedGame?.battleMoveCount) || 0);
    setHeroCrownTile(savedGame?.heroCrownTile || null);
    setNextHeroCrownTargetIndex(Number(savedGame?.nextHeroCrownTargetIndex) || 0);
    setHeroCrownChallenge(null);
    setPendingTurnAfterCrown(null);
    setPendingPickup(null);
    setPickupAnswerRevealed(false);
    setPickupResolution(null);
    setPendingTurnAfterPickup(null);
    setResultOverlay(null);
    setCoopState(savedGame?.coopState || createCoopState(nextSetup.coopTimerSeconds));
    setCoopPaused(Boolean(savedGame?.coopPaused));
    setEnemy(null);
    setEnemyRespawnIn(0);
    setTurnTick(0);
    setCheer(0);
    setStreakBanner(null);
    return true;
  }
  function saveGameState() {
    try {
      localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(buildSavePayload()));
      addMessage("Game state saved on this device.", "success");
    } catch {
      addMessage("Browser storage is full. Use Save As JSON instead.", "error");
    }
  }
  function loadSavedGameState() {
    try {
      const saved = localStorage.getItem(SAVE_STORAGE_KEY);
      if (!saved) { addMessage("No saved state on this device yet.", "info"); return; }
      const loaded = applySavePayload(JSON.parse(saved));
      addMessage(loaded ? "Saved setup restored." : "Saved setup could not be restored.", loaded ? "success" : "error");
    } catch {
      addMessage("Saved setup could not be restored.", "error");
    }
  }
  function saveGameStateAsJson() {
    const blob = new Blob([JSON.stringify(buildSavePayload(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `language-snake-state-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    addMessage("Game setup exported as JSON.", "success");
  }
  function handleSaveFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const loaded = applySavePayload(JSON.parse(String(reader.result || "{}")));
        addMessage(loaded ? "Game setup loaded from JSON." : "Could not load that save file.", loaded ? "success" : "error");
      } catch {
        addMessage("Could not read that JSON save file.", "error");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  useEffect(() => {
    let frameId = 0;
    const start = performance.now();
    const loop = (now) => { setAnimationTime((now - start) / 1000); frameId = window.requestAnimationFrame(loop); };
    frameId = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).has("instanceId")) return;
    if (new URLSearchParams(window.location.search).has("skipSplash")) return;
    const saved = localStorage.getItem(SAVE_STORAGE_KEY);
    if (!saved) return;
    try {
      if (applySavePayload(JSON.parse(saved))) addMessage("Saved setup restored.", "success");
    } catch {
      addMessage("Saved setup could not be restored.", "error");
    }
  }, []);

  useEffect(() => {
    const debug = getSearchSetup();
    if (!debug) return;
    setSplashVisible(false);
    setSplashSetup(debug.setup);
    setMatchSetup(debug.setup);
    resetBoard(debug.setup);
    if (debug.autoStart) {
      setGameStarted(true);
      addMessage(debug.setup.mode === "coop" ? "Co-op started from debug setup." : "Versus started from debug setup.");
    }
  }, []);

  useEffect(() => {
    if (!canRunCoopTimer({ gameStarted, mode: matchSetup.mode, paused: coopPaused, hasPendingPickup: !!pendingPickup || !!heroCrownChallenge, hasPickupResolution: !!pickupResolution, hasResultOverlay: !!resultOverlay })) return undefined;
    const intervalId = window.setInterval(() => setCoopState((prev) => advanceCoopTimer(prev, { seconds: 1, movesConsumed: 0 })), 1000);
    return () => window.clearInterval(intervalId);
  }, [coopPaused, gameStarted, heroCrownChallenge, matchSetup.mode, pendingPickup, pickupResolution, resultOverlay]);

  useEffect(() => {
    if (!gameStarted || resultOverlay) return;
    if (matchSetup.mode === "coop") {
      const outcome = getCoopOutcome({ timerRemaining: coopState.timerRemaining, crystalsRemaining: foods.length });
      if (outcome === "win") setResultOverlay({ title: "Team Victory", subtitle: `All crystals cleared with ${secondsLabel(coopState.timerRemaining)} left.`, mode: "coop" });
      else if (outcome === "loss") setResultOverlay({ title: "Time Up", subtitle: "The team ran out of time before clearing the board.", mode: "coop" });
      return;
    }
    if (phase === "collection" && foods.length === 0) { setPhase("battle"); addMessage("All crystals collected. Versus battle phase started: black squares appear every four moves."); }
  }, [coopState.timerRemaining, foods.length, gameStarted, matchSetup.mode, phase, resultOverlay]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      const rawKey = event.key.toLowerCase();
      if (capturingKey) {
        event.preventDefault();
        if (rawKey !== "escape") {
          setPlayerKeyBindings((prev) => {
            const idx = players.findIndex((p) => p.id === capturingKey.playerId);
            const base = prev[capturingKey.playerId] || directionKeysFromSet(PLAYER_KEY_SETS[idx] || PLAYER_KEY_SETS[0]);
            return { ...prev, [capturingKey.playerId]: { ...base, [capturingKey.dir]: [rawKey] } };
          });
        }
        setCapturingKey(null);
        return;
      }
      if (heroCrownChallenge) {
        if (rawKey === "1") { awardHeroCrownToPlayers([players[0]?.id]); return; }
        if (rawKey === "2") { awardHeroCrownToPlayers([players[1]?.id]); return; }
        if (rawKey === "b") { awardHeroCrownToBoth(); return; }
        if (rawKey === "escape") { cancelHeroCrownChallenge(); return; }
      }
      if (rawKey === "c" && !pendingPickup && !pickupResolution && !resultOverlay) { spawnHeroCrown(true); return; }
      if (rawKey === "1") { if (pickupResolution) closePickupModal(); else if (pendingPickup && !pickupAnswerRevealed) setPickupAnswerRevealed(true); else resolveQuestion(true); return; }
      if (rawKey === "2") { if (pickupAnswerRevealed) resolveQuestion(false); return; }
      if (matchSetup.mode === "coop" && coopPaused) return;
      // Turn-based: only the active player's keys act, so players may share identical keys.
      const activeIndex = players.findIndex((p) => p.id === activeTurn);
      const activePlayer = players[activeIndex];
      if (activePlayer) {
        const binding = playerKeyBindings[activePlayer.id] || directionKeysFromSet(PLAYER_KEY_SETS[activeIndex] || PLAYER_KEY_SETS[0]);
        if (binding.up.includes(rawKey)) moveSnake(activePlayer.id, "up");
        else if (binding.down.includes(rawKey)) moveSnake(activePlayer.id, "down");
        else if (binding.left.includes(rawKey)) moveSnake(activePlayer.id, "left");
        else if (binding.right.includes(rawKey)) moveSnake(activePlayer.id, "right");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTurn, heroCrownChallenge, pendingPickup, pickupAnswerRevealed, pickupResolution, players, resultOverlay, gameStarted, foods, battleBombs, battleMoveCount, phase, coopState, matchSetup, heroCrownTile, heroSettings, heroChallengeLines, capturingKey, playerKeyBindings]);

  useEffect(() => {
    window.render_game_to_text = () => JSON.stringify({
      coordinateSystem: "origin top-left, +x right, +y down",
      splashVisible,
      mode: matchSetup.mode,
      phase,
      board: { width: matchSetup.boardWidth, height: matchSetup.boardHeight },
      crystalsRemaining: foods.length,
      battleBombs,
      heroCrown: {
        settings: heroSettings,
        tile: heroCrownTile,
        challenge: heroCrownChallenge,
        nextTargetIndex: nextHeroCrownTargetIndex,
      },
      coop: matchSetup.mode === "coop" ? coopState : null,
      coopPaused,
      activeTurn,
      players: players.map((player) => ({ id: player.id, name: player.name, score: player.score, crowns: player.crowns || 0, crownBonus: calculateCrownBonus(player, heroSettings.bonusValue), finalTotal: player.score + calculateCrownBonus(player, heroSettings.bonusValue), crownEffectActive: (player.crownEffectUntil || 0) > Date.now(), shield: player.shield, snake: player.snake })),
      pendingPickup: pendingPickup ? { playerId: pendingPickup.playerId, playerName: pendingPickup.playerName, prompt: pendingPickup.question.prompt, answer: pendingPickup.question.answer, answerRevealed: pickupAnswerRevealed, foodType: pendingPickup.food.foodType } : null,
      pickupResolution,
      background: { imageLoaded: Boolean(backgroundImage), controls: backgroundControls },
      resultOverlay,
    });
    window.advanceTime = (ms) => {
      setAnimationTime((value) => value + ms / 1000);
      if (canRunCoopTimer({ gameStarted, mode: matchSetup.mode, paused: coopPaused, hasPendingPickup: !!pendingPickup || !!heroCrownChallenge, hasPickupResolution: !!pickupResolution, hasResultOverlay: !!resultOverlay })) setCoopState((prev) => advanceCoopTimer(prev, { seconds: ms / 1000, movesConsumed: 0 }));
    };
  }, [activeTurn, backgroundControls, backgroundImage, battleBombs, coopPaused, coopState, foods, gameStarted, heroCrownChallenge, heroCrownTile, heroSettings, matchSetup, nextHeroCrownTargetIndex, pendingPickup, pickupAnswerRevealed, pickupResolution, players, phase, resultOverlay, splashVisible]);

  useEffect(() => () => { if (backgroundUrlRef.current) URL.revokeObjectURL(backgroundUrlRef.current); }, []);

  const boardCellCount = matchSetup.boardWidth * matchSetup.boardHeight;
  const cols = matchSetup.boardWidth;
  const rows = matchSetup.boardHeight;
  const cellW = 100 / cols;
  const cellH = 100 / rows;
  const entityWrap = (x, y, z) => ({ position: "absolute", left: `${x * cellW}%`, top: `${y * cellH}%`, width: `${cellW}%`, height: `${cellH}%`, display: "grid", placeItems: "center", zIndex: z, transition: "left .22s ease, top .22s ease", transformStyle: "preserve-3d" });
  const contactShadow = { position: "absolute", left: "14%", right: "14%", bottom: "2%", height: "22%", borderRadius: "50%", background: "rgba(2,6,23,.55)", filter: "blur(4px)", transform: "translateZ(0)", pointerEvents: "none" };
  function gemVisual(food) {
    if (food.foodType === "power") return { gradient: "radial-gradient(circle at 32% 24%, #fff1f2, transparent 40%), linear-gradient(135deg,#fb7185,#ef4444 55%,#be123c)", icon: <Flame size={20} color="#fff7ed" /> };
    if (food.foodType === "mystery") return { gradient: mysteryStyle(animationTime, food.x, food.y).background, icon: <Sparkles size={20} color="#ffffff" /> };
    return { gradient: "radial-gradient(circle at 32% 24%, #fffbeb, transparent 40%), linear-gradient(135deg,#fde047,#f59e0b 55%,#d97706)", icon: <Sparkles size={20} color="#713f12" /> };
  }
  const splitIndex = Math.ceil(players.length / 2);
  const leftPlayers = players.slice(0, splitIndex);
  const rightPlayers = players.slice(splitIndex);

  function renderPlayerCard(player, index) {
    const palette = tone(player);
    const labels = playerDirectionLabels[player.id] ?? DEFAULT_DIRECTION_LABELS;
    const isActive = activeTurn === player.id;
    const controlsBlocked = !gameStarted || !!heroCrownChallenge || !!pendingPickup || !!pickupResolution || !!resultOverlay || (matchSetup.mode === "coop" && coopPaused);
    const moveAreaStyle = isActive
      ? {
        background: `linear-gradient(135deg, hsla(${palette.hue},88%,56%,.3), rgba(255,255,255,.08))`,
        border: `1px solid hsla(${palette.hue},95%,72%,.58)`,
        boxShadow: `inset 0 0 0 1px rgba(255,255,255,.1), 0 0 30px ${palette.glow}`,
        animation: "activeMoveAreaPulse 1.5s ease-in-out infinite alternate",
      }
      : {
        background: "rgba(15,23,42,.18)",
        border: "1px solid rgba(255,255,255,.08)",
      };

    return (
      <div
        key={player.id}
        style={{
          ...glassPanel,
          padding: 12,
          background: isActive ? `linear-gradient(180deg, hsla(${palette.hue},96%,58%,.34), hsla(${palette.hue},92%,40%,.18)), rgba(15,23,42,.2)` : glassPanel.background,
          border: isActive ? "1px solid rgba(255,255,255,.34)" : glass.border,
          boxShadow: isActive ? `0 0 0 1px rgba(255,255,255,.08), 0 0 34px ${palette.glow}` : glass.boxShadow,
          transition: "background 1.5s ease, border-color 1.5s ease, box-shadow 1.5s ease, filter 1.5s ease",
        }}
      >
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
            <h3 style={{ margin: 0, fontSize: 20, lineHeight: 1.05 }}>{player.name}</h3>
            <InfoBadge style={{ background: isActive ? palette.glow : undefined }}>{isActive ? "Active turn" : "Waiting"}</InfoBadge>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
            <StatTile icon={<Trophy size={14} />} label="Score" value={player.score} gradient="linear-gradient(135deg,#0ea5e9,#2563eb)" glow="rgba(14,165,233,.42)" flashUntil={player.celebrateUntil} />
            <StatTile icon={<Crown size={14} />} label="Crowns" value={player.crowns || 0} gradient="linear-gradient(135deg,#facc15,#f97316)" glow="rgba(250,204,21,.48)" />
            <StatTile icon={<Sparkles size={14} />} label="Segments" value={player.snake.length} gradient="linear-gradient(135deg,#10b981,#059669)" glow="rgba(16,185,129,.42)" />
            <StatTile icon={<Shield size={14} />} label="Shields" value={player.shield} gradient="linear-gradient(135deg,#a855f7,#7c3aed)" glow="rgba(168,85,247,.42)" />
          </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, maxWidth: 212, margin: "4px auto 0", padding: 10, borderRadius: 20, transition: "border-color 1.5s ease, background 1.5s ease, box-shadow 1.5s ease, filter 1.5s ease", ...moveAreaStyle }}>
            <div />
            <button style={{ ...button, background: palette.bg, minHeight: 54, padding: "8px 10px", fontSize: 11, opacity: !isActive || controlsBlocked ? .58 : 1 }} onClick={() => moveSnake(player.id, "up")} disabled={controlsBlocked}>{labels.up}</button>
            <div />
            <button style={{ ...button, background: palette.bg, minHeight: 54, padding: "8px 10px", fontSize: 11, opacity: !isActive || controlsBlocked ? .58 : 1 }} onClick={() => moveSnake(player.id, "left")} disabled={controlsBlocked}>{labels.left}</button>
            <div style={{ minHeight: 54, borderRadius: 16, background: isActive ? "rgba(255,255,255,.12)" : "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)" }} />
            <button style={{ ...button, background: palette.bg, minHeight: 54, padding: "8px 10px", fontSize: 11, opacity: !isActive || controlsBlocked ? .58 : 1 }} onClick={() => moveSnake(player.id, "right")} disabled={controlsBlocked}>{labels.right}</button>
            <div />
            <button style={{ ...button, background: palette.bg, minHeight: 54, padding: "8px 10px", fontSize: 11, opacity: !isActive || controlsBlocked ? .58 : 1 }} onClick={() => moveSnake(player.id, "down")} disabled={controlsBlocked}>{labels.down}</button>
            <div />
          </div>
          <p style={{ margin: 0, fontSize: 12, color: "#cbd5e1" }}>Keys: {(() => { const b = bindingForPlayer(player.id, index); return `${keyLabel(b.up)} ${keyLabel(b.left)} ${keyLabel(b.down)} ${keyLabel(b.right)}`; })()}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="game-shell" style={{ minHeight: "100vh", padding: 18, color: "#e5eefb", position: "relative", overflow: "hidden" }}>
      <style>{`@keyframes activeMoveAreaPulse{from{filter:saturate(1);box-shadow:inset 0 0 0 1px rgba(255,255,255,.1),0 0 20px rgba(125,211,252,.18)}to{filter:saturate(1.25);box-shadow:inset 0 0 0 1px rgba(255,255,255,.16),0 0 34px rgba(125,211,252,.34)}}@keyframes heroCrownFlash{from{filter:saturate(1) brightness(1)}to{filter:saturate(1.5) brightness(1.28)}}@keyframes boardShake{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}@keyframes boardShakeHard{0%,100%{transform:translate(0,0)}15%{transform:translate(-12px,4px) rotate(-1deg)}30%{transform:translate(12px,-4px) rotate(1deg)}45%{transform:translate(-10px,6px)}60%{transform:translate(10px,-6px) rotate(-1deg)}75%{transform:translate(-6px,3px)}}@keyframes screenFlashAnim{from{opacity:.85}to{opacity:0}}@keyframes streakPop{0%{transform:translate(-50%,-50%) scale(.4) rotate(-8deg);opacity:0}30%{transform:translate(-50%,-50%) scale(1.15) rotate(3deg);opacity:1}70%{transform:translate(-50%,-50%) scale(1) rotate(-1deg);opacity:1}100%{transform:translate(-50%,-50%) scale(.9) rotate(0);opacity:0}}@keyframes chargedPulse{from{filter:brightness(1.1) drop-shadow(0 0 6px rgba(34,211,238,.8))}to{filter:brightness(1.5) drop-shadow(0 0 16px rgba(34,211,238,1))}}@keyframes villainFloat{0%,100%{transform:translateZ(20px) translateY(0) scale(1)}50%{transform:translateZ(20px) translateY(-3px) scale(1.05)}}@media (max-width:1180px){.top-layout{grid-template-columns:1fr!important}.bottom-layout{grid-template-columns:1fr!important}.player-column{grid-template-columns:repeat(2,minmax(0,1fr))!important}.board-actions{justify-content:center!important}}@media (max-width:760px){.player-column{grid-template-columns:1fr!important}.board-actions{flex-direction:column!important;align-items:stretch!important}}`}</style>
      <div style={{ position: "fixed", inset: 0, background: "radial-gradient(circle at top left, rgba(56,189,248,.22), transparent 32%), radial-gradient(circle at top right, rgba(168,85,247,.18), transparent 28%), linear-gradient(135deg, #020617 0%, #0f172a 48%, #020617 100%)", zIndex: -3 }} />
      {backgroundImage ? <div style={{ position: "fixed", inset: 0, backgroundImage: `url(${backgroundImage})`, backgroundPosition: "center", backgroundSize: "cover", filter: `blur(${backgroundControls.blur}px) saturate(1.08) brightness(${backgroundControls.brightness})`, transform: `scale(${1 + backgroundControls.blur * .006})`, zIndex: -2 }} /> : null}
      <div style={{ position: "fixed", inset: 0, background: `linear-gradient(180deg, rgba(2,6,23,${backgroundControls.overlay * .45}), rgba(2,6,23,${backgroundControls.overlay}) 55%, rgba(2,6,23,${backgroundControls.overlay * 1.35}))`, zIndex: -1 }} />
      {splashVisible ? <Splash setup={splashSetup} setSetup={setSplashSetup} onContinue={continueFromSplash} /> : null}
      {flash.key ? <div key={flash.key} style={{ position: "fixed", inset: 0, background: flash.color, pointerEvents: "none", zIndex: 40, animation: "screenFlashAnim .5s ease forwards" }} /> : null}
      {streakBanner ? (
        <div key={streakBanner.key} style={{ position: "fixed", top: "32%", left: "50%", zIndex: 45, pointerEvents: "none", animation: "streakPop 2.2s ease-in-out forwards", textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: ".2em", color: "#fff", textShadow: "0 2px 12px rgba(0,0,0,.5)" }}>{matchSetup.lessonType === "group" ? streakBanner.playerName : "YOU'RE"}</div>
          <div style={{ fontSize: 86, fontWeight: 950, lineHeight: 1, background: `linear-gradient(135deg, hsla(${streakBanner.tier.hue},100%,65%,1), hsla(${(streakBanner.tier.hue + 40) % 360},100%,55%,1))`, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", filter: `drop-shadow(0 0 24px hsla(${streakBanner.tier.hue},100%,60%,.9))` }}>🔥 {streakBanner.tier.label}</div>
          <div style={{ fontSize: 40, fontWeight: 950, color: "#fff", textShadow: `0 0 20px hsla(${streakBanner.tier.hue},100%,60%,.9)` }}>{streakBanner.count} IN A ROW!</div>
        </div>
      ) : null}
      <div className="game-layout" style={{ maxWidth: 1700, margin: "0 auto", display: "grid", gap: 16 }}>
        <div className="top-layout" style={{ display: "grid", gridTemplateColumns: "minmax(180px, .48fr) minmax(0, 2.2fr) minmax(180px, .48fr)", alignItems: "start", gap: 16 }}>
          <div className="player-column" style={{ display: "grid", gap: 14 }}>
            {leftPlayers.map((player, index) => renderPlayerCard(player, index))}
            <div style={{ ...glassPanel, padding: 12 }}>
              <div style={{ borderRadius: 18, padding: 14, background: "rgba(15,23,42,.14)", border: "1px solid rgba(255,255,255,.08)" }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "#cbd5e1" }}>Game Messages</p>
                <div style={{ display: "grid", gap: 8, marginTop: 10 }}>{messageLog.map((message, index) => <div key={`${message.text}-${index}`} style={{ borderRadius: 14, padding: "10px 12px", background: message.tone === "error" ? "rgba(239,68,68,.16)" : index === 0 ? "rgba(16,185,129,.16)" : "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", color: message.tone === "error" ? "#fca5a5" : index === 0 ? "#86efac" : "#f8fafc", fontSize: index === 0 ? 15 : 13, fontWeight: message.tone === "error" || index === 0 ? 800 : 500 }}>{message.text}</div>)}</div>
              </div>
            </div>
          </div>
          <div className="game-board-panel" style={{ ...glassPanel, padding: 16 }}>
            <div style={{ display: "grid", gap: 14 }}>
              <div style={{ display: "grid", gap: 5 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "#cbd5e1" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Sparkles size={13} /> {matchSetup.lessonType === "group" ? "Class Cheer" : "Cheer Meter"}</span>
                  <span>{Math.round(cheer)}%</span>
                </div>
                <div style={{ height: 14, width: "100%", background: "rgba(2,6,23,.4)", borderRadius: 999, overflow: "hidden", border: "1px solid rgba(255,255,255,.12)" }}>
                  <div style={{ height: "100%", width: `${cheer}%`, background: "linear-gradient(90deg,#22d3ee,#a855f7,#f97316,#facc15)", boxShadow: "0 0 16px rgba(168,85,247,.7)", transition: "width .5s ease" }} />
                </div>
              </div>
              <div onPointerDown={onBoardPointerDown} onPointerMove={onBoardPointerMove} onPointerUp={onBoardPointerUp} onPointerLeave={onBoardPointerUp} onDragStart={(e) => e.preventDefault()} style={{ paddingBottom: board3D ? 18 : 0, paddingTop: board3D ? 6 : 0, touchAction: board3D ? "none" : "auto", cursor: board3D ? (dragging ? "grabbing" : "grab") : "default", userSelect: "none", WebkitUserSelect: "none" }}>
                <div key={shake.key} style={{ animation: shake.key ? `${shake.type === "hard" ? "boardShakeHard" : "boardShake"} .5s ease` : "none" }}>
                  <div className="game-board" ref={boardRef} style={{ "--board-aspect": cols / rows, position: "relative", background: `linear-gradient(180deg, rgba(2,6,23,${backgroundControls.boardOpacity}), rgba(15,23,42,${backgroundControls.boardOpacity * .58}))`, borderRadius: 28, padding: 12, width: "100%", aspectRatio: `${cols} / ${rows}`, border: "1px solid rgba(255,255,255,.1)", overflow: board3D ? "visible" : "hidden", transformStyle: "preserve-3d", transformOrigin: "center center", transform: board3D ? `scale(${cameraZoom}) perspective(1000px) rotateX(${cameraTilt}deg) translate(${cameraPan.x}px, ${cameraPan.y}px)` : `scale(${cameraZoom})`, transition: dragging ? "none" : "transform .6s ease", boxShadow: board3D ? "0 60px 90px rgba(2,6,23,.65)" : undefined }}>
                    <div style={{ position: "absolute", inset: 12, display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)`, borderRadius: 16, overflow: "hidden", background: `linear-gradient(135deg, hsla(${(animationTime * 8) % 360},70%,55%,.38), hsla(${(animationTime * 8 + 90) % 360},72%,52%,.32) 40%, hsla(${(animationTime * 8 + 180) % 360},70%,55%,.34) 70%, hsla(${(animationTime * 8 + 270) % 360},72%,52%,.34))`, boxShadow: "inset 0 0 60px rgba(2,6,23,.42), inset 0 0 0 2px rgba(255,255,255,.08)" }}>
                      {Array.from({ length: boardCellCount }).map((_, index) => { const x = index % cols; const y = Math.floor(index / cols); return <div key={index} style={{ background: (x + y) % 2 ? "rgba(255,255,255,.13)" : "rgba(2,6,23,.10)", borderRight: "1px solid rgba(255,255,255,.07)", borderBottom: "1px solid rgba(255,255,255,.07)", boxShadow: (x + y) % 2 ? "inset 0 0 12px rgba(255,255,255,.06)" : "none" }} />; })}
                    </div>
                    {matchSetup.mode === "coop" ? (
                      <div
                        aria-hidden="true"
                        style={{
                          position: "absolute",
                          inset: "1% 1.5%",
                          display: "grid",
                          placeItems: "center",
                          fontSize: `clamp(110px, ${Math.min(34, Math.max(18, 420 / Math.max(1, matchSetup.boardWidth)))}vw, 320px)`,
                          fontWeight: 900,
                          letterSpacing: ".02em",
                          lineHeight: .9,
                          transform: "scale(1.08, 1.22)",
                          transformOrigin: "center",
                          color: coopState.frozenMovesRemaining > 0 ? "rgba(103,232,249,.62)" : coopState.timerRemaining < 15 ? "rgba(248,113,113,.58)" : "rgba(248,250,252,.56)",
                          mixBlendMode: backgroundImage ? "difference" : "screen",
                          opacity: backgroundImage ? 0.64 : 0.42,
                          textShadow: coopState.frozenMovesRemaining > 0 ? "0 0 34px rgba(103,232,249,.28)" : coopState.timerRemaining < 15 ? "0 0 30px rgba(248,113,113,.22)" : "0 0 26px rgba(255,255,255,.12)",
                          filter: "blur(.2px)",
                          pointerEvents: "none",
                          zIndex: 1,
                          userSelect: "none",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {secondsLabel(coopState.timerRemaining)}
                      </div>
                    ) : null}
                    <div style={{ position: "absolute", inset: 12, transformStyle: "preserve-3d" }}>
                      {foods.map((food) => { const g = gemVisual(food); const bob = Math.sin(animationTime * 2.4 + (food.x + food.y)) * 5; return (
                        <div key={food.id} style={entityWrap(food.x, food.y, 2)}>
                          <div style={contactShadow} />
                          <div style={{ position: "relative", width: "84%", height: "84%", borderRadius: "26% 26% 32% 32%", background: g.gradient, border: "1px solid rgba(255,255,255,.6)", display: "grid", placeItems: "center", transform: `translateZ(${14 + bob}px) rotate(${Math.sin(animationTime * 1.6 + food.x) * 6}deg)`, boxShadow: `0 8px 18px rgba(2,6,23,.5), 0 0 18px ${food.foodType === "power" ? "rgba(251,113,133,.7)" : food.foodType === "mystery" ? "rgba(168,85,247,.7)" : "rgba(250,204,21,.7)"}, inset 0 -6px 10px rgba(2,6,23,.28), inset 0 6px 10px rgba(255,255,255,.5)` }}>{g.icon}</div>
                        </div>
                      ); })}
                      {battleBombs.map((bomb) => (
                        <div key={`bomb-${bomb.x},${bomb.y}`} style={entityWrap(bomb.x, bomb.y, 2)}>
                          <div style={contactShadow} />
                          <div style={{ width: "78%", height: "78%", borderRadius: "50%", background: "radial-gradient(circle at 36% 30%, #64748b, #020617 72%)", border: "1px solid rgba(255,255,255,.2)", transform: "translateZ(10px)", boxShadow: "0 8px 18px rgba(0,0,0,.7), 0 0 14px rgba(0,0,0,.5)" }} />
                        </div>
                      ))}
                      {heroCrownTile ? (
                        <div key={heroCrownTile.id} style={entityWrap(heroCrownTile.x, heroCrownTile.y, 6)}>
                          <div style={contactShadow} />
                          <div style={{ ...heroCrownTileStyle(animationTime, heroCrownTile.remainingMoves), width: "88%", height: "88%", borderRadius: 14, display: "grid", placeItems: "center", transform: `${heroCrownTileStyle(animationTime, heroCrownTile.remainingMoves).transform} translateZ(24px)` }}><Crown size={22} color="#fff7ad" style={{ filter: "drop-shadow(0 0 7px rgba(255,255,255,.9))" }} /></div>
                        </div>
                      ) : null}
                      {enemy ? (
                        <div key={enemy.id} style={entityWrap(enemy.x, enemy.y, 8)}>
                          <div style={contactShadow} />
                          <div style={{ position: "relative", width: "90%", height: "90%", borderRadius: "50% 50% 46% 46%", background: "radial-gradient(circle at 36% 28%, #fca5a5, transparent 40%), linear-gradient(160deg,#7c3aed,#4c1d95 55%,#1e1b4b)", border: "1px solid rgba(252,165,165,.7)", display: "grid", placeItems: "center", animation: "villainFloat 1.4s ease-in-out infinite", boxShadow: "0 8px 18px rgba(2,6,23,.6), 0 0 22px rgba(168,85,247,.8)" }}>
                            <div style={{ position: "absolute", top: "30%", left: "26%", width: "16%", height: "16%", borderRadius: "50%", background: "#fff", boxShadow: "inset -1px -1px 2px rgba(0,0,0,.4)" }}><div style={{ position: "absolute", inset: "26% 10% 10% 30%", borderRadius: "50%", background: "#7f1d1d" }} /></div>
                            <div style={{ position: "absolute", top: "30%", right: "26%", width: "16%", height: "16%", borderRadius: "50%", background: "#fff", boxShadow: "inset -1px -1px 2px rgba(0,0,0,.4)" }}><div style={{ position: "absolute", inset: "26% 30% 10% 10%", borderRadius: "50%", background: "#7f1d1d" }} /></div>
                            <div style={{ position: "absolute", top: "20%", left: "16%", width: "26%", height: "3px", background: "#1e1b4b", transform: "rotate(18deg)", borderRadius: 2 }} />
                            <div style={{ position: "absolute", top: "20%", right: "16%", width: "26%", height: "3px", background: "#1e1b4b", transform: "rotate(-18deg)", borderRadius: 2 }} />
                            <div style={{ position: "absolute", bottom: "18%", width: "34%", height: "16%", borderRadius: "0 0 50% 50%", border: "2px solid #1e1b4b", borderTop: "none" }} />
                          </div>
                        </div>
                      ) : null}
                      {players.map((player) => { const hue = PLAYER_HUES[player.colorKey] ?? 200; const isActiveSegment = activeTurn === player.id; return player.snake.map((seg, i) => (
                        <div key={`${player.id}-seg-${i}`} style={entityWrap(seg.x, seg.y, i === 0 ? 7 : 4)}>
                          <div style={contactShadow} />
                          {i === 0 && player.charged ? <div style={{ position: "absolute", inset: "-6%", borderRadius: "50%", background: "radial-gradient(circle, rgba(34,211,238,.55), transparent 68%)", animation: "chargedPulse .5s ease-in-out infinite alternate", transform: "translateZ(10px)", pointerEvents: "none" }} /> : null}
                          <div style={{ ...segmentStyle(player, i, animationTime, isActiveSegment, i === 0 ? 12 : 6), position: "relative", width: i === 0 ? "98%" : "92%", height: i === 0 ? "98%" : "92%", borderRadius: i === 0 ? "44%" : "48%", display: "grid", placeItems: "center" }}>{i === 0 ? <Head heading={player.heading} hue={hue} /> : null}{i === 0 && player.charged ? <Zap size={14} color="#22d3ee" style={{ position: "absolute", top: "-8%", right: "-8%", filter: "drop-shadow(0 0 4px #22d3ee)" }} /> : null}</div>
                        </div>
                      )); })}
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ display: "grid", gap: 10, justifyItems: "center", textAlign: "center", paddingTop: 2 }}>
                <h1 style={{ margin: 0, display: "flex", gap: 10, alignItems: "center", justifyContent: "center", fontSize: 24 }}><Swords size={22} /> Language Snake Duel</h1>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                  <InfoBadge>{matchSetup.mode === "coop" ? "Co-op" : "Versus"}</InfoBadge>
                  <InfoBadge>Board: {matchSetup.boardWidth} x {matchSetup.boardHeight}</InfoBadge>
                  <InfoBadge>Crystals left: {foods.length}</InfoBadge>
                  {heroCrownTile ? <InfoBadge style={{ background: "rgba(250,204,21,.2)", border: "1px solid rgba(250,204,21,.36)", color: "#fef08a" }}><Crown size={12} /> Crown: {heroCrownTile.targetPlayerName || "Player"} ({heroCrownTile.remainingMoves})</InfoBadge> : null}
                  <InfoBadge>Phase: {phase}</InfoBadge>
                </div>
                {matchSetup.mode === "coop" ? <div style={{ fontSize: 12, color: "#94a3b8" }}>{coopState.frozenMovesRemaining > 0 ? `Timer frozen for ${coopState.frozenMovesRemaining} move(s)` : "Timer shown in the board background"}</div> : null}
                <div className="board-actions" style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
                  {!gameStarted ? <button id="start-game" onClick={startGame} style={{ ...button, background: "linear-gradient(135deg,#10b981,#059669)", display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 14px", fontSize: 14 }}><Play size={15} /> Start Game</button> : <button onClick={() => { setGameStarted(false); resetBoard(matchSetup); }} style={{ ...button, background: "rgba(30,41,59,.82)", padding: "10px 14px", fontSize: 14 }}>Reset Round</button>}
                  <button onClick={() => spawnHeroCrown(true)} style={{ ...button, background: "linear-gradient(135deg,#facc15,#f97316)", color: "#1f1300", padding: "10px 14px", fontSize: 14 }}><Crown size={15} /> Spawn Crown Now ({HERO_CROWN_SHORTCUTS.spawn})</button>
                  <button onClick={() => startHeroCrownChallenge(null)} style={{ ...button, background: "linear-gradient(135deg,#a855f7,#2563eb)", padding: "10px 14px", fontSize: 14 }}>Start Crown Challenge Now</button>
                  <button onClick={() => { setEnemySettings((p) => ({ ...p, enabled: true })); spawnEnemy(); }} style={{ ...button, background: "linear-gradient(135deg,#7c3aed,#4c1d95)", padding: "10px 14px", fontSize: 14, display: "inline-flex", alignItems: "center", gap: 7 }}><Ghost size={15} /> Spawn Villain</button>
                  {enemy ? <button onClick={() => { setEnemy(null); setEnemyRespawnIn(0); addMessage("The villain vanished.", "info"); }} style={{ ...button, background: "rgba(30,41,59,.82)", padding: "10px 14px", fontSize: 14 }}>Remove Villain</button> : null}
                  <button onClick={saveGameState} style={{ ...button, background: "rgba(14,165,233,.82)", padding: "10px 14px", fontSize: 14, display: "inline-flex", alignItems: "center", gap: 7 }}><Save size={15} /> Save State</button>
                  <button onClick={loadSavedGameState} style={{ ...button, background: "rgba(30,41,59,.82)", padding: "10px 14px", fontSize: 14, display: "inline-flex", alignItems: "center", gap: 7 }}><Upload size={15} /> Load Saved State</button>
                  <button onClick={saveGameStateAsJson} style={{ ...button, background: "rgba(16,185,129,.82)", padding: "10px 14px", fontSize: 14, display: "inline-flex", alignItems: "center", gap: 7 }}><Download size={15} /> Save As JSON</button>
                  {matchSetup.mode === "coop" && gameStarted ? <button onClick={toggleCoopPause} style={{ ...button, background: coopPaused ? "linear-gradient(135deg,#0ea5e9,#2563eb)" : "rgba(30,41,59,.82)", padding: "10px 14px", fontSize: 14 }}>{coopPaused ? "Resume Round" : "Pause Round"}</button> : null}
                  <button onClick={() => setBoard3D((v) => !v)} style={{ ...button, background: board3D ? "linear-gradient(135deg,#6366f1,#3b82f6)" : "rgba(30,41,59,.82)", padding: "10px 14px", fontSize: 14, display: "inline-flex", alignItems: "center", gap: 7 }}><Boxes size={15} /> 3D: {board3D ? "On" : "Off"}</button>
                  <button onClick={() => setSoundOn((v) => !v)} style={{ ...button, background: soundOn ? "linear-gradient(135deg,#10b981,#059669)" : "rgba(30,41,59,.82)", padding: "10px 14px", fontSize: 14, display: "inline-flex", alignItems: "center", gap: 7 }}>{soundOn ? <Volume2 size={15} /> : <VolumeX size={15} />} Sound</button>
                  <button onClick={() => setMusicOn((v) => !v)} style={{ ...button, background: musicOn ? "linear-gradient(135deg,#a855f7,#7c3aed)" : "rgba(30,41,59,.82)", padding: "10px 14px", fontSize: 14, display: "inline-flex", alignItems: "center", gap: 7 }}><Music size={15} /> Music</button>
                  <button onClick={returnToSplash} style={{ ...button, background: "rgba(30,41,59,.82)", padding: "10px 14px", fontSize: 14 }}>Change Setup</button>
                </div>
                <div style={{ height: 8, width: "100%", background: "rgba(30,41,59,.22)", borderRadius: 999, overflow: "hidden" }}><div style={{ height: "100%", width: `${progress}%`, background: "linear-gradient(90deg,#22d3ee,#facc15,#c084fc)" }} /></div>
                {board3D ? (
                  <details style={{ width: "100%", borderRadius: 14, border: "1px solid rgba(255,255,255,.12)", background: "rgba(15,23,42,.18)", padding: "8px 12px" }}>
                    <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 800, color: "#cbd5e1", display: "flex", alignItems: "center", gap: 7 }}><Boxes size={14} /> 3D Camera</summary>
                    <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                      <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#cbd5e1" }}>
                        <span style={{ display: "flex", justifyContent: "space-between" }}><strong>Perspective tilt</strong><span>{Math.round(cameraTilt)}°</span></span>
                        <input type="range" min="4" max="52" step="1" value={cameraTilt} onChange={(e) => setCameraTilt(Number(e.target.value))} />
                      </label>
                      <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#cbd5e1" }}>
                        <span style={{ display: "flex", justifyContent: "space-between" }}><strong>Zoom</strong><span>{Math.round(cameraZoom * 100)}%</span></span>
                        <input type="range" min="0.6" max="2.4" step="0.05" value={cameraZoom} onChange={(e) => setCameraZoom(Number(e.target.value))} />
                      </label>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        <button onClick={() => setCameraFollow((v) => !v)} style={{ ...button, background: cameraFollow ? "linear-gradient(135deg,#10b981,#059669)" : "rgba(30,41,59,.82)", padding: "8px 12px", fontSize: 12 }}>Follow active player: {cameraFollow ? "On" : "Off"}</button>
                        <button onClick={resetCamera} style={{ ...button, background: "rgba(30,41,59,.82)", padding: "8px 12px", fontSize: 12 }}>Reset camera</button>
                      </div>
                      <p style={{ margin: 0, fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>Set the 3D level once with the <strong>tilt slider</strong>. Then <strong>grab and drag the board</strong> to fly over it in any direction — drag down to bring the top closer, drag sideways to reach the corners. Or let it auto-follow whoever's turn it is.</p>
                    </div>
                  </details>
                ) : null}
              </div>
            </div>
          </div>
          <div className="player-column" style={{ display: "grid", gap: 14 }}>
            {rightPlayers.map((player, index) => renderPlayerCard(player, index + splitIndex))}
          </div>
        </div>
        {!gameStarted ? <div className="bottom-layout" style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 16 }}>
            <div style={{ ...glassPanel, padding: 16 }}>
              <div style={{ display: "grid", gap: 12 }}>
                <h2 style={{ margin: 0, display: "flex", gap: 8, alignItems: "center", fontSize: 20 }}><Users size={18} /> Match Summary</h2>
                <div style={{ display: "grid", gap: 8 }}>
                  <InfoBadge>Players: {players.map((player) => player.name).join(", ")}</InfoBadge>
                  <InfoBadge>{matchSetup.mode === "coop" ? `Team score: ${teamScore}` : `Leader: ${[...players].sort((a, b) => b.score - a.score)[0]?.name ?? "-"}`}</InfoBadge>
                  {matchSetup.mode === "coop" ? <InfoBadge>Crash penalty: {COOP_CRASH_TIME_PENALTY}s</InfoBadge> : <InfoBadge>Bombs appear every 4 battle moves</InfoBadge>}
                </div>
                <div style={{ display: "grid", gap: 8, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,.1)" }}>
                  <button onClick={saveGameState} style={{ ...button, background: "linear-gradient(135deg,#0ea5e9,#2563eb)", display: "inline-flex", justifyContent: "center", alignItems: "center", gap: 8 }}><Save size={16} /> Save State</button>
                  <button onClick={loadSavedGameState} style={{ ...button, background: "rgba(30,41,59,.82)", display: "inline-flex", justifyContent: "center", alignItems: "center", gap: 8 }}><Upload size={16} /> Load Saved State</button>
                  <button onClick={saveGameStateAsJson} style={{ ...button, background: "linear-gradient(135deg,#10b981,#059669)", display: "inline-flex", justifyContent: "center", alignItems: "center", gap: 8 }}><Download size={16} /> Save As JSON</button>
                  <label style={{ ...button, background: "rgba(30,41,59,.82)", display: "inline-flex", justifyContent: "center", alignItems: "center", gap: 8 }}><Upload size={16} /> Load JSON<input type="file" accept="application/json,.json" style={{ display: "none" }} onChange={handleSaveFileChange} /></label>
                </div>
              </div>
            </div>
            <div style={{ ...glassPanel, padding: 16 }}>
              <div style={{ display: "grid", gap: 24 }}>
                <div style={{ display: "grid", gap: 12 }}>
                  <h2 style={{ margin: 0, display: "flex", gap: 8, alignItems: "center", fontSize: 20 }}><Settings2 size={18} /> Question Setup</h2>
                  <p style={{ margin: 0, fontSize: 13, color: "#e2e8f0", lineHeight: 1.5 }}>Use a question line followed by Answer: the answer. Leave a blank line between each card. The game assigns each question-answer card randomly to crystals and repeats cards when crystals outnumber prompts.</p>
                  <textarea value={questionText} onChange={(event) => setQuestionText(event.target.value)} style={{ ...input, minHeight: 240, resize: "vertical" }} placeholder="One question per line" />
                </div>
                <details style={{ borderRadius: 18, border: "1px solid rgba(255,255,255,.12)", background: "rgba(15,23,42,.12)", padding: 14 }}>
                  <summary style={{ cursor: "pointer", fontSize: 14, color: "#f8fafc", fontWeight: 800 }}>Background Image & Visibility</summary>
                  <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
                    <label style={{ ...glassPanel, padding: 16, display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}><ImagePlus size={18} /><span style={{ fontSize: 14, color: "#f8fafc", fontWeight: 600 }}>{backgroundImage ? "Replace background image" : "Upload background image"}</span><input type="file" accept="image/*" style={{ display: "none" }} onChange={handleBackgroundChange} /><Upload size={16} style={{ marginLeft: "auto", color: "#cbd5e1" }} /></label>
                    {[
                      ["Image blur", "blur", 0, 12, 1, `${backgroundControls.blur}px`],
                      ["Image brightness", "brightness", .45, 1.4, .05, `${Math.round(backgroundControls.brightness * 100)}%`],
                      ["Dark overlay", "overlay", 0, .65, .01, `${Math.round(backgroundControls.overlay * 100)}%`],
                      ["Panel opacity", "panelOpacity", .25, 1, .01, `${Math.round(backgroundControls.panelOpacity * 100)}%`],
                      ["Board opacity", "boardOpacity", .12, .75, .01, `${Math.round(backgroundControls.boardOpacity * 100)}%`],
                    ].map(([label, key, min, max, step, valueLabel]) => (
                      <label key={key} style={{ display: "grid", gap: 5, fontSize: 12, color: "#cbd5e1" }}>
                        <span style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><strong>{label}</strong><span>{valueLabel}</span></span>
                        <input type="range" min={min} max={max} step={step} value={backgroundControls[key]} onChange={(event) => setBackgroundControls((prev) => ({ ...prev, [key]: Number(event.target.value) }))} />
                      </label>
                    ))}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button style={{ ...button, background: "rgba(30,41,59,.82)", padding: "8px 11px", fontSize: 12 }} onClick={() => setBackgroundControls({ blur: 0, brightness: 1.08, overlay: 0.08, panelOpacity: 0.45, boardOpacity: 0.26 })}>Clearer Image</button>
                      <button style={{ ...button, background: "rgba(30,41,59,.82)", padding: "8px 11px", fontSize: 12 }} onClick={() => setBackgroundControls({ blur: 6, brightness: .82, overlay: 0.34, panelOpacity: 0.72, boardOpacity: 0.52 })}>More Readable UI</button>
                    </div>
                    {backgroundImage ? <div style={{ borderRadius: 16, overflow: "hidden", border: "1px solid rgba(255,255,255,.12)" }}><img src={backgroundImage} alt="Game background preview" style={{ display: "block", width: "100%", maxHeight: 150, objectFit: "cover" }} /></div> : null}
                  </div>
                </details>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button onClick={() => resetBoard(matchSetup)} style={{ ...button, background: "rgba(30,41,59,.82)" }}>Refresh Board</button>
                </div>
              </div>
            </div>
            <div style={{ ...glassPanel, padding: 16 }}>
              <div style={{ display: "grid", gap: 12 }}>
                <h2 style={{ margin: 0, display: "flex", gap: 8, alignItems: "center", fontSize: 20 }}><Settings2 size={18} /> Movement Customization</h2>
                <p style={{ margin: 0, fontSize: 13, color: "#e2e8f0" }}>Set the on-screen movement word and the actual keyboard key for each direction. Because the game is turn-based, players can safely share the <strong>same keys</strong> — only the active player's keys move a snake.</p>
                <div style={{ display: "grid", gap: 14 }}>
                  {players.map((player, pIndex) => {
                    const labels = playerDirectionLabels[player.id] ?? DEFAULT_DIRECTION_LABELS;
                    const binding = bindingForPlayer(player.id, pIndex);
                    return (
                      <div key={player.id} style={{ display: "grid", gap: 8, borderTop: "1px solid rgba(255,255,255,.1)", paddingTop: 12 }}>
                        <strong style={{ fontSize: 14 }}>{player.name}</strong>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                          {["up", "down", "left", "right"].map((dir) => {
                            const capturing = capturingKey && capturingKey.playerId === player.id && capturingKey.dir === dir;
                            return (
                              <div key={`${player.id}-${dir}`} style={{ display: "grid", gap: 4 }}>
                                <label style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".08em", color: "#cbd5e1" }}>{dir}</label>
                                <input value={labels[dir]} onChange={(event) => setPlayerDirectionLabels((prev) => updatePlayerDirectionLabel(prev, player.id, dir, event.target.value))} style={input} placeholder="Word shown on screen" />
                                <button onClick={() => setCapturingKey(capturing ? null : { playerId: player.id, dir })} style={{ ...button, background: capturing ? "linear-gradient(135deg,#f59e0b,#d97706)" : "rgba(30,41,59,.82)", padding: "7px 10px", fontSize: 12 }}>{capturing ? "Press a key… (Esc)" : `Key: ${keyLabel(binding[dir])}`}</button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p style={{ margin: 0, fontSize: 12, color: "#cbd5e1" }}>The words are visual prompts; the <strong>Key</strong> buttons set the real keyboard control. Click a Key button, then press the key you want. (1 and 2 are reserved for answering questions.)</p>
              </div>
            </div>
            <div style={{ ...glassPanel, padding: 16 }}>
              <div style={{ display: "grid", gap: 12 }}>
                <h2 style={{ margin: 0, display: "flex", gap: 8, alignItems: "center", fontSize: 20 }}><Crown size={18} /> Hero Crown</h2>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#e2e8f0" }}><input type="checkbox" checked={heroSettings.enabled} onChange={(event) => setHeroCrownSettings((prev) => ({ ...prev, enabled: event.target.checked }))} /> Enable crown challenges</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div style={{ display: "grid", gap: 5 }}><label style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".08em", color: "#cbd5e1" }}>Frequency</label><select value={heroSettings.frequency} onChange={(event) => setHeroCrownSettings((prev) => ({ ...prev, frequency: event.target.value }))} style={input}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>
                  <div style={{ display: "grid", gap: 5 }}><label style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".08em", color: "#cbd5e1" }}>Expires after moves</label><input type="number" min="1" value={heroSettings.expiresAfterMoves} onChange={(event) => setHeroCrownSettings((prev) => ({ ...prev, expiresAfterMoves: Number(event.target.value) || 1 }))} style={input} /></div>
                  <div style={{ display: "grid", gap: 5 }}><label style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".08em", color: "#cbd5e1" }}>Effect seconds</label><input type="number" min="1" value={heroSettings.cosmeticDurationSeconds} onChange={(event) => setHeroCrownSettings((prev) => ({ ...prev, cosmeticDurationSeconds: Number(event.target.value) || 1 }))} style={input} /></div>
                  <div style={{ display: "grid", gap: 5 }}><label style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".08em", color: "#cbd5e1" }}>Bonus value</label><input type="number" min="0" value={heroSettings.bonusValue} onChange={(event) => setHeroCrownSettings((prev) => ({ ...prev, bonusValue: Number(event.target.value) || 0 }))} style={input} /></div>
                </div>
                <textarea value={heroCrownChallengeText} onChange={(event) => setHeroCrownChallengeText(event.target.value)} style={{ ...input, minHeight: 112, resize: "vertical", fontSize: 12 }} />
                <div style={{ display: "grid", gap: 8 }}>
                  <button style={{ ...button, background: "linear-gradient(135deg,#facc15,#f97316)", color: "#1f1300" }} onClick={() => spawnHeroCrown(true)}>Spawn Crown Now ({HERO_CROWN_SHORTCUTS.spawn})</button>
                  <button style={{ ...button, background: "linear-gradient(135deg,#a855f7,#2563eb)" }} onClick={() => startHeroCrownChallenge(null)}>Start Crown Challenge Now</button>
                  <button style={{ ...button, background: heroCrownChallenge ? "linear-gradient(135deg,#10b981,#059669)" : "rgba(71,85,105,.72)" }} onClick={() => awardHeroCrownToPlayers([players[0]?.id])} disabled={!heroCrownChallenge}>Award Crown to Player 1 ({HERO_CROWN_SHORTCUTS.player1})</button>
                  <button style={{ ...button, background: heroCrownChallenge ? "linear-gradient(135deg,#10b981,#059669)" : "rgba(71,85,105,.72)" }} onClick={() => awardHeroCrownToPlayers([players[1]?.id])} disabled={!heroCrownChallenge}>Award Crown to Player 2 ({HERO_CROWN_SHORTCUTS.player2})</button>
                  <button style={{ ...button, background: heroCrownChallenge ? "linear-gradient(135deg,#22d3ee,#7c3aed)" : "rgba(71,85,105,.72)" }} onClick={awardHeroCrownToBoth} disabled={!heroCrownChallenge}>Award Crown to Both ({HERO_CROWN_SHORTCUTS.both})</button>
                  <button style={{ ...button, background: heroCrownChallenge ? "rgba(239,68,68,.82)" : "rgba(71,85,105,.72)" }} onClick={() => cancelHeroCrownChallenge()} disabled={!heroCrownChallenge}>Cancel Challenge ({HERO_CROWN_SHORTCUTS.cancel})</button>
                  <button style={{ ...button, background: "rgba(30,41,59,.82)" }} onClick={clearCrownEffects}>Clear Crown Effects</button>
                </div>
                <div style={{ display: "grid", gap: 10, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,.1)" }}>
                  <h3 style={{ margin: 0, display: "flex", gap: 8, alignItems: "center", fontSize: 16 }}><Ghost size={16} /> Villain</h3>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#e2e8f0" }}><input type="checkbox" checked={enemyConf.enabled} onChange={(event) => setEnemySettings((prev) => ({ ...prev, enabled: event.target.checked }))} /> Enable roaming villain</label>
                  <p style={{ margin: 0, fontSize: 12, color: "#cbd5e1", lineHeight: 1.5 }}>It chases the nearest snake each turn. Catch it with your snake's <strong style={{ color: "#67e8f9" }}>HEAD</strong> to eat it. If it touches your <strong>body</strong>, you lose that segment. Either way the villain is destroyed after one touch. Answering correctly makes you <strong style={{ color: "#67e8f9" }}>Charged</strong> for bonus points on the eat.</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div style={{ display: "grid", gap: 5 }}><label style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".08em", color: "#cbd5e1" }}>Speed</label><select value={enemyConf.speed} onChange={(event) => setEnemySettings((prev) => ({ ...prev, speed: event.target.value }))} style={input}><option value="slow">Slow (every 2 turns)</option><option value="normal">Normal (every turn)</option></select></div>
                    <div style={{ display: "grid", gap: 5 }}><label style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".08em", color: "#cbd5e1" }}>Defeat reward</label><input type="number" min="0" value={enemyConf.defeatReward} onChange={(event) => setEnemySettings((prev) => ({ ...prev, defeatReward: Number(event.target.value) || 0 }))} style={input} /></div>
                  </div>
                  <button style={{ ...button, background: "linear-gradient(135deg,#7c3aed,#4c1d95)", display: "inline-flex", justifyContent: "center", alignItems: "center", gap: 7 }} onClick={() => { setEnemySettings((p) => ({ ...p, enabled: true })); spawnEnemy(); }}><Ghost size={15} /> Spawn Villain Now</button>
                </div>
              </div>
            </div>
            <div style={{ ...glassPanel, padding: 16 }}>
              <div style={{ display: "grid", gap: 12, color: "#dbeafe" }}>
                <h2 style={{ margin: 0, display: "flex", gap: 8, alignItems: "center", fontSize: 20 }}><Trophy size={18} /> Crystal Rules</h2>
                <div style={{ border: "1px solid rgba(234,179,8,.28)", background: "rgba(234,179,8,.1)", borderRadius: 16, padding: 14 }}><p style={{ margin: "0 0 6px 0", fontWeight: 700, color: "#fde047" }}>Yellow = Normal crystal</p><p style={{ margin: 0 }}>Correct answers keep the +1 segment and award 1 point.</p></div>
                <div style={{ border: "1px solid rgba(239,68,68,.26)", background: "rgba(239,68,68,.1)", borderRadius: 16, padding: 14 }}><p style={{ margin: "0 0 6px 0", fontWeight: 700, color: "#fca5a5" }}>Red = Power crystal</p><p style={{ margin: 0 }}>{matchSetup.mode === "coop" ? "Can affect time, shields, and crystal count." : "Can add shields, bonus points, or extra growth."}</p></div>
                <div style={{ border: "1px solid rgba(255,255,255,.18)", background: "rgba(148,163,184,.08)", borderRadius: 16, padding: 14 }}><p style={{ margin: "0 0 6px 0", fontWeight: 700, color: "#f8fafc" }}>Rainbow = Mystery crystal</p><p style={{ margin: 0 }}>{matchSetup.mode === "coop" ? "Includes freeze-time, add/remove time, and add/remove crystal effects." : "Mostly buffs, sometimes nerfs."}</p></div>
                {matchSetup.mode === "coop" ? <div style={{ border: "1px solid rgba(103,232,249,.24)", background: "rgba(34,211,238,.08)", borderRadius: 16, padding: 14 }}><p style={{ margin: "0 0 6px 0", fontWeight: 700, color: "#67e8f9", display: "flex", gap: 6, alignItems: "center" }}><TimerReset size={14} /> Co-op Timer</p><p style={{ margin: 0 }}>Clear the whole board before time expires. Crashes cost time, but your snake keeps its current size.</p></div> : null}
              </div>
            </div>
            <div style={{ ...glassPanel, padding: 16 }}>
              <div style={{ display: "grid", gap: 12 }}>
                <h2 style={{ margin: 0, display: "flex", gap: 8, alignItems: "center", fontSize: 20 }}><Music size={18} /> Audio & Music</h2>
                <p style={{ margin: 0, fontSize: 12, color: "#cbd5e1", lineHeight: 1.5 }}>Upload your own MP3s. Music loops in the background; each sound effect plays on its event. Uploaded audio lasts for this session.</p>
                <div style={{ display: "grid", gap: 6, borderBottom: "1px solid rgba(255,255,255,.1)", paddingBottom: 12 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#f8fafc" }}>Background music {customMusicName ? `· ${customMusicName}` : "· built-in"}</span>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <label style={{ ...button, background: "rgba(168,85,247,.82)", padding: "8px 12px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}><Upload size={14} /> Upload MP3<input type="file" accept="audio/*" style={{ display: "none" }} onChange={handleMusicUpload} /></label>
                    {customMusicName ? <button onClick={clearMusicUpload} style={{ ...button, background: "rgba(30,41,59,.82)", padding: "8px 12px", fontSize: 12 }}>Use built-in</button> : null}
                  </div>
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {SOUND_SLOTS.map(([name, label]) => (
                    <div key={name} style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
                      <span style={{ fontSize: 12, color: "#e2e8f0", minWidth: 96 }}>{label}{customAudioFlags[name] ? " ✓" : ""}</span>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => playSound(name)} title="Test" style={{ ...button, background: "rgba(30,41,59,.82)", padding: "6px 9px", fontSize: 11 }}>▶</button>
                        <label style={{ ...button, background: "rgba(14,165,233,.82)", padding: "6px 9px", fontSize: 11, cursor: "pointer" }}>Upload<input type="file" accept="audio/*" style={{ display: "none" }} onChange={(e) => handleSoundUpload(name, e)} /></label>
                        {customAudioFlags[name] ? <button onClick={() => clearSoundUpload(name)} style={{ ...button, background: "rgba(239,68,68,.6)", padding: "6px 9px", fontSize: 11 }}>✕</button> : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div> : null}
      </div>

      {heroCrownChallenge ? (
        <div className="game-overlay" style={{ position: "fixed", inset: 0, background: "radial-gradient(circle at center, rgba(250,204,21,.28), rgba(2,6,23,.72) 58%)", backdropFilter: "blur(14px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 60 }}>
          <motion.div initial={{ opacity: 0, scale: .78, y: 46 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 1.5, ease: [0.16, 0.92, 0.2, 1] }} style={{ width: "100%", maxWidth: 980 }}>
            <div style={{ ...glass, padding: 28, display: "grid", gap: 20, textAlign: "center", border: "1px solid rgba(250,204,21,.48)", boxShadow: "0 0 80px rgba(250,204,21,.24), 0 24px 80px rgba(2,6,23,.42)" }}>
              <motion.div animate={{ rotate: [-4, 4, -4], scale: [1, 1.12, 1] }} transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }} style={{ display: "grid", placeItems: "center", color: "#fef08a" }}>
                <Crown size={72} />
              </motion.div>
              <div style={{ display: "grid", gap: 8 }}>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 900, letterSpacing: ".18em", textTransform: "uppercase", color: "#fef08a" }}>Hero Crown Challenge!</p>
                <h2 style={{ margin: 0, fontSize: 48, lineHeight: 1.05, color: "#ffffff", textShadow: "0 0 28px rgba(250,204,21,.36)" }}>{heroCrownChallenge.instruction}</h2>
                <p style={{ margin: 0, color: "#e2e8f0", fontSize: 18 }}>Normal gameplay is paused. Teacher chooses who earns the crown.</p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                {players.map((player, index) => (
                  <button key={player.id} style={{ ...button, minHeight: 66, fontSize: 17, background: tone(player).bg, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }} onClick={() => awardHeroCrownToPlayers([player.id])}>
                    <Crown size={18} /> Award to {player.name}{index === 0 ? ` (${HERO_CROWN_SHORTCUTS.player1})` : index === 1 ? ` (${HERO_CROWN_SHORTCUTS.player2})` : ""}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <button style={{ ...button, background: "linear-gradient(135deg,#22d3ee,#7c3aed)", flex: 1, minWidth: 180, minHeight: 58, fontSize: 17 }} onClick={awardHeroCrownToBoth}><Crown size={18} /> Award to Both ({HERO_CROWN_SHORTCUTS.both})</button>
                <button style={{ ...button, background: "rgba(30,41,59,.82)", flex: 1, minWidth: 180, minHeight: 58, fontSize: 17 }} onClick={() => cancelHeroCrownChallenge("Hero Crown Challenge ended with no crown.")}>No Crown / Cancel ({HERO_CROWN_SHORTCUTS.cancel})</button>
              </div>
            </div>
          </motion.div>
        </div>
      ) : null}

      {pendingPickup ? (
        <div className="game-overlay" style={{ position: "fixed", inset: 0, background: "rgba(2,6,23,.28)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 50 }}>
          <motion.div initial={{ opacity: 0, scale: .82, y: 34 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 1.5, ease: [0.16, 0.92, 0.2, 1] }} style={{ width: "100%", maxWidth: 1000 }}>
            <div style={{ ...glass, color: "#f8fafc", padding: 24, display: "grid", gap: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <h2 style={{ margin: 0, fontSize: 30 }}>{pendingPickup.playerName} Question</h2>
                <InfoBadge>{pendingPickup.food.foodType === "mystery" ? "Mystery" : pendingPickup.food.foodType}</InfoBadge>
              </div>
              <div style={{ perspective: 1200 }}>
                <motion.div
                  className="game-question-flip"
                  animate={{ rotateY: pickupAnswerRevealed ? 180 : 0 }}
                  transition={{ duration: 1.5, ease: [0.16, 0.92, 0.2, 1] }}
                  style={{ position: "relative", minHeight: 250, transformStyle: "preserve-3d" }}
                >
                  <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", borderRadius: 26, background: "rgba(30,41,59,.42)", padding: 30, fontSize: 34, fontWeight: 700, lineHeight: 1.15, border: "1px solid rgba(255,255,255,.14)", display: "grid", alignContent: "center" }}>
                    {pendingPickup.question.prompt}
                  </div>
                  <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", transform: "rotateY(180deg)", borderRadius: 26, background: "linear-gradient(135deg, rgba(14,165,233,.22), rgba(16,185,129,.16))", padding: 30, border: "1px solid rgba(125,211,252,.34)", display: "grid", gap: 14, alignContent: "center" }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 900, letterSpacing: ".12em", textTransform: "uppercase", color: "#bae6fd" }}>Answer</p>
                    <p style={{ margin: 0, fontSize: 32, fontWeight: 900, lineHeight: 1.18 }}>{pendingPickup.question.answer || "No answer was added for this question."}</p>
                  </div>
                </motion.div>
              </div>
              {pickupResolution ? (
                <motion.div initial={{ opacity: 0, y: 22, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 1.5, ease: [0.16, 0.92, 0.2, 1] }} style={{ borderRadius: 24, border: "1px solid rgba(255,255,255,.18)", background: pickupResolution.tone === "buff" ? "linear-gradient(135deg, rgba(16,185,129,.3), rgba(34,211,238,.18))" : "linear-gradient(135deg, rgba(239,68,68,.28), rgba(251,191,36,.18))", padding: 24, color: "#dbeafe", display: "grid", gap: 8 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", color: "#ffffff" }}>{pendingPickup.playerName} result</p>
                  <p style={{ margin: 0, fontSize: 32, fontWeight: 900, color: "#ffffff" }}>{pickupResolution.title}</p>
                  <p style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>{pickupResolution.label}</p>
                  <p style={{ margin: 0, fontSize: 18, lineHeight: 1.4 }}>{pickupResolution.description}</p>
                </motion.div>
              ) : (
                <div style={{ borderRadius: 18, border: "1px dashed rgba(255,255,255,.22)", padding: 18, color: "#cbd5e1", fontSize: 17 }}>
                  {pickupAnswerRevealed ? "Judge the spoken answer now. Press 1 for correct or 2 for incorrect." : "Reveal the answer before scoring this crystal. Press 1 to show the answer."}
                </div>
              )}
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {pickupResolution ? (
                  <button style={{ ...button, background: "linear-gradient(135deg,#10b981,#059669)", flex: 1, minWidth: 180, height: 64, fontSize: 18 }} onClick={closePickupModal}>Continue</button>
                ) : pickupAnswerRevealed ? (
                  <>
                    <button style={{ ...button, background: "linear-gradient(135deg,#10b981,#059669)", flex: 1, minWidth: 180, height: 64, fontSize: 18, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }} onClick={() => resolveQuestion(true)}><Check size={20} /> Correct (1)</button>
                    <button style={{ ...button, background: "rgba(30,41,59,.72)", flex: 1, minWidth: 180, height: 64, fontSize: 18, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }} onClick={() => resolveQuestion(false)}><X size={20} /> Incorrect (2)</button>
                  </>
                ) : (
                  <button style={{ ...button, background: "linear-gradient(135deg,#0ea5e9,#2563eb)", flex: 1, minWidth: 180, height: 64, fontSize: 18, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }} onClick={() => setPickupAnswerRevealed(true)}><Eye size={20} /> Show answer (1)</button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      ) : null}

      {resultOverlay ? <div className="game-overlay" style={{ position: "fixed", inset: 0, background: "rgba(2,6,23,.42)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 55 }}><motion.div initial={{ opacity: 0, scale: .84, y: 36 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 1.5, ease: [0.16, 0.92, 0.2, 1] }} style={{ width: "100%", maxWidth: 900 }}><div style={{ ...glass, padding: 28, display: "grid", gap: 16, textAlign: "center" }}><p style={{ margin: 0, fontSize: 14, fontWeight: 800, letterSpacing: ".16em", textTransform: "uppercase", color: "#cbd5e1" }}>{resultOverlay.mode === "coop" ? "Co-op Result" : "Versus Result"}</p><h2 style={{ margin: 0, fontSize: 42, color: "#f8fafc" }}>{resultOverlay.title}</h2><p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#86efac" }}>{resultOverlay.subtitle}</p><div style={{ display: "grid", gap: 8, textAlign: "left" }}>{players.map((player) => { const crownBonus = calculateCrownBonus(player, heroSettings.bonusValue); return <div key={player.id} className="game-result-player" style={{ borderRadius: 14, padding: "12px 14px", background: "rgba(255,255,255,.05)", display: "grid", gridTemplateColumns: "1.1fr repeat(4, minmax(82px, auto))", alignItems: "center", gap: 12 }}><span style={{ fontWeight: 800 }}>{player.name}</span><span>Score: {player.score}</span><span><Crown size={14} /> x {player.crowns || 0}</span><span>Bonus: {crownBonus}</span><span style={{ color: "#fef08a", fontWeight: 900 }}>Total: {player.score + crownBonus}</span></div>; })}</div>{resultOverlay.mode === "coop" ? <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#f8fafc" }}>Team total: {players.reduce((sum, player) => sum + player.score + calculateCrownBonus(player, heroSettings.bonusValue), 0)}</p> : null}<div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}><button style={{ ...button, background: "linear-gradient(135deg,#10b981,#059669)", minWidth: 220, height: 60, fontSize: 18 }} onClick={() => { setResultOverlay(null); setGameStarted(false); resetBoard(matchSetup); }}>Play Again</button><button style={{ ...button, background: "rgba(30,41,59,.82)", minWidth: 220, height: 60, fontSize: 18 }} onClick={returnToSplash}>Back to Splash</button></div></div></motion.div></div> : null}
    </div>
  );
}
