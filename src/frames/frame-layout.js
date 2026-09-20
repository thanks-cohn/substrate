export const FRAME_LAYOUT_CONTRACTS = Object.freeze({
  generic: Object.freeze({ minWidth: 280, minHeight: 190, compactWidth: 420, shortHeight: 280, titleBarHeight: 42, controlSize: 30, controlGap: 4 }),
  pdf: Object.freeze({ minWidth: 360, minHeight: 280, compactWidth: 620, shortHeight: 420, titleBarHeight: 42, controlSize: 30, controlGap: 4 }),
  docx: Object.freeze({ minWidth: 360, minHeight: 280, compactWidth: 620, shortHeight: 420, titleBarHeight: 42, controlSize: 30, controlGap: 4 }),
  image: Object.freeze({ minWidth: 280, minHeight: 220, compactWidth: 440, shortHeight: 300, titleBarHeight: 42, controlSize: 30, controlGap: 4 }),
  gallery: Object.freeze({ minWidth: 300, minHeight: 240, compactWidth: 480, shortHeight: 320, titleBarHeight: 42, controlSize: 30, controlGap: 4 }),
  video: Object.freeze({ minWidth: 320, minHeight: 240, compactWidth: 500, shortHeight: 320, titleBarHeight: 42, controlSize: 30, controlGap: 4 }),
  audio: Object.freeze({ minWidth: 320, minHeight: 160, compactWidth: 480, shortHeight: 220, titleBarHeight: 42, controlSize: 30, controlGap: 4 })
});
export function layoutContract(category) { return FRAME_LAYOUT_CONTRACTS[category] || FRAME_LAYOUT_CONTRACTS.generic; }
export function measureLayout(width, height, category) {
  const contract = layoutContract(category), widthState = Number(width) < contract.compactWidth ? "narrow" : "wide", heightState = Number(height) < contract.shortHeight ? "short" : "tall";
  return Object.freeze({ state: `${widthState}-${heightState}`, widthState, heightState, constraints: contract });
}
