// SPDX-License-Identifier: Apache-2.0
import assert from "node:assert/strict";
import { parseBlocks } from "../mods/file-tab/md-blocks.js";

const doc = [
  "Intro",
  "",
  "![График](media/chart.png)",
  "",
  '<figure>\n  <img src="https://x.test/a.png" alt="A">\n  <figcaption>Подпись. <a href="https://x.test/src">Источник</a>.</figcaption>\n</figure>',
  "",
  '<figure>\n  <video controls poster="media/p.jpg" src="media/v.mp4" aria-label="Видео"></video>\n  <figcaption>Клип</figcaption>\n</figure>',
  "",
  "```md",
  "![не картинка](x.png)",
  "```",
  "",
  "Конец",
].join("\n");
const b = parseBlocks(doc);
const media = b.filter((x) => x.type === "media");
assert.equal(media.length, 3);
assert.deepEqual(media[0], { type: "media", kind: "image", src: "media/chart.png", alt: "График" });
assert.equal(media[1].src, "https://x.test/a.png");
assert.equal(media[1].caption, "Подпись. [Источник](https://x.test/src).");
assert.equal(media[2].kind, "video");
assert.equal(media[2].poster, "media/p.jpg");
assert.ok(b.some((x) => x.type === "text" && x.value.includes("![не картинка](x.png)")), "fenced code stays text");
assert.equal(b[0].value.trim(), "Intro");
assert.equal(b.at(-1).value.trim(), "Конец");
console.log("md-blocks: PASS");
