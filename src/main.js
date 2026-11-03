import {
  HawkerGame,
  UPGRADES,
  cookPhase,
  customerPhase,
  rushIntensity,
} from "./game.js";
import { StallScene } from "./scene.js";
import { StallInteractions } from "./interactions.js";
import { icon, food } from "./art.js";
import { GameAudio } from "./audio.js";
import { FeedbackEffects } from "./feedback.js";
import { impatientDialogue } from "./dialogue.js";
import { orderTicketPosition } from "./order-layout.js";
import { gameLayout } from "./game-layout.js";

let saved = {};
try {
  saved = JSON.parse(localStorage.getItem("hawker-rush") || "{}");
} catch {
  /* Storage is optional. */
}
const freshGame = (day = saved.day || 1) =>
  new HawkerGame({
    day,
    wallet: saved.wallet || 0,
    upgrades: Array.isArray(saved.upgrades)
      ? saved.upgrades.filter((id) => UPGRADES.some((u) => u.id === id))
      : [],
  });
let game = freshGame(),
  controls = new StallInteractions(game),
  world,
  effects;
let muted = saved.sound === false,
  musicEnabled = saved.music !== false,
  chatterEnabled = saved.chatter ?? saved.voices ?? true,
  modal = null,
  resumeAfterModal = false,
  selected = null,
  lastState = "ready";
const audio = new GameAudio({
  muted,
  music: musicEnabled,
  chatter: chatterEnabled,
});
let noticeUntil = 0,
  lastUi = 0,
  animation,
  previous = performance.now();
const $ = (id) => document.getElementById(id);
const cash = (n) => `$${n.toFixed(2)}`;
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const cache = new Map();
const put = (id, text) => {
  if (cache.get(id) !== text) {
    $(id).innerHTML = text;
    cache.set(id, text);
  }
};

$("app").innerHTML = `
  <div id="world" class="world"></div><div class="scene-vignette"></div>
  <header class="game-hud"><div class="game-brand"><span class="brand-mark">${icon("bowl")}</span><div><h1>HAWKER<span>RUSH<span class="title-dot">!</span></span></h1><p>TIONG BAHRU · SINGAPORE</p></div></div>
    <div class="shift-hud"><div class="shift-time">${icon("clock")}<strong id="time">04:00</strong></div><span class="hud-divider"></span><div class="shift-coins">${icon("money")}<strong id="coins">$0.00</strong></div><span class="hud-divider"></span><div class="shift-score">${icon("star")}<strong id="score">0<span>served</span></strong></div></div>
    <div class="hud-actions"><button data-action="sound" id="sound" class="round-button" aria-label="Mute all audio">${icon("sound")}</button><button data-action="music" id="music" class="round-button music-button" aria-label="Mute music" aria-pressed="true" title="Mute background music">${icon("music")}</button><button data-action="chatter" id="chatter" class="round-button chatter-button" aria-label="Mute background hawker chatter" aria-pressed="true" title="Background hawker chatter">${icon("voices")}</button><button data-action="help" class="round-button" aria-label="How to play">${icon("help")}</button><button data-action="pause" id="pause" class="round-button" aria-label="Pause game">${icon("pause")}</button><button data-action="fullscreen" class="round-button fullscreen-button" aria-label="Toggle full screen">⛶</button></div>
  </header>
  <div class="location-tag"><span class="live-dot"></span><span id="day">DAY 01</span><span class="location-divider">/</span> AH HUAT’S · #01–08</div>
  <div id="tickets" class="world-tickets" aria-label="Customer orders"></div><div id="npc-speech" class="npc-speech" aria-live="polite"></div><div id="equipment-labels" class="equipment-labels"></div><div id="object-hotspots" class="object-hotspots" aria-label="Kitchen objects"></div><div id="cook-cues" class="cook-cues"></div><div id="feedback-layer" class="feedback-layer"></div><div class="view-caption" id="view-caption">CENTRE · CUSTOMERS & PLATING</div>
  <button class="look-arrow look-left" data-action="look-left" aria-label="Look left toward preparation"><span>‹</span><small>PREP</small><kbd>A</kbd></button><button class="look-arrow look-right" data-action="look-right" aria-label="Look right toward drinks"><span>›</span><small>KOPI</small><kbd>D</kbd></button>
  <div id="object-tooltip" class="object-tooltip" role="status"></div><div id="drag-label" class="drag-label"></div>
  <div class="game-footer"><div class="stall-state"><span class="open-dot" id="open-dot"></span><div><strong id="stall-state">COUNTER’S READY</strong><span id="queue-state">A new day in the neighbourhood</span></div></div><div class="camera-compass"><button data-action="view" data-view="-1" aria-label="Look at preparation area">COOK</button><span>·</span><button data-action="view" data-view="0" class="selected" aria-label="Look at service counter">COUNTER</button><span>·</span><button data-action="view" data-view="1" aria-label="Look at drinks area">KOPI</button></div><div class="interaction-note">${icon("spark")} <span>DRAG. COOK. SERVE.</span></div></div>
  <div class="context-hint" id="context-hint"></div><div class="game-notice" id="notice" role="status" aria-live="polite"></div>
  <section class="intro" id="intro"><div class="intro-kicker"><span></span> SMALL STALL. BIG HEART.</div><h2>The neighbourhood<br>is <em>hungry.</em></h2><p>Apron on. Step into your own little corner<br>of Singapore’s lunch-hour rush.</p><button class="play-button" data-action="start">Let’s cook! <span>▶</span></button><button class="intro-help" data-action="help">First shift? Here’s how to play ${icon("arrow")}</button><div class="intro-controls"><span>↔ <kbd>A</kbd> <kbd>D</kbd> Look around</span><span>✋ Drag objects to cook</span></div></section>
  <div class="scene-caption" id="scene-caption"><span>01 / THE LUNCH RUSH</span><strong>One stall.<br>A thousand stories.</strong></div><div id="status-announcement" class="sr-only" role="status" aria-live="polite"></div><div id="modal-root"></div>`;

function save() {
  saved = {
    ...saved,
    day: game.day,
    wallet: game.wallet,
    upgrades: game.upgrades,
    sound: !muted,
    music: musicEnabled,
    chatter: chatterEnabled,
    best: Math.max(saved.best || 0, game.status === "ended" ? game.served : 0),
  };
  try {
    localStorage.setItem("hawker-rush", JSON.stringify(saved));
  } catch {
    /* A shift still works without local storage. */
  }
}
function sound(success = false) {
  audio.effect(success);
}
function tell(text, success = false, playSound = true) {
  effects?.clearCards();
  document.body.classList.add("has-notice");
  $("notice").innerHTML =
    `${icon(success ? "check" : "spark")}<span>${escape(text)}</span>`;
  $("notice").classList.add("visible");
  noticeUntil = performance.now() + 4300;
  if (success && playSound) sound(true);
}
function afterInteraction() {
  world.sync(game);
  renderUi();
}
function drop(source, target, options) {
  if (
    target.kind === "customer" &&
    !game.orders.some((order) => order.id === target.id)
  ) {
    game.rejectServe(
      target.id,
      "This ticket is already closed. Serve another customer.",
      "closed-order",
    );
    afterInteraction();
    return;
  }
  if (target.kind === "customer" && !world.customers.get(target.id)?.arrived) {
    game.rejectServe(
      target.id,
      "Let them reach the counter first, boss.",
      "arriving",
    );
    afterInteraction();
    return;
  }
  const result = controls.drop(source, target, options);
  if (result && target.kind !== "customer") sound();
  afterInteraction();
}
function applyLayout() {
  const layout = gameLayout(innerWidth, innerHeight, !!world?.view);
  const app = $("app");
  app.dataset.layout = layout.mode;
  for (const [name, value] of Object.entries({
    "order-width": layout.cardWidth,
    "order-height": layout.cardHeight,
  }))
    app.style.setProperty(`--${name}`, `${value}px`);
}
window.addEventListener("resize", applyLayout);
function setView(value) {
  world?.setView(value);
}
function hint() {
  if (game.status === "ready") return "";
  if (selected?.item === "cleaver" && game.chop.loaded)
    return `${icon("leaf")} <strong>CHOP ${game.chop.cuts}/3</strong> Tap the board again. <span>Esc to put the cleaver down.</span>`;
  if (selected)
    return `${icon("arrow")} ${escape(selected.label)} <span>Esc to put down</span>`;
  if (game.chop.loaded)
    return `${icon("leaf")} <strong>Chop ${game.chop.cuts}/3</strong> Pick up the cleaver and tap the board. <span>Three cuts make three portions.</span>`;
  if (game.pouring)
    return `${icon("coffee")} Pulling kopi… <strong>${game.pouring.toFixed(1)}s</strong>`;
  if (game.refill)
    return `${icon("coffee")} Brewing a fresh pot… <strong>${game.refill.toFixed(1)}s</strong>`;
  const job = game.jobs[0];
  if (job)
    return `${icon(job.type === "noodles" ? "bowl" : "toast")} ${job.quantity > 1 ? `${job.quantity} portions · ` : ""}<strong>${job.time.toFixed(1)}s</strong> ${job.time < 2 ? "A little longer…" : job.time <= 4 ? (job.type === "noodles" ? "Ready! Drag the basket into an empty bowl." : "Golden! Drag the toast from the grill to a plating spot.") : job.time < 6 ? "Overcooking — lift it now!" : `Burnt! Drag the ${job.type === "toast" ? "toast" : "basket"} to the bin.`}`;
  const plainToast = [...game.plates, ...game.holding].find(
    (p) => p.type === "toast" && !p.kaya,
  );
  if (plainToast)
    return `${icon("toast")} <strong>Toast needs kaya.</strong> Dip the knife into the kaya jar, then spread it onto the toast.`;
  const blackCoffee = game.holding.find((p) => p.type === "kopi");
  if (blackCoffee)
    return `${icon("coffee")} Add milk and sugar <strong>as ordered</strong>, then move the cup to the centre counter.`;
  if (game.plates.length)
    return `${icon("heart")} Finish the dish, then <strong>drag it to a customer.</strong> <span>Chilli? Takeaway? Check their order.</span>`;
  if (game.holding.length)
    return `${icon("bowl")} <strong>Food’s ready.</strong> Drag a prepared portion into an empty bowl.`;
  return `${icon("bowl")} <strong>Pick up a mee nest</strong> and drag it into the noodle pot. <span>Look left with A / ←</span>`;
}
function renderUi() {
  applyLayout();
  audio.setRush(rushIntensity(game.elapsed, game.duration));
  audio.setActive(game.status === "running" && !document.hidden);
  const remaining = Math.max(0, Math.ceil(game.duration - game.elapsed));
  $("time").textContent =
    `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;
  $("time").classList.toggle("urgent", remaining < 30);
  $("coins").textContent = cash(game.earnings);
  put("score", `${game.served}<span>served</span>`);
  $("day").textContent = `DAY ${String(game.day).padStart(2, "0")}`;
  const ready = game.status === "ready";
  if (ready || modal) $("object-tooltip").classList.remove("visible");
  document.body.classList.toggle("ready", ready);
  document.body.classList.toggle("playing", game.status === "running");
  $("intro").hidden = !ready;
  $("scene-caption").hidden = !ready;
  $("pause").disabled = ready || game.status === "ended";
  $("open-dot").classList.toggle("is-open", game.status === "running");
  $("stall-state").textContent = ready
    ? "COUNTER’S READY"
    : game.status === "paused"
      ? "KOPI BREAK"
      : game.status === "ended"
        ? "THAT’S A WRAP"
        : "OPEN FOR LUNCH";
  $("queue-state").textContent = ready
    ? "A new day in the neighbourhood"
    : `${game.orders.length} waiting · ${Math.round(game.rating * 100)}% satisfaction`;
  $("pause").setAttribute(
    "aria-label",
    game.status === "paused" ? "Resume game" : "Pause game",
  );
  put("pause", icon(game.status === "paused" ? "play" : "pause"));
  put("sound", icon(muted ? "mute" : "sound"));
  $("sound").setAttribute(
    "aria-label",
    muted ? "Enable audio" : "Mute all audio",
  );
  $("music").setAttribute(
    "aria-label",
    musicEnabled ? "Mute music" : "Enable music",
  );
  $("music").setAttribute("aria-pressed", musicEnabled);
  $("music").title = musicEnabled
    ? muted
      ? "Music enabled · all audio muted"
      : "Mute background music"
    : "Enable background music";
  $("music").classList.toggle("is-muted", !musicEnabled || muted);
  $("chatter").setAttribute("aria-pressed", chatterEnabled);
  $("chatter").setAttribute(
    "aria-label",
    chatterEnabled
      ? "Mute background hawker chatter"
      : "Enable background hawker chatter",
  );
  $("chatter").title = "Background hawker chatter";
  $("chatter").classList.toggle("is-muted", !chatterEnabled || muted);
  put("context-hint", hint());
  $("context-hint").classList.toggle(
    "visible",
    !ready && game.status !== "ended" && !modal,
  );
  for (const event of game.events.splice(0)) {
    if (event.feedback) {
      $("status-announcement").textContent = event.text;
      audio.cue(event.feedback, event);
      if (
        [
          "order-served",
          "dish-served",
          "serve-rejected",
          "customer-left",
        ].includes(event.feedback)
      ) {
        $("notice").classList.remove("visible");
        document.body.classList.remove("has-notice");
        noticeUntil = 0;
      }
      effects?.handle(event);
      if (event.feedback === "customer-warning") {
        const order = game.orders.find((o) => o.id === event.orderId),
          previous = speechStates.get(event.orderId);
        if (order && (!previous || (event.urgent && !previous.urgent))) {
          const dialogue = impatientDialogue(
            order.type,
            event.urgent,
            order.id + game.day,
          );
          speechStates.set(order.id, {
            text: dialogue.text,
            until: game.elapsed + 4.5,
            urgent: event.urgent,
          });
        }
      }
    }
    if (
      event.feedback?.startsWith("cook-") ||
      event.feedback === "customer-warning" ||
      [
        "order-served",
        "dish-served",
        "serve-rejected",
        "customer-left",
      ].includes(event.feedback)
    )
      continue;
    tell(
      event.text
        .replace(
          "Select an order and let’s cook.",
          "Drag a mee nest into the pot.",
        )
        .replace(
          "Tap the takeaway bag first.",
          "Drag takeaway paper onto the dish first.",
        )
        .replace(
          "Remove takeaway packaging first.",
          "Drop takeaway paper onto the dish again to unpack it.",
        )
        .replace(
          "or choose “Serve as is”.",
          "or hold Shift while handing it over for reduced satisfaction.",
        ),
      event.kind === "success",
      !event.feedback,
    );
    $("notice").dataset.kind = event.kind;
  }
  if (game.status === "ended" && lastState !== "ended") {
    lastState = "ended";
    save();
    openModal("results");
  }
  lastState = game.status;
}
const ticketNodes = new Map(),
  hotspotNodes = new Map(),
  timerNodes = new Map(),
  freshnessNodes = new Map(),
  cookCueNodes = new Map(),
  speechStates = new Map(),
  speechNodes = new Map(),
  finishNodes = new Map();
function orderFood(item) {
  return `<div class="ticket-food ${item.served ? "done" : ""}">${food(item.type, "", item.chilli)}${item.served ? `<b>${icon("check")}</b>` : item.type === "noodles" ? `<span class="chilli-pref ${item.chilli ? "spicy" : ""}">${icon("chilli")}${item.chilli ? "" : "×"}</span><span class="greens-pref">${icon("leaf")}</span>` : item.type === "kopi" ? `<span class="coffee-order"><span title="${item.milk ? "Milk" : "No milk"}">${icon("milk")}${item.milk ? "✓" : "×"}</span><span title="${item.sugar ? "Sugar" : "No sugar"}">${icon("sugar")}${item.sugar ? "✓" : "×"}</span></span>` : ""}</div>`;
}
function project(entries) {
  const active = new Set();
  const pinnedCounts = { left: 0, right: 0 };
  const placedCues = [];
  for (const entry of entries) {
    let hot = hotspotNodes.get(entry.name);
    if (!hot) {
      hot = document.createElement("button");
      hot.className = "world-hotspot";
      hot.dataset.worldObject = entry.name;
      hot.setAttribute("aria-label", entry.label);
      hot.title = entry.label;
      $("object-hotspots").append(hot);
      hotspotNodes.set(entry.name, hot);
    }
    hot.style.transform = `translate(${entry.x}px,${entry.y}px)`;
    hot.setAttribute("aria-label", entry.label);
    hot.title = entry.label;
    hot.hidden = !entry.visible;
    active.add(entry.name);
    if (entry.kind === "customer") {
      const order = game.orders.find((o) => o.id === entry.id);
      if (!order) continue;
      let node = ticketNodes.get(entry.id);
      if (!node) {
        node = document.createElement("div");
        node.className = "floating-ticket";
        node.dataset.customer = entry.id;
        $("tickets").append(node);
        ticketNodes.set(entry.id, node);
      }
      const position = orderTicketPosition({
        index: game.orders.indexOf(order),
        count: game.orders.length,
        x: entry.counterLabelX,
        y: entry.counterLabelY,
        view: world.viewCurrent,
        width: innerWidth,
        height: innerHeight,
      });
      node.hidden =
        game.status === "ready" ||
        game.status === "ended" ||
        (!entry.arrived && position.blend < 0.05);
      node.dataset.docked = position.blend > 0.5;
      node.style.left = `${position.x}px`;
      node.style.top = `${position.y}px`;
      node.style.setProperty("--dock", position.blend);
      const urgency = customerPhase(order);
      node.dataset.urgency = urgency;
      const ticket = `<div class="ticket-name"><span>${order.name}<small class="ticket-countdown">${Math.max(0, Math.ceil(order.remaining))}s</small></span>${icon(order.takeaway ? "bag" : "bowl")}</div><div class="ticket-foods">${order.items.map(orderFood).join("")}</div>${urgency !== "patient" ? `<div class="ticket-warning">${icon("clock")} <strong>${Math.max(0, Math.ceil(order.remaining))}s</strong> ${urgency === "critical" ? "LAST CALL!" : "LEAVING SOON"}</div>` : ""}<div class="patience"><span style="width:${Math.max(0, Math.round((order.remaining / order.patience) * 100))}%;background:${order.remaining / order.patience < 0.25 ? "#d98556" : "#8da76b"}"></span></div>`;
      if (node.dataset.content !== ticket) {
        node.innerHTML = ticket;
        node.dataset.content = ticket;
      }
      const speech = speechStates.get(entry.id);
      let bubble = speechNodes.get(entry.id);
      if (speech && speech.until > game.elapsed) {
        if (!bubble) {
          bubble = document.createElement("div");
          bubble.className = "npc-bubble";
          bubble.dataset.speechCustomer = entry.id;
          $("npc-speech").append(bubble);
          speechNodes.set(entry.id, bubble);
        }
        bubble.textContent = speech.text;
        bubble.dataset.urgent = speech.urgent;
        bubble.hidden =
          !entry.visible || game.status === "ready" || game.status === "ended";
        bubble.style.left = `${Math.max(100, Math.min(innerWidth - 100, entry.labelX))}px`;
        bubble.style.top = `${entry.labelY + 10}px`;
      } else if (bubble) {
        bubble.remove();
        speechNodes.delete(entry.id);
      }
    }
    if (entry.kind === "board") {
      let node = timerNodes.get("board");
      if (!node) {
        node = document.createElement("div");
        node.className = "world-timer board-progress";
        $("equipment-labels").append(node);
        timerNodes.set("board", node);
      }
      node.hidden =
        !entry.visible || game.status === "ready" || game.status === "ended";
      node.textContent = game.chop.loaded
        ? `CHOP ${game.chop.cuts}/3`
        : `${game.choppedVegetables} greens ready`;
      node.style.left = `${entry.labelX}px`;
      node.style.top = `${entry.labelY - 35}px`;
    }
    if (
      entry.kind === "pot" ||
      entry.kind === "grill" ||
      entry.kind === "coffee"
    ) {
      const job =
        entry.kind === "coffee"
          ? null
          : game.jobs.find(
              (j) =>
                j.type === (entry.kind === "grill" ? "toast" : "noodles") &&
                j.slot === (entry.slot ?? 0),
            );
      let node = timerNodes.get(entry.name);
      if (!node) {
        node = document.createElement("div");
        node.className = "world-timer";
        $("equipment-labels").append(node);
        timerNodes.set(entry.name, node);
      }
      const show =
        job ||
        (entry.kind === "coffee" &&
          (game.pouring || game.refill || game.status === "running"));
      node.hidden = !entry.visible || !show || !!job;
      node.style.left = `${entry.labelX}px`;
      node.style.top = `${entry.labelY - 28}px`;
      node.classList.toggle("perfect", !!job && job.time >= 2 && job.time <= 4);
      node.classList.toggle("burning", !!job && job.time > 4);
      const text = job
        ? `${job.quantity > 1 ? `${job.quantity}× · ` : ""}${job.time.toFixed(1)}s ${job.time >= 2 && job.time <= 4 ? "✓" : job.time > 4 ? "!" : ""}`
        : game.pouring
          ? `Pouring ${game.pouring.toFixed(1)}s`
          : game.refill
            ? `Brewing ${game.refill.toFixed(1)}s`
            : `${game.kopi}/5 cups`;
      if (node.textContent !== text) node.textContent = text;
    }
    if (["basket", "grill-toast"].includes(entry.kind)) {
      const job = game.jobs.find((j) => j.id === entry.id);
      if (job) {
        let node = cookCueNodes.get(job.id);
        if (!node) {
          node = document.createElement("button");
          node.className = "cook-cue";
          node.dataset.cookId = job.id;
          $("cook-cues").append(node);
          cookCueNodes.set(job.id, node);
        }
        const phase = cookPhase(job.time),
          ready = job.time >= 2,
          burnt = phase === "burnt";
        const label = burnt
          ? "BIN IT"
          : phase === "burning"
            ? "SAVE IT!"
            : ready
              ? "LIFT NOW"
              : "COOKING";
        const countdown = burnt
          ? "Burnt"
          : ready
            ? job.time <= 4
              ? `${Math.max(0, 4 - job.time).toFixed(1)}s perfect`
              : `${Math.max(0, 6 - job.time).toFixed(1)}s to burn`
            : `${Math.max(0, 2 - job.time).toFixed(1)}s`;
        node.dataset.phase = phase;
        node.dataset.cookObject = entry.name;
        node.disabled = game.status !== "running";
        node.hidden = game.status === "ready" || game.status === "ended";
        node.classList.toggle("offscreen", !entry.visible);
        let cueX = Math.max(80, Math.min(innerWidth - 80, entry.x));
        let cueY = Math.max(
          innerWidth < 650 ? 210 : 185,
          Math.min(innerHeight - 160, entry.y - 15),
        );
        if (!entry.visible) {
          const side = entry.x < innerWidth / 2 ? "left" : "right",
            index = pinnedCounts[side]++;
          cueX = side === "left" ? 80 : innerWidth - 80;
          cueY = innerHeight < 540 ? 230 : 275;
          if (innerHeight < 540)
            cueX += (side === "left" ? 1 : -1) * index * 100;
          else cueY += index * 130;
        }
        // Keep cues distinct even if one cooker is just inside the camera edge.
        for (const placed of placedCues) {
          if (
            Math.abs(cueX - placed.x) >= 120 ||
            Math.abs(cueY - placed.y) >= 140
          )
            continue;
          if (innerHeight >= 540 && placed.y + 150 <= innerHeight - 130)
            cueY = placed.y + 150;
          else
            cueX =
              placed.x + 140 <= innerWidth - 70
                ? placed.x + 140
                : placed.x - 140;
        }
        placedCues.push({ x: cueX, y: cueY });
        const area = world.getWorkRect();
        cueX = Math.max(area.left + 75, Math.min(area.right - 75, cueX));
        cueY = Math.max(area.top + 125, Math.min(area.bottom - 15, cueY));
        node.style.left = `${cueX}px`;
        node.style.top = `${cueY}px`;
        node.setAttribute(
          "aria-label",
          `${job.type === "toast" ? "Toast" : "Noodles"}: ${label}, ${countdown}. Drag this icon to ${burnt ? "the bin" : "an empty plating spot"}.`,
        );
        const content = `<span class="cook-cue-icon">${icon(burnt ? "trash" : ready ? "lift" : "clock")}<span class="cue-food">${icon(job.type === "toast" ? "toast" : "bowl")}</span></span><strong>${label}${job.quantity > 1 ? ` · ${job.quantity}×` : ""}</strong><span class="cue-countdown">${countdown}</span>${!entry.visible ? "<small>↔ PREP</small>" : ""}`;
        if (node.dataset.content !== content) {
          node.innerHTML = content;
          node.dataset.content = content;
        }
      }
    }
    if (entry.kind === "plate" || entry.kind === "prepared") {
      const portion = [...game.plates, ...game.holding].find(
        (p) => p.id === entry.id,
      );
      if (portion) {
        let node = freshnessNodes.get(entry.name);
        if (!node) {
          node = document.createElement("div");
          node.className = "world-freshness";
          node.innerHTML = "<span></span>";
          $("equipment-labels").append(node);
          freshnessNodes.set(entry.name, node);
        }
        node.hidden = !entry.visible;
        node.style.left = `${entry.x}px`;
        node.style.top = `${entry.y + 24}px`;
        const fill = node.firstElementChild;
        node.style.top = `${entry.y + 44}px`;
        fill.style.width = `${Math.max(0, 1 - portion.age / game.freshTime) * 100}%`;
        fill.style.background =
          portion.quality === 0
            ? "#b8704a"
            : portion.age > game.freshTime
              ? "#c99b58"
              : "#a6ba79";
        let status = finishNodes.get(entry.name);
        if (!status) {
          status = document.createElement("div");
          status.className = "dish-finish-status";
          $("equipment-labels").append(status);
          finishNodes.set(entry.name, status);
        }
        status.hidden = !entry.visible;
        status.style.left = `${entry.x}px`;
        status.style.top = `${entry.y + 18}px`;
        status.dataset.incomplete =
          (portion.type === "toast" && !portion.kaya) ||
          (portion.type === "noodles" && !portion.garnish);
        status.textContent =
          portion.type === "toast"
            ? portion.kaya
              ? "KAYA ✓"
              : "KAYA NEEDED"
            : portion.type === "noodles"
              ? portion.garnish
                ? "GREENS ✓"
                : "GREENS NEEDED"
              : `${portion.milk ? "MILK ✓" : "BLACK"} · ${portion.sugar ? "SUGAR ✓" : "NO SUGAR"}`;
      }
    }
  }
  for (const [name, node] of hotspotNodes)
    if (!active.has(name)) {
      node.remove();
      hotspotNodes.delete(name);
    }
  for (const [id, node] of ticketNodes)
    if (!game.orders.some((o) => o.id === id)) {
      node.remove();
      ticketNodes.delete(id);
    }
  for (const [name, node] of freshnessNodes)
    if (!active.has(name)) {
      node.remove();
      freshnessNodes.delete(name);
    }
  for (const [id, node] of cookCueNodes)
    if (!game.jobs.some((j) => j.id === id)) {
      node.remove();
      cookCueNodes.delete(id);
    }
  for (const [name, node] of finishNodes)
    if (!active.has(name)) {
      node.remove();
      finishNodes.delete(name);
    }
  for (const [id, node] of speechNodes)
    if (!game.orders.some((o) => o.id === id)) {
      node.remove();
      speechNodes.delete(id);
      speechStates.delete(id);
    }
}
function hover(info, { x, y, holding }) {
  const tooltip = $("object-tooltip");
  tooltip.classList.toggle(
    "visible",
    !!info && game.status !== "ready" && !modal,
  );
  if (info) {
    const portion = [...game.plates, ...game.holding].find(
      (p) => p.id === info.id && ["plate", "prepared"].includes(info.kind),
    );
    const freshness = portion
      ? portion.quality === 0
        ? " · Burnt"
        : portion.age > game.freshTime
          ? " · Cooling"
          : ` · ${Math.ceil(game.freshTime - portion.age)}s fresh`
      : "";
    tooltip.textContent = holding
      ? `Drop here · ${info.label.split(" · ")[0]}`
      : info.label + freshness;
    tooltip.style.left = `${Math.max(120, Math.min(innerWidth - 180, x))}px`;
    tooltip.style.top = `${Math.max(100, Math.min(innerHeight - 130, y - 35))}px`;
  }
}
function modalBody(type) {
  if (type === "help")
    return `<span class="modal-kicker">YOUR FIRST SHIFT AT AH HUAT’S</span><h2>Hands on.<br><em>Heart in.</em></h2><div class="how-grid"><article><span class="how-icon">${icon("bowl")}</span><h3>Chop your greens</h3><p>Look left. Drag fresh greens onto the board. Pick up the cleaver and tap the board three times; one batch makes three portions. Drag chopped greens onto each noodle bowl.</p></article><article><span class="how-icon">${icon("clock")}</span><h3>Lift at 2–4 seconds</h3><p>Drag the basket out of the pot and into an empty bowl. Extra portions stay on the prep tray. Drag them into bowls when you need them.</p></article><article><span class="how-icon">${icon("chilli")}</span><h3>Toast, then kaya</h3><p>Toast bread for 2–4 seconds, then lift it. It is still plain! Dip the spreader into the kaya jar and spread it on the cooked toast. Kaya is required before serving.</p></article><article><span class="how-icon">${icon("heart")}</span><h3>Hand it over</h3><p>Drag a finished dish directly to the customer who wants it. Families accept dishes one at a time. Hold Shift while serving to accept a wrong preference for less satisfaction.</p></article></div><div class="other-recipes"><span>${icon("toast")} <strong>Toast:</strong> bread → grill → wait 2–4s → lift → dip knife into kaya → spread onto toast. You can spread on the prep tray or at a plating spot.</span><span>${icon("coffee")} <strong>Kopi:</strong> cup → urn → wait 2s. Black coffee appears beside the urn. Add milk and sugar as shown on the ticket, then move it to centre plating and serve. Kettle → urn to refill.</span><span>${icon("trash")} Slightly overcooked food is edible. Burnt food goes in the bin. Prepared food stays fresh for ${game.freshTime}s. A customer leaving costs 5 satisfaction percentage points; their remaining order is a missed sale.</span></div><div class="keyboard-row"><span><kbd>A</kbd> <kbd>D</kbd> / <kbd>←</kbd> <kbd>→</kbd> Look around</span><span><kbd>P</kbd> Pause</span><span><kbd>Esc</kbd> Put down</span></div><p class="tap-note">You can also tap an object to pick it up, then tap its destination. Tab + Enter works on the kitchen objects too.</p><button class="play-button" data-action="close">Got it, boss ${icon("arrow")}</button>`;
  if (type === "pause")
    return `<span class="modal-kicker">TAKE A LITTLE BREATHER</span><h2>Kopi <em>break.</em></h2><p class="modal-copy">Your kitchen can wait. We’ve paused the rush.</p><button class="play-button" data-action="close">Back to the stall ${icon("play")}</button><button class="secondary-button" data-action="help">How to play</button><button class="restart-button" data-action="restart">Restart this shift</button>`;
  if (type === "results")
    return `<span class="modal-kicker">DAY ${game.day} · LUNCH SERVICE COMPLETE</span><div class="result-stars">${game.served >= 8 ? "★ ★ ★" : game.served >= 5 ? "★ ★ ☆" : game.served >= 2 ? "★ ☆ ☆" : "☆ ☆ ☆"}</div><h2>${game.served >= 8 ? "Shiok shift, <em>boss!</em>" : "Made with <em>heart.</em>"}</h2><div class="result-stats"><div><strong>${game.served}</strong><span>orders served</span></div><div><strong>${cash(game.earnings)}</strong><span>today’s takings</span></div><div><strong>${Math.round(game.rating * 100)}%</strong><span>satisfaction</span></div></div><p class="modal-copy">Best streak: ${game.bestStreak} · ${game.lost} customers had to go.<br>${cash(game.missedRevenue)} in missed sales · earned money stays yours.<br>Your next lunch rush is a fresh start.</p><button class="play-button" data-action="upgrades">A little stall upgrade ${icon("upgrade")}</button><button class="secondary-button" data-action="next">See you tomorrow ${icon("arrow")}</button>`;
  return `<span class="modal-kicker">SMALL CHANGES. BIG POSSIBILITIES.</span><h2>Your stall,<br><em>your way.</em></h2><p class="modal-copy">Stall savings: <strong>${cash(game.wallet)}</strong></p><div class="upgrade-grid">${UPGRADES.map((u) => `<article>${icon(u.icon)}<h3>${u.name}</h3><p>${u.description}</p><button class="secondary-button" data-action="buy" data-id="${u.id}" ${game.upgrades.includes(u.id) || game.wallet < u.price ? "disabled" : ""}>${game.upgrades.includes(u.id) ? "✓ Installed" : `Install · ${cash(u.price)}`}</button></article>`).join("")}</div><button class="play-button" data-action="next">Back tomorrow ${icon("arrow")}</button>`;
}
function openModal(type) {
  if (!modal) {
    resumeAfterModal = game.status === "running";
    if (resumeAfterModal) game.pause();
    world?.cancelPick();
  }
  modal = type;
  $("modal-root").innerHTML =
    `<div class="modal-backdrop"><section class="game-modal ${["pause", "results"].includes(type) ? "compact" : ""}" role="dialog" aria-modal="true" aria-labelledby="modal-title">${game.status === "ended" ? "" : `<button class="modal-close" data-action="close" aria-label="Close dialog">${icon("close")}</button>`}${modalBody(type)}</section></div>`;
  $("modal-root").querySelector("h2").id = "modal-title";
  $("modal-root")
    .querySelector("button:not([disabled])")
    ?.focus({ preventScroll: true });
  renderUi();
}
function closeModal() {
  if (game.status === "ended") return;
  const resume = resumeAfterModal || modal === "pause";
  modal = null;
  resumeAfterModal = false;
  $("modal-root").innerHTML = "";
  if (resume && game.status === "paused") game.pause();
  renderUi();
  world?.renderer.domElement.focus({ preventScroll: true });
}
function restart(next = false) {
  if (next) save();
  game = freshGame(next ? game.day + 1 : game.day);
  if (next) save();
  controls = new StallInteractions(game);
  effects?.clear();
  speechStates.clear();
  for (const node of speechNodes.values()) node.remove();
  speechNodes.clear();
  for (const node of cookCueNodes.values()) node.remove();
  cookCueNodes.clear();
  world.reset();
  world.sync(game);
  world.setView(0);
  cache.clear();
  modal = null;
  lastState = "ready";
  $("modal-root").innerHTML = "";
  renderUi();
}
function act(action, button) {
  switch (action) {
    case "start":
      game.start();
      sound();
      renderUi();
      break;
    case "help":
      openModal("help");
      break;
    case "pause":
      if (game.status === "running") openModal("pause");
      else if (game.status === "paused") closeModal();
      break;
    case "close":
      closeModal();
      break;
    case "sound":
      muted = !muted;
      audio.setMuted(muted);
      save();
      sound();
      renderUi();
      break;
    case "music":
      musicEnabled = !musicEnabled;
      audio.setMusicEnabled(musicEnabled);
      if (musicEnabled) audio.unlock();
      save();
      renderUi();
      break;
    case "chatter":
      chatterEnabled = !chatterEnabled;
      audio.setChatterEnabled(chatterEnabled);
      if (chatterEnabled) audio.unlock();
      save();
      renderUi();
      break;
    case "look-left":
      setView(world.view - 1);
      break;
    case "look-right":
      setView(world.view + 1);
      break;
    case "view":
      setView(Number(button.dataset.view));
      break;
    case "restart":
      restart();
      break;
    case "next":
      restart(true);
      break;
    case "upgrades":
      openModal("upgrades");
      break;
    case "buy":
      if (game.buy(button.dataset.id)) {
        save();
        openModal("upgrades");
        world.sync(game);
        sound(true);
      }
      break;
    case "fullscreen":
      if (document.fullscreenElement) document.exitFullscreen?.();
      else
        $("app")
          .requestFullscreen?.()
          .catch(() => {});
      break;
  }
}
document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (button && !button.disabled) act(button.dataset.action, button);
});
document.addEventListener("pointerdown", (event) => {
  const cue = event.target.closest("[data-cook-object]");
  if (!cue || cue.disabled || modal) return;
  event.preventDefault();
  world.beginObjectDrag(cue.dataset.cookObject, event);
});
document.addEventListener("keydown", (event) => {
  if (modal) {
    if (event.key === "Escape") closeModal();
    if (event.key === "Tab") {
      const nodes = [
          ...$("modal-root").querySelectorAll("button:not([disabled])"),
        ],
        first = nodes[0],
        last = nodes.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    return;
  }
  if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
  const key = event.key.toLowerCase();
  if (["a", "arrowleft", "d", "arrowright"].includes(key)) {
    event.preventDefault();
    setView(world.view + (["a", "arrowleft"].includes(key) ? -1 : 1));
  }
  if (key === "p" || (key === " " && event.target.tagName !== "BUTTON")) {
    event.preventDefault();
    act("pause");
  }
  if (key === "escape") world.cancelPick();
  if (key === "?") openModal("help");
  const objectName =
    event.target.dataset.worldObject || event.target.dataset.cookObject;
  if (objectName && ["enter", " "].includes(key)) {
    event.preventDefault();
    const object = world.objects.get(objectName),
      info = object?.userData.interaction;
    if (!info) return;
    if (
      world.held &&
      (controls.accepts(world.held.info, info) || info.kind === "customer")
    ) {
      drop(world.held.info, info, { imperfect: event.shiftKey });
      if (!world.keepTool(world.held.info, info)) world.cancelPick();
    } else if (info.draggable) world.pick({ object, info });
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && game.status === "running") openModal("pause");
});

try {
  world = new StallScene($("world"), {
    onProject: project,
    onHover: hover,
    onDrop: drop,
    onLift: (source) => controls.pickCooked(source),
    accepts: (source, target) => controls.accepts(source, target),
    onPick: (info) => {
      selected = info;
      if (!info) $("object-tooltip").classList.remove("visible");
      $("drag-label").textContent = info
        ? `HOLDING · ${info.label.split(" · ")[0]}`
        : "";
      $("drag-label").classList.toggle("visible", !!info);
      renderUi();
    },
    onCamera: (value) => {
      $("app").dataset.view = ["left", "centre", "right"][value + 1];
      applyLayout();
      $("view-caption").textContent = [
        "LEFT · INGREDIENTS & COOKING",
        "CENTRE · CUSTOMERS & PLATING",
        "RIGHT · KOPI & TAKEAWAY",
      ][value + 1];
      const left = document.querySelector(".look-left"),
        right = document.querySelector(".look-right");
      left.disabled = value === -1;
      right.disabled = value === 1;
      left.querySelector("small").textContent =
        value === 1 ? "COUNTER" : "COOK";
      right.querySelector("small").textContent =
        value === -1 ? "COUNTER" : "KOPI";
      document
        .querySelectorAll(".camera-compass button")
        .forEach((b) =>
          b.classList.toggle(
            "selected",
            Math.abs(Number(b.dataset.view) - value) < 0.45,
          ),
        );
    },
  });
  effects = new FeedbackEffects($("feedback-layer"), world);
  world.sync(game);
  renderUi();
  const frame = (now) => {
    const dt = Math.min((now - previous) / 1000, 0.25);
    previous = now;
    game.tick(dt);
    world.sync(game);
    world.update(dt);
    if (now - lastUi > 100 || game.status !== lastState) {
      renderUi();
      lastUi = now;
    }
    if (now > noticeUntil) {
      $("notice").classList.remove("visible");
      document.body.classList.remove("has-notice");
    }
    animation = requestAnimationFrame(frame);
  };
  animation = requestAnimationFrame(frame);
} catch (error) {
  console.error(error);
  $("world").innerHTML =
    `<div class="webgl-error"><h2>Your stall needs WebGL.</h2><p>Enable hardware acceleration in your browser, then reload to enter the 3D hawker centre.</p></div>`;
  $("intro").hidden = true;
}
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    window.removeEventListener("resize", applyLayout);
    cancelAnimationFrame(animation);
    audio.dispose();
    effects?.clear();
    world?.dispose();
  });
