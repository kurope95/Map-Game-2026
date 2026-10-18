import type { CountryId } from "../../game/state/types";

function horizontal(colors: string[]): string {
  const height = 20 / colors.length;
  return colors
    .map(
      (color, index) =>
        `<rect x="0" y="${(index * height).toFixed(2)}" width="30" height="${height.toFixed(2)}" fill="${color}"/>`
    )
    .join("");
}

function vertical(colors: string[]): string {
  const width = 30 / colors.length;
  return colors
    .map(
      (color, index) =>
        `<rect x="${(index * width).toFixed(2)}" y="0" width="${width.toFixed(2)}" height="20" fill="${color}"/>`
    )
    .join("");
}

function macedoniaRays(): string {
  const rays: string[] = [];
  for (let index = 0; index < 8; index += 1) {
    const angle = (index * Math.PI) / 4;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const baseX = 15 + cos * 3.4;
    const baseY = 10 + sin * 3.4;
    const perpX = -sin * 1.2;
    const perpY = cos * 1.2;
    const tipX = 15 + cos * 15.5;
    const tipY = 10 + sin * 15.5;
    rays.push(
      `<polygon points="${(baseX + perpX).toFixed(2)},${(baseY + perpY).toFixed(2)} ${(baseX - perpX).toFixed(
        2
      )},${(baseY - perpY).toFixed(2)} ${tipX.toFixed(2)},${tipY.toFixed(2)}" fill="#ffe600"/>`
    );
  }
  return rays.join("");
}

const KOSOVO_STARS = [
  [9.5, 7],
  [11.2, 4.8],
  [13.5, 3.8],
  [16.5, 3.8],
  [18.8, 4.8],
  [20.5, 7]
]
  .map(([cx, cy]) => `<circle cx="${cx}" cy="${cy}" r="0.8" fill="#ffffff"/>`)
  .join("");

const BOSNIA_STARS = Array.from({ length: 7 }, (_, index) => {
  const t = (index + 1) / 8;
  return `<circle cx="${(8 + t * 14).toFixed(2)}" cy="${(t * 20).toFixed(2)}" r="0.75" fill="#ffffff"/>`;
}).join("");

const FLAG_BODIES: Record<CountryId, string> = {
  RUSSIA: horizontal(["#ffffff", "#1c3f94", "#d52b1e"]),
  BELARUS: `<rect width="30" height="13.33" fill="#c8313e"/><rect y="13.33" width="30" height="6.67" fill="#4aa657"/><rect width="3" height="20" fill="#ffffff"/>`,
  NOVOROSSIA: `<rect width="30" height="20" fill="#c8102e"/><path d="M0 0 L30 20 M30 0 L0 20" stroke="#ffffff" stroke-width="4.2"/><path d="M0 0 L30 20 M30 0 L0 20" stroke="#2b5fb0" stroke-width="2.6"/>`,
  PRIDNESTROVIE: horizontal(["#c8102e", "#00843d", "#c8102e"]),
  SLOVAKIA: `${horizontal(["#ffffff", "#0b4ea2", "#ee1c25"])}<rect x="6" y="6" width="7" height="9" rx="0.8" fill="#ee1c25" stroke="#ffffff" stroke-width="0.8"/><rect x="8.9" y="7.3" width="1.2" height="6.2" fill="#ffffff"/><rect x="7.9" y="8.4" width="3.2" height="1" fill="#ffffff"/><rect x="7.9" y="10.6" width="3.2" height="1" fill="#ffffff"/>`,
  HUNGARY: horizontal(["#ce2939", "#ffffff", "#477050"]),
  GERMANY: horizontal(["#000000", "#dd0000", "#ffce00"]),
  POLAND: horizontal(["#ffffff", "#dc143c"]),
  ROMANIA: vertical(["#002b7f", "#fcd116", "#ce1126"]),
  CZECH_REPUBLIC: `<rect width="30" height="10" fill="#ffffff"/><rect y="10" width="30" height="10" fill="#d7141a"/><polygon points="0,0 15,10 0,20" fill="#11457e"/>`,
  FINLAND: `<rect width="30" height="20" fill="#ffffff"/><rect x="8" width="5" height="20" fill="#002f6c"/><rect y="8" width="30" height="4" fill="#002f6c"/>`,
  BALTIC_FEDERATION: horizontal(["#0072ce", "#9e3039", "#fdb913"]),
  UKRAINE: horizontal(["#005bbb", "#ffd500"]),
  AUSTRIA: horizontal(["#ed2939", "#ffffff", "#ed2939"]),
  SERBIA: horizontal(["#c6363c", "#0c4076", "#ffffff"]),
  SWITZERLAND: `<rect width="30" height="20" fill="#d52b1e"/><rect x="13" y="4" width="4" height="12" fill="#ffffff"/><rect x="9" y="8" width="12" height="4" fill="#ffffff"/>`,
  BOSNIA_AND_HERZEGOVINA: `<rect width="30" height="20" fill="#002395"/><polygon points="8,0 22,0 22,20" fill="#fecb00"/>${BOSNIA_STARS}`,
  MONTENEGRO: `<rect width="30" height="20" fill="#c40308"/><rect x="0.7" y="0.7" width="28.6" height="18.6" fill="none" stroke="#d4af3a" stroke-width="1.4"/>`,
  KOSOVO: `<rect width="30" height="20" fill="#244aa5"/>${KOSOVO_STARS}`,
  ALBANIA: `<rect width="30" height="20" fill="#e41e20"/><path d="M15 4 L19 8 L23 7 L20 11 L22 15 L17 13 L15 16 L13 13 L8 15 L10 11 L7 7 L11 8 Z" fill="#000000"/>`,
  NORTH_MACEDONIA: `<rect width="30" height="20" fill="#d20000"/>${macedoniaRays()}<circle cx="15" cy="10" r="3" fill="#ffe600"/>`,
  CROATIA: `${horizontal(["#ff0000", "#ffffff", "#171796"])}<rect x="12" y="6" width="6" height="8" rx="0.6" fill="#ff0000" stroke="#ffffff" stroke-width="0.7"/>`,
  SLOVENIA: `${horizontal(["#ffffff", "#005da4", "#ed1c24"])}<rect x="6" y="7" width="6" height="8" rx="0.6" fill="#005da4" stroke="#ed1c24" stroke-width="0.8"/>`,
  MOLDOVA: `${vertical(["#0046ae", "#ffd200", "#cc092f"])}<rect x="12" y="7" width="6" height="8" rx="0.6" fill="#8a5a2b"/>`
};

export function flagSvgMarkup(countryId: CountryId, width: number, height: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 30 20">${FLAG_BODIES[countryId]}</svg>`;
}
