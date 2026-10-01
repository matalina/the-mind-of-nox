/**
 * Marks on the page itself. Blood follows the magic: a night the creature
 * manifested is a night he bled. The coffee stain is its own 1d6: a ring in
 * one of three places on an even roll, none on an odd one. The spots are
 * the .stain--coffee-N classes in main.css.
 */

const die = (sides) => 1 + Math.floor(Math.random() * sides);

export const rollCoffeeStain = () => die(6);

const SPOT = { 2: "top right", 4: "middle left", 6: "bottom right" };

export function describeCoffeeStain(roll) {
  return SPOT[roll]
    ? `Coffee stain: d6 ${roll}, a ring at the ${SPOT[roll]}.`
    : `Coffee stain: d6 ${roll}, none.`;
}
