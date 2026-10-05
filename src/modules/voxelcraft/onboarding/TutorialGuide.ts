/** Постоянная подсказка текущего действия поверх игрового мира. */
export interface TutorialGuideStep {
  number: number;
  title: string;
  action: string;
}

export class TutorialGuide {
  private readonly root = document.getElementById("tutorialGuide")!;
  private readonly progress = document.getElementById("tutorialGuideProgress")!;
  private readonly title = document.getElementById("tutorialGuideTitle")!;
  private readonly action = document.getElementById("tutorialGuideAction")!;
  private last = "";

  show(step: TutorialGuideStep) {
    const value = `${step.number}|${step.title}|${step.action}`;
    if (value !== this.last) {
      this.progress.textContent = `${step.number}/9`;
      this.title.textContent = step.title;
      this.action.textContent = step.action;
      this.last = value;
    }
    this.root.classList.remove("hidden");
  }

  hide() {
    this.root.classList.add("hidden");
  }

  dispose() { this.hide(); }
}
