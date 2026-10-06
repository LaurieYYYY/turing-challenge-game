export function getStage(content, state) {
  return content.stages[state.currentStageIndex];
}

export function getQuestion(content, state) {
  return getStage(content, state).questions[state.currentQuestionIndex];
}

export function syncPointers(content, state) {
  const stage = getStage(content, state);
  const question = getQuestion(content, state);
  state.currentStage = stage.id;
  state.currentQuestion = question.id;
}

export function useHint(content, state) {
  const question = getQuestion(content, state);
  if (state.hintsRemaining < 1 || state.hintUsedByQuestion[question.id] || hasStartedAnswering(content, state)) {
    return false;
  }
  state.hintsRemaining -= 1;
  state.hintUsedByQuestion[question.id] = true;
  return true;
}

export function hasStartedAnswering(content, state) {
  const question = getQuestion(content, state);
  return Boolean(
    state.answeredQuestions[question.id] ||
    state.correctnessAnswers[question.id] ||
    state.sourceAnswers[question.id]
  );
}

export function submitSingle(content, state, answer) {
  const stage = getStage(content, state);
  const question = getQuestion(content, state);
  if (state.answeredQuestions[question.id]) return null;
  if (!stage.choices.some((choice) => choice.id === answer)) throw new Error("Invalid answer choice.");
  const isCorrect = answer === question.correctAnswer;
  const pointsAwarded = isCorrect ? stage.stageScore.pointsPerQuestion : 0;
  state.answeredQuestions[question.id] = {
    answer,
    isCorrect,
    pointsAwarded,
    hintUsed: Boolean(state.hintUsedByQuestion[question.id]),
  };
  state.score += pointsAwarded;
  state.learningCardOpened = true;
  return state.answeredQuestions[question.id];
}

export function submitDecision(content, state, decisionId, answer) {
  const question = getQuestion(content, state);
  const decision = question.decisions.find((item) => item.id === decisionId);
  if (!decision) throw new Error("Invalid decision.");
  if (decisionId === "source" && !state.correctnessAnswers[question.id]) throw new Error("Answer correctness first.");
  const target = decisionId === "correctness" ? state.correctnessAnswers : state.sourceAnswers;
  if (target[question.id]) return null;
  if (!decision.choices.some((choice) => choice.id === answer)) throw new Error("Invalid answer choice.");
  const isCorrect = answer === decision.correctAnswer;
  const pointsAwarded = isCorrect ? decision.points : 0;
  target[question.id] = { answer, isCorrect, pointsAwarded };
  state.score += pointsAwarded;
  state.learningCardOpened = Boolean(state.correctnessAnswers[question.id] && state.sourceAnswers[question.id]);
  return target[question.id];
}

export function advance(content, state) {
  const stage = getStage(content, state);
  if (state.currentQuestionIndex < stage.questions.length - 1) {
    state.currentQuestionIndex += 1;
    state.learningCardOpened = false;
    syncPointers(content, state);
    state.screen = "question";
    return;
  }
  state.screen = "stage-complete";
}

export function advanceStage(content, state) {
  if (state.currentStageIndex < content.stages.length - 1) {
    state.currentStageIndex += 1;
    state.currentQuestionIndex = 0;
    state.learningCardOpened = false;
    syncPointers(content, state);
    state.screen = "stage-intro";
    return;
  }
  state.gameCompleted = true;
  state.screen = "final";
}

export function stageScore(stage, state) {
  return stage.questions.reduce((sum, question) => {
    if (stage.answerMode === "single_choice") {
      return sum + (state.answeredQuestions[question.id]?.pointsAwarded || 0);
    }
    return sum + (state.correctnessAnswers[question.id]?.pointsAwarded || 0) + (state.sourceAnswers[question.id]?.pointsAwarded || 0);
  }, 0);
}
