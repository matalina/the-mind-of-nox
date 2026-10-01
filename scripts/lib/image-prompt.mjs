/**
 * The prompt for an AI drawing of a night's creature, as Nox would have drawn
 * it at that age. Only the creature's appearance goes in: the game tags would
 * end up written on the drawing.
 */

import { handFor } from "../../src/config/notebook-math.js";

/** How well he draws, by notebook handwriting band. */
const SKILL = {
  child: "Wobbly scribbled lines and uneven shapes, like a small child.",
  kid: "A kid who draws every night: more detail, still unsure proportions.",
  teen: "A teenager who draws every night and is getting good: confident lines, some hatching.",
  adult: "A skilled young artist: clean, precise ink linework and cross-hatching, like a tattoo sketch.",
};

/**
 * He never draws himself (he can't see himself). The drawing is from his own
 * point of view, so the creature comes at whoever is looking at the page.
 */
const POINT_OF_VIEW =
  "Drawn from his own point of view: the monster is coming straight toward the viewer, close and filling the page. He does not draw himself, and there are no people in the drawing.";

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
  const name = `The ${c.movement} ${c.surface} ${c.form} of ${c.features}`;
  const form = c.form.toLowerCase();
  return [
    `A drawing by ${drawer(age)} of a monster from his nightmare: ${name}. It is ${c.surface.toLowerCase()}: ${SURFACE_HINT[c.surface]}. It is shaped like ${article(form)} ${form}: ${FORM_HINT[c.form]}. It is covered in ${c.features.toLowerCase()}, and it moves by ${c.movement.toLowerCase()}.`,
    SKILL[band],
    "Black ink lines only, on plain flat white paper. No color, no grey shading, no shadows, no paper texture. Not a photo of paper.",
    `${POINT_OF_VIEW} No words or labels, except sounds the monster makes.`,
  ].join("\n\n");
}
