import { test } from "node:test";
import assert from "node:assert/strict";
import { HawkerGame, orderPatience } from "../src/game.js";

function advance(game, seconds) {
  for (let t = 0; t < seconds; t += 0.25) game.tick(0.25);
}
test("opening orders have time for the full multi-step recipes", () => {
  const game = new HawkerGame();
  assert.deepEqual(
    game.orders.map((order) => order.patience),
    [110, 162, 200],
  );
  game.start();
  advance(game, 90);
  assert.equal(
    game.lost,
    0,
    "the old office and regular deadlines no longer cut preparation short",
  );
  assert.equal(game.orders.length, 3);
});
test("larger orders, coffee additions and takeaway packing each add preparation time", () => {
  const black = [{ type: "kopi", milk: false, sugar: false }];
  const milk = [{ type: "kopi", milk: true, sugar: false }];
  const sweet = [{ type: "kopi", milk: true, sugar: true }];
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
test("the longer shift closes arrivals for the last minute so the player can finish existing tickets", () => {
  const game = new HawkerGame();
  game.start();
  assert.equal(game.duration, 240);
  advance(game, 180);
  game.orders = [];
  game.selectedOrder = null;
  advance(game, 5);
  assert.equal(game.orders.length, 0);
  assert.equal(game.status, "running");
  advance(game, 55);
  assert.equal(game.status, "ended");
});
