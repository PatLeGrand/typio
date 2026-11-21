import {
  BLOB_COLOR_HEX,
  type BlobAccessory,
  type BlobExpression,
  type BlobGlasses,
  type BlobHat,
  type BlobStyle,
} from "./blobStyle";

/** Dimensions du SVG composite (inclut l'espace autour du corps pour les couvre-chefs, capes et ailes). */
export const BLOB_SVG_WIDTH = 120;
export const BLOB_SVG_HEIGHT = 122;

const BLOB_OFFSET_X = 14;
const BLOB_OFFSET_Y = 26;

/** Trait d'encre commun au blob d'origine (`public/race/blob.svg`). */
const INK = "#293C49";

/** Silhouette exacte de `public/race/blob.svg` (repère local 94×94). */
const BODY_PATH =
  "M39.3389 1.69629C47.127 0.60538 55.2283 1.52067 61.9531 4.35156C68.6733 7.18054 73.9412 11.8826 76.2725 18.3359L76.3057 18.4297L76.3545 18.5176C82.8347 30.217 83.6405 38.6554 84.0488 46.7646C84.4604 54.9386 84.4589 62.9479 89.5449 73.3545L89.5605 73.3877L89.5791 73.4199C91.5644 76.939 92.5635 79.7335 92.7266 81.8516C92.8836 83.8932 92.2698 85.2231 91.0371 86.1133C89.7019 87.0773 87.4506 87.666 84.0576 87.666C80.6974 87.666 76.3904 87.0894 71.1113 85.9062L70.6133 85.7949L70.1797 86.0635C62.6435 90.7283 55.0765 92.9302 47.459 92.7383C39.8365 92.5462 32.0684 89.9545 24.1406 84.8799L23.5195 84.4824L22.8721 84.834C18.5054 87.1991 14.8791 88.7673 11.9766 89.5771C9.03558 90.3977 7.03439 90.3828 5.77539 89.8525C4.64568 89.3766 3.87577 88.3774 3.63867 86.4512C3.39412 84.4638 3.75274 81.6488 4.83691 77.9297L4.98145 77.4355L4.73535 76.9834C2.07624 72.0866 1.1738 67.8243 1.25488 63.9756C1.33634 60.1108 2.41145 56.5815 3.8291 53.1445C4.53918 51.423 5.32667 49.7438 6.11523 48.0518C6.89899 46.37 7.68437 44.6749 8.3623 42.9678C9.71382 39.5644 10.6786 36.017 10.3936 32.1826C10.1322 23.003 13.4983 15.9655 18.8174 10.9326C24.1663 5.87166 31.5496 2.78737 39.3389 1.69629Z";

const LEFT_EYE_PATH =
  "M46.06 33.4C50.3488 33.4 54.0197 37.8947 54.0199 43.7096C54.0199 49.5247 50.3489 54.0201 46.06 54.0201C41.771 54.0201 38.1 49.5247 38.1 43.7096C38.1002 37.8947 41.7711 33.4 46.06 33.4Z";

const RIGHT_EYE_PATH =
  "M67.2102 32.46C69.2205 32.4601 71.0812 33.5614 72.4573 35.4229C73.8333 37.2846 74.7004 39.8807 74.7005 42.7696C74.7005 45.6586 73.8334 48.2545 72.4573 50.1162C71.0812 51.9781 69.2207 53.08 67.2102 53.0801C65.1997 53.0801 63.3384 51.9782 61.9622 50.1162C60.5862 48.2545 59.72 45.6585 59.72 42.7696C59.7201 39.8807 60.5862 37.2846 61.9622 35.4229C63.3384 33.5611 65.1998 32.46 67.2102 32.46Z";

function renderBackAccessorySvg(accessory: BlobAccessory): string {
  switch (accessory) {
    case "cape":
      return [
        `<g id="Accessory-cape-back">`,
        `<path d="M16 42C4 47 -8 58 -11 76C-3 79 4 79 11 77L16 42Z" fill="#E64956" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>`,
        `<path d="M11 49C3 56 -3 65 -5 75" stroke="#B8323E" stroke-width="2.2" stroke-linecap="round"/>`,
        `</g>`,
      ].join("");
    case "wings":
      return [
        `<g id="Accessory-wings-back">`,
        `<path d="M13 43C2 32 -9 29 -11 36C-12.5 41 -7 46 -1 47C-8 48 -11 53 -8 57C-5 61 4 59 11 54Z" fill="#FFF8E8" stroke="${INK}" stroke-width="2.3" stroke-linejoin="round"/>`,
        `<path d="M9 47C2 42 -4 39 -6 37" stroke="#CBDCE8" stroke-width="1.8" stroke-linecap="round"/>`,
        `<path d="M8 52C2 52 -3 53 -5 54" stroke="#CBDCE8" stroke-width="1.8" stroke-linecap="round"/>`,
        `</g>`,
      ].join("");
    default:
      return "";
  }
}

function renderExpressionSvg(expression: BlobExpression, bodyFill: string): string {
  switch (expression) {
    case "smile":
      return [
        `<g id="Expression-smile">`,
        `<path id="Eye" d="${LEFT_EYE_PATH}" fill="#FFFFFF" stroke="${INK}"/>`,
        `<path id="Eye_2" d="${RIGHT_EYE_PATH}" fill="#FFFFFF" stroke="${INK}"/>`,
        `<ellipse id="Pupil" cx="49.115" cy="42.77" rx="3.055" ry="4.23" fill="${INK}"/>`,
        `<ellipse id="Pupil_2" cx="70.735" cy="41.83" rx="3.055" ry="4.23" fill="${INK}"/>`,
        `<path id="Smile" d="M45.12 58.28C52.0133 70.8133 58.9067 70.8133 65.8 58.28" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`,
        `</g>`,
      ].join("");
    case "wink":
      return [
        `<g id="Expression-wink">`,
        `<path id="Eye" d="${LEFT_EYE_PATH}" fill="#FFFFFF" stroke="${INK}"/>`,
        `<ellipse id="Pupil" cx="49.115" cy="42.77" rx="3.055" ry="4.23" fill="${INK}"/>`,
        `<circle cx="48" cy="40.4" r="1.15" fill="#FFFFFF"/>`,
        `<path d="M60.2 43.2C63.2 38.2 70.8 38.2 73.8 43.2" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>`,
        `<path id="Smile" d="M44.8 58.2C51.8 71.2 59.2 71.2 66.2 58.2" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`,
        `</g>`,
      ].join("");
    case "determined":
      return [
        `<g id="Expression-determined">`,
        `<path id="Eye" d="${LEFT_EYE_PATH}" fill="#FFFFFF" stroke="${INK}"/>`,
        `<path id="Eye_2" d="${RIGHT_EYE_PATH}" fill="#FFFFFF" stroke="${INK}"/>`,
        `<ellipse id="Pupil" cx="49.5" cy="43.8" rx="3.05" ry="4.05" fill="${INK}"/>`,
        `<ellipse id="Pupil_2" cx="70.6" cy="42.8" rx="3.05" ry="4.05" fill="${INK}"/>`,
        `<path d="M38.2 32.5L53.8 37.6" stroke="${INK}" stroke-width="2.8" stroke-linecap="round"/>`,
        `<path d="M74.6 31.4L60.2 36.4" stroke="${INK}" stroke-width="2.8" stroke-linecap="round"/>`,
        `<path id="Smile" d="M46.5 62C53 65.4 61 63.4 66.8 58.4" stroke="${INK}" stroke-width="2.3" stroke-linecap="round"/>`,
        `</g>`,
      ].join("");
    case "surprised":
      return [
        `<g id="Expression-surprised">`,
        `<path id="Eye" d="${LEFT_EYE_PATH}" fill="#FFFFFF" stroke="${INK}"/>`,
        `<path id="Eye_2" d="${RIGHT_EYE_PATH}" fill="#FFFFFF" stroke="${INK}"/>`,
        `<ellipse id="Pupil" cx="47.2" cy="43.2" rx="3.5" ry="4.6" fill="${INK}"/>`,
        `<ellipse id="Pupil_2" cx="68.5" cy="42.3" rx="3.5" ry="4.6" fill="${INK}"/>`,
        `<circle cx="45.8" cy="40.8" r="1.3" fill="#FFFFFF"/>`,
        `<circle cx="67.1" cy="39.9" r="1.3" fill="#FFFFFF"/>`,
        `<ellipse cx="56" cy="63.5" rx="4.2" ry="5.4" fill="${INK}"/>`,
        `<ellipse cx="56" cy="65.6" rx="2.1" ry="1.6" fill="#FF8585"/>`,
        `</g>`,
      ].join("");
    case "cat":
      return [
        `<g id="Expression-cat">`,
        `<path id="Eye" d="${LEFT_EYE_PATH}" fill="#FFFFFF" stroke="${INK}"/>`,
        `<path id="Eye_2" d="${RIGHT_EYE_PATH}" fill="#FFFFFF" stroke="${INK}"/>`,
        `<ellipse id="Pupil" cx="48.8" cy="43" rx="3.2" ry="4.3" fill="${INK}"/>`,
        `<ellipse id="Pupil_2" cx="70.2" cy="42.1" rx="3.2" ry="4.3" fill="${INK}"/>`,
        `<circle cx="47.5" cy="40.6" r="1.25" fill="#FFFFFF"/>`,
        `<circle cx="68.9" cy="39.7" r="1.25" fill="#FFFFFF"/>`,
        `<path d="M46.5 60.5C49 65.5 54 65.2 56 60.8C58 65.2 63 65.5 65.5 60.5" stroke="${INK}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`,
        `<path d="M27 56.5L36.5 57.8M26.5 62.5L36.2 61.5" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>`,
        `<path d="M74.5 56.8L83.5 55.2M74.5 60.8L83.8 61.5" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>`,
        `</g>`,
      ].join("");
    case "cool":
      return [
        `<g id="Expression-cool">`,
        `<path id="Eye" d="${LEFT_EYE_PATH}" fill="#FFFFFF" stroke="${INK}"/>`,
        `<path id="Eye_2" d="${RIGHT_EYE_PATH}" fill="#FFFFFF" stroke="${INK}"/>`,
        `<ellipse id="Pupil" cx="49.2" cy="44.8" rx="3.05" ry="3.6" fill="${INK}"/>`,
        `<ellipse id="Pupil_2" cx="70.5" cy="43.8" rx="3.05" ry="3.6" fill="${INK}"/>`,
        `<path d="M37.5 39.8L54.6 40.6V32.5H37.5Z" fill="${bodyFill}"/>`,
        `<path d="M59.1 39.2L75.4 39.6V31.5H59.1Z" fill="${bodyFill}"/>`,
        `<path d="M38.2 40.2L54 40.8" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`,
        `<path d="M59.8 39.4L74.8 39.8" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`,
        `<path id="Smile" d="M48 61.8C54.5 64.5 61.5 62.8 66.5 58.6" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`,
        `</g>`,
      ].join("");
  }
}

function renderFrontAccessorySvg(accessory: BlobAccessory): string {
  switch (accessory) {
    case "none":
    case "wings":
      return "";
    case "cape":
      return [
        `<g id="Accessory-cape">`,
        `<path d="M12.5 46.5C18.5 51.5 24 54.5 31 55.5" stroke="#E64956" stroke-width="4" stroke-linecap="round"/>`,
        `<path d="M12.5 46.5C18.5 51.5 24 54.5 31 55.5" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>`,
        `<circle cx="31.5" cy="55.5" r="3.4" fill="#FFD24C" stroke="${INK}" stroke-width="1.8"/>`,
        `</g>`,
      ].join("");
    case "blush":
      return [
        `<g id="Accessory-blush">`,
        `<ellipse cx="36.5" cy="56.5" rx="6.5" ry="3.6" fill="#FF7B9C" fill-opacity="0.58"/>`,
        `<ellipse cx="75.2" cy="54.8" rx="6.2" ry="3.4" fill="#FF7B9C" fill-opacity="0.58"/>`,
        `<path d="M34.2 57.6L35.8 55.3M37.4 57.6L39 55.3" stroke="#E0537A" stroke-opacity="0.7" stroke-width="1.3" stroke-linecap="round"/>`,
        `<path d="M73 55.8L74.5 53.6M76.1 55.8L77.6 53.6" stroke="#E0537A" stroke-opacity="0.7" stroke-width="1.3" stroke-linecap="round"/>`,
        `</g>`,
      ].join("");
    case "mustache":
      return [
        `<g id="Accessory-mustache">`,
        `<path d="M56 56.2C52.8 53.2 46.5 53.5 43.2 56.8C41.2 58.8 39.2 58.6 38.2 57.2C39.2 61.5 44.5 62.6 49.5 60.4C52.2 59.2 54.5 58.8 56 59.8C57.5 58.8 59.8 59.2 62.5 60.4C67.5 62.6 72.8 61.5 73.8 57.2C72.8 58.6 70.8 58.8 68.8 56.8C65.5 53.5 59.2 53.2 56 56.2Z" fill="#4A3528" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`,
        `</g>`,
      ].join("");
    case "bowtie":
      return [
        `<g id="Accessory-bowtie">`,
        `<path d="M54 75.5L42.5 70.2C41.2 73.8 41.2 77.6 42.5 81.2L54 75.5Z" fill="#FF5C77" stroke="${INK}" stroke-width="2.1" stroke-linejoin="round"/>`,
        `<path d="M58 75.5L69.5 70.2C70.8 73.8 70.8 77.6 69.5 81.2L58 75.5Z" fill="#FF5C77" stroke="${INK}" stroke-width="2.1" stroke-linejoin="round"/>`,
        `<rect x="52.6" y="72.4" width="6.8" height="6.2" rx="2.4" fill="#FFD24C" stroke="${INK}" stroke-width="2"/>`,
        `</g>`,
      ].join("");
    case "scarf":
      return [
        `<g id="Accessory-scarf">`,
        `<path d="M12 69C3 73 -5 79 -9 86C-2 87 5 85 13 80Z" fill="#E85D75" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>`,
        `<path d="M-3 80.5L4 83.2" stroke="#FFF8E8" stroke-width="2.6" stroke-linecap="round"/>`,
        `<path d="M6.5 66.5C28 73.5 61 73.5 85.5 66C87.2 70 87.8 73.5 86.8 76.2C61.5 83.2 27.5 83.2 6.2 76C4.8 72.8 5.2 69.5 6.5 66.5Z" fill="#E85D75" stroke="${INK}" stroke-width="2.3" stroke-linejoin="round"/>`,
        `<path d="M25 71.2L24.5 79.4M46 72.8L46 81.2M67 71.2L68 79.4" stroke="#FFF8E8" stroke-width="3.2" stroke-linecap="round"/>`,
        `</g>`,
      ].join("");
    case "bandaid":
      return [
        `<g id="Accessory-bandaid" transform="rotate(-24 27 31)">`,
        `<rect x="17" y="26.5" width="20" height="9" rx="4.2" fill="#F6D0A6" stroke="${INK}" stroke-width="2"/>`,
        `<rect x="23.5" y="27.5" width="7" height="7" rx="1" fill="#E7B887"/>`,
        `<circle cx="20.5" cy="29.8" r="0.8" fill="${INK}"/>`,
        `<circle cx="20.5" cy="32.4" r="0.8" fill="${INK}"/>`,
        `<circle cx="33.5" cy="29.8" r="0.8" fill="${INK}"/>`,
        `<circle cx="33.5" cy="32.4" r="0.8" fill="${INK}"/>`,
        `</g>`,
      ].join("");
  }
}

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
    case "heart":
      return [
        `<g id="Glasses-heart">`,
        `<path d="M15.5 40.2L35.5 41.2" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>`,
        `<path d="M46.2 52.8C41.5 49 35.6 45.2 35.6 40.2C35.6 36.6 38.4 34.2 41.6 34.2C43.8 34.2 45.3 35.4 46.2 37C47.1 35.4 48.6 34.2 50.8 34.2C54 34.2 56.8 36.6 56.8 40.2C56.8 45.2 50.9 49 46.2 52.8Z" fill="#FF6B9D" fill-opacity="0.3" stroke="#FF6B9D" stroke-width="3.4" stroke-linejoin="round"/>`,
        `<path d="M46.2 52.8C41.5 49 35.6 45.2 35.6 40.2C35.6 36.6 38.4 34.2 41.6 34.2C43.8 34.2 45.3 35.4 46.2 37C47.1 35.4 48.6 34.2 50.8 34.2C54 34.2 56.8 36.6 56.8 40.2C56.8 45.2 50.9 49 46.2 52.8Z" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>`,
        `<path d="M67.2 52C62.7 48.4 57.2 44.8 57.2 39.9C57.2 36.5 59.8 34.1 62.9 34.1C64.9 34.1 66.3 35.2 67.2 36.8C68.1 35.2 69.5 34.1 71.5 34.1C74.6 34.1 77.2 36.5 77.2 39.9C77.2 44.8 71.7 48.4 67.2 52Z" fill="#FF6B9D" fill-opacity="0.3" stroke="#FF6B9D" stroke-width="3.4" stroke-linejoin="round"/>`,
        `<path d="M67.2 52C62.7 48.4 57.2 44.8 57.2 39.9C57.2 36.5 59.8 34.1 62.9 34.1C64.9 34.1 66.3 35.2 67.2 36.8C68.1 35.2 69.5 34.1 71.5 34.1C74.6 34.1 77.2 36.5 77.2 39.9C77.2 44.8 71.7 48.4 67.2 52Z" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>`,
        `<path d="M55.8 40.2L58.4 39.8" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`,
        `</g>`,
      ].join("");
    case "pixel":
      return [
        `<g id="Glasses-pixel">`,
        `<rect x="14" y="37" width="21" height="4" fill="#1F2F3B"/>`,
        `<rect x="35" y="36" width="44" height="4" fill="#1F2F3B"/>`,
        `<rect x="35" y="40" width="20" height="5" fill="#1F2F3B"/>`,
        `<rect x="38" y="45" width="14" height="4" fill="#1F2F3B"/>`,
        `<rect x="59" y="40" width="20" height="5" fill="#1F2F3B"/>`,
        `<rect x="62" y="45" width="14" height="4" fill="#1F2F3B"/>`,
        `<rect x="39" y="40" width="3" height="3" fill="#FFFFFF"/>`,
        `<rect x="42" y="43" width="3" height="3" fill="#FFFFFF"/>`,
        `<rect x="63" y="40" width="3" height="3" fill="#FFFFFF"/>`,
        `<rect x="66" y="43" width="3" height="3" fill="#FFFFFF"/>`,
        `</g>`,
      ].join("");
    case "monocle":
      return [
        `<g id="Glasses-monocle">`,
        `<circle cx="67.2" cy="42.6" r="10.2" fill="#FFFFFF" fill-opacity="0.28" stroke="#FFD24C" stroke-width="3.4"/>`,
        `<circle cx="67.2" cy="42.6" r="10.2" fill="none" stroke="${INK}" stroke-width="1.6"/>`,
        `<path d="M62.4 38.2L65.2 35.8" stroke="#FFFFFF" stroke-opacity="0.85" stroke-width="1.9" stroke-linecap="round"/>`,
        `<path d="M77 45.5C80.5 52.5 81 62 77 70" stroke="#FFD24C" stroke-width="2" stroke-dasharray="2.5 2.5" stroke-linecap="round"/>`,
        `<circle cx="77" cy="70.5" r="2.2" fill="#FFD24C" stroke="${INK}" stroke-width="1.3"/>`,
        `</g>`,
      ].join("");
    case "visor":
      return [
        `<g id="Glasses-visor">`,
        `<path d="M14 39.5L35 39" stroke="${INK}" stroke-width="3.2" stroke-linecap="round"/>`,
        `<path d="M34.5 34.5C47 32.2 64.5 31.8 78.5 33.8C79.8 39.5 79.2 45.5 76.2 49.5C64 51.8 48 52.2 36.8 50C34.2 46 33.6 39.8 34.5 34.5Z" fill="#22D3EE" fill-opacity="0.72" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>`,
        `<path d="M40 44.5L49 36M55 46.5L65 36.5" stroke="#FFFFFF" stroke-opacity="0.75" stroke-width="2.4" stroke-linecap="round"/>`,
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
    case "tophat":
      return [
        `<g id="Hat-tophat">`,
        `<path d="M26 7.5L29 -20C39 -22.5 53 -22.5 63 -19.5L66 7.5Z" fill="#2A3441" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>`,
        `<path d="M26.8 1.5C39 -1 53 -1 65.2 1.5L65.8 6.8C53 4.2 39 4.2 26.2 6.8Z" fill="#E64956" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>`,
        `<rect x="42.5" y="0.6" width="7" height="5.4" rx="1.2" fill="#FFD24C" stroke="${INK}" stroke-width="1.6"/>`,
        `<path d="M13.5 11.5C33.5 4.2 59.5 4.2 79.5 11.2C77.5 15.8 72.5 16.4 66 14.5C53 11 39 11 26 14.5C19.5 16.4 15.2 15.6 13.5 11.5Z" fill="#2A3441" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>`,
        `</g>`,
      ].join("");
    case "headphones":
      return [
        `<g id="Hat-headphones">`,
        `<path d="M10.5 34C10.5 5 26 -7 46 -7C66 -7 80.5 5 80.5 32" stroke="#2E4756" stroke-width="6.5" stroke-linecap="round"/>`,
        `<path d="M10.5 34C10.5 5 26 -7 46 -7C66 -7 80.5 5 80.5 32" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`,
        `<path d="M26 -3.8C38 -7.8 54 -7.8 66 -3.8" stroke="#54B7E5" stroke-width="3.2" stroke-linecap="round"/>`,
        `<rect x="3" y="27" width="12" height="22" rx="6" fill="#2E4756" stroke="${INK}" stroke-width="2.3"/>`,
        `<rect x="11" y="30" width="4.5" height="16" rx="2.2" fill="#FF856D" stroke="${INK}" stroke-width="1.6"/>`,
        `<rect x="76.5" y="25.5" width="11.5" height="21" rx="5.8" fill="#2E4756" stroke="${INK}" stroke-width="2.3"/>`,
        `<rect x="75.5" y="28.5" width="4.5" height="15" rx="2.2" fill="#FF856D" stroke="${INK}" stroke-width="1.6"/>`,
        `</g>`,
      ].join("");
    case "beret":
      return [
        `<g id="Hat-beret">`,
        `<path d="M44 -14C44.5 -18.5 47 -20.5 49.5 -20" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>`,
        `<path d="M13 13C10 -4 25 -15 47 -14.5C68 -14 82 -4.5 78 8C65 4 35 6 13 13Z" fill="#C94A6A" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`,
        `<path d="M22 4C36 -2 56 -2.5 70 2" stroke="#A13652" stroke-width="2.2" stroke-linecap="round"/>`,
        `<path d="M16 12.2C34 5.5 57 4.8 75 9.2" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>`,
        `</g>`,
      ].join("");
    case "party":
      return [
        `<g id="Hat-party">`,
        `<path d="M24 10L46 -20L67 9C53 5.5 38 6 24 10Z" fill="#A682FF" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>`,
        `<path d="M31.5 -0.2C41 -2.5 51 -2.5 59.8 -0.4" stroke="#FFD24C" stroke-width="4" stroke-linecap="round"/>`,
        `<path d="M38 -9.5C43.5 -11 48.8 -11 53.6 -9.5" stroke="#4CD4A9" stroke-width="3.6" stroke-linecap="round"/>`,
        `<circle cx="46" cy="-21.5" r="4.5" fill="#FF856D" stroke="${INK}" stroke-width="2"/>`,
        `<circle cx="29" cy="6.2" r="2" fill="#FFD24C"/>`,
        `<circle cx="45.5" cy="4.2" r="2.2" fill="#FF856D"/>`,
        `<circle cx="61" cy="5.8" r="2" fill="#4CD4A9"/>`,
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
    renderBackAccessorySvg(style.accessory),
    `<path id="Body" d="${BODY_PATH}" fill="${fill}" stroke="${INK}" stroke-width="2.5"/>`,
    `<ellipse id="Highlight" cx="34.321" cy="19.7997" rx="8.93" ry="4.23" transform="rotate(-25 34.321 19.7997)" fill="#FFFFFF" fill-opacity="0.44"/>`,
    renderExpressionSvg(style.expression, fill),
    renderFrontAccessorySvg(style.accessory),
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
