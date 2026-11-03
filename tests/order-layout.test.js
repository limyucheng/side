import { test } from "node:test";
import assert from "node:assert/strict";
import { orderTicketPosition } from "../src/order-layout.js";
import { gameLayout } from "../src/game-layout.js";
const position = (overrides = {}) =>
  orderTicketPosition({
    index: 0,
    count: 3,
    x: 200,
    y: 400,
    view: 0,
    width: 1280,
    height: 900,
    ...overrides,
  });
test("tickets return to customer heads and use the same stable dock in either side view", () => {
  assert.deepEqual(position(), { x: 200, y: 400, blend: 0 });
  assert.deepEqual(
    position({ view: -1, x: -10000, y: -10000 }),
    position({ view: 1, x: 10000, y: 10000 }),
  );
});
test("turning moves a ticket continuously to its dock", () => {
  let previous = position();
  const end = position({ view: 1 });
  for (const view of [0.05, 0.15, 0.3, 0.45, 0.6]) {
    const current = position({ view });
    assert.ok(current.x > previous.x && current.x < end.x);
    assert.ok(current.y < previous.y && current.y > end.y);
    previous = current;
  }
});
test("large orders occupy their own region, clear of the kitchen and footer at each screen size", () => {
  for (const [width, height] of [
    [390, 844],
    [844, 390],
    [1280, 900],
    [1920, 1080],
  ]) {
    const layout = gameLayout(width, height),
      { cardWidth: w, cardHeight: h, work } = layout;
    const cards = [0, 1, 2].map((index) =>
      position({ index, width, height, view: 1 }),
    );
    for (const p of cards) {
      assert.ok(p.x - w / 2 >= 0 && p.x + w / 2 <= width);
      assert.ok(p.y < height - work.bottom);
      assert.ok(
        p.y <= work.top || p.x + w / 2 <= work.left,
        "tickets do not cover the kitchen",
      );
    }
    for (let i = 1; i < cards.length; i++)
      assert.ok(
        cards[i].x - cards[i - 1].x >= w || cards[i].y - cards[i - 1].y >= h,
        "cards do not overlap",
      );
    assert.ok(
      w >= 110 && h >= 68,
      "tickets have room for readable food and preference icons",
    );
  }
});
