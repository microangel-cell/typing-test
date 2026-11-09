const typingInput = document.getElementById("typingInput");
const restartButton = document.getElementById("restartButton");
const timeDisplay = document.getElementById("time");
const wpmDisplay = document.getElementById("wpm");
const accuracyDisplay = document.getElementById("accuracy");
const textDisplay = document.getElementById("textDisplay");
const textToType = document.body.dataset.text;

// WPM is hidden for the first moments of a test so one fast keystroke
// does not show an unrealistic spike.
const MIN_SECONDS_FOR_WPM = 2;

let timer = null;
let isRunning = false;
let startTime = null;
let previousValue = "";
let typedKeystrokes = 0;
let correctKeystrokes = 0;

// Screen-reader announcement for the final result.
const resultAnnouncer = document.createElement("p");
resultAnnouncer.className = "sr-only";
resultAnnouncer.setAttribute("role", "status");
resultAnnouncer.setAttribute("aria-live", "polite");
document.body.appendChild(resultAnnouncer);

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
    const remainingSeconds = (seconds % 60).toString().padStart(2, "0");
    return `${minutes}:${remainingSeconds}`;
}

function renderText() {
    textDisplay.replaceChildren();
    typingInput.maxLength = textToType.length;

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

    keepCurrentCharacterVisible();
}

function keepCurrentCharacterVisible() {
    if (window.innerWidth > 700) {
        return;
    }

    const currentCharacter = textDisplay.querySelector(".current-character");
    if (!currentCharacter) {
        return;
    }

    const displayBounds = textDisplay.getBoundingClientRect();
    const characterBounds = currentCharacter.getBoundingClientRect();
    const visibleTop = displayBounds.top + textDisplay.clientTop;
    const visibleCenter = visibleTop + textDisplay.clientHeight / 2;
    const characterCenter = characterBounds.top + characterBounds.height / 2;

    textDisplay.scrollTop += characterCenter - visibleCenter;
}


/* =========================
   TIMING AND STATISTICS
========================= */

function getElapsedSeconds() {
    return startTime === null ? 0 : (Date.now() - startTime) / 1000;
}

function countCorrectCharacters(typedText) {
    let correctCharacters = 0;

    for (let index = 0; index < typedText.length; index++) {
        if (typedText[index] === textToType[index]) {
            correctCharacters++;
        }
    }

    return correctCharacters;
}

// Accuracy = correct keystrokes / all character keystrokes.
// Mistakes stay counted even after they are fixed; backspace is not a mistake.
function getAccuracy() {
    return typedKeystrokes === 0
        ? 100
        : (correctKeystrokes / typedKeystrokes) * 100;
}

function getWPM(isFinal) {
    const elapsedSeconds = getElapsedSeconds();

    if (elapsedSeconds <= 0 || (!isFinal && elapsedSeconds < MIN_SECONDS_FOR_WPM)) {
        return 0;
    }

    return (countCorrectCharacters(typingInput.value) / 5) / (elapsedSeconds / 60);
}

function updateStats(isFinal = false) {
    accuracyDisplay.textContent = Math.round(getAccuracy());
    wpmDisplay.textContent = Math.round(getWPM(isFinal));
}

function updateElapsedTime() {
    timeDisplay.textContent = formatTime(Math.floor(getElapsedSeconds()));
    updateStats();
}


/* =========================
   START / FINISH / RESTART
========================= */

function startTest() {
    isRunning = true;
    startTime = Date.now();
    resultAnnouncer.textContent = "";
    clearInterval(timer);
    timer = setInterval(updateElapsedTime, 250);
}

function finishTest() {
    isRunning = false;
    clearInterval(timer);
    timeDisplay.textContent = formatTime(Math.floor(getElapsedSeconds()));
    updateStats(true);
    typingInput.disabled = true;

    resultAnnouncer.textContent = `Lesson complete in ${timeDisplay.textContent}. `
        + `${wpmDisplay.textContent} words per minute, ${accuracyDisplay.textContent} percent accuracy.`;

    // Lets the PR panel (PR Function.js) save the result.
    document.dispatchEvent(new CustomEvent("keyflow:testcomplete", {
        detail: {
            correctChars: countCorrectCharacters(typingInput.value),
            seconds: getElapsedSeconds(),
            accuracy: getAccuracy(),
            wpm: Number(wpmDisplay.textContent),
        },
    }));
}

function restartTest() {
    clearInterval(timer);
    isRunning = false;
    startTime = null;
    previousValue = "";
    typedKeystrokes = 0;
    correctKeystrokes = 0;
    typingInput.value = "";
    typingInput.disabled = false;
    updateTextHighlight("");
    timeDisplay.textContent = formatTime(0);
    wpmDisplay.textContent = 0;
    accuracyDisplay.textContent = 100;
    resultAnnouncer.textContent = "";
    typingInput.focus();
    document.dispatchEvent(new CustomEvent("keyflow:testreset"));
}


/* =========================
   TYPING
========================= */

function recordKeystrokes(newValue) {
    // Count only newly added characters; deletions are not keystrokes.
    if (newValue.length <= previousValue.length) {
        return;
    }

    let firstChange = 0;
    while (firstChange < previousValue.length && previousValue[firstChange] === newValue[firstChange]) {
        firstChange++;
    }

    const addedCount = newValue.length - previousValue.length;

    for (let index = firstChange; index < firstChange + addedCount; index++) {
        typedKeystrokes++;

        if (newValue[index] === textToType[index]) {
            correctKeystrokes++;
        }
    }
}

function checkTyping() {
    const typedText = typingInput.value;

    if (!isRunning) {
        if (typedText.length === 0) {
            return;
        }

        startTest();
    }

    recordKeystrokes(typedText);
    previousValue = typedText;

    updateTextHighlight(typedText);
    updateStats();

    if (typedText === textToType) {
        finishTest();
    }
}

function blockEvent(event) {
    event.preventDefault();
}

renderText();
timeDisplay.textContent = formatTime(0);
restartButton.addEventListener("click", restartTest);
typingInput.addEventListener("input", checkTyping);
// Pasting or dropping text would skip the actual typing.
typingInput.addEventListener("paste", blockEvent);
typingInput.addEventListener("drop", blockEvent);
