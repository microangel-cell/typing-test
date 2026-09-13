const typingInput = document.getElementById("typingInput");
const restartButton = document.getElementById("restartButton");

const timeDisplay = document.getElementById("time");
const wpmDisplay = document.getElementById("wpm");
const accuracyDisplay = document.getElementById("accuracy");
const textDisplay = document.getElementById("textDisplay");

const textToType = document.body.dataset.text;

let timeLeft = 60;
let timer = null;
let isRunning = false;
let startTime = null;
let backspacePresses = 0;
const timeoutBuzzer = document.getElementById("timeoutBuzzer")
    || new Audio("Wrong_Buzzer_-_Sound_Effect(360p).mp3");
timeoutBuzzer.preload = "auto";

function renderText() {
    textDisplay.replaceChildren();

    for (const character of textToType) {
        const characterSpan = document.createElement("span");
        characterSpan.textContent = character;
        textDisplay.appendChild(characterSpan);
    }

    updateTextHighlight("");
}

function updateTextHighlight(typedText) {
    const characterSpans = textDisplay.querySelectorAll("span");

    characterSpans.forEach((characterSpan, index) => {
        characterSpan.className = "";

        if (index < typedText.length) {
            characterSpan.classList.add(
                typedText[index] === textToType[index]
                    ? "typed-correct"
                    : "typed-wrong"
            );
        } else if (index === typedText.length) {
            characterSpan.classList.add("current-character");
        }
    });

    typingInput.classList.toggle(
        "input-warning",
        typedText.length > textToType.length
    );
}

renderText();

restartButton.addEventListener("click", restartTest);


/* =========================
   START TEST
========================= */

function startTest() {

    // Reset values
    timeLeft = 60;
    timeDisplay.textContent = timeLeft;
    wpmDisplay.textContent = 0;
    accuracyDisplay.textContent = 100;
    backspacePresses = 0;
    timeDisplay.parentElement.classList.remove("timer-expired");

    // Start the test
    isRunning = true;
    startTime = Date.now();

    typingInput.disabled = false;
    typingInput.focus();

    // Stop an existing timer
    clearInterval(timer);

    // Start timer
    timer = setInterval(updateTimer, 1000);
}


/* =========================
   TIMER
========================= */

function updateTimer() {

    timeLeft--;

    timeDisplay.textContent = timeLeft;

    if (timeLeft <= 0) {
        timeDisplay.parentElement.classList.add("timer-expired");
        timeoutBuzzer.currentTime = 0;
        timeoutBuzzer.play().catch(() => {});
        finishTest();
    }
}


/* =========================
   TYPING
========================= */

typingInput.addEventListener("input", checkTyping);

typingInput.addEventListener("keydown", function (event) {
    if (isRunning && event.key === "Backspace") {
        backspacePresses++;
    }
});

function checkTyping() {

    if (!isRunning) {
        if (typingInput.value.length === 0) {
            return;
        }

        startTest();
    }

    const typedText = typingInput.value;

    updateTextHighlight(typedText);

    let correctCharacters = 0;
    let wrongCharacters = 0;

    for (let i = 0; i < typedText.length; i++) {

        if (typedText[i] === textToType[i]) {
            correctCharacters++;
        } else {
            wrongCharacters++;
        }
    }

    const wrongPresses = wrongCharacters + backspacePresses;
    const accuracy = typedText.length === 0 && backspacePresses === 0
        ? 100
        : correctCharacters === 0
        ? 0
        : Math.max(
            0,
            ((correctCharacters - wrongPresses) / correctCharacters) * 100
        );

    accuracyDisplay.textContent = Math.round(accuracy);

    calculateWPM(correctCharacters);

    if (typedText === textToType) {
        finishTest();
    }
}


/* =========================
   WPM
========================= */

function calculateWPM(correctCharacters) {

    const elapsedTime = (Date.now() - startTime) / 1000;

    const elapsedMinutes = elapsedTime / 60;

    if (elapsedMinutes <= 0) {
        return;
    }

    const wpm = (correctCharacters / 5) / elapsedMinutes;

    wpmDisplay.textContent = Math.round(wpm);
}


/* =========================
   FINISH TEST
========================= */

function finishTest() {

    isRunning = false;

    clearInterval(timer);

    typingInput.disabled = true;

    console.log("Test finished!");
}

function restartTest() {

    clearInterval(timer);

    timeLeft = 60;
    isRunning = false;
    startTime = null;
    backspacePresses = 0;

    typingInput.value = "";
    typingInput.disabled = false;
    updateTextHighlight("");
    timeDisplay.textContent = timeLeft;
    wpmDisplay.textContent = 0;
    accuracyDisplay.textContent = 100;
    timeDisplay.parentElement.classList.remove("timer-expired");
    typingInput.focus();
}