import { test } from "node:test";
import assert from "node:assert/strict";
import { HawkerGame } from "../src/game.js";
import { StallInteractions } from "../src/interactions.js";
import { finishRecipe } from "./recipe-helpers.js";

const ingredient = (item) => ({ kind: "ingredient", item });
const pot = (slot) => ({ kind: "pot", slot });
const spot = (slot) => ({ kind: "plating", slot });
const step = (g, seconds) => {
  for (let i = 0; i < Math.round(seconds * 10); i++) g.tick(0.1);
};
function setup(upgrades = []) {
  const game = new HawkerGame({ upgrades });
  game.start();
  return { g: game, c: new StallInteractions(game) };
}
function basket(g) {
  return { kind: "basket", id: g.jobs.find((j) => j.type === "noodles").id };
}
function plate(g) {
  return { kind: "plate", id: g.plates[0].id };
}

test("physical mee drops batch in the same basket, with a shared cooking window", () => {
  const { g, c } = setup();
  assert.equal(c.drop(ingredient("noodles"), pot(0)), true);
  step(g, 0.8);
  assert.equal(c.drop(ingredient("noodles"), pot(0)), true);
  assert.equal(g.jobs.length, 1);
  assert.equal(g.jobs[0].quantity, 2);
  assert.equal(g.jobs[0].time, 0);
  step(g, 2.5);
  assert.equal(c.drop(basket(g), spot(1)), true);
  assert.equal(g.plates[0].slot, 1);
  assert.equal(g.holding.length, 1);
});
test("ready baskets reject new raw noodles instead of changing cooked portions", () => {
  const { g, c } = setup();
  c.drop(ingredient("noodles"), pot(0));
  step(g, 2.5);
  assert.equal(c.drop(ingredient("noodles"), pot(0)), false);
  assert.equal(g.jobs[0].quantity, 1);
});
test("dropping into a specified second basket respects its equipment slot", () => {
  const { g, c } = setup(["basket"]);
  assert.equal(c.drop(ingredient("noodles"), pot(1)), true);
  assert.equal(g.jobs[0].slot, 1);
  assert.equal(c.drop(ingredient("bread"), { kind: "grill" }), true);
  assert.deepEqual(
    g.jobs.map((j) => j.slot),
    [1, 0],
  );
});
test("uninstalled second equipment cannot receive ingredients", () => {
  const { g, c } = setup();
  assert.equal(c.drop(ingredient("noodles"), pot(1)), false);
  assert.equal(g.jobs.length, 0);
});
test("a plate stays in the chosen physical position after a neighbouring dish is removed", () => {
  const { g, c } = setup();
  c.drop(ingredient("noodles"), pot(0));
  c.drop(ingredient("noodles"), pot(0));
  step(g, 2.5);
  c.drop(basket(g), spot(1));
  c.drop({ kind: "prepared", id: g.holding[0].id }, spot(0));
  const first = g.plates.find((p) => p.slot === 1);
  g.discard(g.plates.find((p) => p.slot === 0).id);
  assert.equal(g.plates[0].id, first.id);
  assert.equal(g.plates[0].slot, 1);
});
test("an occupied drop target does not lift or consume the cooking batch", () => {
  const { g, c } = setup();
  c.drop(ingredient("noodles"), pot(0));
  step(g, 2.5);
  c.drop(basket(g), spot(0));
  c.drop(ingredient("noodles"), pot(0));
  step(g, 2.5);
  const source = basket(g);
  assert.equal(c.drop(source, spot(0)), false);
  assert.equal(g.jobs[0].id, source.id);
});
test("dragging chilli to a bowl and handing it to a customer completes an order", () => {
  const { g, c } = setup();
  c.drop(ingredient("noodles"), pot(0));
  step(g, 2.5);
  c.drop(basket(g), spot(0));
  finishRecipe(g, g.plates[0]);
  assert.equal(c.drop(plate(g), { kind: "customer", id: 1 }), false);
  assert.equal(c.drop(ingredient("chilli"), plate(g)), true);
  assert.equal(c.drop(plate(g), { kind: "customer", id: 1 }), true);
  assert.equal(g.served, 1);
});
test("a topping can be dragged back to its ingredient jar to recover a mistake", () => {
  const { g, c } = setup();
  c.drop(ingredient("noodles"), pot(0));
  step(g, 2.5);
  c.drop(basket(g), spot(0));
  c.drop(ingredient("chilli"), plate(g));
  assert.equal(
    c.drop(
      { kind: "topping", item: "chilli", id: g.plates[0].id },
      ingredient("chilli"),
    ),
    true,
  );
  assert.equal(g.plates[0].chilli, false);
  assert.equal(g.plates[0].correction, 1);
});
test("toast is lifted plain and kaya must be dipped and spread separately", () => {
  const { g, c } = setup();
  assert.equal(c.drop(ingredient("bread"), { kind: "grill" }), true);
  assert.equal(c.drop(ingredient("knife"), { kind: "grill" }), false);
  assert.equal(g.jobs.length, 1);
  step(g, 2.5);
  assert.equal(c.drop(ingredient("knife"), { kind: "grill" }), false);
  assert.equal(
    c.drop({ kind: "grill-toast", id: g.jobs[0].id }, spot(1)),
    true,
  );
  assert.equal(g.plates[0].kaya, false);
  assert.equal(c.drop(ingredient("knife"), plate(g)), false);
  assert.equal(c.drop(ingredient("knife"), ingredient("kaya")), true);
  assert.equal(c.drop(ingredient("knife"), plate(g)), true);
  assert.equal(g.plates[0].kaya, true);
});
test("toast can be dragged directly from the grill to the chosen plating spot", () => {
  const { g, c } = setup();
  c.drop(ingredient("bread"), { kind: "grill" });
  const toast = { kind: "grill-toast", id: g.jobs[0].id };
  assert.equal(c.accepts(toast, spot(1)), true);
  assert.equal(
    c.drop(toast, spot(1)),
    false,
    "early lifting keeps bread on the grill",
  );
  assert.equal(g.jobs.length, 1);
  step(g, 2.5);
  assert.equal(c.drop(toast, spot(1)), true);
  assert.equal(g.jobs.length, 0);
  assert.equal(g.plates[0].type, "toast");
  assert.equal(g.plates[0].slot, 1);
  assert.equal(g.plates[0].quality, 1);
});
test("toast can leave the grill for the prep tray and be plated later", () => {
  const { g, c } = setup();
  c.drop(ingredient("bread"), { kind: "grill" });
  const toast = { kind: "grill-toast", id: g.jobs[0].id };
  step(g, 2.5);
  assert.equal(c.accepts(toast, { kind: "prep" }), true);
  assert.equal(c.drop(toast, { kind: "prep" }), true);
  assert.equal(g.jobs.length, 0);
  assert.equal(g.holding[0].type, "toast");
  assert.equal(
    c.drop({ kind: "prepared", id: g.holding[0].id }, spot(0)),
    true,
  );
});
test("an occupied plating spot leaves toast on the grill", () => {
  const { g, c } = setup();
  c.drop(ingredient("cup"), { kind: "coffee" });
  step(g, 2.1);
  c.drop({ kind: "prepared", id: g.holding[0].id }, spot(0));
  c.drop(ingredient("bread"), { kind: "grill" });
  step(g, 2.5);
  const toast = { kind: "grill-toast", id: g.jobs[0].id };
  assert.equal(c.drop(toast, spot(0)), false);
  assert.equal(g.jobs[0].id, toast.id);
  assert.equal(g.holding.length, 0);
});
test("burnt toast can be dragged off the grill directly into the bin", () => {
  const { g, c } = setup();
  c.drop(ingredient("bread"), { kind: "grill" });
  step(g, 6.5);
  const toast = { kind: "grill-toast", id: g.jobs[0].id };
  assert.equal(c.accepts(toast, { kind: "bin" }), true);
  assert.equal(c.drop(toast, { kind: "bin" }), true);
  assert.equal(g.jobs.length, 0);
  assert.equal(
    c.drop(ingredient("noodles"), pot(0)),
    true,
    "shared burner is freed",
  );
});
test("cups and kettle act on the kopi urn, with a real timed refill", () => {
  const { g, c } = setup();
  assert.equal(c.drop(ingredient("cup"), { kind: "coffee" }), true);
  step(g, 2.1);
  assert.equal(g.holding[0].type, "kopi");
  assert.equal(g.holding[0].milk, false);
  assert.equal(g.holding[0].sugar, false);
  const cup = { kind: "prepared", id: g.holding[0].id };
  assert.equal(c.drop(ingredient("milk"), cup), true);
  assert.equal(c.drop(ingredient("sugar"), cup), true);
  assert.equal(c.drop(cup, spot(0)), true);
  assert.equal(g.plates[0].slot, 0);
  assert.equal(g.kopi, 4);
  assert.equal(c.drop(ingredient("kettle"), { kind: "coffee" }), true);
  step(g, 4.1);
  assert.equal(g.kopi, 5);
});
test("burnt cooking batches can go directly into the bin", () => {
  const { g, c } = setup();
  c.drop(ingredient("noodles"), pot(0));
  step(g, 6.5);
  assert.equal(c.drop(basket(g), { kind: "bin" }), true);
  assert.equal(g.jobs.length, 0);
  assert.equal(g.holding.length, 0);
});
test("invalid equipment and paused shifts preserve ingredients and state", () => {
  const { g, c } = setup();
  assert.equal(c.drop(ingredient("noodles"), { kind: "coffee" }), false);
  assert.equal(g.jobs.length, 0);
  g.pause();
  assert.equal(c.drop(ingredient("noodles"), pot(0)), false);
  assert.equal(g.jobs.length, 0);
  assert.equal(c.accepts(ingredient("chilli"), { kind: "plate" }), true);
  assert.equal(c.accepts(ingredient("bread"), pot(0)), false);
});
