// Separate screen regions for orders, the interactive kitchen and feedback.
export function stationBlend(view) {
  const amount = Math.min(1, Math.abs(view) / 0.62);
  return amount * amount * (3 - 2 * amount);
}

export function kitchenViewport(width, height, view, ready = false) {
  if (ready)
    return { left: 0, top: 0, width, height, right: width, bottom: height };
  const centre = gameLayout(width, height, false).work;
  const side = gameLayout(width, height, true).work;
  const blend = stationBlend(view);
  const left = centre.left + (side.left - centre.left) * blend;
  const top = centre.top + (side.top - centre.top) * blend;
  const bottom = height - centre.bottom;
  return {
    left,
    top,
    width: width - left,
    height: bottom - top,
    right: width,
    bottom,
  };
}

export function gameLayout(width, height, side = true) {
  const landscape = width > height && height < 600;
  const portrait = !landscape && width < 650;
  const footer = landscape ? 92 : 144;
  const cardWidth = landscape
    ? 204
    : portrait
      ? (width - 48) / 3
      : Math.min(224, (width - 72) / 3);
  const cardHeight = landscape
    ? Math.min(70, (height - 162) / 3)
    : portrait
      ? 104
      : 116;
  const spacing = cardWidth + (portrait ? 12 : 16);
  const docks = [0, 1, 2].map((index) =>
    landscape
      ? { x: 12 + cardWidth / 2, y: 64 + (index + 1) * cardHeight + index * 6 }
      : {
          x: width / 2 + (index - 1) * spacing,
          y: (portrait ? 146 : 94) + cardHeight,
        },
  );
  return {
    mode: landscape ? "landscape" : portrait ? "portrait" : "wide",
    cardWidth,
    cardHeight,
    docks,
    work: {
      left: side && landscape ? cardWidth + 24 : 0,
      top: side
        ? landscape
          ? 64
          : portrait
            ? 262
            : 222
        : portrait
          ? 144
          : landscape
            ? 60
            : 88,
      bottom: footer,
    },
  };
}
