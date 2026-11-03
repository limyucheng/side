import { icon } from "./art.js";

const cash = (value) => `$${value.toFixed(2)}`;
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );

export class FeedbackEffects {
  constructor(root, world) {
    this.root = root;
    this.world = world;
    this.timers = new Set();
    this.cards = new Map();
    this.reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  later(callback, delay) {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      callback();
    }, delay);
    this.timers.add(timer);
  }
  point(orderId) {
    const p = this.world.customerAnchor(orderId) || {
      x: innerWidth / 2,
      y: innerHeight * 0.45,
    };
    return {
      x: Math.max(105, Math.min(innerWidth - 105, p.x)),
      y: Math.max(185, Math.min(innerHeight - 150, p.y)),
    };
  }
  card(event, type, content, duration = 2700) {
    this.clearCards();
    const node = document.createElement("div"),
      point = this.point(event.orderId);
    node.className = `feedback-card ${type}`;
    node.dataset.feedback = event.feedback;
    node.dataset.orderId = event.orderId;
    node.setAttribute("aria-hidden", "true"); // The main status region announces the same outcome.
    node.style.setProperty("--life", `${duration}ms`);
    if (this.reducedMotion) node.style.animation = "none";
    node.innerHTML = content;
    this.root.append(node);
    this.cards.set(event.orderId, node);
    document.body.classList.add("has-feedback");
    this.later(() => {
      node.remove();
      if (this.cards.get(event.orderId) === node)
        this.cards.delete(event.orderId);
      if (!this.cards.size) document.body.classList.remove("has-feedback");
    }, duration);
    return point;
  }
  pulse(element, loss = false) {
    if (!element || this.reducedMotion) return;
    element.animate(
      [
        { transform: "scale(1)", filter: "brightness(1)" },
        {
          transform: `scale(${loss ? 1.06 : 1.25})`,
          filter: "brightness(1.5)",
          color: loss ? "#ffb095" : "#ffe5a4",
          offset: 0.25,
        },
        { transform: "scale(1)", filter: "brightness(1)" },
      ],
      { duration: loss ? 650 : 520, easing: "ease-out" },
    );
  }
  coins(point, count) {
    if (this.reducedMotion) return;
    const hud = document.getElementById("coins").getBoundingClientRect();
    const dx = hud.x + hud.width / 2 - point.x,
      dy = hud.y + hud.height / 2 - point.y;
    for (let i = 0; i < count; i++) {
      const coin = document.createElement("span");
      coin.className = "flying-coin";
      coin.textContent = "$";
      coin.setAttribute("aria-hidden", "true");
      const angle = (i * Math.PI * 2) / count;
      coin.style.left = `${point.x}px`;
      coin.style.top = `${point.y}px`;
      coin.style.setProperty(
        "--scatter-x",
        `${Math.cos(angle) * (40 + (i % 3) * 13)}px`,
      );
      coin.style.setProperty("--scatter-y", `${Math.sin(angle) * 40 - 55}px`);
      coin.style.setProperty("--coin-x", `${dx}px`);
      coin.style.setProperty("--coin-y", `${dy}px`);
      coin.style.animationDelay = `${i * 22}ms`;
      this.root.append(coin);
      this.later(() => coin.remove(), 1350 + i * 22);
    }
  }
  handle(event) {
    if (["order-served", "dish-served"].includes(event.feedback)) {
      const complete = event.feedback === "order-served";
      const point = this.card(
        event,
        complete ? "sale complete" : "sale",
        `
        <span class="feedback-kicker">${icon(complete ? "star" : "check")} ${complete ? (event.streak >= 3 ? "ON FIRE, BOSS!" : "SHIOK!") : "NICE ONE!"}</span>
        <strong class="reward-amount">+${cash(event.amount)}</strong>
        <span class="reward-detail">${event.tip ? `${cash(event.baseAmount)} meal + ${cash(event.tip)} tip` : "Meal paid"}</span>
        ${complete ? `<span class="streak-reward">${icon("spark")} ${event.streak > 1 ? `${event.streak} ORDER STREAK` : "ORDER COMPLETE"}</span>` : `<span class="remaining-dishes">Still to come: ${escape(event.remaining.join(" + "))}</span>`}
      `,
      );
      this.coins(point, complete ? 12 + Math.min(event.streak, 5) * 2 : 7);
      this.pulse(document.getElementById("coins"));
      if (complete) this.pulse(document.getElementById("score"));
      this.world.react(event.orderId, "happy");
    } else if (event.feedback === "serve-rejected") {
      this.card(
        event,
        "rejected",
        `<span class="feedback-kicker">${icon("close")} CHECK THE ORDER</span><strong class="rejection-reason">${escape(event.text)}</strong><span class="reward-detail">Dish kept · fix it and try again</span>`,
        2400,
      );
      this.world.react(event.orderId, "wrong");
    } else if (event.feedback === "customer-left") {
      this.card(
        event,
        "customer-loss",
        `<span class="feedback-kicker">${icon("heartbreak")} CUSTOMER LEFT</span><strong class="missed-amount">${cash(event.missedRevenue)} <small>missed sale</small></strong><span class="satisfaction-loss">−${Math.round(event.satisfactionLost * 100)}pp satisfaction</span>${event.streakLost ? `<span class="lost-streak">${event.streakLost}-order streak ended</span>` : ""}`,
        3800,
      );
      this.pulse(document.getElementById("queue-state"), true);
      this.world.react(event.orderId, "sad");
    }
  }
  clear() {
    this.clearCards();
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
    this.cards.clear();
    this.root.replaceChildren();
  }
  clearCards() {
    for (const node of this.cards.values()) node.remove();
    this.cards.clear();
    document.body.classList.remove("has-feedback");
  }
}
