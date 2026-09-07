import { writeFileSync } from "node:fs";

const rows = [
  "1111000000001110",
  "1111000000001110",
  "1111000000001110",
  "1111000000000000",
  "0000001100000000",
  "1111111111111110",
  "0001101101100000",
  "0001101101100000",
  "0001101101100000",
  "0001100001100000",
  "0001101111110000",
  "0000000001100000",
  "1111000001101111",
  "1111000001101000",
  "1111000001101111",
  "0000000000000000",
];

const grid = rows.map((row) => [...row].map((cell) => (cell === "1" ? 0 : 255)));

function rotateClockwise(source) {
  return source[0].map((_, x) => source.map((row) => row[x]).reverse());
}

const orientations = [grid];
for (let index = 1; index < 4; index += 1) {
  orientations.push(rotateClockwise(orientations[index - 1]));
}

const pattern = orientations
  .flatMap((orientation) =>
    [0, 1, 2].flatMap(() => [
      ...orientation.map((row) => row.map((value) => String(value).padStart(3, " ")).join(" ")),
      "",
    ]),
  )
  .join("\n");

writeFileSync("frontend/public/assets/tuklas-marker.patt", `${pattern}\n`);

const cellSize = 16;
const offset = 192;
const blocks = rows
  .flatMap((row, y) =>
    [...row].flatMap((cell, x) =>
      cell === "1"
        ? [`  <rect x="${offset + x * cellSize}" y="${offset + y * cellSize}" width="${cellSize}" height="${cellSize}" fill="#111"/>`]
        : [],
    ),
  )
  .join("\n");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" role="img" aria-labelledby="title desc">
  <title id="title">Tuklas AR reusable marker</title>
  <desc id="desc">A black and white square marker trained for the Tuklas AR Science Lab prototype.</desc>
  <rect width="640" height="640" fill="#fff"/>
  <rect x="64" y="64" width="512" height="512" fill="#111"/>
  <rect x="192" y="192" width="256" height="256" fill="#fff"/>
${blocks}
  <text x="320" y="620" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="900" fill="#111">TUKLAS AR</text>
</svg>
`;

writeFileSync("frontend/public/assets/tuklas-marker.svg", svg);
