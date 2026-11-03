const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

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
  const turn = clamp(Math.abs(view) / 0.62, 0, 1);
  const blend = turn * turn * (3 - 2 * turn);
  const margin = width < 650 ? 58 : 85;
  const spacing = Math.min(
    width >= 650 ? 190 : 122,
    (width - 24) / Math.max(1, count),
  );
  const railX = width / 2 + (index - (count - 1) / 2) * spacing;
  const railY = height < 500 ? 104 : width < 650 ? 202 : 145;
  const headX = clamp(x, margin, width - margin);
  const headY = clamp(y, 150, height - 80);
  return {
    x: headX + (railX - headX) * blend,
    y: headY + (railY - headY) * blend,
    blend,
  };
}
