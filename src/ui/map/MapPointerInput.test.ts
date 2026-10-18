import { describe, expect, it } from "vitest";
import { MapPointerInput, type PointerInputHooks } from "./MapPointerInput";

// The class only needs an event target with these few canvas methods, so Node's EventTarget stands in for the canvas.
class FakeCanvas extends EventTarget {
  classes = new Set<string>();
  classList = { add: (name: string) => this.classes.add(name), remove: (name: string) => this.classes.delete(name) };
  getBoundingClientRect() {
    return { left: 10, top: 20 } as DOMRect;
  }
  setPointerCapture() {}
  releasePointerCapture() {}
}

function pointer(type: string, x: number, y: number, extra: { id?: number; button?: number; pointerType?: string } = {}): Event {
  return Object.assign(new Event(type), {
    pointerId: extra.id ?? 1,
    pointerType: extra.pointerType ?? "mouse",
    button: extra.button ?? 0,
    clientX: x,
    clientY: y
  });
}

function wheel(deltaY: number, deltaMode = 0, x = 110, y = 70): Event {
  return Object.assign(new Event("wheel", { cancelable: true }), { deltaY, deltaMode, clientX: x, clientY: y });
}

function setup(interactive = true) {
  const canvas = new FakeCanvas();
  const calls = { pans: [] as [number, number][], clicks: [] as [number, number][], wheels: [] as [number, number, number][], dragStarted: 0, hover: 0 };
  const state = { interactive };
  const hooks: PointerInputHooks = {
    isInteractive: () => state.interactive,
    getCamera: () => ({ scale: 1, offsetX: 100, offsetY: 50 }),
    pan: (x, y) => calls.pans.push([x, y]),
    dragStarted: () => {
      calls.dragStarted += 1;
    },
    click: (x, y) => calls.clicks.push([x, y]),
    wheel: (factor, x, y) => calls.wheels.push([factor, x, y]),
    hoverChanged: () => {
      calls.hover += 1;
    }
  };
  const controller = new AbortController();
  const input = new MapPointerInput(canvas as unknown as HTMLCanvasElement, hooks, controller.signal);
  return { canvas, calls, input, state, controller };
}

describe("MapPointerInput", () => {
  it("turns a press and release into a click at the canvas-relative point", () => {
    const { canvas, calls } = setup();
    canvas.dispatchEvent(pointer("pointerdown", 60, 70));
    canvas.dispatchEvent(pointer("pointerup", 60, 70));
    expect(calls.clicks).toEqual([[50, 50]]);
    expect(calls.pans).toEqual([]);
    expect(calls.dragStarted).toBe(0);
  });

  it("still clicks after a move under 5 px", () => {
    const { canvas, calls } = setup();
    canvas.dispatchEvent(pointer("pointerdown", 60, 70));
    canvas.dispatchEvent(pointer("pointermove", 63, 72));
    canvas.dispatchEvent(pointer("pointerup", 63, 72));
    expect(calls.pans).toEqual([]);
    expect(calls.clicks).toHaveLength(1);
  });

  it("pans from the offsets the drag started with once it passes 5 px, and does not click", () => {
    const { canvas, calls, input } = setup();
    canvas.dispatchEvent(pointer("pointerdown", 60, 70));
    canvas.dispatchEvent(pointer("pointermove", 90, 90));
    expect(calls.dragStarted).toBe(1);
    expect(calls.pans).toEqual([[130, 70]]);
    expect(canvas.classes.has("is-dragging")).toBe(true);
    expect(input.dragging).toBe(true);
    canvas.dispatchEvent(pointer("pointermove", 100, 95));
    expect(calls.pans[1]).toEqual([140, 75]);
    expect(calls.dragStarted).toBe(1);
    canvas.dispatchEvent(pointer("pointerup", 100, 95));
    expect(calls.clicks).toEqual([]);
    expect(canvas.classes.has("is-dragging")).toBe(false);
    expect(input.dragging).toBe(false);
  });

  it("remembers the hovered point, tells the controller, and forgets it when the drag starts or the pointer leaves", () => {
    const { canvas, calls, input } = setup();
    canvas.dispatchEvent(pointer("pointermove", 40, 60));
    expect(input.pointer).toEqual([30, 40]);
    expect(calls.hover).toBe(1);
    canvas.dispatchEvent(pointer("pointerdown", 40, 60));
    canvas.dispatchEvent(pointer("pointermove", 80, 90));
    expect(input.pointer).toBeNull();
    canvas.dispatchEvent(pointer("pointerup", 80, 90));
    canvas.dispatchEvent(pointer("pointermove", 20, 30));
    expect(input.pointer).toEqual([10, 10]);
    canvas.dispatchEvent(pointer("pointerleave", 0, 0));
    expect(input.pointer).toBeNull();
    expect(calls.hover).toBe(3);
  });

  it("ignores a drag that starts with the right mouse button", () => {
    const { canvas, calls } = setup();
    canvas.dispatchEvent(pointer("pointerdown", 60, 70, { button: 2 }));
    canvas.dispatchEvent(pointer("pointermove", 200, 200));
    canvas.dispatchEvent(pointer("pointerup", 200, 200, { button: 2 }));
    expect(calls.pans).toEqual([]);
    expect(calls.clicks).toEqual([]);
  });

  it("ends a drag without a click on cancel and on lost pointer capture", () => {
    for (const ending of ["pointercancel", "lostpointercapture"]) {
      const { canvas, calls, input } = setup();
      canvas.dispatchEvent(pointer("pointerdown", 60, 70));
      canvas.dispatchEvent(pointer(ending, 60, 70));
      expect(calls.clicks, ending).toEqual([]);
      expect(input.dragging, ending).toBe(false);
      canvas.dispatchEvent(pointer("pointerup", 60, 70));
      expect(calls.clicks, ending).toEqual([]);
    }
  });

  it("does nothing when the map is not interactive (showcase mode)", () => {
    const { canvas, calls, input } = setup(false);
    canvas.dispatchEvent(pointer("pointerdown", 60, 70));
    canvas.dispatchEvent(pointer("pointermove", 200, 200));
    canvas.dispatchEvent(pointer("pointerup", 200, 200));
    const tick = wheel(-100);
    canvas.dispatchEvent(tick);
    expect(calls).toEqual({ pans: [], clicks: [], wheels: [], dragStarted: 0, hover: 0 });
    expect(input.pointer).toBeNull();
    expect(tick.defaultPrevented).toBe(false);
  });

  it("turns wheel ticks into a zoom factor of 1.0015^-delta anchored at the canvas-relative point", () => {
    const { canvas, calls } = setup();
    const tick = wheel(-100);
    canvas.dispatchEvent(tick);
    expect(tick.defaultPrevented).toBe(true);
    expect(calls.wheels).toHaveLength(1);
    expect(calls.wheels[0][0]).toBeCloseTo(1.0015 ** 100, 10);
    expect(calls.wheels[0].slice(1)).toEqual([100, 50]);
    canvas.dispatchEvent(wheel(100));
    expect(calls.wheels[1][0]).toBeCloseTo(1.0015 ** -100, 10);
  });

  it("scales line and page wheel deltas to pixels", () => {
    const { canvas, calls } = setup();
    canvas.dispatchEvent(wheel(-3, 1));
    canvas.dispatchEvent(wheel(-2, 2));
    expect(calls.wheels[0][0]).toBeCloseTo(1.0015 ** 48, 10);
    expect(calls.wheels[1][0]).toBeCloseTo(1.0015 ** 200, 10);
  });

  it("stops listening when the signal aborts", () => {
    const { canvas, calls, controller } = setup();
    controller.abort();
    canvas.dispatchEvent(pointer("pointerdown", 60, 70));
    canvas.dispatchEvent(pointer("pointerup", 60, 70));
    expect(calls.clicks).toEqual([]);
  });
});
