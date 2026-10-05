import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createInitialState, replaceState } from "../dist/js/state.js";
import {
  advance,
  advanceStage,
  getQuestion,
  getStage,
  stageScore,
  submitDecision,
  submitSingle,
  syncPointers,
  useHint,
} from "../dist/js/game-engine.js";

const content = JSON.parse(await readFile(new URL("../dist/data/game-content.json", import.meta.url), "utf8"));

function freshState() {
  const state = createInitialState(content.game.hintPolicy.totalHints);
  syncPointers(content, state);
  return state;
}

test("a perfect run reaches 90 points without duplicate scoring", () => {
  const state = freshState();
  state.screen = "question";
  for (let stageIndex = 0; stageIndex < content.stages.length; stageIndex += 1) {
    const stage = getStage(content, state);
    for (let questionIndex = 0; questionIndex < stage.questions.length; questionIndex += 1) {
      const question = getQuestion(content, state);
      if (stage.answerMode === "single_choice") {
        submitSingle(content, state, question.correctAnswer);
        assert.equal(submitSingle(content, state, question.correctAnswer), null);
      } else {
        for (const decision of question.decisions) submitDecision(content, state, decision.id, decision.correctAnswer);
      }
      advance(content, state);
    }
    assert.equal(stageScore(stage, state), 30);
    advanceStage(content, state);
  }
  assert.equal(state.score, 90);
  assert.equal(state.gameCompleted, true);
});

test("hints are shared, single-use, and reset in memory", () => {
  const state = freshState();
  assert.equal(useHint(content, state), true);
  assert.equal(useHint(content, state), false);
  assert.equal(state.hintsRemaining, 2);
  submitSingle(content, state, "human");
  assert.equal(useHint(content, state), false);
  advance(content, state);
  assert.equal(useHint(content, state), true);
  assert.equal(state.hintsRemaining, 1);
  replaceState(state, freshState());
  assert.equal(state.hintsRemaining, 3);
  assert.deepEqual(state.answeredQuestions, {});
});

test("stage 3 requires correctness before source and scores decisions separately", () => {
  const state = freshState();
  state.currentStageIndex = 2;
  state.currentQuestionIndex = 0;
  syncPointers(content, state);
  const question = getQuestion(content, state);
  assert.throws(() => submitDecision(content, state, "source", "ai_generated"));
  submitDecision(content, state, "correctness", question.decisions[0].correctAnswer);
  submitDecision(content, state, "source", question.decisions[1].correctAnswer);
  assert.equal(state.score, 10);
  assert.equal(state.learningCardOpened, true);
});
