import { createInitialState, replaceState } from "./state.js";
import {
  advance,
  advanceStage,
  getQuestion,
  getStage,
  submitDecision,
  submitSingle,
  syncPointers,
  useHint,
} from "./game-engine.js";
import { describeState, renderApp } from "./render.js";

const root = document.querySelector("#game");
const liveStatus = document.querySelector("#live-status");
const hintDialog = document.querySelector("#hint-dialog");
const confirmHint = document.querySelector("#confirm-hint");
const dialogHintCount = document.querySelector("#dialog-hint-count");
let content;
let state;
let hintReturnTarget = null;

boot();

async function boot() {
  try {
    const response = await fetch("data/game-content.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Content request failed with ${response.status}`);
    content = await response.json();
    validateContent(content);
    state = createInitialState(content.game.hintPolicy.totalHints);
    syncPointers(content, state);
    render({ focusTitle: false });
    registerWebMcpTools();
  } catch (error) {
    console.error("The Turing Challenge failed to start:", error);
    root.setAttribute("aria-busy", "false");
    root.innerHTML = `<section class="screen fatal-error" role="alert"><h1>The game could not load.</h1><p>Please refresh the page and try again.</p><button class="button button-primary" onclick="location.reload()">Refresh</button></section>`;
  }
}

function validateContent(data) {
  if (!data?.game || !Array.isArray(data.stages) || data.stages.length !== 3) throw new Error("Three stages are required.");
  const ids = new Set();
  for (const stage of data.stages) {
    if (!Array.isArray(stage.questions) || stage.questions.length !== 3) throw new Error(`${stage.id} must contain three questions.`);
    for (const question of stage.questions) {
      if (!question.id || !question.hint || !question.learningCard || !question.reveal) throw new Error(`Question content is incomplete in ${stage.id}.`);
      if (ids.has(question.id)) throw new Error(`Duplicate question ID ${question.id}.`);
      ids.add(question.id);
      if (question.media && (!question.media.path || !question.media.altText)) throw new Error(`Image data is incomplete for ${question.id}.`);
    }
  }
  const maximum = data.stages.reduce((sum, stage) => sum + stage.stageScore.maximum, 0);
  if (maximum !== 90 || data.game.scoring.maximumScore !== 90) throw new Error("Maximum score must equal 90.");
}

function render(options = {}) {
  renderApp(root, content, state);
  if (options.announce) announce(options.announce);
  requestAnimationFrame(() => {
    const target = options.focusSelector ? root.querySelector(options.focusSelector) : options.focusTitle === false ? null : root.querySelector("#screen-title");
    target?.focus({ preventScroll: false });
  });
}

function announce(message) {
  liveStatus.textContent = "";
  requestAnimationFrame(() => { liveStatus.textContent = message; });
}

root.addEventListener("click", (event) => {
  const actionTarget = event.target.closest("[data-action]");
  if (!actionTarget) return;
  const action = actionTarget.dataset.action;
  try {
    if (action === "start") {
      state.screen = "how-to";
      render();
    } else if (action === "continue") {
      state.screen = "stage-intro";
      render();
    } else if (action === "begin-stage") {
      state.screen = "question";
      render();
    } else if (action === "open-hint") {
      openHintDialog(actionTarget);
    } else if (action === "answer-single") {
      const result = submitSingle(content, state, actionTarget.dataset.answer);
      if (result) render({ announce: result.isCorrect ? "Correct. Ten points added." : "Answer recorded. Open the learning card to check the source.", focusSelector: "[data-focus-target]" });
    } else if (action === "answer-correctness") {
      const result = submitDecision(content, state, "correctness", actionTarget.dataset.answer);
      if (result) render({ announce: "Correctness answer recorded. Now identify the source.", focusSelector: ".source-decision" });
    } else if (action === "answer-source") {
      const result = submitDecision(content, state, "source", actionTarget.dataset.answer);
      if (result) render({ announce: "Source answer recorded. The learning card is ready.", focusSelector: "[data-focus-target]" });
    } else if (action === "next-question") {
      advance(content, state);
      render();
    } else if (action === "next-stage") {
      advanceStage(content, state);
      render();
    } else if (action === "show-takeaway") {
      state.screen = "takeaway";
      render();
    } else if (action === "review-cards") {
      state.screen = "review";
      render();
    } else if (action === "close-review") {
      state.screen = "takeaway";
      render();
    } else if (action === "play-again") {
      resetGame();
    } else if (action === "retry-image") {
      retryImage(actionTarget);
    }
  } catch (error) {
    console.error("Game action failed:", error);
    announce("That action did not work. Please try again.");
  }
});

function openHintDialog(trigger) {
  hintReturnTarget = trigger;
  dialogHintCount.textContent = state.hintsRemaining;
  hintDialog.showModal();
}

hintDialog.addEventListener("close", () => {
  if (hintDialog.returnValue === "confirm") {
    if (useHint(content, state)) {
      const count = state.hintsRemaining;
      const message = content.game.hintPolicy.usedTemplate.replace("{remaining}", count);
      render({ announce: message, focusSelector: ".hint-card" });
      return;
    }
  }
  hintReturnTarget?.focus();
});

confirmHint.addEventListener("click", () => { hintDialog.returnValue = "confirm"; });

function retryImage(button) {
  const frame = button.closest("[data-image-frame]");
  const image = frame.querySelector("img");
  const fallback = frame.querySelector(".image-fallback");
  fallback.hidden = true;
  image.hidden = false;
  const separator = image.dataset.originalSrc.includes("?") ? "&" : "?";
  image.src = `${image.dataset.originalSrc}${separator}retry=${Date.now()}`;
}

function resetGame() {
  replaceState(state, createInitialState(content.game.hintPolicy.totalHints));
  syncPointers(content, state);
  render({ announce: "New game started." });
}

function performToolAction(input) {
  if (input.action === "start") {
    if (state.screen === "start") state.screen = "how-to";
    else if (state.screen === "how-to") state.screen = "stage-intro";
    else if (state.screen === "stage-intro") state.screen = "question";
    else throw new Error("The current screen cannot be started.");
  } else if (input.action === "answer") {
    if (state.screen !== "question") throw new Error("No question is active.");
    const stage = getStage(content, state);
    if (stage.answerMode === "single_choice") submitSingle(content, state, input.answer);
    else submitDecision(content, state, input.decision, input.answer);
  } else if (input.action === "next") {
    if (state.screen === "question" && state.learningCardOpened) advance(content, state);
    else if (state.screen === "stage-complete") advanceStage(content, state);
    else throw new Error("There is nothing to advance from this screen.");
  } else if (input.action === "restart") {
    replaceState(state, createInitialState(content.game.hintPolicy.totalHints));
    syncPointers(content, state);
  }
  render();
  return describeState(content, state);
}

function registerWebMcpTools() {
  const context = document.modelContext;
  if (!context?.registerTool) return;
  const lifecycle = new AbortController();
  window.addEventListener("pagehide", () => lifecycle.abort(), { once: true });
  try {
    void Promise.resolve(context.registerTool({
      name: "read_turing_challenge_status",
      title: "Read game status",
      description: "Read the current screen, score, hints, stage, question, and completion state without changing the game.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute() { return describeState(content, state); },
    }, { signal: lifecycle.signal })).catch(console.error);
    void Promise.resolve(context.registerTool({
      name: "play_turing_challenge",
      title: "Play the current game step",
      description: "Start or advance the game, submit the visible answer, or restart. Uses the same state and rules as the visible controls.",
      inputSchema: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["start", "answer", "next", "restart"] },
          decision: { type: "string", enum: ["correctness", "source"] },
          answer: { type: "string" },
        },
        required: ["action"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        if (!input || typeof input !== "object") throw new Error("A valid action is required.");
        if (input.action === "answer" && typeof input.answer !== "string") throw new Error("An answer is required.");
        return performToolAction(input);
      },
    }, { signal: lifecycle.signal })).catch(console.error);
  } catch (error) {
    console.error("WebMCP registration failed:", error);
  }
}
