import { test } from "node:test";
import assert from "node:assert/strict";
import { orderTicketPosition } from "../src/order-layout.js";

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
test("tickets return exactly to their customer's head in the centre view", () => {
  assert.deepEqual(position(), { x: 200, y: 400, blend: 0 });
});
test("either side view uses the same stable order rail despite off-screen head positions", () => {
  assert.deepEqual(
    position({ view: -1, x: -10000, y: -10000 }),
    position({ view: 1, x: 10000, y: 10000 }),
  );
  assert.equal(position({ view: -1 }).blend, 1);
});
test("turning moves tickets continuously through intermediate positions", () => {
  let previous = position();
  const end = position({ view: 1 });
  for (const view of [0.05, 0.15, 0.3, 0.45, 0.6]) {
    const current = position({ view });
    assert.ok(current.x > previous.x && current.x < end.x);
    assert.ok(current.y < previous.y && current.y > end.y);
    previous = current;
  }
});
test("three rail tickets fit without overlap on portrait, landscape and desktop screens", () => {
  for (const [width, height, ticketWidth] of [
    [390, 844, 116],
    [844, 390, 178],
    [1280, 900, 178],
    [1920, 1080, 178],
  ]) {
    const tickets = [0, 1, 2].map((index) =>
      position({ index, width, height, view: 1 }),
    );
    assert.ok(tickets[0].x - ticketWidth / 2 >= 0);
    assert.ok(tickets[2].x + ticketWidth / 2 <= width);
    for (let i = 1; i < tickets.length; i++)
      assert.ok(tickets[i].x - tickets[i - 1].x >= ticketWidth);
    assert.ok(tickets[0].y < height - 100);
  }
});
