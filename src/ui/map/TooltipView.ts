import type { GameState } from "../../game/state/types";
import type { Viewport } from "./camera";
import { tooltipHtml, tooltipModel, tooltipPosition } from "./tooltip";

/**
 * The hover tooltip element. It is filled and moved through its DOM ref, never through React state (spec 11.3), and
 * only rebuilt when the region or the game state changed; moving the pointer just moves the box.
 */
export class TooltipView {
  private visible = false;
  private regionId: string | null = null;
  private state: GameState | null = null;
  private size = { width: 0, height: 0 };

  constructor(private readonly element: HTMLDivElement) {}

  /** Shows the tooltip for `regionId` next to `pointer`; hides it when there is no region, pointer or state. */
  update(state: GameState | undefined, regionId: string | null, pointer: readonly [number, number] | null, viewport: Viewport): void {
    const element = this.element;
    if (!regionId || !pointer || !state) {
      if (this.visible) element.classList.remove("is-visible");
      this.visible = false;
      this.regionId = null;
      return;
    }
    if (!this.visible) {
      element.classList.add("is-visible");
      this.visible = true;
    }
    if (regionId !== this.regionId || state !== this.state) {
      const model = tooltipModel(state, regionId);
      element.innerHTML = model ? tooltipHtml(model) : "";
      this.regionId = regionId;
      this.state = state;
      this.size = { width: element.offsetWidth, height: element.offsetHeight };
    }
    const { x, y } = tooltipPosition(pointer, this.size, viewport);
    element.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }
}
