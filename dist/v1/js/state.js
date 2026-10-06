export function createInitialState(totalHints = 3) {
  return {
    screen: "start",
    currentStageIndex: 0,
    currentQuestionIndex: 0,
    currentStage: "stage-1",
    currentQuestion: "P1",
    score: 0,
    hintsRemaining: totalHints,
    hintUsedByQuestion: {},
    answeredQuestions: {},
    correctnessAnswers: {},
    sourceAnswers: {},
    learningCardOpened: false,
    gameCompleted: false,
  };
}

export function replaceState(target, nextState) {
  for (const key of Object.keys(target)) delete target[key];
  Object.assign(target, nextState);
  return target;
}
