const stroke =
  'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"';
const paths = {
  voices:
    '<path d="M3 4h14v11H9l-5 4v-4H3V4Zm4 4h6m-6 3h4m9-5a8 8 0 0 1 0 11m-1-8a4 4 0 0 1 0 5"/>',
  milk: '<path d="M7 3h10l3 5v13H4V8l3-5Zm0 0v5h13M7 8 4 8m4 5h8v5H8Z"/>',
  sugar:
    '<path d="m12 3 9 5v10l-9 4-9-4V8l9-5Zm0 10L3 8m9 5 9-5m-9 5v9M7 6l9 5"/>',
  stall:
    '<path d="M3 10h18M4 10v11h16V10M2 10l3-7h14l3 7M8 3l-1 7m9-7 1 7M8 21v-7h5v7"/><path d="M2 10a3 3 0 0 0 5 1 3 3 0 0 0 5 0 3 3 0 0 0 5 0 3 3 0 0 0 5-1"/>',
  bowl: '<path d="M3 11h18c-1 7-4 10-9 10S4 18 3 11Zm4-7 2 4m4-6v6m5-4-2 4M2 11h20"/>',
  upgrade: '<path d="m12 3 7 8h-4v10H9V11H5l7-8Z"/>',
  book: '<path d="M12 5C8 2 4 3 2 4v16c4-2 7-1 10 1 3-2 6-3 10-1V4c-3-1-7-2-10 1Zm0 0v16M5 8l4 1m6 0 4-1m-14 4 4 1m6 0 4-1"/>',
  trophy:
    '<path d="M7 3h10v7a5 5 0 0 1-10 0V3Zm0 2H3v3c0 3 2 4 5 4m9-7h4v3c0 3-2 4-5 4m-4 3v5m-5 1h10"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  money:
    '<rect x="2" y="5" width="20" height="14" rx="3"/><circle cx="12" cy="12" r="3"/><path d="M6 9v6m12-6v6"/>',
  heart:
    '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  heartbreak:
    '<path d="M9 3a5.5 5.5 0 0 0-6 9l9 9 9-9a5.5 5.5 0 0 0-8-8M12 3l-2 6 5 3-3 6"/>',
  lift: '<path d="M12 15V3m-5 5 5-5 5 5M4 14l2 7h12l2-7"/>',
  warning:
    '<path d="M10 3 2 19c-.4 1 .2 2 1.5 2h17c1.3 0 1.9-1 1.5-2L14 3c-.8-1.5-3.2-1.5-4 0ZM12 8v6m0 3h.01"/>',
  star: '<path d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6Z"/>',
  pause: '<path d="M8 5v14m8-14v14" stroke-width="4"/>',
  play: '<path d="m8 4 12 8-12 8V4Z"/>',
  sound:
    '<path d="m11 4-6 5H2v6h3l6 5V4Zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  mute: '<path d="m11 4-6 5H2v6h3l6 5V4Zm5 5 6 6m0-6-6 6"/>',
  music:
    '<path d="M9 18V5l12-3v13M9 8l12-3"/><ellipse cx="6" cy="18" rx="3" ry="2.5"/><ellipse cx="18" cy="15" rx="3" ry="2.5"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 4 3c-1 0-1 1-1 2m0 3h.01"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  bag: '<path d="M5 8h14l2 13H3L5 8Zm3 0V6a4 4 0 0 1 8 0v2"/>',
  chilli: '<path d="M17 7c-9-1-3 11-13 12 8 4 18-5 13-12Zm0 0c-1-4 2-5 4-5"/>',
  leaf: '<path d="M20 3C8 2 1 10 6 17c7 6 16-2 14-14ZM4 21 16 8"/>',
  coffee:
    '<path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8Zm14 1h2a4 4 0 0 1 0 8h-2M6 2v3m4-3v3m4-3v3"/>',
  toast:
    '<path d="M5 10a5 5 0 0 1-2-4c0-5 18-5 18 0a5 5 0 0 1-2 4v11H5V10Zm4 3h6m-6 4h6"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  pin: '<path d="M19 10c0 5-7 12-7 12S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
  spark:
    '<path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2Z"/>',
  reset: '<path d="M3 10a9 9 0 1 1 2 8M3 3v7h7"/>',
};
export const icon = (name, cls = "") =>
  `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true" ${stroke}>${paths[name] || paths.bowl}</svg>`;

const svg = (content, cls = "", view = "0 0 300 190") =>
  `<svg class="illustration ${cls}" viewBox="${view}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${content}</svg>`;
const steam =
  '<g class="steam" fill="none" stroke="#f8f0d6" stroke-width="5" stroke-linecap="round"><path d="M126 70c-14-16 12-21 0-38m27 34c-14-16 12-21 0-38m27 42c-14-16 12-21 0-38"/></g>';
const noodleLines =
  '<g fill="none" stroke="#efc36b" stroke-width="4" stroke-linecap="round"><path d="M91 100q10-14 23 0t25 0 25 0 25 0 23 0M88 108q10-14 23 0t25 0 25 0 25 0 27 0M96 116q10-14 23 0t25 0 25 0 25 0M109 124q10-14 23 0t25 0 25 0"/></g>';
export function food(type, cls = "", chilli = false, takeaway = false) {
  if (type === "noodles")
    return svg(
      `<ellipse cx="150" cy="162" rx="89" ry="10" fill="#294b3920"/>${takeaway ? '<path d="M68 93h164l-18 66H87Z" fill="#e3c69b" stroke="#b59870" stroke-width="3"/>' : '<path d="M64 100h172c-9 45-37 64-86 64s-77-19-86-64" fill="#faf2db" stroke="#d0c5a7" stroke-width="3"/><path d="M72 119q78 28 156 0" fill="none" stroke="#d1604e" stroke-width="6"/>'}<ellipse cx="150" cy="100" rx="86" ry="33" fill="#fff8e5" stroke="#d4c8a9" stroke-width="3"/><ellipse cx="150" cy="101" rx="73" ry="24" fill="#a76d31"/>${noodleLines}<g fill="#5d8550"><ellipse cx="193" cy="89" rx="16" ry="9" transform="rotate(-30 193 89)"/><ellipse cx="203" cy="102" rx="17" ry="8" transform="rotate(25 203 102)"/></g><g fill="#df9b83" stroke="#c47c67" stroke-width="2"><ellipse cx="105" cy="87" rx="17" ry="9" transform="rotate(-15 105 87)"/><ellipse cx="113" cy="104" rx="16" ry="9" transform="rotate(-15 113 104)"/></g>${chilli ? '<g fill="#c74d37"><ellipse cx="164" cy="90" rx="17" ry="8"/><circle cx="178" cy="100" r="6"/></g>' : ""}<g fill="#53915e"><rect x="144" y="83" width="4" height="9" transform="rotate(-22 144 83)"/><rect x="166" y="107" width="4" height="8"/><rect x="137" y="115" width="4" height="8" transform="rotate(30 137 115)"/></g><g stroke="#654732" stroke-width="5" stroke-linecap="round"><path d="m177 82 50-58m-39 63 51-57"/></g>`,
      cls,
    );
  if (type === "toast")
    return svg(
      '<ellipse cx="151" cy="158" rx="100" ry="15" fill="#294b3915"/><ellipse cx="150" cy="135" rx="110" ry="35" fill="#f9f4e3" stroke="#d8cdae" stroke-width="3"/><ellipse cx="150" cy="135" rx="95" ry="26" fill="none" stroke="#b5c5b1" stroke-width="2"/><path d="m65 118 68-60 80 66-69 35Z" fill="#b97135" stroke="#905124" stroke-width="3"/><path d="m70 108 65-59 77 66-69 34Z" fill="#e8b976" stroke="#a86b34" stroke-width="3"/><path d="m81 108 54-48 63 55-55 23Z" fill="#f3d29b"/><path d="m139 57 73 61 20-12-73-62Z" fill="#d49a53" stroke="#a86b34" stroke-width="3"/><path d="m145 61 64 55 15-10-64-54Z" fill="#86a361"/><path d="m75 112 67 37 5-10-65-38Z" fill="#8da467"/><path d="m137 70 58 49m-65-40 55 47m-66-37 55 44" stroke="#d6a365" stroke-width="3" stroke-linecap="round"/><path d="m151 72 22 18-13 10-22-18Z" fill="#f5dc8a"/>',
      cls,
    );
  return svg(
    '<ellipse cx="142" cy="161" rx="84" ry="13" fill="#294b3918"/><ellipse cx="145" cy="147" rx="85" ry="25" fill="#fff9e8" stroke="#d4c9aa" stroke-width="3"/><path d="M185 78h18c35 0 33 51-3 51h-15v-13h14c18 0 20-24 2-24h-16" fill="#fff8e6" stroke="#d4c9aa" stroke-width="4"/><path d="M91 75h104v50c0 35-104 35-104 0Z" fill="#fcf7e7" stroke="#d4c9aa" stroke-width="3"/><path d="M93 108h100m-100 7h100" stroke="#49826a" stroke-width="4"/><ellipse cx="143" cy="75" rx="52" ry="17" fill="#fff8e6" stroke="#d4c9aa" stroke-width="3"/><ellipse cx="143" cy="77" rx="43" ry="11" fill="#633f29"/><path d="M108 77q30-10 60 0" fill="none" stroke="#a67c46" stroke-width="3"/>' +
      steam,
    cls,
  );
}

export function stove(cooking = false) {
  return svg(
    `<ellipse cx="148" cy="175" rx="109" ry="11" fill="#294b3916"/><path d="m45 133 23-23h164l23 23v35H45Z" fill="#afbab0" stroke="#7c8a7c" stroke-width="3"/><path d="M45 136h210v32H45Z" fill="#d1d6c8"/><path d="M71 146h157" stroke="#7d897d" stroke-width="2"/><circle cx="213" cy="156" r="7" fill="#485b4e"/><circle cx="84" cy="156" r="4" fill="#d36a43"/><ellipse cx="148" cy="124" rx="75" ry="14" fill="#4d594c"/>${cooking ? '<path class="flame" d="m100 125 6-16 10 12 8-19 13 20 11-20 11 20 12-19 10 17 10-9 8 14" fill="#e9ae4b"/>' : ""}<path d="M82 78h132v30c-2 37-129 37-132 0Z" fill="#a9b8ac" stroke="#758f7b" stroke-width="3"/><path d="M82 88v21c3 23 129 23 132 0V88" fill="#c4cec0"/><ellipse cx="148" cy="79" rx="66" ry="24" fill="#d6dece" stroke="#7d9780" stroke-width="3"/><ellipse cx="148" cy="79" rx="55" ry="17" fill="#8fae96"/><g fill="none" stroke="#dfe9cf" stroke-width="2"><ellipse cx="125" cy="78" rx="13" ry="4"/><ellipse cx="164" cy="83" rx="16" ry="4"/></g><path d="M78 90H62v16h18m139-16h15v16h-16" fill="none" stroke="#6c8271" stroke-width="6" stroke-linecap="round"/><path d="m170 76 34-45 9 6-31 45Z" fill="#bb935e" stroke="#8f714b" stroke-width="2"/><ellipse cx="164" cy="82" rx="29" ry="14" fill="#c4ae73" stroke="#907e51" stroke-width="3"/><g stroke="#968355" stroke-width="1.5"><path d="m141 77 40 12m-38-18 42 12m-38-14 40 12m-30-15-10 23m20-21-10 25m19-20-10 21"/></g>${cooking ? steam : '<g fill="none" stroke="#a5b5a0" stroke-width="3" stroke-linecap="round"><path d="M117 42q-10-10 0-20m25 25q-10-10 0-20"/></g>'}`,
    cooking ? "is-cooking" : "",
  );
}
export function condiments() {
  return svg(
    '<ellipse cx="150" cy="171" rx="110" ry="9" fill="#294b3914"/><path d="M35 107h230v51H35Z" fill="#cdb68b" stroke="#ac9168" stroke-width="3"/><path d="M30 103h240v11H30Z" fill="#e6d6b5" stroke="#bca57d" stroke-width="2"/><path d="M57 58h45v52H57Z" fill="#b84632" stroke="#903f2d" stroke-width="3"/><ellipse cx="79" cy="59" rx="23" ry="8" fill="#d56a42"/><path d="M55 52h49v9H55Z" fill="#d1b081" stroke="#a78a62" stroke-width="2"/><path d="M76 48V29h8v19" fill="#d1b081" stroke="#a78a62" stroke-width="2"/><rect x="66" y="73" width="28" height="24" rx="3" fill="#f5dca8"/><path d="M75 79c-8 6 4 7-2 12 12 1 17-12 8-11l2-6" fill="#b44831"/><path d="M126 79h46l-5 33h-36Z" fill="#f4ebd2" stroke="#c3b494" stroke-width="2"/><ellipse cx="149" cy="79" rx="23" ry="9" fill="#5e8b51"/><g fill="none" stroke="#88a762" stroke-width="3"><path d="m138 73 6 9m8-12-2 12m12-8-5 8m-24-4 8 7"/></g><path d="M201 44h29v68h-29Z" fill="#785433" stroke="#5c432e" stroke-width="3"/><path d="M198 39h35v13h-35Z" fill="#cc9d58"/><path d="M207 19h16v20h-16Z" fill="#d4b77d"/><rect x="202" y="67" width="27" height="25" fill="#f0e3bd"/><path d="m209 75 6 6 6-6m-6 6v5" fill="none" stroke="#7d6341" stroke-width="2"/><path d="M52 125h196m-196 12h196" stroke="#b39c73" stroke-width="2"/>',
  );
}
export function portrait(type) {
  const regular = type === "regular",
    family = type === "family";
  return svg(
    `<circle cx="32" cy="32" r="31" fill="${regular ? "#e8cf8a" : family ? "#d9dfce" : "#e8d5c5"}"/><path d="M10 64c1-20 12-27 22-27s22 7 23 27" fill="${regular ? "#b9684f" : family ? "#8c9b68" : "#77958b"}"/>${!regular && !family ? '<path d="m25 41 7 11 7-11-7 5Z" fill="#f6efe0"/><path d="m32 49-4 11 5 4 4-4-4-11" fill="#335a50"/>' : ""}<path d="M18 24c0-20 29-20 29 0v10c0 18-29 18-29 0Z" fill="#d9a477"/><path d="M17 26C12 5 51 3 47 27l-9-10-16 5-1 8Z" fill="${regular ? "#6f7263" : "#4b4136"}"/><g fill="#3f3a2e"><circle cx="25" cy="30" r="1.4"/><circle cx="39" cy="30" r="1.4"/></g><path d="M28 37q4 4 8-1" stroke="#925d42" stroke-width="1.4" fill="none" stroke-linecap="round"/>${regular ? '<g fill="none" stroke="#4f5242" stroke-width="1.7"><circle cx="25" cy="30" r="6"/><circle cx="39" cy="30" r="6"/><path d="M31 30h2"/></g>' : ""}${family ? '<circle cx="48" cy="47" r="13" fill="#e3b98c"/><path d="M35 44c0-15 27-15 27 0l-8-7-15 8" fill="#574839"/><circle cx="43" cy="47" r="1"/><circle cx="52" cy="47" r="1"/><path d="M35 64v-9h24v9" fill="#d79e60"/>' : ""}`,
    "portrait",
    "0 0 64 64",
  );
}

export function skyline() {
  return svg(
    '<g fill="none" stroke="currentColor" stroke-width="2"><path d="M0 88h500M15 88V40h62v48M24 40V26h44v14m-38-4v-5m10 5v-5m10 5v-5m10 5v-5M24 52h13v20H24Zm29 0h13v20H53Zm-15 36V72h16v16m39 0V52h55v36m-48-36V36h41v16m-34-16 14-15 14 15m-30 23h9v14h-9Zm22 0h9v14h-9Zm44 29V29h53v59m-45-49h9v11h-9Zm25 0h9v11h-9Zm-25 21h9v11h-9Zm25 0h9v11h-9Zm40 28V42h43v46m-39-46 17-14 18 14m-24 46V67h15v21m36 0V19h12v69m12 0V16h12v72m12 0V19h12v69m-55-70q30 10 61 0l3-8q-30 9-65 0Zm88 70V49h60v39m-51-39V35h43v14m-39 10h11v16h-11Zm25 0h11v16h-11Zm50 29V57h37v31m-32-31V43h27v14"/></g>',
    "skyline",
    "0 0 500 100",
  );
}
