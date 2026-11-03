import voiceDurations from "./voice-durations.js";

export const COMPLAINTS = {
  office: {
    impatient: [
      "Eh boss, faster leh. My lunch break ending liao.",
      "Wah, queue until like that. I still got meeting leh.",
    ],
    critical: [
      "Chibai, lunch break over already lah!",
      "Lanjiao lah, wait until my boss call already!",
    ],
  },
  regular: {
    impatient: [
      "Ah Huat ah, my usual. Can faster a bit?",
      "Aiyo, my kopi leh? Wait very long already.",
    ],
    critical: [
      "Chibai, wait until hungry again already!",
      "Lanjiao lah, uncle cannot wait whole day leh!",
    ],
  },
  family: {
    impatient: [
      "Boss ah, kids hungry already. Help a bit leh.",
      "Two bowls only leh. Can faster or not?",
    ],
    critical: [
      "Chibai, whole family still waiting leh!",
      "Aiyo, kids making noise already lah!",
    ],
  },
};

export function impatientLine(type, urgent, variation = 0) {
  return impatientDialogue(type, urgent, variation).text;
}

export function impatientDialogue(type, urgent, variation = 0) {
  const speaker = COMPLAINTS[type] ? type : "office";
  const phase = urgent ? "critical" : "impatient";
  const lines = COMPLAINTS[speaker][phase];
  const index = Math.abs(Math.trunc(variation)) % lines.length;
  const file = `${speaker}-${phase}-${index}-sg2.mp3`;
  return {
    text: lines[index],
    clip: `/audio/voices/${file}`,
    duration: voiceDurations[file] || 6,
    urgent,
  };
}

export const HAWKER_CHATTER = [
  {
    id: "kopi-call",
    text: "Kopi, teh! Lai, kopi!",
    profile: "hawker-man",
  },
  {
    id: "toast-call",
    text: "Lai ah! Toast ready already!",
    profile: "hawker-woman",
  },
  {
    id: "dabao",
    text: "Uncle, two mee. Dabao, ah.",
    profile: "hawker-woman",
  },
  {
    id: "coming",
    text: "Can lah. Coming, coming!",
    profile: "hawker-man",
  },
  {
    id: "seat",
    text: "Here got people sit or not?",
    profile: "hawker-man",
  },
  {
    id: "share",
    text: "No lah. Sit, sit. Can share.",
    profile: "hawker-woman",
  },
  {
    id: "kosong",
    text: "Auntie, kopi kosong, one.",
    profile: "hawker-woman",
  },
  {
    id: "noodles-ready",
    text: "Lai, your mee! Careful ah, hot!",
    profile: "hawker-man",
  },
].map((line) => ({
  ...line,
  clip: `/audio/voices/chatter-${line.id}-sg2.mp3`,
}));
