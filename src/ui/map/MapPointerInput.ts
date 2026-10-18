import type { Camera } from "./camera";

const DRAG_THRESHOLD_PX = 5;
const WHEEL_SENSITIVITY = 1.0015;

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  startOffsetX: number;
  startOffsetY: number;
  active: boolean;
}

/** What the controller does with the gestures the pointer input recognizes. */
export interface PointerInputHooks {
  /** False in showcase mode: no pan, zoom, click or hover. */
  isInteractive(): boolean;
  /** The camera a drag starts from. */
  getCamera(): Camera;
  /** A drag moved the map: the new offsets (the controller clamps, stores and redraws). */
  pan(offsetX: number, offsetY: number): void;
  /** The drag passed the 5 px threshold. */
  dragStarted(): void;
  /** A press and release without a drag, at a canvas-relative point (CSS px). */
  click(x: number, y: number): void;
  /** A wheel tick: multiply the target scale by `factor`, anchored at the canvas-relative point. */
  wheel(factor: number, x: number, y: number): void;
  /** The plain pointer moved or left; `pointer` has the new position. */
  hoverChanged(): void;
}

/**
 * Translates pointer and wheel events on the canvas into gestures (spec 11.3): a drag past 5 px pans, a press and
 * release is a click, the wheel zooms by 1.0015^-delta. It keeps no camera and does not render; the hooks do that.
 */
export class MapPointerInput {
  /** The hovered point in canvas CSS px; null when the pointer left the canvas or a drag is going on. */
  pointer: [number, number] | null = null;
  private drag: DragState | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly hooks: PointerInputHooks,
    signal: AbortSignal
  ) {
    canvas.addEventListener("pointerdown", this.onPointerDown, { signal });
    canvas.addEventListener("pointermove", this.onPointerMove, { signal });
    canvas.addEventListener("pointerup", this.onPointerUp, { signal });
    canvas.addEventListener("pointercancel", this.onPointerCancel, { signal });
    canvas.addEventListener("lostpointercapture", this.onLostPointerCapture, { signal });
    canvas.addEventListener("pointerleave", this.onPointerLeave, { signal });
    canvas.addEventListener("wheel", this.onWheel, { signal, passive: false });
  }

  /** True once a drag has passed the threshold (until the pointer is released). */
  get dragging(): boolean {
    return this.drag?.active === true;
  }

  private eventPoint(event: { clientX: number; clientY: number }): [number, number] {
    const rect = this.canvas.getBoundingClientRect();
    return [event.clientX - rect.left, event.clientY - rect.top];
  }

  private onPointerDown = (event: PointerEvent): void => {
    if (!this.hooks.isInteractive()) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const [x, y] = this.eventPoint(event);
    const camera = this.hooks.getCamera();
    this.drag = { pointerId: event.pointerId, startX: x, startY: y, startOffsetX: camera.offsetX, startOffsetY: camera.offsetY, active: false };
    try {
      this.canvas.setPointerCapture(event.pointerId);
    } catch {
      // synthetic events (the benchmark) have no active pointer; dragging works without capture
    }
  };

  private onPointerMove = (event: PointerEvent): void => {
    const drag = this.drag;
    if (!drag || drag.pointerId !== event.pointerId) {
      // plain hover: remember the pointer; the next frame hit-tests it once
      if (this.hooks.isInteractive()) {
        this.pointer = this.eventPoint(event);
        this.hooks.hoverChanged();
      }
      return;
    }
    const [x, y] = this.eventPoint(event);
    const dx = x - drag.startX;
    const dy = y - drag.startY;
    if (!drag.active) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      drag.active = true;
      this.pointer = null; // no hover or tooltip while dragging
      this.canvas.classList.add("is-dragging");
      this.hooks.dragStarted();
    }
    this.hooks.pan(drag.startOffsetX + dx, drag.startOffsetY + dy);
  };

  private endDrag(event: PointerEvent, asClick: boolean): void {
    const drag = this.drag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    this.drag = null;
    this.canvas.classList.remove("is-dragging");
    try {
      this.canvas.releasePointerCapture(event.pointerId);
    } catch {
      // not captured
    }
    if (asClick && !drag.active) {
      const [x, y] = this.eventPoint(event);
      this.hooks.click(x, y);
    }
  }

  private onPointerUp = (event: PointerEvent): void => this.endDrag(event, true);
  private onPointerCancel = (event: PointerEvent): void => this.endDrag(event, false);
  private onLostPointerCapture = (event: PointerEvent): void => this.endDrag(event, false);

  private onPointerLeave = (): void => {
    this.pointer = null;
    this.hooks.hoverChanged();
  };

  private onWheel = (event: WheelEvent): void => {
    if (!this.hooks.isInteractive()) return;
    event.preventDefault();
    const [x, y] = this.eventPoint(event);
    const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaMode === 2 ? event.deltaY * 100 : event.deltaY;
    this.hooks.wheel(WHEEL_SENSITIVITY ** -delta, x, y);
  };
}
