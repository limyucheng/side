import { test } from "node:test";
import assert from "node:assert/strict";
import {
  HawkerGame,
  orderPatience,
  rushIntensity,
  arrivalPacing,
} from "../src/game.js";
function advance(game, seconds) {
  for (let t = 0; t < seconds; t += 0.25) game.tick(0.25);
}
test("all three opening waits are ten seconds shorter and later orders retain their recipe budgets", () => {
  const game = new HawkerGame({ random: () => 0 });
  assert.deepEqual(
    game.orders.map((o) => o.patience),
    [100, 152, 190],
  );
  assert.equal(game.makeOrder("office", 0).patience, 100);
  assert.equal(game.makeOrder("regular").patience, 162);
  assert.equal(game.makeOrder("family").patience, 200);
  game.start();
  advance(game, 90);
  assert.equal(game.lost, 0);
  assert.equal(game.orders.length, 3);
});
test("larger orders, coffee additions and takeaway each add preparation time", () => {
  const black = [{ type: "kopi", milk: false, sugar: false }],
    milk = [{ type: "kopi", milk: true, sugar: false }],
    sweet = [{ type: "kopi", milk: true, sugar: true }];
  assert.ok(orderPatience("office", milk) > orderPatience("office", black));
  assert.ok(orderPatience("office", sweet) > orderPatience("office", milk));
  assert.ok(
    orderPatience("office", sweet, true) > orderPatience("office", sweet),
  );
  assert.ok(
    orderPatience("office", [...sweet, { type: "toast" }]) >
      orderPatience("office", sweet),
  );
});
test("arrivals and chatter share a smooth lunch peak with quieter opening and closing", () => {
  const start = arrivalPacing(0),
    peak = arrivalPacing(120),
    end = arrivalPacing(240);
  assert.ok(peak.interval < start.interval / 2);
  assert.equal(peak.capacity, 3);
  assert.equal(start.capacity, 2);
  assert.equal(end.capacity, 2);
  assert.ok(Math.abs(rushIntensity(0) - rushIntensity(240)) < 1e-9);
  let previous = rushIntensity(0);
  for (let t = 1; t <= 120; t++) {
    const next = rushIntensity(t);
    assert.ok(next >= previous);
    assert.ok(next - previous < 0.02);
    previous = next;
  }
});
test("an empty counter gets a new customer throughout the final minute, including the last few seconds", () => {
  for (const elapsed of [180, 220, 236]) {
    const game = new HawkerGame();
    game.start();
    game.elapsed = elapsed;
    game.orders = [];
    game.selectedOrder = null;
    game.arrival = 0;
    advance(game, 2.25);
    assert.ok(game.orders.length > 0, `new customer at ${elapsed}s`);
    assert.equal(game.status, "running");
  }
});
test("customer generation has no daily sales cap and still ends exactly at closing", () => {
  const game = new HawkerGame({ random: () => 0 });
  game.start();
  let arrivals = 0,
    late = 0;
  for (let i = 0; i < 960; i++) {
    const before = game.nextId;
    game.orders = [];
    game.tick(0.25);
    arrivals += game.nextId - before;
    if (game.elapsed > 230) late += game.nextId - before;
  }
  assert.ok(arrivals > 30);
  assert.ok(late > 0);
  assert.equal(game.status, "ended");
  const last = game.nextId;
  advance(game, 10);
  assert.equal(game.nextId, last);
});
