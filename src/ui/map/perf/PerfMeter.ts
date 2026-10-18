import { readStats } from "./frameStats";

const REFRESH_MS = 500;

/** The dev frame meter (F3): average and p95 draw time, React render count and frame count, refreshed twice a second. */
export class PerfMeter {
  private timer: number | null = null;

  constructor(private readonly element: HTMLDivElement) {}

  toggle(): void {
    const visible = this.element.classList.toggle("is-visible");
    this.stop();
    if (visible) {
      this.refresh();
      this.timer = window.setInterval(() => this.refresh(), REFRESH_MS);
    }
  }

  destroy(): void {
    this.stop();
  }

  private stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }

  private refresh(): void {
    const stats = readStats();
    this.element.textContent = `avg ${stats.avgFrameMs.toFixed(1)} ms · p95 ${stats.p95FrameMs.toFixed(1)} ms · renders ${stats.renders} · frames ${stats.frames}`;
  }
}
