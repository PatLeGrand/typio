import { BLOB_COLOR_HEX, type BlobGlasses, type BlobHat, type BlobStyle } from "./blobStyle";

/** Dimensions du SVG composite (inclut l'espace au-dessus de la tête pour les couvre-chefs et la visière). */
export const BLOB_SVG_WIDTH = 108;
export const BLOB_SVG_HEIGHT = 118;

const BLOB_OFFSET_X = 4;
const BLOB_OFFSET_Y = 22;

/** Trait d'encre commun au blob d'origine (`public/race/blob.svg`). */
const INK = "#293C49";

/** Silhouette exacte de `public/race/blob.svg` (repère local 94×94). */
const BODY_PATH =
  "M39.3389 1.69629C47.127 0.60538 55.2283 1.52067 61.9531 4.35156C68.6733 7.18054 73.9412 11.8826 76.2725 18.3359L76.3057 18.4297L76.3545 18.5176C82.8347 30.217 83.6405 38.6554 84.0488 46.7646C84.4604 54.9386 84.4589 62.9479 89.5449 73.3545L89.5605 73.3877L89.5791 73.4199C91.5644 76.939 92.5635 79.7335 92.7266 81.8516C92.8836 83.8932 92.2698 85.2231 91.0371 86.1133C89.7019 87.0773 87.4506 87.666 84.0576 87.666C80.6974 87.666 76.3904 87.0894 71.1113 85.9062L70.6133 85.7949L70.1797 86.0635C62.6435 90.7283 55.0765 92.9302 47.459 92.7383C39.8365 92.5462 32.0684 89.9545 24.1406 84.8799L23.5195 84.4824L22.8721 84.834C18.5054 87.1991 14.8791 88.7673 11.9766 89.5771C9.03558 90.3977 7.03439 90.3828 5.77539 89.8525C4.64568 89.3766 3.87577 88.3774 3.63867 86.4512C3.39412 84.4638 3.75274 81.6488 4.83691 77.9297L4.98145 77.4355L4.73535 76.9834C2.07624 72.0866 1.1738 67.8243 1.25488 63.9756C1.33634 60.1108 2.41145 56.5815 3.8291 53.1445C4.53918 51.423 5.32667 49.7438 6.11523 48.0518C6.89899 46.37 7.68437 44.6749 8.3623 42.9678C9.71382 39.5644 10.6786 36.017 10.3936 32.1826C10.1322 23.003 13.4983 15.9655 18.8174 10.9326C24.1663 5.87166 31.5496 2.78737 39.3389 1.69629Z";

const LEFT_EYE_PATH =
  "M46.06 33.4C50.3488 33.4 54.0197 37.8947 54.0199 43.7096C54.0199 49.5247 50.3489 54.0201 46.06 54.0201C41.771 54.0201 38.1 49.5247 38.1 43.7096C38.1002 37.8947 41.7711 33.4 46.06 33.4Z";

const RIGHT_EYE_PATH =
  "M67.2102 32.46C69.2205 32.4601 71.0812 33.5614 72.4573 35.4229C73.8333 37.2846 74.7004 39.8807 74.7005 42.7696C74.7005 45.6586 73.8334 48.2545 72.4573 50.1162C71.0812 51.9781 69.2207 53.08 67.2102 53.0801C65.1997 53.0801 63.3384 51.9782 61.9622 50.1162C60.5862 48.2545 59.72 45.6585 59.72 42.7696C59.7201 39.8807 60.5862 37.2846 61.9622 35.4229C63.3384 33.5611 65.1998 32.46 67.2102 32.46Z";

function renderGlassesSvg(glasses: BlobGlasses): string {
  switch (glasses) {
    case "none":
      return "";
    case "round":
      return [
        `<g id="Glasses-round">`,
        `<path d="M16 40.5L36.4 42.6" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>`,
        `<circle cx="46.2" cy="43.5" r="9.8" fill="#FFFFFF" fill-opacity="0.26" stroke="${INK}" stroke-width="2.5"/>`,
        `<circle cx="67.2" cy="42.6" r="9.4" fill="#FFFFFF" fill-opacity="0.26" stroke="${INK}" stroke-width="2.5"/>`,
        `<path d="M55.8 42.6C56.6 41.1 57.4 41.1 58.1 42.4" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>`,
        `<path d="M40.6 39.2L43.5 36.7" stroke="#FFFFFF" stroke-opacity="0.78" stroke-width="1.8" stroke-linecap="round"/>`,
        `<path d="M62.1 38.4L64.8 36.1" stroke="#FFFFFF" stroke-opacity="0.78" stroke-width="1.8" stroke-linecap="round"/>`,
        `</g>`,
      ].join("");
    case "shades":
      return [
        `<g id="Glasses-shades">`,
        `<path d="M14.5 39L35.2 39.8" stroke="${INK}" stroke-width="3.2" stroke-linecap="round"/>`,
        `<path d="M35.2 33.8C42.2 32.5 49.6 32.8 55.4 35L54.2 47.4C53.4 51.8 49.8 53 45.6 53C40.5 53 36.8 51.2 35.9 46.6L35.2 33.8Z" fill="#1F2F3B" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>`,
        `<path d="M58.4 34.4C64.4 32.4 71 32 76.4 33.5L75.5 46.2C74.7 51 71.1 52.1 67.1 52.1C62.2 52.1 59.3 50.4 58.7 46.2L58.4 34.4Z" fill="#1F2F3B" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>`,
        `<path d="M54.6 37C56.1 35.8 57.6 35.8 59 36.8" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`,
        `<path d="M39.5 39.2L44 35.8M42.8 44.2L48.8 39.8" stroke="#FFFFFF" stroke-opacity="0.55" stroke-width="1.9" stroke-linecap="round"/>`,
        `<path d="M62.2 38.6L66.4 35.4M65.2 43.6L70.8 39.4" stroke="#FFFFFF" stroke-opacity="0.55" stroke-width="1.9" stroke-linecap="round"/>`,
        `</g>`,
      ].join("");
    case "star":
      return [
        `<g id="Glasses-star">`,
        `<path d="M15.5 40.5L34.5 42" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>`,
        `<polygon points="46.2,30.2 49.8,38.1 58.4,39.1 52,44.9 53.7,53.4 46.2,49.2 38.7,53.4 40.4,44.9 34.0,39.1 42.6,38.1" fill="#FFD24C" fill-opacity="0.32" stroke="#FFD24C" stroke-width="3.6" stroke-linejoin="round"/>`,
        `<polygon points="46.2,30.2 49.8,38.1 58.4,39.1 52,44.9 53.7,53.4 46.2,49.2 38.7,53.4 40.4,44.9 34.0,39.1 42.6,38.1" fill="none" stroke="${INK}" stroke-width="1.7" stroke-linejoin="round"/>`,
        `<polygon points="67.2,29.6 70.6,37.1 78.6,38.0 72.6,43.5 74.2,51.6 67.2,47.6 60.2,51.6 61.8,43.5 55.8,38.0 63.8,37.1" fill="#FFD24C" fill-opacity="0.32" stroke="#FFD24C" stroke-width="3.6" stroke-linejoin="round"/>`,
        `<polygon points="67.2,29.6 70.6,37.1 78.6,38.0 72.6,43.5 74.2,51.6 67.2,47.6 60.2,51.6 61.8,43.5 55.8,38.0 63.8,37.1" fill="none" stroke="${INK}" stroke-width="1.7" stroke-linejoin="round"/>`,
        `<path d="M55.4 41L58.4 40.6" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`,
        `</g>`,
      ].join("");
  }
}

function renderHatSvg(hat: BlobHat): string {
  switch (hat) {
    case "none":
      return "";
    case "cap":
      return [
        `<g id="Hat-cap">`,
        `<path d="M18 14.5C19.5 -7.5 35.5 -15.5 51.5 -14.8C65.5 -14.2 74.5 -4.8 76.5 9.8C62.5 6.8 36 8.2 18 14.5Z" fill="#2E4756" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`,
        `<path d="M44 -14.8C56 -13.8 66 -6.5 69.5 8.2C61.5 7.2 52 7.2 43.5 8C42.5 -1 42.8 -8.5 44 -14.8Z" fill="#FFF8E8" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`,
        `<circle cx="44" cy="-15.2" r="3" fill="#FFDA70" stroke="${INK}" stroke-width="2"/>`,
        `<path d="M50 6.8C69 3.6 86.5 5.4 97.5 11.8C86 15.2 69 14.8 50.5 12.2C48.5 11.8 48.2 7.2 50 6.8Z" fill="#FFDA70" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`,
        `</g>`,
      ].join("");
    case "beanie":
      return [
        `<g id="Hat-beanie">`,
        `<circle cx="44.5" cy="-13" r="5.8" fill="#FFF8E8" stroke="${INK}" stroke-width="2.3"/>`,
        `<path d="M17.5 13.5C19 -4.5 31.5 -12.5 46.5 -12.5C61.5 -12.5 73.5 -3.8 75.5 10.5Z" fill="#5C4D9A" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`,
        `<path d="M21 5.5C35 -0.2 56.5 -0.5 73 4.2" stroke="#FFDA70" stroke-width="4" stroke-linecap="round"/>`,
        `<path d="M15.5 12.2C33.5 4.8 57.5 4.4 77.5 9.2C78.8 13.8 77.2 17.6 74.2 18.8C56.2 14 34.2 14.4 17.5 20.2C14.8 18.6 14.5 15.4 15.5 12.2Z" fill="#FFF8E8" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>`,
        `<path d="M28 9.2L29 16.4M41 7.2L41.5 14.8M54 7.2L53.8 14.8M66.5 8.5L65.5 16" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>`,
        `</g>`,
      ].join("");
    case "crown":
      return [
        `<g id="Hat-crown">`,
        `<path d="M23.5 11.5L20 -8.5L35.5 -0.5L46.5 -15L57.5 -0.5L72.5 -8L68.5 10.5C54 6.2 38.5 6.4 23.5 11.5Z" fill="#FFD24C" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>`,
        `<path d="M25.5 7.4C39.2 3.2 53.5 3 67.2 6.8" stroke="#E09F1F" stroke-width="2.2" stroke-linecap="round"/>`,
        `<circle cx="20" cy="-9.5" r="2.6" fill="#FFD24C" stroke="${INK}" stroke-width="1.8"/>`,
        `<circle cx="46.5" cy="-16" r="3" fill="#FFD24C" stroke="${INK}" stroke-width="1.8"/>`,
        `<circle cx="72.5" cy="-9" r="2.6" fill="#FFD24C" stroke="${INK}" stroke-width="1.8"/>`,
        `<circle cx="46.5" cy="1.8" r="2.7" fill="#FF6B6B" stroke="${INK}" stroke-width="1.6"/>`,
        `<circle cx="33.5" cy="3.8" r="2.1" fill="#54B7E5" stroke="${INK}" stroke-width="1.5"/>`,
        `<circle cx="59.5" cy="3.5" r="2.1" fill="#4CD4A9" stroke="${INK}" stroke-width="1.5"/>`,
        `</g>`,
      ].join("");
  }
}

/** Génère le SVG original complet du blob de course pour un style donné (partagé aperçu + piste Pixi). */
export function renderBlobSvg(style: BlobStyle): string {
  const fill = BLOB_COLOR_HEX[style.color];
  return [
    `<svg width="${BLOB_SVG_WIDTH}" height="${BLOB_SVG_HEIGHT}" viewBox="0 0 ${BLOB_SVG_WIDTH} ${BLOB_SVG_HEIGHT}" fill="none" xmlns="http://www.w3.org/2000/svg">`,
    `<g id="Blob-character" transform="translate(${BLOB_OFFSET_X} ${BLOB_OFFSET_Y})">`,
    `<path id="Body" d="${BODY_PATH}" fill="${fill}" stroke="${INK}" stroke-width="2.5"/>`,
    `<ellipse id="Highlight" cx="34.321" cy="19.7997" rx="8.93" ry="4.23" transform="rotate(-25 34.321 19.7997)" fill="#FFFFFF" fill-opacity="0.44"/>`,
    `<path id="Eye" d="${LEFT_EYE_PATH}" fill="#FFFFFF" stroke="${INK}"/>`,
    `<path id="Eye_2" d="${RIGHT_EYE_PATH}" fill="#FFFFFF" stroke="${INK}"/>`,
    `<ellipse id="Pupil" cx="49.115" cy="42.77" rx="3.055" ry="4.23" fill="${INK}"/>`,
    `<ellipse id="Pupil_2" cx="70.735" cy="41.83" rx="3.055" ry="4.23" fill="${INK}"/>`,
    `<path id="Smile" d="M45.12 58.28C52.0133 70.8133 58.9067 70.8133 65.8 58.28" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`,
    renderGlassesSvg(style.glasses),
    renderHatSvg(style.hat),
    `</g>`,
    `</svg>`,
  ].join("");
}

/** Data URL UTF-8 directement consommable par `<img>` / `next/image` et par Pixi. */
export function blobSvgDataUrl(style: BlobStyle): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(renderBlobSvg(style))}`;
}
