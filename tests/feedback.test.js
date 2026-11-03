import { test } from "node:test";
import assert from "node:assert/strict";
import { HawkerGame, cookPhase, customerPhase } from "../src/game.js";
import { StallInteractions } from "../src/interactions.js";
import { finishRecipe } from "./recipe-helpers.js";

function advance(game, seconds) {
  for (let i = 0; i < Math.round(seconds * 20); i++) game.tick(0.05);
}
function running(upgrades = []) {
  const game = new HawkerGame({ upgrades });
  game.start();
  game.events.length = 0;
  return game;
}
function cook(game, type = "noodles") {
  game.startCook(type);
  advance(game, 2.5);
  game.finishCook(type);
  const id = game.holding.at(-1).id;
  game.plate(id);
  return finishRecipe(
    game,
    game.plates.find((p) => p.id === id),
  );
}
const feedback = (game, type) => game.events.filter((e) => e.feedback === type);

test("cookers emit one readiness cue and escalating warnings for each threshold", () => {
  const g = running();
  g.startCook("toast");
  const id = g.jobs[0].id;
  advance(g, 2.1);
  assert.equal(feedback(g, "cook-ready").length, 1);
  assert.equal(feedback(g, "cook-ready")[0].jobId, id);
  assert.equal(feedback(g, "cook-ready")[0].dishType, "toast");
  advance(g, 4.5);
  assert.deepEqual(
    feedback(g, "cook-warning").map((e) => e.threshold),
    [3.25, 4, 5],
  );
  assert.equal(feedback(g, "cook-burnt").length, 1);
  advance(g, 3);
  assert.equal(feedback(g, "cook-burnt").length, 1);
});
test("lifting food cancels its future warnings and pausing freezes pending alerts", () => {
  const g = running();
  g.startCook("noodles");
  advance(g, 1.5);
  g.pause();
  advance(g, 10);
  assert.equal(g.events.length, 0);
  g.pause();
  advance(g, 0.6);
  assert.equal(feedback(g, "cook-ready").length, 1);
  g.finishCook("noodles");
  advance(g, 4);
  assert.equal(feedback(g, "cook-warning").length, 0);
  assert.equal(feedback(g, "cook-burnt").length, 0);
});
test("two cooking slots keep their own warning identities", () => {
  const g = running(["basket"]);
  g.startCook("toast", 0);
  g.startCook("noodles", 1);
  advance(g, 2.1);
  const cues = feedback(g, "cook-ready");
  assert.equal(cues.length, 2);
  assert.deepEqual(
    cues.map((e) => e.slot),
    [0, 1],
  );
  assert.notEqual(cues[0].jobId, cues[1].jobId);
});
test("customer countdowns warn once, then escalate in the last five seconds", () => {
  const g = running();
  const order = g.orders[0];
  order.remaining = 15.2;
  advance(g, 15.5);
  const warnings = feedback(g, "customer-warning").filter(
    (e) => e.orderId === order.id,
  );
  assert.equal(warnings.length, 4);
  assert.deepEqual(
    warnings.map((e) => e.urgent),
    [false, true, true, true],
  );
  assert.equal(
    feedback(g, "customer-left").filter((e) => e.orderId === order.id).length,
    1,
  );
});
test("raw food handed to a customer produces a recoverable incomplete-order rejection", () => {
  const g = running(),
    c = new StallInteractions(g);
  assert.equal(
    c.drop({ kind: "ingredient", item: "bread" }, { kind: "customer", id: 1 }),
    false,
  );
  const event = feedback(g, "serve-rejected").at(-1);
  assert.equal(event.orderId, 1);
  assert.equal(event.reason, "incomplete");
  assert.equal(g.earnings, 0);
  assert.equal(g.rating, 1);
  assert.equal(g.orders.length, 3);
});
test("wrong dish, missing chilli, and wrong packaging identify what to fix without consuming food", () => {
  const g = running();
  let p = cook(g, "toast");
  assert.equal(g.serve(), false);
  assert.equal(feedback(g, "serve-rejected").at(-1).reason, "wrong-dish");
  assert.equal(g.plates[0].id, p.id);
  g.discard(p.id);
  p = cook(g);
  assert.equal(g.serve(), false);
  assert.equal(feedback(g, "serve-rejected").at(-1).reason, "needs-chilli");
  g.toggle("chilli");
  g.toggle("takeaway");
  assert.equal(g.serve(), false);
  assert.equal(feedback(g, "serve-rejected").at(-1).reason, "dine-in");
  assert.equal(g.plates[0].id, p.id);
  assert.equal(g.earnings, 0);
  assert.equal(g.lost, 0);
});
test("a complete sale emits one exact payout event including its tip and streak", () => {
  const g = running();
  cook(g);
  g.toggle("chilli");
  g.events.length = 0;
  assert.equal(g.serve(), true);
  const events = feedback(g, "order-served");
  assert.equal(events.length, 1);
  const sale = events[0];
  assert.equal(sale.orderId, 1);
  assert.equal(sale.baseAmount, 5.5);
  assert.equal(sale.amount, g.earnings);
  assert.ok(Math.abs(sale.tip - 0.6) < 1e-9);
  assert.equal(sale.streak, 1);
  assert.equal(feedback(g, "dish-served").length, 0);
  assert.equal(g.serve(), false);
  assert.equal(feedback(g, "order-served").length, 1);
});
test("valid partial family service is rewarded and identifies the remaining dish", () => {
  const g = running();
  cook(g);
  g.toggle("chilli");
  g.toggle("takeaway");
  g.selectedOrder = 3;
  assert.equal(g.serve(), true);
  const sale = feedback(g, "dish-served").at(-1);
  assert.equal(sale.amount, 5.5);
  assert.equal(sale.tip, 0);
  assert.deepEqual(sale.remaining, ["Bak chor mee"]);
  assert.equal(g.served, 0);
  assert.equal(feedback(g, "serve-rejected").length, 0);
});
test("departure reports missed revenue and a real five-point satisfaction loss without debiting earned cash", () => {
  const g = running();
  g.earnings = 12;
  g.streak = 3;
  g.orders[0].remaining = 0.1;
  advance(g, 0.2);
  const loss = feedback(g, "customer-left")[0];
  assert.equal(loss.missedRevenue, 5.5);
  assert.equal(loss.satisfactionLost, 0.05);
  assert.equal(loss.streakLost, 3);
  assert.equal(g.rating, 0.95);
  assert.equal(g.earnings, 12);
  assert.equal(g.missedRevenue, 5.5);
  assert.equal(g.streak, 0);
  advance(g, 1);
  assert.equal(feedback(g, "customer-left").length, 1);
});
test("a partially served family's missed sale includes only what is still unserved", () => {
  const g = running();
  cook(g);
  g.toggle("chilli");
  g.toggle("takeaway");
  g.selectedOrder = 3;
  g.serve();
  const earned = g.earnings,
    rating = g.rating;
  g.orders.find((o) => o.id === 3).remaining = 0.1;
  advance(g, 0.2);
  const loss = feedback(g, "customer-left")[0];
  assert.equal(loss.missedRevenue, 5.5);
  assert.equal(g.earnings, earned);
  assert.ok(Math.abs(rating - g.rating - loss.satisfactionLost) < 1e-9);
});
test("simultaneous departures each report their actual loss, and satisfaction cannot go negative", () => {
  const g = running();
  g.orders.forEach((o) => (o.remaining = 0.1));
  advance(g, 0.2);
  assert.equal(feedback(g, "customer-left").length, 3);
  assert.ok(Math.abs(g.rating - 0.85) < 1e-9);
  assert.ok(Math.abs(g.missedRevenue - 21.5) < 1e-9);
  g.lost = 30;
  assert.equal(g.rating, 0);
});
test("visual alert phases agree with the cooking and customer deadlines", () => {
  assert.deepEqual([1, 2, 3.5, 4.5, 6].map(cookPhase), [
    "cooking",
    "ready",
    "hurry",
    "burning",
    "burnt",
  ]);
  assert.deepEqual(
    [30, 10, 5].map((remaining) => customerPhase({ remaining, patience: 58 })),
    ["patient", "impatient", "critical"],
  );
});
