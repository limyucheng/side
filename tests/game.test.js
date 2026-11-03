import { test } from "node:test";
import assert from "node:assert/strict";
import { HawkerGame } from "../src/game.js";
import { finishRecipe } from "./recipe-helpers.js";

function advance(game, seconds) {
  for (let i = 0; i < Math.round(seconds * 10); i++) game.tick(0.1);
}
function cook(game, type = "noodles", seconds = 2.5) {
  assert.equal(game.startCook(type), true);
  advance(game, seconds);
  assert.equal(game.finishCook(type), true);
}
function plateFirst(game) {
  const id = game.holding[0].id;
  assert.equal(game.plate(id), true);
  return finishRecipe(
    game,
    game.plates.find((p) => p.id === id),
  );
}

test("ready and paused kitchens freeze every clock", () => {
  const g = new HawkerGame();
  advance(g, 10);
  assert.equal(g.elapsed, 0);
  assert.equal(g.orders[0].remaining, g.orders[0].patience);
  g.start();
  g.startCook("noodles");
  advance(g, 1);
  g.pause();
  const snapshot = JSON.stringify(g);
  advance(g, 10);
  assert.equal(JSON.stringify(g), snapshot);
  g.pause();
  advance(g, 1);
  assert.ok(g.jobs[0].time > 1.9);
});
test("one perfectly timed batch becomes three independently customisable bowls", () => {
  const g = new HawkerGame();
  g.start();
  g.batch = 3;
  cook(g);
  assert.equal(g.holding.length, 3);
  assert.ok(g.holding.every((p) => p.quality === 1));
  const first = plateFirst(g);
  g.toggle("chilli");
  const second = plateFirst(g);
  g.toggle("takeaway");
  assert.equal(first.chilli, true);
  assert.equal(first.takeaway, false);
  assert.equal(second.chilli, false);
  assert.equal(second.takeaway, true);
  assert.equal(g.holding.length, 1);
});
test("early lifting keeps the basket cooking; overcooking remains recoverable", () => {
  const g = new HawkerGame();
  g.start();
  g.startCook("noodles");
  advance(g, 1);
  assert.equal(g.finishCook("noodles"), false);
  assert.equal(g.jobs.length, 1);
  advance(g, 3.5);
  assert.equal(g.finishCook("noodles"), true);
  assert.equal(g.holding[0].quality, 0.7);
});
test("burnt food cannot be plated and can be discarded", () => {
  const g = new HawkerGame();
  g.start();
  cook(g, "noodles", 6.5);
  const p = g.holding[0];
  assert.equal(p.quality, 0);
  assert.equal(g.plate(p.id), false);
  g.discard(p.id);
  assert.equal(g.holding.length, 0);
});
test("toast and noodles share the primary burner", () => {
  const g = new HawkerGame();
  g.start();
  g.startCook("noodles");
  assert.equal(g.startCook("toast"), false);
  assert.equal(g.jobs.length, 1);
  advance(g, 2.5);
  g.finishCook("noodles");
  assert.equal(g.startCook("toast"), true);
});
test("second basket makes a second concurrent noodle batch possible", () => {
  const g = new HawkerGame({ upgrades: ["basket"] });
  g.start();
  assert.equal(g.startCook("toast"), true);
  assert.equal(g.startCook("noodles"), true);
  assert.deepEqual(
    g.jobs.map((j) => j.slot),
    [0, 1],
  );
  assert.equal(g.startCook("noodles"), false);
  advance(g, 2.5);
  const second = g.jobs.find((j) => j.slot === 1);
  assert.equal(g.finishCook("noodles", second.id), true);
  assert.equal(g.jobs[0].type, "toast");
});
test("two plating spots are enforced without losing cooked portions", () => {
  const g = new HawkerGame();
  g.start();
  g.batch = 3;
  cook(g);
  plateFirst(g);
  plateFirst(g);
  assert.equal(g.plate(g.holding[0].id), false);
  assert.equal(g.holding.length, 1);
});
test("wrong chilli and packaging can be fixed before serving", () => {
  const g = new HawkerGame();
  g.start();
  cook(g);
  plateFirst(g);
  assert.equal(g.serve(), false);
  g.toggle("chilli");
  g.toggle("takeaway");
  assert.equal(g.serve(), false);
  g.toggle("takeaway");
  assert.equal(g.serve(), true);
  assert.equal(g.served, 1);
  assert.ok(g.earnings > 5.5);
  assert.equal(g.plates.length, 0);
});
test("removing a topping has a small timed recovery cost", () => {
  const g = new HawkerGame();
  g.start();
  cook(g);
  const p = plateFirst(g);
  g.toggle("chilli");
  g.toggle("chilli");
  assert.equal(p.chilli, false);
  assert.equal(p.correction, 1);
  g.toggle("chilli");
  assert.equal(p.chilli, false);
  advance(g, 1.1);
  g.toggle("chilli");
  assert.equal(p.chilli, true);
  assert.equal(g.serve(), true);
});
test("an unserved bowl can go to any matching ticket; family orders support partial service", () => {
  const g = new HawkerGame();
  g.start();
  g.batch = 2;
  cook(g);
  g.selectedOrder = g.orders.find((o) => o.type === "family").id;
  plateFirst(g);
  g.toggle("chilli");
  g.toggle("takeaway");
  assert.equal(g.serve(), true);
  assert.equal(g.served, 0);
  plateFirst(g);
  g.toggle("takeaway");
  assert.equal(g.serve(), true);
  assert.equal(g.served, 1);
  assert.equal(
    g.orders.some((o) => o.type === "family"),
    false,
  );
});
test("serve as is accepts imperfect preferences but never the wrong recipe", () => {
  const g = new HawkerGame();
  g.start();
  cook(g, "toast");
  plateFirst(g);
  assert.equal(g.serve(true), false);
  g.discard(g.selectedPlate);
  cook(g);
  plateFirst(g);
  assert.equal(g.serve(true), true);
  assert.ok(g.rating < 0.7);
  assert.equal(g.streak, 0);
});
test("freshness has a forgiving window and insulation doubles it", () => {
  const g = new HawkerGame();
  g.start();
  cook(g);
  const p = plateFirst(g);
  g.toggle("chilli");
  advance(g, 21);
  assert.ok(p.age > g.freshTime);
  assert.equal(g.serve(), true);
  assert.ok(g.rating < 0.75);
  const insulated = new HawkerGame({ upgrades: ["insulation"] });
  assert.equal(insulated.freshTime, 40);
});
test("kopi is limited, pours over time and refills the pot", () => {
  const g = new HawkerGame();
  g.start();
  for (let i = 0; i < 5; i++) {
    assert.equal(g.pour(), true);
    assert.equal(g.pour(), false);
    advance(g, 2.1);
    g.discard(g.holding.find((p) => p.type === "kopi").id);
  }
  assert.equal(g.kopi, 0);
  assert.equal(g.pour(), false);
  g.refillPot();
  advance(g, 4.1);
  assert.equal(g.kopi, 5);
  assert.equal(g.refill, 0);
});
test("kopi completed during plating congestion is retained on the prep tray", () => {
  const g = new HawkerGame();
  g.start();
  g.batch = 2;
  cook(g);
  plateFirst(g);
  g.pour();
  plateFirst(g);
  advance(g, 2.1);
  assert.equal(g.plates.length, 2);
  assert.equal(g.holding[0].type, "kopi");
});
test("customers leave independently, and the queue gets a fresh chance", () => {
  const g = new HawkerGame({ random: () => 0 });
  g.start();
  advance(g, g.orders[0].patience + 1);
  assert.equal(g.lost, 1);
  assert.ok(g.orders.some((o) => o.type === "family"));
  assert.equal(g.orders.length, 3);
});
test("a complete shift banks earnings exactly once and purchases persist into the next shift", () => {
  const g = new HawkerGame();
  g.start();
  g.earnings = 42;
  advance(g, g.duration + 0.1);
  assert.equal(g.status, "ended");
  assert.equal(g.wallet, 42);
  g.end();
  assert.equal(g.wallet, 42);
  assert.equal(g.buy("insulation"), true);
  assert.equal(g.wallet, 22);
  assert.equal(g.buy("insulation"), false);
  assert.equal(g.buy("basket"), false);
  const next = new HawkerGame({
    wallet: g.wallet,
    upgrades: g.upgrades,
    day: 2,
  });
  assert.equal(next.freshTime, 40);
  assert.equal(next.wallet, 22);
  assert.equal(next.status, "ready");
});
test("equipment upgrades change batch and plating capacity", () => {
  const g = new HawkerGame({ upgrades: ["tray", "plating"] });
  assert.equal(g.maxBatch, 4);
  assert.equal(g.maxPlates, 3);
  g.start();
  g.batch = 4;
  cook(g);
  plateFirst(g);
  plateFirst(g);
  plateFirst(g);
  assert.equal(g.plates.length, 3);
  assert.equal(g.holding.length, 1);
});
