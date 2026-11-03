import { test } from "node:test";
import assert from "node:assert/strict";
import { HawkerGame } from "../src/game.js";
import { StallInteractions } from "../src/interactions.js";
import { impatientLine } from "../src/dialogue.js";

const ingredient = (item) => ({ kind: "ingredient", item });
const spot = (slot) => ({ kind: "plating", slot });
function advance(g, seconds) {
  for (let i = 0; i < Math.round(seconds * 20); i++) g.tick(0.05);
}
function setup() {
  const g = new HawkerGame();
  g.start();
  g.events.length = 0;
  return { g, c: new StallInteractions(g) };
}
function toast(g) {
  g.startCook("toast");
  advance(g, 2.5);
  g.finishCook("toast");
  return g.holding.at(-1);
}
function coffee(g) {
  g.pour();
  advance(g, 2.1);
  return g.holding.find((p) => p.type === "kopi");
}

test("toasting never applies kaya, including when food is plated", () => {
  const { g } = setup(),
    p = toast(g);
  assert.equal(p.kaya, false);
  g.plate(p.id);
  assert.equal(g.plates[0].kaya, false);
  g.selectedOrder = 2;
  assert.equal(g.serve(), false);
  assert.equal(g.events.at(-1).reason, "missing-kaya");
  assert.equal(
    g.serve(true),
    false,
    "unfinished toast cannot bypass kaya with Shift",
  );
});
test("kaya requires loading the spreader and one load finishes exactly one toast", () => {
  const { g, c } = setup(),
    p = toast(g),
    food = { kind: "prepared", id: p.id };
  assert.equal(c.drop(ingredient("knife"), food), false);
  assert.equal(p.kaya, false);
  assert.equal(c.drop(ingredient("knife"), ingredient("kaya")), true);
  assert.equal(g.knifeLoaded, true);
  assert.equal(c.drop(ingredient("knife"), food), true);
  assert.equal(p.kaya, true);
  assert.equal(g.knifeLoaded, false);
  g.plate(p.id, 0);
  assert.equal(g.plates[0].kaya, true, "plating preserves applied kaya");
  assert.equal(
    c.drop(ingredient("knife"), { kind: "plate", id: p.id }),
    false,
    "extra touches do not remove kaya",
  );
});
test("spreading on the grill cannot finish bread or apply kaya", () => {
  const { g, c } = setup();
  g.startCook("toast");
  g.loadKaya();
  advance(g, 2.5);
  assert.equal(c.drop(ingredient("knife"), { kind: "grill" }), false);
  assert.equal(g.jobs.length, 1);
  assert.equal(g.holding.length, 0);
  assert.equal(g.knifeLoaded, true);
});
test("picking cooked bread off the grill locks its quality while turning to another station", () => {
  const { g, c } = setup();
  g.startCook("toast");
  advance(g, 2.5);
  const held = c.pickCooked({
    kind: "grill-toast",
    id: g.jobs[0].id,
    name: "toast",
  });
  assert.equal(held.kind, "prepared");
  assert.equal(g.jobs.length, 0);
  advance(g, 5);
  assert.equal(c.drop(held, spot(0)), true);
  assert.equal(g.plates[0].quality, 1);
  assert.equal(g.plates[0].kaya, false);
});
test("a lifted noodle batch frees the burner and leaves extra portions on the prep tray", () => {
  const { g, c } = setup();
  g.batch = 3;
  g.startCook("noodles");
  advance(g, 2.5);
  const held = c.pickCooked({
    kind: "basket",
    id: g.jobs[0].id,
    name: "basket",
  });
  assert.equal(g.jobs.length, 0);
  assert.equal(g.holding.length, 3);
  assert.equal(c.drop(held, spot(1)), true);
  assert.equal(g.holding.length, 2);
  assert.equal(g.plates[0].slot, 1);
  assert.equal(g.startCook("toast"), true);
});
test("raw food is not silently finished by picking it up early", () => {
  const { g, c } = setup();
  g.startCook("toast");
  advance(g, 1);
  const source = { kind: "grill-toast", id: g.jobs[0].id };
  assert.equal(c.pickCooked(source), source);
  assert.equal(g.jobs.length, 1);
  assert.equal(g.holding.length, 0);
});
test("three distinct cleaver cuts create a three-portion batch of greens", () => {
  const { g, c } = setup();
  const board = { kind: "board" };
  assert.equal(c.drop(ingredient("cleaver"), board), false);
  assert.equal(c.drop(ingredient("vegetables"), board), true);
  assert.equal(c.drop(ingredient("cleaver"), board), true);
  assert.equal(g.chop.cuts, 1);
  assert.equal(
    c.drop(ingredient("cleaver"), board),
    false,
    "cuts have a short physical cooldown",
  );
  advance(g, 0.35);
  c.drop(ingredient("cleaver"), board);
  advance(g, 0.35);
  c.drop(ingredient("cleaver"), board);
  assert.equal(g.chop.loaded, false);
  assert.equal(g.choppedVegetables, 3);
});
test("noodles require real chopped greens, and adding a portion consumes stock", () => {
  const { g, c } = setup();
  g.startCook("noodles");
  advance(g, 2.5);
  g.finishCook("noodles");
  g.plate(g.holding[0].id);
  g.toggle("chilli");
  assert.equal(g.serve(), false);
  assert.equal(g.events.at(-1).reason, "missing-vegetables");
  const dish = { kind: "plate", id: g.plates[0].id };
  assert.equal(c.drop(ingredient("garnish"), dish), false);
  g.loadVegetables();
  for (let i = 0; i < 3; i++) {
    g.chopVegetables();
    advance(g, 0.35);
  }
  assert.equal(c.drop(ingredient("garnish"), dish), true);
  assert.equal(g.choppedVegetables, 2);
  assert.equal(g.serve(), true);
});
test("chopping progress freezes during a pause and cannot be reset by reloading greens", () => {
  const { g } = setup();
  g.loadVegetables();
  g.chopVegetables();
  g.pause();
  const before = JSON.stringify(g.chop);
  advance(g, 3);
  assert.equal(JSON.stringify(g.chop), before);
  assert.equal(g.chopVegetables(), false);
  g.pause();
  assert.equal(g.loadVegetables(), false);
  assert.equal(g.chop.cuts, 1);
});
test("brewing produces black unsweetened coffee at the coffee station", () => {
  const { g } = setup();
  const cup = coffee(g);
  assert.equal(cup.milk, false);
  assert.equal(cup.sugar, false);
  assert.equal(cup.station, "coffee");
  assert.equal(g.plates.length, 0);
});
test("milk and sugar are separate physical additions, preserved when the cup is plated", () => {
  const { g, c } = setup();
  const cup = coffee(g),
    source = { kind: "prepared", id: cup.id };
  assert.equal(c.drop(ingredient("milk"), source), true);
  assert.equal(cup.milk, true);
  assert.equal(cup.sugar, false);
  assert.equal(c.drop(ingredient("sugar"), source), true);
  assert.equal(c.drop(source, spot(0)), true);
  assert.equal(g.plates[0].milk, true);
  assert.equal(g.plates[0].sugar, true);
});
test("the regular's coffee is rejected until both requested additions are present", () => {
  const { g } = setup();
  const cup = coffee(g);
  g.plate(cup.id);
  g.selectedOrder = 2;
  assert.equal(g.serve(), false);
  assert.equal(g.events.at(-1).reason, "missing-milk");
  g.addIngredient(cup.id, "milk");
  assert.equal(g.serve(), false);
  assert.equal(g.events.at(-1).reason, "missing-sugar");
  g.addIngredient(cup.id, "sugar");
  assert.equal(g.serve(), true);
  assert.equal(g.served, 0, "toast on the ticket is still pending");
});
test("black/no-sugar preferences remain valid and extra additions are recoverable with imperfect serving", () => {
  const { g } = setup();
  const cup = coffee(g);
  g.plate(cup.id);
  const order = g.orders[1],
    requested = order.items.find((i) => i.type === "kopi");
  requested.milk = false;
  requested.sugar = false;
  g.selectedOrder = order.id;
  g.addIngredient(cup.id, "milk");
  assert.equal(g.serve(), false);
  assert.equal(g.events.at(-1).reason, "extra-milk");
  assert.equal(g.serve(true), true);
  assert.ok(g.rating < 0.7);
});
test("coffee additions cannot be applied to toast or used twice on the same cup", () => {
  const { g } = setup();
  const bread = toast(g);
  assert.equal(g.addIngredient(bread.id, "milk"), false);
  const cup = coffee(g);
  assert.equal(g.addIngredient(cup.id, "sugar"), true);
  assert.equal(g.addIngredient(cup.id, "sugar"), false);
  assert.equal(cup.sugar, true);
});
test("the coffee station has two real preparation spots and frees one when a cup moves", () => {
  const { g, c } = setup();
  const first = coffee(g);
  coffee(g);
  assert.equal(g.pour(), false);
  c.drop({ kind: "prepared", id: first.id }, spot(0));
  assert.equal(g.pour(), true);
});
test("moving a cup to the centre prep tray frees a coffee station spot", () => {
  const { g, c } = setup();
  const first = coffee(g);
  coffee(g);
  assert.equal(g.pour(), false);
  assert.equal(
    c.drop({ kind: "prepared", id: first.id }, { kind: "prep" }),
    true,
  );
  assert.equal(first.station, "prep");
  assert.equal(g.holding.length, 2);
  assert.equal(g.pour(), true);
});
test("NPC impatience uses readable Singlish, with the requested stronger language at last call", () => {
  for (const type of ["office", "regular", "family"]) {
    assert.ok(impatientLine(type, false).length > 10);
    assert.match(impatientLine(type, true, 0), /Chibai/);
  }
  assert.match(impatientLine("office", true, 1), /Lanjiao/);
  assert.match(impatientLine("regular", true, 1), /Lanjiao/);
  assert.doesNotThrow(() => impatientLine("unknown", false));
});
