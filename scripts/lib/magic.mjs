/**
 * Nox's magic on a night: the Sussuri Innate Trait from Breaking the Cycle.
 * Roll 1d4 for the state (content, taint only, or both active); unless he is
 * content, roll 1d10 for the emotion driving his magic. Pain with both active
 * is a manifestation, one night in twenty: the creature caught him and hurt
 * him, he lashed out with raw magic, and it was cast out into the world. Nox
 * never knows, so it is recorded only as a GM note in the front matter.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TABLE = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "..", "src", "data", "sussuriMagic.json"), "utf8"),
);

const die = (sides) => 1 + Math.floor(Math.random() * sides);

export function rollMagic() {
  const stateRoll = die(4);
  const state = TABLE.state[stateRoll];
  if (state === "content") {
    return { magic: { stateRoll, state }, manifested: false };
  }
  const emotionRoll = die(10);
  const e = TABLE.emotions[emotionRoll - 1];
  const magic = { stateRoll, state, emotionRoll, emotion: e.emotion };
  if (state === "both active") magic.bleed = e.bleed;
  magic.tinge = e.tinge;
  const manifested = state === "both active" && e.emotion === "Pain";
  return {
    magic,
    manifested,
    ...(manifested && {
      gmNote:
        "Pain, with both active: this creature manifested. It caught him and hurt him, he lashed out with raw magic, and it was cast out into the world somewhere far from him. He woke cracked. Nox does not know.",
    }),
  };
}

/** Front matter lines for a magic roll. */
export function magicFrontMatter({ magic, manifested, gmNote }) {
  const q = (v) => JSON.stringify(v);
  return [
    "magic:",
    ...Object.entries(magic).map(([k, v]) => `  ${k}: ${q(v)}`),
    `manifested: ${manifested}`,
    ...(gmNote ? [`gmNote: ${q(gmNote)}`] : []),
  ];
}

/** One line for the console. */
export function describeMagic({ magic: m, manifested }) {
  if (m.state === "content") return `Magic: d4 ${m.stateRoll}, content. Nothing happens.`;
  const effects = [m.bleed && `bleeds ${m.bleed}`, `tinged ${m.tinge}`].filter(Boolean).join(", ");
  return `Magic: d4 ${m.stateRoll}, ${m.state}; d10 ${m.emotionRoll}, ${m.emotion} (${effects}).${
    manifested ? "\nGM NOTE: Pain with both active. The creature manifested into the world." : ""
  }`;
}
