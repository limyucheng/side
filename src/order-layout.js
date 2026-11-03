const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
import { gameLayout, stationBlend } from "./game-layout.js";

// One ticket travels between its customer's head and a stable rail position.
// Use the centre camera's anchor so an off-screen projection cannot fling it away.
export function orderTicketPosition({
  index,
  count,
  x,
  y,
  view,
  width,
  height,
}) {
  const blend = stationBlend(view);
  const margin = width < 650 ? 58 : 85;
  const layout = gameLayout(width, height);
  const slot = layout.mode === "landscape" ? index : index + (3 - count) / 2;
  const railX =
    layout.mode === "landscape"
      ? layout.docks[0].x
      : width / 2 +
        (slot - 1) *
          (layout.cardWidth + (layout.mode === "portrait" ? 12 : 16));
  const railY =
    layout.mode === "landscape"
      ? 64 + (index + 1) * layout.cardHeight + index * 6
      : layout.docks[0].y;
  const headX = clamp(x, margin, width - margin);
  const headY = clamp(y, 150, height - 80);
  return {
    x: headX + (railX - headX) * blend,
    y: headY + (railY - headY) * blend,
    blend,
  };
}
