/**
 * The prompt for an AI drawing of a night's creature, as Nox would have drawn
 * it at that age. Only the creature's appearance goes in, not its name or game
 * tags: anything named ends up written on the drawing.
 */

import { handFor } from "../../src/config/notebook-math.js";

/**
 * How well he draws, by notebook handwriting band. Image models draw too well
 * by default, so the child band spells out what a real small child's drawing
 * looks like, and that it is not an adult imitating one.
 */
const SKILL = {
  child:
    "It must look like a real drawing by a small child, not an adult or an artist imitating a child's style. Drawn with a fat black marker gripped in a fist: shaky, wobbly lines that overshoot and don't meet, lopsided circles, stick legs, a few scribbled patches, wrong proportions and no perspective. Everything is flat and simple. No hatching, no shading, no fine detail, no neat outlines.",
  kid: "Drawn by a kid who draws every night: more detail than a small child, but still stiff, uneven lines and unsure proportions. Simple scribbled hatching at most.",
  teen: "Drawn by a teenager who draws every night and is getting good: confident lines, some hatching, mostly right proportions.",
  adult: "Drawn by a skilled young artist: clean, precise ink linework and cross-hatching, like a tattoo sketch.",
};

/**
 * He never draws himself (he can't see himself). The drawing is from his own
 * point of view, at the moment he woke: the creature lunging at whoever is
 * looking at the page.
 */
const POINT_OF_VIEW =
  "Drawn from his own point of view, the instant before he woke up: the monster is lunging straight at the viewer, mid-attack and about to hit, so close it fills the picture and spills past the edges. It is the last image seared into his mind as he jolted awake. He does not draw himself, and there are no people in the drawing.";

/**
 * Before every nightmare he dreams of his soulmate, Alex, and forgets it. What
 * lingers is the phoenix tattooed on Alex's inner wrist, so a bird turns up in
 * every drawing without him knowing why. Described, never copied: it is his
 * own doodle of it, in the same hand as the monster.
 */
const PHOENIX =
  "a phoenix rising with both wings swept up and outward, its long feathers curving like flames, a small hooked beak and a curled crest on its head, and a long tail that flows down in S-shaped ribbons like smoke";

/** The same phoenix, as a small child can draw it. */
const CHILD_PHOENIX =
  "a simple bird with two big wings pointing up like flames, a little curl on its head, and a long wavy tail";

const bird = (band) =>
  `Somewhere in the picture, small and apart from the monster, he has also drawn a bird, without knowing why: ${band === "child" ? CHILD_PHOENIX : PHOENIX}. It is calm, not part of the nightmare, and drawn in the same hand and ink as the rest, no better.`;

/** What each surface looks like in black ink. */
const SURFACE_HINT = {
  Glass: "clear and smooth, with sharp cracked edges and glints",
  Ashen: "crumbling and flaking like burnt paper, with ash falling off it",
  Waxen: "smooth and melting, with drips like a candle",
  Chitinous: "hard shell plates like a beetle, with segmented joints",
  "Wet-furred": "matted, clumped fur, dripping wet",
  "Raw-skinned": "skinned and raw, with muscle lines and veins showing",
  Rusted: "flaking, pitted metal with rivets and holes",
  "Tar-slick": "black, glossy and sticky, with strings stretching off it",
  Paper: "folded and crumpled paper, with creases and torn edges",
  "Bone-plated": "covered in plates of bone, like ribs and pieces of skull",
  Mossy: "overgrown with moss and little hanging roots",
  Feathered: "covered in ragged, overlapping feathers",
  Porcelain: "smooth and shiny with cracks, like a broken teacup or doll",
  Rubbery: "stretchy and bulging, with wrinkles where it bends",
  Oily: "slick and shiny, with drips and puddles running off it",
  Scabbed: "covered in crusted scabs and peeling patches",
  Velvet: "soft and fuzzy, drawn with fine short strokes like a stuffed toy",
  Mirrored: "smooth mirror panels that reflect nothing at all",
  "Sand-crusted": "crusted in grainy sand, drawn with stippled dots, sand pouring off it",
  Glittering: "covered in tiny sparkles and star-shaped glints",
};

/** What each form looks like in black ink. */
const FORM_HINT = {
  Tangle: "a knotted tangle of loops and strands",
  Column: "a tall, narrow pillar standing upright",
  Knot: "one tight, twisted knot",
  Sheet: "a thin, flat sheet that bends and flaps like a blanket",
  Heap: "a sagging pile slumped on the ground",
  Sphere: "a round ball",
  Coil: "wound in loops like a spring or a coiled snake",
  Spiral: "winding inward like a snail shell",
  Cluster: "many round lumps stuck together like grapes",
  Mass: "a shapeless, lumpy blob",
  Tower: "very tall, stacked and leaning over the viewer",
  Web: "strands spread out like a spider's web",
  Cocoon: "a wrapped pod bound in strands",
  Husk: "an empty, dried-out shell, cracked open and hollow",
  Lattice: "a crisscross frame of bars like a fence",
  Bundle: "many long pieces tied together like sticks",
  Wedge: "thick at one end and sharp at the other, like a doorstop",
  Ring: "a ring with an empty hole in the middle",
  Stalk: "a single tall stem with something on top",
  Sack: "a baggy sack, bulging and drooping",
};

const article = (word) => (/^[aeiou]/i.test(word) ? "an" : "a");

/** "a 4-year-old boy", "a 15-year-old teenager", "a 20-year-old man". */
const drawer = (age) =>
  `a ${age}-year-old ${age >= 18 ? "man" : age >= 13 ? "teenager" : "boy"}`;

export function imagePrompt({ notebook, age, creature: c }) {
  const band = handFor(notebook);
  const form = c.form.toLowerCase();
  return [
    `A drawing by ${drawer(age)} of a monster from his nightmare. It is ${c.surface.toLowerCase()}: ${SURFACE_HINT[c.surface]}. It is shaped like ${article(form)} ${form}: ${FORM_HINT[c.form]}. It is covered in ${c.features.toLowerCase()}, and it moves by ${c.movement.toLowerCase()}.`,
    SKILL[band],
    "Black ink lines only, on a plain white background that fills the whole image edge to edge. No color, no grey shading, no shadows.",
    POINT_OF_VIEW,
    bird(band),
    "No text anywhere in the picture: no words, no letters, no sound effects, no labels, no title, no signature.",
  ].join("\n\n");
}
