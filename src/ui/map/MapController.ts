import type { GameState } from "../../game/state/types";
import {
  clampCamera,
  fitCamera,
  MAX_ZOOM,
  MIN_ZOOM,
  recenterOnResize,
  type Camera,
  type Viewport
} from "./camera";
import { anchorTween, cameraTween, stepTween, tweenTargetScale, type Tween } from "./cameraTween";
import { deriveMapData, type DerivedMapData } from "./derive";
import { buildMapGeometry, type MapGeometry } from "./geometry/buildMapGeometry";
import { WORLD } from "./geometry/projection";
import { clickOutcome, hitTest, type FrameHitData } from "./layout/hitTest";
import type { MapViewProps } from "./MapView";
import { recordFrame } from "./perf/frameStats";
import { PerfMeter } from "./perf/PerfMeter";
import { drawPreparingMap } from "./render/layers/sea";
import { renderFrame } from "./render/renderFrame";
import { clearTextCache } from "./render/text";
import { getStartingControllers } from "./startingControllers";
import { TooltipView } from "./TooltipView";

const DRAG_THRESHOLD_PX = 5;
const WHEEL_SENSITIVITY = 1.0015;
export const BUTTON_ZOOM = 1.6;
const FIT_PADDING = 40;

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  startOffsetX: number;
  startOffsetY: number;
  active: boolean;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/**
 * Imperative owner of the map canvas. Camera, easing, drag and the frame loop live here, outside
 * React: panning and zooming never call setState, so React never re-renders because of them
 * (spec 11.3, constraint C2). React only passes props in through setProps.
 */
export class MapController {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly abort = new AbortController();
  private readonly resizeObserver: ResizeObserver;

  private props: MapViewProps | null = null;
  private geometry: MapGeometry | null = null;
  private derived: DerivedMapData | null = null;
  private camera: Camera = { scale: 1, offsetX: 0, offsetY: 0 };
  private viewport: Viewport = { width: 0, height: 0 };
  private dpr = 1;
  private fitScale = 1;
  private hasFit = false;
  private drag: DragState | null = null;
  private tween: Tween | null = null;
  private expandedRegionId: string | null = null;
  private hoverRegionId: string | null = null;
  private fontsReady = false;
  private frameHit: FrameHitData = { counters: [], cities: [], pills: [] };
  private rafId: number | null = null;
  private buildTimer: number | null = null;
  private destroyed = false;
  /** Something other than the pointer changed since the last draw (camera, props, size, fonts). */
  private drawPending = true;
  private pointer: [number, number] | null = null;
  private hoverKey = "off";
  private hoverDirty = true;
  private readonly tooltip: TooltipView;
  private readonly perfMeter: PerfMeter;

  constructor(elements: { canvas: HTMLCanvasElement; tooltip: HTMLDivElement; perf: HTMLDivElement }) {
    this.canvas = elements.canvas;
    this.tooltip = new TooltipView(elements.tooltip);
    this.perfMeter = new PerfMeter(elements.perf);
    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D is not available");
    this.ctx = ctx;

    const { signal } = this.abort;
    this.canvas.addEventListener("pointerdown", this.onPointerDown, { signal });
    this.canvas.addEventListener("pointermove", this.onPointerMove, { signal });
    this.canvas.addEventListener("pointerup", this.onPointerUp, { signal });
    this.canvas.addEventListener("pointercancel", this.onPointerCancel, { signal });
    this.canvas.addEventListener("lostpointercapture", this.onLostPointerCapture, { signal });
    this.canvas.addEventListener("pointerleave", this.onPointerLeave, { signal });
    this.canvas.addEventListener("wheel", this.onWheel, { signal, passive: false });
    if (import.meta.env.DEV) window.addEventListener("keydown", this.onKeyDown, { signal });

    this.resizeObserver = new ResizeObserver(() => this.syncSize());
    this.resizeObserver.observe(this.canvas);
    this.syncSize();

    // Build the geometry after the first paint of "Preparing map…".
    this.buildTimer = window.setTimeout(() => this.buildGeometry(), 0);
    // A failed load only means the fallback font is used; labels must still appear.
    const fontsLoaded = (): void => {
      clearTextCache();
      this.fontsReady = true;
      this.requestRender();
    };
    void document.fonts?.load("500 12px Oswald").then(fontsLoaded, fontsLoaded);
    this.requestRender();
  }

  /** Stores the latest props and callbacks; re-derives per-state data when the state changed. */
  setProps(props: MapViewProps): void {
    this.props = props;
    this.refreshDerived();
    this.hoverDirty = true;
    this.requestRender();
  }

  zoomBy(factor: number): void {
    this.zoomTo(this.targetScale() * factor, this.viewport.width / 2, this.viewport.height / 2);
  }

  resetView(): void {
    if (!this.geometry || !this.hasFit) return;
    const fitted = fitCamera(this.geometry.regionBounds, this.viewport, FIT_PADDING);
    this.fitScale = fitted.scale;
    this.tweenToCamera(fitted);
  }

  /** Eases the camera so the region's city is centered, keeping the zoom. */
  focusRegion(regionId: string): void {
    const shape = this.geometry?.regions.get(regionId);
    if (!shape) return;
    const scale = this.camera.scale;
    this.tweenToCamera(
      clampCamera(
        { scale, offsetX: this.viewport.width / 2 - shape.point[0] * scale, offsetY: this.viewport.height / 2 - shape.point[1] * scale },
        this.viewport,
        WORLD
      )
    );
  }

  /** Dev/test helper: the camera and the sizes it is relative to. */
  debugSnapshot(): { camera: Camera; fitScale: number; z: number; viewport: Viewport; ready: boolean; tweening: boolean } {
    return {
      camera: { ...this.camera },
      fitScale: this.fitScale,
      z: this.camera.scale / this.fitScale,
      viewport: { ...this.viewport },
      ready: this.geometry !== null && this.derived !== null,
      tweening: this.tween !== null
    };
  }

  destroy(): void {
    this.destroyed = true;
    this.abort.abort();
    this.resizeObserver.disconnect();
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    if (this.buildTimer !== null) window.clearTimeout(this.buildTimer);
    this.perfMeter.destroy();
    this.rafId = null;
    this.buildTimer = null;
  }

  // ---- geometry, size and camera ----

  private buildGeometry(): void {
    this.buildTimer = null;
    if (this.destroyed) return;
    const props = this.props;
    if (!props) {
      this.buildTimer = window.setTimeout(() => this.buildGeometry(), 16);
      return;
    }
    this.geometry = buildMapGeometry(props.state.regions, getStartingControllers(props.state));
    if (import.meta.env.DEV) console.info(`[map] geometry ready in ${this.geometry.buildMs.toFixed(0)} ms`);
    if (this.viewport.width > 0 && this.viewport.height > 0) this.fit();
    this.refreshDerived();
    this.requestRender();
  }

  private fit(): void {
    if (!this.geometry) return;
    const fitted = fitCamera(this.geometry.regionBounds, this.viewport, FIT_PADDING);
    this.fitScale = fitted.scale;
    this.camera = fitted;
    this.hasFit = true;
  }

  private refreshDerived(): void {
    const props = this.props;
    if (!props || !this.geometry) return;
    this.derived = deriveMapData(props.state as GameState, this.geometry, {
      playerCountryId: props.state.playerCountryId,
      showSupply: props.showSupplyOverlay === true
    });
  }

  /** Sizes the backing store to the CSS size times devicePixelRatio and refits or re-centers on resize. */
  private syncSize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(0, rect.width);
    const height = Math.max(0, rect.height);
    const dpr = window.devicePixelRatio || 1;
    const pixelWidth = Math.max(1, Math.round(width * dpr));
    const pixelHeight = Math.max(1, Math.round(height * dpr));
    if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
      this.canvas.width = pixelWidth;
      this.canvas.height = pixelHeight;
    }
    this.dpr = dpr;

    if (width === this.viewport.width && height === this.viewport.height) {
      this.requestRender();
      return;
    }
    const previous = this.viewport;
    this.viewport = { width, height };
    if (this.geometry && width > 0 && height > 0) {
      if (!this.hasFit) {
        this.fit();
      } else {
        // keep the world point at the viewport center, and the zoom relative to the fit
        const nextFit = fitCamera(this.geometry.regionBounds, this.viewport, FIT_PADDING).scale;
        this.camera = recenterOnResize(this.camera, previous, this.viewport, this.fitScale, nextFit, WORLD);
        this.fitScale = nextFit;
      }
    }
    this.requestRender();
  }

  private targetScale(): number {
    return tweenTargetScale(this.tween, this.camera);
  }

  private zoomTo(targetScale: number, anchorX: number, anchorY: number): void {
    if (!this.geometry || !this.hasFit) return;
    const toScale = clamp(targetScale, MIN_ZOOM * this.fitScale, MAX_ZOOM * this.fitScale);
    this.tween = anchorTween(this.camera, toScale, anchorX, anchorY, performance.now());
    this.requestRender();
  }

  private tweenToCamera(target: Camera): void {
    this.tween = cameraTween(this.camera, target, this.viewport, performance.now());
    this.requestRender();
  }

  /** Advances the easing for this frame; true while it is still running. */
  private advanceTween(now: number): boolean {
    const tween = this.tween;
    if (!tween) return false;
    const step = stepTween(tween, now, this.viewport);
    this.camera = step.camera;
    if (step.done) this.tween = null;
    return !step.done;
  }

  // ---- interaction ----

  private get interactive(): boolean {
    return this.props?.mode !== "showcase";
  }

  private eventPoint(event: { clientX: number; clientY: number }): [number, number] {
    const rect = this.canvas.getBoundingClientRect();
    return [event.clientX - rect.left, event.clientY - rect.top];
  }

  private onPointerDown = (event: PointerEvent): void => {
    if (!this.interactive) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const [x, y] = this.eventPoint(event);
    this.drag = {
      pointerId: event.pointerId,
      startX: x,
      startY: y,
      startOffsetX: this.camera.offsetX,
      startOffsetY: this.camera.offsetY,
      active: false
    };
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
      if (this.interactive) {
        this.pointer = this.eventPoint(event);
        this.scheduleFrame();
      }
      return;
    }
    const [x, y] = this.eventPoint(event);
    const dx = x - drag.startX;
    const dy = y - drag.startY;
    if (!drag.active) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      drag.active = true;
      this.tween = null;
      this.pointer = null; // no hover or tooltip while dragging
      this.hoverDirty = true;
      this.canvas.classList.add("is-dragging");
    }
    this.camera = clampCamera(
      { scale: this.camera.scale, offsetX: drag.startOffsetX + dx, offsetY: drag.startOffsetY + dy },
      this.viewport,
      WORLD
    );
    this.requestRender();
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
      this.handleClick(x, y);
    }
  }

  private onPointerLeave = (): void => {
    this.pointer = null;
    this.hoverDirty = true;
    this.scheduleFrame();
  };

  private onPointerUp = (event: PointerEvent): void => this.endDrag(event, true);
  private onPointerCancel = (event: PointerEvent): void => this.endDrag(event, false);
  private onLostPointerCapture = (event: PointerEvent): void => this.endDrag(event, false);

  private onWheel = (event: WheelEvent): void => {
    if (!this.interactive) return;
    event.preventDefault();
    const [x, y] = this.eventPoint(event);
    const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaMode === 2 ? event.deltaY * 100 : event.deltaY;
    this.zoomTo(this.targetScale() * WHEEL_SENSITIVITY ** -delta, x, y);
  };

  /** Applies the click outcome of spec 11.3; any click that is not on a stack collapses the expanded stack. */
  private handleClick(x: number, y: number): void {
    const props = this.props;
    const geometry = this.geometry;
    if (!props || !geometry) return;
    const outcome = clickOutcome(hitTest(x, y, this.frameHit, this.camera, geometry.lookup));
    if (outcome.selectUnit) props.onSelectUnit?.(outcome.selectUnit);
    if (outcome.selectRegion) props.onSelectRegion?.(outcome.selectRegion);
    if (outcome.focus) this.focusRegion(outcome.focus);
    this.expandedRegionId = outcome.expand ?? null;
    this.requestRender();
  }

  // ---- frame loop ----

  /** Marks the canvas dirty; any number of requests coalesce into one animation frame. */
  private requestRender(): void {
    this.drawPending = true;
    this.scheduleFrame();
  }

  private scheduleFrame(): void {
    if (this.rafId !== null || this.destroyed) return;
    this.rafId = requestAnimationFrame(this.frame);
  }

  private frame = (now: number): void => {
    this.rafId = null;
    if (this.destroyed) return;
    if ((window.devicePixelRatio || 1) !== this.dpr) this.syncSize();

    const hadTween = this.tween !== null;
    const animating = this.advanceTween(now);
    if (hadTween) this.drawPending = true;
    // hover is hit-tested here, once per frame, against the boxes of the last draw
    const hoverChanged = this.updateHover(false);
    if (!this.drawPending && !hoverChanged) return; // only the tooltip moved

    const started = performance.now();
    const movedUnderPointer = this.drawPending;
    this.drawPending = false;
    const props = this.props;
    if (!this.geometry || !this.derived || !props || this.viewport.width === 0 || this.viewport.height === 0) {
      this.drawPreparing();
    } else {
      this.frameHit = renderFrame({
        ctx: this.ctx,
        viewport: this.viewport,
        dpr: this.dpr,
        camera: this.camera,
        z: this.camera.scale / this.fitScale,
        geometry: this.geometry,
        derived: this.derived,
        state: props.state,
        props,
        hoverRegionId: this.hoverRegionId,
        expandedRegionId: this.expandedRegionId,
        fontsReady: this.fontsReady
      });
    }
    recordFrame(performance.now() - started);
    // the camera, props or size changed what is under a still pointer: test again against the fresh boxes
    if (movedUnderPointer && this.updateHover(true)) this.requestRender();
    if (animating) this.requestRender();
  };

  // ---- hover, tooltip and the dev meter ----

  /** Hit-tests the pointer; true when the hovered region changed (the outline then needs a draw). */
  private updateHover(force: boolean): boolean {
    const geometry = this.geometry;
    if (!geometry || !this.interactive) return false;
    const pointer = this.drag?.active ? null : this.pointer;
    const camera = this.camera;
    const key = pointer ? `${pointer[0]},${pointer[1]},${camera.scale},${camera.offsetX},${camera.offsetY}` : "off";
    if (!force && !this.hoverDirty && key === this.hoverKey) return false;
    this.hoverKey = key;
    this.hoverDirty = false;

    let regionId: string | null = null;
    if (pointer) {
      const hit = hitTest(pointer[0], pointer[1], this.frameHit, camera, geometry.lookup);
      if (hit.kind !== "sea" && hit.kind !== "pill") regionId = hit.regionId;
    }
    this.tooltip.update(this.props?.state, regionId, pointer, this.viewport);
    if (regionId === this.hoverRegionId) return false;
    this.hoverRegionId = regionId;
    return true;
  }

  /** F3 (dev builds only) shows or hides the frame-time meter. */
  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "F3") return;
    event.preventDefault();
    this.perfMeter.toggle();
  };

  private drawPreparing(): void {
    drawPreparingMap(this.ctx, this.viewport, this.dpr);
  }
}
