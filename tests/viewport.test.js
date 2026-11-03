import { test } from "node:test";
import { PerspectiveCamera, Vector3 } from "three";
import assert from "node:assert/strict";
import { kitchenViewport, stationBlend } from "../src/game-layout.js";

test("the sharp kitchen follows one reversible transition between valid centre and side frames", () => {
  for (const [width, height] of [
    [1280, 900],
    [390, 844],
    [844, 390],
  ]) {
    const centre = kitchenViewport(width, height, 0);
    const side = kitchenViewport(width, height, 1);
    let previous = centre;
    for (const view of [0.02, 0.08, 0.15, 0.3, 0.45, 0.6, 1]) {
      const current = kitchenViewport(width, height, view);
      assert.ok(current.top >= previous.top && current.top <= side.top);
      assert.ok(current.left >= previous.left && current.left <= side.left);
      assert.ok(current.width > 0 && current.height > 0);
      assert.equal(current.left + current.width, width);
      assert.equal(current.top + current.height, centre.bottom);
      assert.deepEqual(current, kitchenViewport(width, height, -view));
      previous = current;
    }
    assert.equal(stationBlend(0), 0);
    assert.equal(stationBlend(1), 1);
    assert.ok(kitchenViewport(width, height, 0.3).top > centre.top);
    assert.ok(kitchenViewport(width, height, 0.3).top < side.top);
  }
});

test("extending the rendered scene behind the HUD preserves every sharp-workspace projection", () => {
  for (const [width, height] of [
    [1280, 900],
    [390, 844],
    [844, 390],
  ])
    for (const view of [0, 0.1, 0.3, 0.5, 1]) {
      const frame = kitchenViewport(width, height, view);
      const focused = new PerspectiveCamera(
        55,
        frame.width / frame.height,
        0.1,
        85,
      );
      focused.position.set(0, 2.45, 1.65);
      focused.lookAt(
        Math.sin(view * 1.4) * 5,
        1.25,
        1.65 - Math.cos(view * 1.4) * 5,
      );
      focused.updateMatrixWorld();
      const extended = focused.clone();
      extended.setViewOffset(
        frame.width,
        frame.height,
        -frame.left,
        -frame.top,
        width,
        height,
      );
      for (const point of [
        new Vector3(-3.2, 1.4, 1.2),
        new Vector3(0, 1.5, -2.9),
        new Vector3(3.7, 2, 1.3),
      ]) {
        const before = point.clone().project(focused),
          after = point.clone().project(extended);
        const expectedX = frame.left + (before.x / 2 + 0.5) * frame.width;
        const expectedY = frame.top + (-before.y / 2 + 0.5) * frame.height;
        assert.ok(Math.abs(expectedX - (after.x / 2 + 0.5) * width) < 1e-8);
        assert.ok(Math.abs(expectedY - (-after.y / 2 + 0.5) * height) < 1e-8);
      }
    }
});

test("the intro can use the whole screen without changing the three station layouts", () => {
  assert.deepEqual(kitchenViewport(1280, 900, 1, true), {
    left: 0,
    top: 0,
    width: 1280,
    height: 900,
    right: 1280,
    bottom: 900,
  });
});
