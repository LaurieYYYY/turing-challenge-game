import { getQuestion, getStage, hasStartedAnswering, stageScore } from "./game-engine.js";

const icons = {
  poem: "✦",
  painting: "▣",
  math_and_logic: "#",
};

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function button(label, action, className = "button-primary", attrs = "") {
  return `<button class="button ${className}" data-action="${action}" ${attrs}>${escapeHtml(label)}</button>`;
}

function statusBar(stage, state) {
  const step = state.currentQuestionIndex + 1;
  const percent = Math.round((step / stage.questions.length) * 100);
  return `
    <div class="mission-bar">
      <div>
        <span class="eyebrow">${escapeHtml(stage.displayTitle)}</span>
        <span class="progress-copy">Case ${step} of ${stage.questions.length}</span>
      </div>
      <div class="progress-track" role="progressbar" aria-label="Stage progress" aria-valuemin="1" aria-valuemax="${stage.questions.length}" aria-valuenow="${step}">
        <span style="width:${percent}%"></span>
      </div>
    </div>`;
}

function mediaFigure(question, implementation) {
  if (!question.media) return "";
  const src = escapeHtml(question.media.path);
  const alt = escapeHtml(question.media.altText);
  return `
    <figure class="artifact-frame" data-image-frame>
      <img class="artifact-image" src="${src}" alt="${alt}" data-original-src="${src}">
      <div class="image-fallback" hidden>
        <p>${escapeHtml(implementation.imageError.message)}</p>
        ${button(implementation.imageError.retryButtonLabel, "retry-image", "button-secondary")}
      </div>
    </figure>`;
}

function poemArtifact(question) {
  if (question.artifact?.type !== "poem") return "";
  return `<blockquote class="poem" aria-label="Mystery poem">${question.artifact.lines.map((line) => `<span>${escapeHtml(line)}</span>`).join("")}</blockquote>`;
}

function choiceButtons(choices, action, selected, locked) {
  return `<div class="choice-grid">${choices.map((choice) => {
    const picked = selected === choice.id;
    const classes = picked ? "choice-button is-selected" : "choice-button";
    return `<button class="${classes}" data-action="${action}" data-answer="${escapeHtml(choice.id)}" ${locked ? "disabled" : ""}>
      <span class="choice-symbol" aria-hidden="true">${choice.id.includes("human") ? "H" : choice.id === "ai" || choice.id.includes("ai_") ? "AI" : choice.id === "correct" ? "✓" : "×"}</span>
      <span>${escapeHtml(choice.label)}</span>
    </button>`;
  }).join("")}</div>`;
}

function sourceDetails(sourceRecord) {
  if (!sourceRecord) return "";
  const details = [];
  if (sourceRecord.model) details.push(`<p><strong>Model:</strong> ${escapeHtml(sourceRecord.model)}</p>`);
  if (sourceRecord.prompt) details.push(`<p><strong>Prompt:</strong> ${escapeHtml(sourceRecord.prompt)}</p>`);
  if (sourceRecord.steps) {
    details.push(...sourceRecord.steps.map((step) => `<p><strong>Step ${step.order}:</strong> ${escapeHtml(step.model)} — “${escapeHtml(step.prompt)}”</p>`));
  }
  const link = sourceRecord.url || sourceRecord.verification?.url;
  const label = sourceRecord.label || sourceRecord.verification?.label;
  if (link && label) details.push(`<p><a class="source-link" href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">Check the source: ${escapeHtml(label)}</a></p>`);
  return details.length ? `<div class="source-details">${details.join("")}</div>` : "";
}

function learningCard(question) {
  const body = question.learningCard.body.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("");
  return `
    <section class="learning-card" tabindex="-1" data-focus-target aria-labelledby="learning-title">
      <div class="card-kicker">Learning Card</div>
      <h3 id="learning-title">${escapeHtml(question.learningCard.title)}</h3>
      <p class="reveal-line"><strong>${escapeHtml(typeof question.reveal === "string" ? question.reveal : question.reveal.copy)}</strong></p>
      <div class="learning-body">${body}</div>
      ${sourceDetails(question.sourceRecord)}
    </section>`;
}

function feedback(cue, correct, reveal = "", label = "", className = "") {
  const statusLabel = label || (correct ? "Correct choice" : "Incorrect choice");
  return `<div class="answer-feedback ${correct ? "is-correct" : "is-incorrect"} ${className}" role="status" tabindex="-1" data-focus-target>
    <span class="feedback-mark" aria-hidden="true">${correct ? "✓" : "✕"}</span>
    <div class="feedback-copy">
      <span class="feedback-label">${escapeHtml(statusLabel)}</span>
      <strong>${escapeHtml(cue)}</strong>
      ${reveal ? `<p>${escapeHtml(reveal)}</p>` : ""}
    </div>
  </div>`;
}

function hintArea(content, state, question, disabled) {
  const used = state.hintUsedByQuestion[question.id];
  if (used) {
    return `<aside class="hint-card" tabindex="-1"><span class="hint-label">Hint</span><p>${escapeHtml(question.hint)}</p></aside>`;
  }
  const label = state.hintsRemaining ? `Use a Hint (${state.hintsRemaining} left)` : content.game.hintPolicy.noneLeftMessage;
  return button(label, "open-hint", "button-hint", disabled || !state.hintsRemaining ? "disabled" : "");
}

function renderStart(content) {
  const { game } = content;
  return `
    <section class="screen start-screen" aria-labelledby="screen-title">
      <div class="start-emblem" aria-hidden="true"><span>H</span><span>AI</span></div>
      <p class="filipino-greeting" lang="fil">Kumusta!</p>
      <p class="eyebrow">AI Detective Mission</p>
      <h1 id="screen-title" tabindex="-1">${escapeHtml(game.title)}</h1>
      <p class="lead">${escapeHtml(game.startScreen.intro)}</p>
      <p class="story-copy">${escapeHtml(game.startScreen.background)}</p>
      ${button(game.startScreen.buttonLabel, "start", "button-primary button-large")}
      <div class="stage-preview" aria-label="Three game stages">
        ${content.stages.map((stage, index) => `<div><span>0${index + 1}</span><strong>${escapeHtml(stage.title)}</strong><small>${escapeHtml(stage.shortDescription)}</small></div>`).join("")}
      </div>
    </section>`;
}

function renderHowTo(content) {
  return `
    <section class="screen" aria-labelledby="screen-title">
      <p class="eyebrow">Detective Briefing</p>
      <h1 id="screen-title" tabindex="-1">How to Play</h1>
      <ol class="instruction-list">
        ${content.game.howToPlay.map((item, index) => `<li><span>${index + 1}</span><p>${escapeHtml(item)}</p></li>`).join("")}
      </ol>
      <div class="hint-budget"><span aria-hidden="true">◆ ◆ ◆</span><p><strong>Three hints.</strong> Save them for the clues that make you think twice.</p></div>
      ${button("Continue", "continue", "button-primary button-large")}
    </section>`;
}

function renderStageIntro(content, state) {
  const stage = getStage(content, state);
  const stageNumber = state.currentStageIndex + 1;
  return `
    <section class="screen stage-intro" aria-labelledby="screen-title">
      <div class="stage-orb" aria-hidden="true">${icons[stage.type] || "?"}</div>
      <p class="eyebrow">Stage ${stageNumber} of ${content.stages.length}</p>
      <h1 id="screen-title" tabindex="-1">${escapeHtml(stage.title)}</h1>
      <p class="lead">${escapeHtml(stage.shortDescription)}</p>
      <div class="mission-card">
        <span>Mission</span>
        <p>${escapeHtml(stage.playerInstruction)}</p>
      </div>
      <div class="stage-stats">
        <div><span>Maximum</span><strong>${stage.stageScore.maximum} pts</strong></div>
        <div><span>Your score</span><strong>${state.score} pts</strong></div>
        <div><span>Hints left</span><strong>${state.hintsRemaining}</strong></div>
      </div>
      ${button("Begin Stage", "begin-stage", "button-primary button-large")}
    </section>`;
}

function renderSingleQuestion(content, state, stage, question) {
  const record = state.answeredQuestions[question.id];
  const cue = record?.isCorrect ? "Sharp eye!" : "Good try. Check the learning card.";
  return `
    ${statusBar(stage, state)}
    <div class="question-layout ${question.media ? "has-media" : ""}">
      <div class="artifact-column">
        ${mediaFigure(question, content.implementation)}
        ${poemArtifact(question)}
      </div>
      <section class="question-card" aria-labelledby="screen-title">
        <p class="mystery-id">Mystery ${escapeHtml(question.id)}</p>
        <h1 id="screen-title" tabindex="-1">${escapeHtml(question.question)}</h1>
        ${hintArea(content, state, question, Boolean(record))}
        ${choiceButtons(stage.choices, "answer-single", record?.answer, Boolean(record))}
        ${record ? feedback(cue, record.isCorrect) : ""}
      </section>
    </div>
    ${record ? learningCard(question) : ""}
    ${record ? `<div class="next-row">${button(state.currentQuestionIndex === stage.questions.length - 1 ? "Finish Stage" : "Next Question", "next-question", "button-primary button-large")}</div>` : ""}`;
}

function renderLogicQuestion(content, state, stage, question) {
  const correctness = state.correctnessAnswers[question.id];
  const source = state.sourceAnswers[question.id];
  const correctnessDecision = question.decisions.find((item) => item.id === "correctness");
  const sourceDecision = question.decisions.find((item) => item.id === "source");
  const complete = Boolean(correctness && source);
  const correctnessCue = correctness?.isCorrect ? "Good thinking!" : "Good try. Check the learning card.";
  const sourceCue = source?.isCorrect ? "Good thinking!" : "Good try. Check the learning card.";
  return `
    ${statusBar(stage, state)}
    <div class="question-layout has-media">
      <div class="artifact-column">
        ${mediaFigure(question, content.implementation)}
        <div class="puzzle-card"><span>Puzzle</span><p>${escapeHtml(question.puzzle)}</p></div>
      </div>
      <section class="question-card" aria-labelledby="screen-title">
        <p class="mystery-id">Mystery ${escapeHtml(question.id)}</p>
        <h1 id="screen-title" tabindex="-1">Check the explanation</h1>
        <blockquote class="mystery-explanation">${escapeHtml(question.mysteryExplanation)}</blockquote>
        ${hintArea(content, state, question, Boolean(correctness))}
        <div class="decision-block" aria-labelledby="correctness-title">
          <span class="decision-step">Decision 1 · 5 points</span>
          <h2 id="correctness-title">${escapeHtml(correctnessDecision.question)}</h2>
          ${choiceButtons(correctnessDecision.choices, "answer-correctness", correctness?.answer, Boolean(correctness))}
          ${correctness ? feedback(
            correctnessCue,
            correctness.isCorrect,
            "",
            correctness.isCorrect ? "Correctness check: correct" : "Correctness check: incorrect",
            "correctness-feedback"
          ) : ""}
        </div>
        ${correctness ? `<div class="decision-block source-decision" data-focus-target tabindex="-1" aria-labelledby="source-title">
          <span class="decision-step">Decision 2 · 5 points</span>
          <h2 id="source-title">${escapeHtml(sourceDecision.question)}</h2>
          <p class="decision-help">Choose where the explanation itself came from.</p>
          ${choiceButtons(sourceDecision.choices, "answer-source", source?.answer, Boolean(source))}
          ${source ? feedback(
            sourceCue,
            source.isCorrect,
            "",
            source.isCorrect ? "Source check: correct" : "Source check: incorrect",
            "source-feedback"
          ) : ""}
        </div>` : ""}
      </section>
    </div>
    ${complete ? learningCard(question) : ""}
    ${complete ? `<div class="next-row">${button(state.currentQuestionIndex === stage.questions.length - 1 ? "Finish Stage" : "Next Question", "next-question", "button-primary button-large")}</div>` : ""}`;
}

function renderQuestion(content, state) {
  const stage = getStage(content, state);
  const question = getQuestion(content, state);
  return `<section class="screen question-screen" aria-label="Question">${stage.answerMode === "single_choice" ? renderSingleQuestion(content, state, stage, question) : renderLogicQuestion(content, state, stage, question)}</section>`;
}

function renderStageComplete(content, state) {
  const stage = getStage(content, state);
  return `
    <section class="screen complete-screen" aria-labelledby="screen-title">
      <div class="completion-badge" aria-hidden="true">✓</div>
      <p class="eyebrow">Stage Complete</p>
      <h1 id="screen-title" tabindex="-1">${escapeHtml(stage.title)} cleared!</h1>
      <p class="lead">You investigated every mystery in this stage.</p>
      <div class="score-display"><span>Stage score</span><strong>${stageScore(stage, state)} / ${stage.stageScore.maximum}</strong></div>
      <div class="stage-stats compact">
        <div><span>Total score</span><strong>${state.score}</strong></div>
        <div><span>Hints left</span><strong>${state.hintsRemaining}</strong></div>
      </div>
      ${button(state.currentStageIndex === content.stages.length - 1 ? "See Final Score" : "Next Stage", "next-stage", "button-primary button-large")}
    </section>`;
}

function renderFinal(content, state) {
  const final = content.game.finalScreen;
  const band = final.feedbackBands.find((item) => state.score >= item.minScore && state.score <= item.maxScore);
  return `
    <section class="screen final-screen" aria-labelledby="screen-title">
      <div class="final-rays" aria-hidden="true"><span>★</span></div>
      <p class="filipino-greeting" lang="fil">Paalam!</p>
      <p class="eyebrow">All three stages complete</p>
      <h1 id="screen-title" tabindex="-1">${escapeHtml(final.title)}</h1>
      <div class="final-score"><strong>${state.score}</strong><span>/ 90</span></div>
      <h2>${escapeHtml(band.name)}</h2>
      <p class="lead">${escapeHtml(band.message)}</p>
      <div class="breakdown" aria-label="Score by stage">
        ${content.stages.map((stage, index) => `<div><span>Stage ${index + 1}</span><strong>${stageScore(stage, state)} / 30</strong></div>`).join("")}
      </div>
      ${button("See Takeaway", "show-takeaway", "button-primary button-large")}
    </section>`;
}

function renderTakeaway(content) {
  const takeaway = content.game.finalScreen.takeaway;
  return `
    <section class="screen takeaway-screen" aria-labelledby="screen-title">
      <p class="eyebrow">Detective Notes</p>
      <h1 id="screen-title" tabindex="-1">${escapeHtml(takeaway.title)}</h1>
      <div class="takeaway-list">${takeaway.items.map((item, index) => `<div><span>0${index + 1}</span><p>${escapeHtml(item)}</p></div>`).join("")}</div>
      <div class="button-row">
        ${button("Review Cards", "review-cards", "button-secondary")}
        ${button("Play Again", "play-again", "button-primary")}
      </div>
    </section>`;
}

function renderReview(content) {
  const cards = content.stages.flatMap((stage) => stage.questions.map((question) => `
    <article class="review-card">
      <span class="eyebrow">${escapeHtml(stage.title)} · ${escapeHtml(question.id)}</span>
      <h2>${escapeHtml(question.title)}</h2>
      <p class="reveal-line"><strong>${escapeHtml(typeof question.reveal === "string" ? question.reveal : question.reveal.copy)}</strong></p>
      ${question.learningCard.body.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}
      ${sourceDetails(question.sourceRecord)}
    </article>`));
  return `
    <section class="screen review-screen" aria-labelledby="screen-title">
      <p class="eyebrow">Completed Case Files</p>
      <h1 id="screen-title" tabindex="-1">Learning Card Review</h1>
      <p class="lead">Review the clues, facts, and sources you uncovered.</p>
      <div class="review-grid">${cards.join("")}</div>
      <div class="button-row sticky-actions">${button("Close Review", "close-review", "button-primary")}${button("Play Again", "play-again", "button-secondary")}</div>
    </section>`;
}

export function renderApp(root, content, state) {
  document.body.dataset.stage = state.screen === "start" || state.screen === "how-to" ? "start" : `stage-${state.currentStageIndex + 1}`;
  const screens = {
    start: () => renderStart(content),
    "how-to": () => renderHowTo(content),
    "stage-intro": () => renderStageIntro(content, state),
    question: () => renderQuestion(content, state),
    "stage-complete": () => renderStageComplete(content, state),
    final: () => renderFinal(content, state),
    takeaway: () => renderTakeaway(content),
    review: () => renderReview(content),
  };
  root.innerHTML = (screens[state.screen] || screens.start)();
  root.setAttribute("aria-busy", "false");
  const hud = document.querySelector("#hud");
  hud.hidden = state.screen === "start" || state.screen === "how-to";
  document.querySelector("#hud-score").textContent = state.score;
  document.querySelector("#hud-hints").textContent = state.hintsRemaining;
  bindImageFallbacks(root);
}

function bindImageFallbacks(root) {
  root.querySelectorAll("[data-image-frame]").forEach((frame) => {
    const image = frame.querySelector("img");
    const fallback = frame.querySelector(".image-fallback");
    image.addEventListener("error", () => {
      image.hidden = true;
      fallback.hidden = false;
    });
  });
}

export function describeState(content, state) {
  const stage = getStage(content, state);
  const question = getQuestion(content, state);
  return {
    screen: state.screen,
    score: state.score,
    hintsRemaining: state.hintsRemaining,
    stage: stage.id,
    question: question.id,
    answerStarted: hasStartedAnswering(content, state),
    completed: state.gameCompleted,
  };
}
