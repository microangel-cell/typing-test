const typingInput = document.getElementById("typingInput");
const restartButton = document.getElementById("restartButton");
const timeDisplay = document.getElementById("time");
const wpmDisplay = document.getElementById("wpm");
const accuracyDisplay = document.getElementById("accuracy");
const textDisplay = document.getElementById("textDisplay");
const textToType = document.body.dataset.text;

let elapsedSeconds = 0;
let timer = null;
let isRunning = false;
let startTime = null;
let backspacePresses = 0;

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
    const remainingSeconds = (seconds % 60).toString().padStart(2, "0");
    return `${minutes}:${remainingSeconds}`;
}

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

function updateElapsedTime() {
    elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
    timeDisplay.textContent = formatTime(elapsedSeconds);
}

function startTest() {
    isRunning = true;
    startTime = Date.now();
    typingInput.disabled = false;
    typingInput.focus();
    clearInterval(timer);
    timer = setInterval(updateElapsedTime, 250);
}

function calculateWPM(correctCharacters) {
    const elapsedMinutes = (Date.now() - startTime) / 60000;

    if (elapsedMinutes <= 0) {
        return;
    }

    wpmDisplay.textContent = Math.round((correctCharacters / 5) / elapsedMinutes);
}

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

    for (let index = 0; index < typedText.length; index++) {
        if (typedText[index] === textToType[index]) {
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

function finishTest() {
    updateElapsedTime();
    isRunning = false;
    clearInterval(timer);
    typingInput.disabled = true;
}

function restartTest() {
    clearInterval(timer);
    elapsedSeconds = 0;
    isRunning = false;
    startTime = null;
    backspacePresses = 0;
    typingInput.value = "";
    typingInput.disabled = false;
    updateTextHighlight("");
    timeDisplay.textContent = formatTime(0);
    wpmDisplay.textContent = 0;
    accuracyDisplay.textContent = 100;
    typingInput.focus();
}

renderText();
timeDisplay.textContent = formatTime(0);
restartButton.addEventListener("click", restartTest);
typingInput.addEventListener("input", checkTyping);
typingInput.addEventListener("keydown", function (event) {
    if (isRunning && event.key === "Backspace") {
        backspacePresses++;
    }
});