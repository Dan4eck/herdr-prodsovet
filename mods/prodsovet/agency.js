import { style, agentAccent, appearance } from "./appearance.js";
// SPDX-License-Identifier: Apache-2.0
// ProdAdvice for Herdr: customized interface and behavior, 2026. See NOTICE.
// Agency-page decoration (profiles with style.agency): agent colors, tinted
// selection, pixel icons, the halftone, text rails, typewriter and glitch frames.
// Everything here is native gpui: tinted one-color SVGs and text frames.

import { div, svg } from "gpui-kit";
import { settings } from "herdr";
import { artKind } from "./creatures.js";

const ART = "mods/prodsovet/art/agency";

export const agency = () => style("agency") === true;

// The agent's own color where the profile has one; otherwise the status color.
export function accentOf(program, t, status = "working") {
  const own = program ? agentAccent(artKind(program.key)) : null;
  return own ?? t[status] ?? t.accent;
}

// The one "selected" look everywhere (tab, agent, space, file): a quiet fill
// in the owner's color, nothing else.
export function selected(el, t, color) {
  return el.bg((color ?? t.foreground) + "24");
}

// The 7 px halftone screen fading upwards (420 x 84), for the bottom of a column.
export const halftone = (color) => svg(`${ART}/halftone.svg`).w(420).h(84).text_color(color);

// A lead running along a dotted rail (pane headers): working moves, done arrived.
const RAIL = 9;
const rail = (i, mark = "●") => "·".repeat(i) + mark + "·".repeat(RAIL - 1 - i);
const RAILS = {
  working: Array.from({ length: RAIL }, (_, i) => rail(i)),
  blocked: [rail(4, "!"), "·".repeat(RAIL)],
  done: [rail(RAIL - 1)],
  idle: ["·".repeat(RAIL)],
};
export function railFrames(status) {
  const st = RAILS[status] ? status : "idle";
  return { frames: RAILS[st], ms: { working: 120, blocked: 420, done: 1000, idle: 1000 }[st] };
}

// Typewriter frames: the text appears, the cursor blinks, then it starts over.
export function typed(text, hold = 14) {
  const out = [];
  for (let i = 0; i <= text.length; i++) out.push(text.slice(0, i) + "_");
  for (let i = 0; i < hold; i++) out.push(text + (i % 2 ? " " : "_"));
  return out;
}

// A rare two-frame glitch for an overlay copy of a title: blank for `length`
// 100 ms frames (~9 s by default), shown only at `at` and `at + 2`.
export function glitch(text, at, length = 90) {
  return Array.from({ length }, (_, i) => (i === at || i === at + 2 ? text : ""));
}

// A text with the brand glitch: offset neon and coral copies flash rarely.
// `base` is a function returning a fresh styled div (font, size, line height).
export function glitchy(base, text, t, { color = t.foreground, at = 80, length = 90 } = {}) {
  const neon = appearance().brandColors[settings()?.dark === false ? "light" : "dark"];
  return div().relative().flex_none()
    .child(base().text_color(color).child(text))
    .child(base().absolute().top(0).left(-2).opacity(0.85).text_color(neon).frames(glitch(text, at, length), 100))
    .child(base().absolute().top(0).left(2).opacity(0.8).text_color(t.blocked).frames(glitch(text, at + 1, length), 100));
}

// Pixel icons (12 x 12 dot matrix) in agency profiles, the stock icon otherwise.
export const px = (name) => `mods/prodsovet/art/px/${name}.svg`;
export const icon = (name, stock) => (agency() ? px(name) : stock);
