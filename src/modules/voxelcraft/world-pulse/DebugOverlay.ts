/** Только разработчику: обычный игрок не видит состояние селектора. */
export class DebugOverlay {
  private element: HTMLDivElement | null = null;

  show(): void {
    if (this.element) return;
    const element = document.createElement("div");
    element.setAttribute("data-world-pulse-debug", "");
    element.style.cssText = "position:fixed;right:12px;top:12px;z-index:9999;pointer-events:none;white-space:pre-line;padding:9px 12px;background:#10151cce;color:#c5f3d0;border:1px solid #52735b;font:12px/1.45 monospace;max-width:340px";
    document.body.append(element);
    this.element = element;
  }

  update(lines: string[]): void { if (this.element) this.element.textContent = lines.join("\n"); }
  hide(): void { this.element?.remove(); this.element = null; }
}
