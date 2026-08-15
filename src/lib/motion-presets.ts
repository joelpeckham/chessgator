import type { Transition } from "motion/react";

/** Snappy overshoot for elements popping into existence. */
export const popSpring: Transition = {
  type: "spring",
  stiffness: 560,
  damping: 26,
  mass: 0.8,
};

/** Calm glide for elements moving to a new position. */
export const settleSpring: Transition = {
  type: "spring",
  stiffness: 340,
  damping: 34,
};

/** Playful, extra-bouncy spring for mascot motion. */
export const bouncySpring: Transition = {
  type: "spring",
  stiffness: 430,
  damping: 16,
};
