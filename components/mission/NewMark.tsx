/**
 * Static arrival marker for reduced-motion users.
 *
 * Inputs: none. Outputs: a small "New" t-label for four seconds after mount when the
 * reduced-motion preference is active, otherwise nothing.
 * Invariants: the label is the only arrival cue in reduced mode; the timer is cleared on
 * unmount and the label never appears while animation is available.
 */

"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/** Shows "New" for four seconds under reduced motion. */
export function NewMark() {
  const reduced = useReducedMotion();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(timer);
  }, []);

  if (!reduced || !visible) return null;
  return <span className="t-label text-accent">New</span>;
}
