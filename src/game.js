export const DISHES = {
  noodles: { name: "Bak chor mee", price: 5.5, short: "Mee" },
  toast: { name: "Kaya toast", price: 3.2, short: "Toast" },
  kopi: { name: "Kopi", price: 1.8, short: "Kopi" },
};
export const UPGRADES = [
  {
    id: "basket",
    name: "Second noodle basket",
    description: "Cook a second noodle batch while the main burner is busy.",
    price: 25,
    icon: "bowl",
  },
  {
    id: "tray",
    name: "Larger preparation tray",
    description: "Cook up to 4 portions per batch instead of 3.",
    price: 18,
    icon: "stall",
  },
  {
    id: "insulation",
    name: "Insulated holding area",
    description: "Keep prepared food fresh twice as long.",
    price: 20,
    icon: "spark",
  },
  {
    id: "plating",
    name: "Extra plating space",
    description: "Make room for a third finished dish on the counter.",
    price: 22,
    icon: "bowl",
  },
];
const clamp = (n, min, max) => Math.max(min, Math.min(n, max));
export const LOST_CUSTOMER_PENALTY = 0.05;
export function orderPatience(type, items, takeaway = false) {
  const base = { office: 70, regular: 80, family: 90 }[type] ?? 70;
  const preparation = items.reduce(
    (seconds, item) =>
      seconds +
      ({ noodles: 35, toast: 25, kopi: 30 }[item.type] ?? 25) +
      (item.chilli ? 5 : 0) +
      (item.type === "kopi"
        ? (item.milk !== false ? 6 : 0) + (item.sugar !== false ? 6 : 0)
        : 0),
    0,
  );
  return (
    base +
    preparation +
    Math.max(0, items.length - 1) * 15 +
    (takeaway ? items.length * 10 : 0)
  );
}
export const cookPhase = (time) =>
  time < 2
    ? "cooking"
    : time < 3.25
      ? "ready"
      : time <= 4
        ? "hurry"
        : time < 6
          ? "burning"
          : "burnt";
export const customerPhase = (order) =>
  order.remaining <= 5
    ? "critical"
    : order.remaining <= Math.min(15, order.patience * 0.25)
      ? "impatient"
      : "patient";
export class HawkerGame {
  constructor({
    upgrades = [],
    day = 1,
    wallet = 0,
    random = Math.random,
  } = {}) {
    this.random = random;
    this.upgrades = [...upgrades];
    this.day = day;
    this.wallet = wallet;
    this.status = "ready";
    this.elapsed = 0;
    this.duration = 240;
    this.earnings = 0;
    this.served = 0;
    this.lost = 0;
    this.missedRevenue = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.satisfaction = [];
    this.jobs = [];
    this.holding = [];
    this.plates = [];
    this.kopi = 5;
    this.refill = 0;
    this.pouring = 0;
    this.chop = { loaded: false, cuts: 0, cooldown: 0 };
    this.choppedVegetables = 0;
    this.knifeLoaded = false;
    this.batch = 1;
    this.selectedPlate = null;
    this.nextId = 1;
    this.arrival = 0;
    this.events = [];
    this.orders = [
      this.makeOrder("office", 0),
      this.makeOrder("regular", 1),
      this.makeOrder("family", 2),
    ];
    this.selectedOrder = this.orders[0].id;
  }
  get maxBatch() {
    return this.upgrades.includes("tray") ? 4 : 3;
  }
  get maxPlates() {
    return this.upgrades.includes("plating") ? 3 : 2;
  }
  get freshTime() {
    return this.upgrades.includes("insulation") ? 40 : 20;
  }
  get rating() {
    const servedRating = this.satisfaction.length
      ? this.satisfaction.reduce((a, b) => a + b, 0) / this.satisfaction.length
      : 1;
    return Math.max(0, servedRating - this.lost * LOST_CUSTOMER_PENALTY);
  }
  event(text, kind = "info", detail = {}) {
    this.events.push({ text, kind, ...detail });
  }
  rejectServe(orderId, text, reason = "incomplete") {
    this.event(text, "error", { feedback: "serve-rejected", orderId, reason });
    return false;
  }
  makeOrder(type, initial = -1) {
    const id = this.nextId++;
    const regular = type === "regular";
    const takeaway = type === "family" || (initial < 0 && this.random() > 0.7);
    let items;
    if (initial === 0) items = [{ type: "noodles", chilli: true }];
    else if (regular) items = [{ type: "toast" }, { type: "kopi" }];
    else if (type === "family")
      items = [
        { type: "noodles", chilli: true },
        { type: "noodles", chilli: false },
      ];
    else {
      const choice = this.random();
      items = [
        {
          type: choice < 0.55 ? "noodles" : choice < 0.8 ? "toast" : "kopi",
          chilli: this.random() > 0.5,
          milk: this.random() > 0.25,
          sugar: this.random() > 0.25,
        },
      ];
    }
    const patience = orderPatience(type, items, takeaway);
    return {
      id,
      type,
      name:
        type === "office"
          ? "Office worker"
          : regular
            ? "Uncle Lim"
            : "Family of two",
      takeaway,
      patience,
      remaining: patience,
      items: items.map((item) => ({
        ...item,
        chilli: item.type === "noodles" && !!item.chilli,
        milk: item.type === "kopi" && item.milk !== false,
        sugar: item.type === "kopi" && item.sugar !== false,
        served: false,
      })),
    };
  }
  start() {
    if (this.status === "ready") {
      this.status = "running";
      this.event("Stall open! Select an order and let’s cook.", "success");
    }
  }
  pause() {
    if (this.status === "running") this.status = "paused";
    else if (this.status === "paused") this.status = "running";
  }
  canAct() {
    if (this.status !== "running") {
      this.event(
        this.status === "ready"
          ? "Open your stall to start cooking."
          : "Resume your shift to keep cooking.",
      );
      return false;
    }
    return true;
  }
  startCook(type, preferredSlot = null) {
    if (!this.canAct()) return false;
    const primaryBusy = this.jobs.some((j) => j.slot === 0);
    let slot =
      primaryBusy &&
      type === "noodles" &&
      this.upgrades.includes("basket") &&
      !this.jobs.some((j) => j.slot === 1)
        ? 1
        : 0;
    if (preferredSlot !== null) {
      if (
        ![0, 1].includes(preferredSlot) ||
        (preferredSlot === 1 &&
          (type !== "noodles" || !this.upgrades.includes("basket")))
      )
        return false;
      slot = preferredSlot;
    }
    if (this.jobs.some((j) => j.slot === slot)) {
      this.event("The burner is busy. Finish the current dish first.");
      return false;
    }
    if (
      this.holding.length +
        this.jobs.reduce((n, j) => n + j.quantity, 0) +
        (type === "noodles" ? this.batch : 1) >
      this.maxBatch + 2
    ) {
      this.event("Preparation tray is full. Plate or discard a portion first.");
      return false;
    }
    this.jobs.push({
      id: this.nextId++,
      type,
      slot,
      time: 0,
      quantity: type === "noodles" ? this.batch : 1,
    });
    return true;
  }
  addPortion(jobId) {
    if (!this.canAct()) return false;
    const job = this.jobs.find((j) => j.id === jobId && j.type === "noodles");
    if (!job) return false;
    if (job.time >= 2) {
      this.event(
        "These noodles are ready. Lift this batch before adding more.",
      );
      return false;
    }
    if (job.quantity >= this.maxBatch) {
      this.event(
        `This basket holds ${this.maxBatch} portions. Lift the batch when ready.`,
      );
      return false;
    }
    if (
      this.holding.length + this.jobs.reduce((n, j) => n + j.quantity, 0) >=
      this.maxBatch + 2
    ) {
      this.event("The preparation tray is full. Serve a dish first.");
      return false;
    }
    job.quantity++;
    job.time = 0;
    return true;
  }
  finishCook(type, jobId) {
    if (this.status !== "running") return false;
    const job = this.jobs.find(
      (j) => j.type === type && (jobId == null || j.id === jobId),
    );
    if (!job) return false;
    if (job.time < 2) {
      this.event(
        type === "noodles"
          ? "A little longer! Give the noodles at least 2 seconds."
          : "The bread needs 2 seconds to toast.",
      );
      return false;
    }
    const quality = job.time <= 4 ? 1 : job.time < 6 ? 0.7 : 0;
    this.jobs = this.jobs.filter((j) => j !== job);
    for (let i = 0; i < job.quantity; i++)
      this.holding.push({
        id: this.nextId++,
        type,
        quality,
        age: 0,
        kaya: false,
        garnish: false,
        chilli: false,
        milk: false,
        sugar: false,
        takeaway: false,
      });
    this.event(
      quality === 1
        ? `${job.quantity > 1 ? `${job.quantity} portions, one cook. Shiok!` : type === "toast" ? "Golden plain toast. Add kaya before serving." : "Springy noodles. Add chopped greens to finish."}`
        : quality
          ? "A little overdone, still good to serve."
          : "Burnt! Discard this batch and try again.",
      quality === 1 ? "success" : "info",
    );
    return true;
  }
  plate(id, preferredSlot = null) {
    if (!this.canAct()) return false;
    const portion = this.holding.find((p) => p.id === id);
    if (!portion) return false;
    if (portion.quality === 0) {
      this.event("This portion is burnt. Use the bin to clear it.");
      return false;
    }
    if (this.plates.length >= this.maxPlates) {
      this.event("Plating counter is full. Serve a dish to make space.");
      return false;
    }
    const slot =
      preferredSlot ??
      Array.from({ length: this.maxPlates }, (_, i) => i).find(
        (i) => !this.plates.some((p) => p.slot === i),
      );
    if (
      !Number.isInteger(slot) ||
      slot < 0 ||
      slot >= this.maxPlates ||
      this.plates.some((p) => p.slot === slot)
    ) {
      this.event("That plating spot is occupied. Use an empty bowl.");
      return false;
    }
    this.holding = this.holding.filter((p) => p.id !== id);
    this.plates.push({
      chilli: false,
      takeaway: false,
      garnish: false,
      correction: 0,
      ...portion,
      slot,
    });
    this.selectedPlate = portion.id;
    return true;
  }
  toggle(option) {
    if (!this.canAct()) return;
    const plate = this.plates.find((p) => p.id === this.selectedPlate);
    if (!plate) {
      this.event("Plate a dish, then select it to customise.");
      return;
    }
    if (option === "garnish") {
      if (plate.garnish) {
        plate.garnish = false;
        this.choppedVegetables++;
        plate.correction = 1;
        return true;
      }
      return this.addIngredient(plate.id, "garnish");
    }
    if (option !== "takeaway" && plate.type !== "noodles") {
      this.event("Chilli and spring onion are for the noodles.");
      return;
    }
    if (plate.correction > 0) return;
    if (plate[option] && option !== "takeaway") {
      plate.correction = 1;
      this.event("Topping removed. One second to tidy the bowl.");
    }
    plate[option] = !plate[option];
  }
  loadVegetables() {
    if (!this.canAct()) return false;
    if (this.chop.loaded) {
      this.event("Vegetables are already on the board. Pick up the cleaver.");
      return false;
    }
    if (this.choppedVegetables + 3 > 6) {
      this.event("The chopped-greens tray is full. Use a portion first.");
      return false;
    }
    this.chop = { loaded: true, cuts: 0, cooldown: 0 };
    this.event("Vegetables on the board. Use the cleaver for three chops.");
    return true;
  }
  chopVegetables() {
    if (!this.canAct()) return false;
    if (!this.chop.loaded) {
      this.event("Drag fresh vegetables onto the chopping board first.");
      return false;
    }
    if (this.chop.cooldown > 0) return false;
    this.chop.cuts++;
    this.chop.cooldown = 0.15;
    this.event(`Chop ${this.chop.cuts}/3`, "info", { feedback: "prep-chop" });
    if (this.chop.cuts === 3) {
      this.chop.loaded = false;
      this.choppedVegetables += 3;
      this.event("Three portions of fresh chopped greens. Steady!", "success");
    }
    return true;
  }
  loadKaya() {
    if (!this.canAct()) return false;
    if (this.knifeLoaded) {
      this.event("The knife already has kaya. Spread it on cooked toast.");
      return false;
    }
    this.knifeLoaded = true;
    this.event("Kaya on the knife. Spread it onto cooked toast.");
    return true;
  }
  addIngredient(id, ingredient) {
    if (!this.canAct()) return false;
    const portion = [...this.plates, ...this.holding].find((p) => p.id === id);
    if (!portion || portion.quality === 0) {
      this.event("Use a cooked, edible portion first.");
      return false;
    }
    const expected = {
      kaya: "toast",
      milk: "kopi",
      sugar: "kopi",
      garnish: "noodles",
    }[ingredient];
    if (!expected || portion.type !== expected) {
      this.event("That ingredient belongs to a different dish.");
      return false;
    }
    if (portion[ingredient]) {
      this.event(
        `This dish already has ${ingredient === "garnish" ? "chopped greens" : ingredient}.`,
      );
      return false;
    }
    if (ingredient === "kaya" && !this.knifeLoaded) {
      this.event("Dip the spreader into the kaya jar first.");
      return false;
    }
    if (ingredient === "garnish" && this.choppedVegetables === 0) {
      this.event("Chop fresh vegetables before adding greens.");
      return false;
    }
    portion[ingredient] = true;
    if (ingredient === "kaya") this.knifeLoaded = false;
    if (ingredient === "garnish") this.choppedVegetables--;
    this.event(
      `${ingredient === "garnish" ? "Chopped greens" : ingredient[0].toUpperCase() + ingredient.slice(1)} added.`,
      "info",
      { feedback: "recipe-step" },
    );
    return true;
  }
  pour() {
    if (!this.canAct() || this.pouring > 0 || this.refill > 0) return false;
    if (!this.kopi) {
      this.event("The kopi pot is empty. Refill it for the next round.");
      return false;
    }
    if (this.holding.filter((p) => p.station === "coffee").length >= 2) {
      this.event(
        "Both kopi preparation spots are full. Move a cup to the counter.",
      );
      return false;
    }
    this.kopi--;
    this.pouring = 2;
    return true;
  }
  refillPot() {
    if (!this.canAct() || this.refill > 0 || this.pouring > 0) return;
    if (this.kopi === 5) {
      this.event("The kopi pot is already full.");
      return;
    }
    this.refill = 4;
  }
  discard(id) {
    if (!this.canAct()) return;
    this.holding = this.holding.filter((p) => p.id !== id);
    this.plates = this.plates.filter((p) => p.id !== id);
    if (this.selectedPlate === id)
      this.selectedPlate = this.plates[0]?.id ?? null;
    this.event("Counter cleared. Fresh start!");
  }
  serve(imperfect = false) {
    if (!this.canAct()) return false;
    const order = this.orders.find((o) => o.id === this.selectedOrder);
    const plate = this.plates.find((p) => p.id === this.selectedPlate);
    if (!plate) {
      return this.rejectServe(
        order?.id,
        "Plate and finish the food before handing it over.",
      );
    }
    if (!order) {
      return this.rejectServe(
        this.selectedOrder,
        "This ticket is already closed. Serve another customer.",
        "closed-order",
      );
    }
    if (plate.correction > 0) {
      return this.rejectServe(
        order.id,
        "Just a moment — this bowl is still being tidied.",
        "tidying",
      );
    }
    if (plate.type === "toast" && !plate.kaya)
      return this.rejectServe(
        order.id,
        "Plain toast! Dip the knife in kaya, then spread it first.",
        "missing-kaya",
      );
    if (plate.type === "noodles" && !plate.garnish)
      return this.rejectServe(
        order.id,
        "This bowl needs freshly chopped greens first.",
        "missing-vegetables",
      );
    const item = order.items.find(
      (i) =>
        !i.served &&
        i.type === plate.type &&
        (i.chilli === plate.chilli || imperfect),
    );
    if (!item) {
      const sameDish = order.items.find(
        (i) => !i.served && i.type === plate.type,
      );
      if (sameDish)
        return this.rejectServe(
          order.id,
          sameDish.chilli
            ? "This bowl needs chilli first."
            : "No chilli, please! Remove it before serving.",
          sameDish.chilli ? "needs-chilli" : "no-chilli",
        );
      const pending = order.items
        .filter((i) => !i.served)
        .map((i) => DISHES[i.type].name)
        .join(" & ");
      return this.rejectServe(
        order.id,
        `Wrong dish — still waiting for ${pending}.`,
        "wrong-dish",
      );
    }
    if (order.takeaway !== plate.takeaway && !imperfect) {
      return this.rejectServe(
        order.id,
        order.takeaway
          ? "Pack this dish for takeaway first."
          : "Dine-in, please! Remove the takeaway packaging.",
        order.takeaway ? "takeaway" : "dine-in",
      );
    }
    if (plate.type === "kopi" && !imperfect) {
      if (item.milk !== plate.milk)
        return this.rejectServe(
          order.id,
          item.milk
            ? "Add milk to this kopi first."
            : "No milk for this order, please.",
          item.milk ? "missing-milk" : "extra-milk",
        );
      if (item.sugar !== plate.sugar)
        return this.rejectServe(
          order.id,
          item.sugar
            ? "This kopi needs one spoon of sugar."
            : "Kosong means no sugar, please.",
          item.sugar ? "missing-sugar" : "extra-sugar",
        );
    }
    let quality = plate.quality * (plate.age > this.freshTime ? 0.75 : 1);
    if (
      item.chilli !== plate.chilli ||
      order.takeaway !== plate.takeaway ||
      (plate.type === "kopi" &&
        (item.milk !== plate.milk || item.sugar !== plate.sugar))
    )
      quality *= 0.6;
    item.served = true;
    this.plates = this.plates.filter((p) => p !== plate);
    this.selectedPlate = this.plates[0]?.id ?? null;
    this.earnings += DISHES[plate.type].price;
    const baseAmount = DISHES[plate.type].price;
    this.satisfaction.push(
      quality * (0.7 + (0.3 * order.remaining) / order.patience),
    );
    if (order.items.every((i) => i.served)) {
      this.served++;
      this.streak = quality >= 0.9 ? this.streak + 1 : 0;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      const tip = quality >= 0.9 ? Math.min(1.5, 0.5 + this.streak * 0.1) : 0;
      this.earnings += tip;
      this.orders = this.orders.filter((o) => o !== order);
      this.selectedOrder = this.orders[0]?.id ?? null;
      this.event(
        `Shiok! +$${(baseAmount + tip).toFixed(2)}${tip ? ` including $${tip.toFixed(2)} tip` : ""}. Order served!`,
        "success",
        {
          feedback: "order-served",
          orderId: order.id,
          amount: baseAmount + tip,
          baseAmount,
          tip,
          streak: this.streak,
          quality,
          remaining: [],
        },
      );
    } else
      this.event(
        `+$${baseAmount.toFixed(2)}! Dish served — finish the rest of this ticket.`,
        "success",
        {
          feedback: "dish-served",
          orderId: order.id,
          amount: baseAmount,
          baseAmount,
          tip: 0,
          streak: this.streak,
          quality,
          remaining: order.items
            .filter((i) => !i.served)
            .map((i) => DISHES[i.type].name),
        },
      );
    return true;
  }
  tick(dt) {
    if (this.status !== "running") return;
    dt = clamp(dt, 0, 0.25);
    this.elapsed += dt;
    this.chop.cooldown = Math.max(0, this.chop.cooldown - dt);
    for (const job of this.jobs) {
      const before = job.time;
      job.time += dt;
      for (const [threshold, feedback] of [
        [2, "cook-ready"],
        [3.25, "cook-warning"],
        [4, "cook-warning"],
        [5, "cook-warning"],
        [6, "cook-burnt"],
      ]) {
        if (before < threshold && job.time >= threshold)
          this.event(
            `${DISHES[job.type].name}: ${feedback === "cook-burnt" ? "burnt — clear the cooker" : "lift it now!"}`,
            "info",
            {
              feedback,
              jobId: job.id,
              dishType: job.type,
              slot: job.slot,
              threshold,
            },
          );
      }
    }
    for (const p of [...this.holding, ...this.plates]) {
      p.age += dt;
      if (p.correction) p.correction = Math.max(0, p.correction - dt);
    }
    if (this.refill > 0) {
      this.refill = Math.max(0, this.refill - dt);
      if (!this.refill) {
        this.kopi = 5;
        this.event("Fresh kopi is ready!", "success");
      }
    }
    if (this.pouring > 0) {
      this.pouring = Math.max(0, this.pouring - dt);
      if (!this.pouring) {
        const p = {
          id: this.nextId++,
          type: "kopi",
          quality: 1,
          age: 0,
          chilli: false,
          takeaway: false,
          garnish: false,
          kaya: false,
          milk: false,
          sugar: false,
          station: "coffee",
          correction: 0,
        };
        this.holding.push(p);
        this.event(
          "Black coffee is ready beside the urn. Add milk and sugar as ordered.",
        );
      }
    }
    for (const order of this.orders) {
      const before = order.remaining;
      order.remaining -= dt;
      for (const threshold of new Set([
        Math.min(15, order.patience * 0.25),
        5,
        3,
        1,
      ])) {
        if (
          before > threshold &&
          order.remaining <= threshold &&
          order.remaining > 0
        )
          this.event(`${order.name} is about to leave!`, "info", {
            feedback: "customer-warning",
            orderId: order.id,
            remaining: Math.max(1, Math.ceil(order.remaining)),
            urgent: threshold <= 5,
          });
      }
    }
    const leaving = this.orders.filter((o) => o.remaining <= 0);
    if (leaving.length) {
      for (const order of leaving) {
        const before = this.rating,
          streakLost = this.streak;
        const missedRevenue = order.items
          .filter((i) => !i.served)
          .reduce((sum, i) => sum + DISHES[i.type].price, 0);
        this.lost++;
        this.streak = 0;
        this.missedRevenue += missedRevenue;
        const satisfactionLost =
          Math.round((before - this.rating) * 10000) / 10000;
        this.event(
          `${order.name} left. $${missedRevenue.toFixed(2)} missed · −${Math.round(satisfactionLost * 100)}pp satisfaction.${streakLost ? " Streak ended." : ""}`,
          "loss",
          {
            feedback: "customer-left",
            orderId: order.id,
            missedRevenue,
            satisfactionLost,
            streakLost,
          },
        );
      }
      this.orders = this.orders.filter((o) => o.remaining > 0);
      if (!this.orders.some((o) => o.id === this.selectedOrder))
        this.selectedOrder = this.orders[0]?.id ?? null;
    }
    this.arrival += dt;
    if (
      this.orders.length < 3 &&
      this.arrival >= 4 &&
      this.elapsed < this.duration - 60
    ) {
      this.arrival = 0;
      const types = ["office", "family", "regular"];
      const order = this.makeOrder(
        types[Math.floor(this.random() * types.length)],
      );
      this.orders.push(order);
      if (this.selectedOrder === null) this.selectedOrder = order.id;
    }
    if (this.elapsed >= this.duration) this.end();
  }
  end() {
    if (this.status === "ended") return;
    this.status = "ended";
    this.elapsed = this.duration;
    this.wallet += this.earnings;
    this.event("Lunch rush complete. Good work, boss!", "success");
  }
  buy(id) {
    if (this.status !== "ended") return false;
    const upgrade = UPGRADES.find((u) => u.id === id);
    if (!upgrade || this.upgrades.includes(id) || this.wallet < upgrade.price)
      return false;
    this.wallet -= upgrade.price;
    this.upgrades.push(id);
    return true;
  }
}
