// Scene objects describe intent; game rules stay independent of WebGL.
export class StallInteractions {
  constructor(game) {
    this.game = game;
  }
  pickCooked(source) {
    if (
      !["basket", "grill-toast"].includes(source.kind) ||
      this.game.status !== "running"
    )
      return source;
    const job = this.game.jobs.find((j) => j.id === source.id);
    if (!job || job.time < 2) return source;
    const before = new Set(this.game.holding.map((p) => p.id));
    if (!this.game.finishCook(job.type, job.id)) return source;
    const portion = this.game.holding.find((p) => !before.has(p.id));
    return {
      ...source,
      kind: "prepared",
      id: portion.id,
      label:
        portion.quality === 0
          ? "Burnt food · drop in the bin"
          : job.type === "toast"
            ? "Plain toast · move to the centre, then spread kaya"
            : "Cooked noodles · move to a centre plating spot",
    };
  }
  drop(source, target, { imperfect = false } = {}) {
    const g = this.game;
    if (!source || !target || !g.canAct()) return false;
    if (target.kind === "customer" && source.kind !== "plate")
      return g.rejectServe(
        target.id,
        "Not ready yet! Plate and finish the dish before serving.",
      );
    if (target.kind === "bin") {
      if (["plate", "prepared"].includes(source.kind)) {
        g.discard(source.id);
        return true;
      }
      if (["basket", "grill-toast"].includes(source.kind)) {
        g.jobs = g.jobs.filter((j) => j.id !== source.id);
        g.event("Burner cleared. A fresh start.");
        return true;
      }
    }
    if (
      source.kind === "ingredient" &&
      source.item === "noodles" &&
      target.kind === "pot"
    ) {
      const job = g.jobs.find((j) => j.slot === target.slot);
      if (job && job.type === "noodles") return g.addPortion(job.id);
      g.batch = 1;
      return g.startCook("noodles", target.slot);
    }
    if (
      source.kind === "ingredient" &&
      source.item === "bread" &&
      target.kind === "grill"
    )
      return g.startCook("toast", 0);
    if (
      source.kind === "ingredient" &&
      source.item === "knife" &&
      target.kind === "grill"
    ) {
      g.event("Lift the toast first. Kaya is spread after toasting.");
      return false;
    }
    if (
      source.kind === "ingredient" &&
      source.item === "vegetables" &&
      target.kind === "board"
    )
      return g.loadVegetables();
    if (
      source.kind === "ingredient" &&
      source.item === "cleaver" &&
      target.kind === "board"
    )
      return g.chopVegetables();
    if (
      source.kind === "ingredient" &&
      source.item === "knife" &&
      target.kind === "ingredient" &&
      target.item === "kaya"
    )
      return g.loadKaya();
    if (
      source.kind === "ingredient" &&
      ["milk", "sugar", "garnish", "knife"].includes(source.item) &&
      ["plate", "prepared"].includes(target.kind)
    )
      return g.addIngredient(
        target.id,
        source.item === "knife" ? "kaya" : source.item,
      );
    if (
      source.kind === "ingredient" &&
      source.item === "cup" &&
      target.kind === "coffee"
    )
      return g.pour();
    if (
      source.kind === "ingredient" &&
      source.item === "kettle" &&
      target.kind === "coffee"
    ) {
      const before = g.refill;
      g.refillPot();
      return g.refill > before;
    }
    if (source.kind === "prepared" && target.kind === "plating")
      return g.plate(source.id, target.slot);
    if (source.kind === "prepared" && target.kind === "prep") {
      const portion = g.holding.find((p) => p.id === source.id);
      if (!portion) return false;
      portion.station = "prep";
      return true;
    }
    if (source.kind === "grill-toast" && target.kind === "prep")
      return g.finishCook("toast", source.id);
    if (
      ["basket", "grill-toast"].includes(source.kind) &&
      target.kind === "plating"
    ) {
      if (g.plates.length >= g.maxPlates) {
        g.event("Both plating spots are full. Serve a dish first.");
        return false;
      }
      if (
        target.slot != null &&
        (target.slot < 0 ||
          target.slot >= g.maxPlates ||
          g.plates.some((p) => p.slot === target.slot))
      ) {
        g.event("Use an empty plating spot.");
        return false;
      }
      const before = new Set(g.holding.map((p) => p.id));
      if (
        !g.finishCook(
          source.kind === "grill-toast" ? "toast" : "noodles",
          source.id,
        )
      )
        return false;
      const portion = g.holding.find((p) => !before.has(p.id));
      return portion ? g.plate(portion.id, target.slot) : false;
    }
    if (
      source.kind === "ingredient" &&
      ["chilli", "garnish", "takeaway"].includes(source.item) &&
      target.kind === "plate"
    ) {
      const plate = g.plates.find((p) => p.id === target.id);
      if (!plate) return false;
      g.selectedPlate = plate.id;
      const before = plate[source.item];
      g.toggle(source.item);
      return before !== plate[source.item];
    }
    if (
      source.kind === "topping" &&
      target.kind === "ingredient" &&
      target.item === source.item
    ) {
      const plate = g.plates.find((p) => p.id === source.id);
      if (!plate?.[source.item]) return false;
      g.selectedPlate = plate.id;
      g.toggle(source.item);
      return true;
    }
    if (source.kind === "plate" && target.kind === "customer") {
      g.selectedPlate = source.id;
      g.selectedOrder = target.id;
      return g.serve(imperfect);
    }
    g.event("That doesn’t go there. Look for the glowing drop area.");
    return false;
  }
  accepts(source, target) {
    if (!source || !target) return false;
    if (target.kind === "bin")
      return ["plate", "prepared", "basket", "grill-toast"].includes(
        source.kind,
      );
    if (source.kind === "ingredient")
      return (
        {
          noodles: ["pot"],
          bread: ["grill"],
          knife: [
            "plate",
            "prepared",
            ...(target.item === "kaya" ? ["ingredient"] : []),
          ],
          vegetables: ["board"],
          cleaver: ["board"],
          milk: ["plate", "prepared"],
          sugar: ["plate", "prepared"],
          cup: ["coffee"],
          kettle: ["coffee"],
          chilli: ["plate"],
          garnish: ["plate", "prepared"],
          takeaway: ["plate"],
        }[source.item] || []
      ).includes(target.kind);
    if (source.kind === "prepared")
      return ["plating", "prep"].includes(target.kind);
    if (source.kind === "basket") return target.kind === "plating";
    if (source.kind === "grill-toast")
      return ["plating", "prep"].includes(target.kind);
    if (source.kind === "plate") return target.kind === "customer";
    return (
      source.kind === "topping" &&
      target.kind === "ingredient" &&
      target.item === source.item
    );
  }
}
