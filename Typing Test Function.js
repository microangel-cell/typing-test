const typingInput = document.getElementById("typingInput");
const restartButton = document.getElementById("restartButton");

const timeDisplay = document.getElementById("time");
const wpmDisplay = document.getElementById("wpm");
const accuracyDisplay = document.getElementById("accuracy");
const textDisplay = document.getElementById("textDisplay");
const isFreeStyle = document.body.classList.contains("free-style-page");
const timerStatus = isFreeStyle
    ? timeDisplay.closest("p")
    : timeDisplay.parentElement;

let textToType = document.body.dataset.text;
const testDuration = Number(document.body.dataset.duration) || 60;

// WPM is hidden for the first moments of a test so one fast keystroke
// does not show an unrealistic spike.
const MIN_SECONDS_FOR_WPM = 2;

let timer = null;
let isRunning = false;
let startTime = null;
let previousValue = "";
let typedKeystrokes = 0;
let correctKeystrokes = 0;

const timeoutBuzzer = document.getElementById("timeoutBuzzer")
    || new Audio("Wrong_Buzzer_-_Sound_Effect(360p).mp3");
timeoutBuzzer.preload = "auto";

// Screen-reader announcement for the final result.
const resultAnnouncer = document.createElement("p");
resultAnnouncer.className = "sr-only";
resultAnnouncer.setAttribute("role", "status");
resultAnnouncer.setAttribute("aria-live", "polite");
document.body.appendChild(resultAnnouncer);

function renderText() {
    textDisplay.replaceChildren();
    typingInput.maxLength = textToType.length;

    if (isFreeStyle) {
        const words = textToType.split(" ");
        const promptStyle = window.getComputedStyle(textDisplay);
        const availableWidth = textDisplay.clientWidth
            - parseFloat(promptStyle.paddingLeft)
            - parseFloat(promptStyle.paddingRight);
        const measureCanvas = document.createElement("canvas");
        const measureContext = measureCanvas.getContext("2d");
        measureContext.font = promptStyle.font;
        const lineTexts = [];
        let wordsOnLine = [];
        let characterIndex = 0;

        words.forEach((word) => {
            const candidateLine = [...wordsOnLine, word].join(" ");

            if (wordsOnLine.length > 0 && measureContext.measureText(candidateLine).width > availableWidth) {
                lineTexts.push(`${wordsOnLine.join(" ")} `);
                wordsOnLine = [word];
            } else {
                wordsOnLine.push(word);
            }
        });

        if (wordsOnLine.length > 0) {
            lineTexts.push(wordsOnLine.join(" "));
        }

        lineTexts.forEach((lineText, lineIndex) => {
            if (lineIndex < lineTexts.length - 1 && !lineText.endsWith(" ")) {
                lineText += " ";
            }

            const line = document.createElement("div");
            line.className = "free-style-line";
            line.dataset.start = characterIndex;
            line.dataset.end = characterIndex + lineText.length;

            for (const character of lineText) {
                const characterSpan = document.createElement("span");
                characterSpan.textContent = character;
                line.appendChild(characterSpan);
            }

            textDisplay.appendChild(line);
            characterIndex += lineText.length;
        });

        updateTextHighlight(typingInput.value);
        return;
    }

    for (const character of textToType) {
        const characterSpan = document.createElement("span");
        characterSpan.textContent = character;
        textDisplay.appendChild(characterSpan);
    }

    updateTextHighlight(typingInput.value);
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

    if (isFreeStyle) {
        const lines = Array.from(textDisplay.querySelectorAll(".free-style-line"));
        const activeLineIndex = lines.findIndex((line) => {
            const lineStart = Number(line.dataset.start);
            const lineEnd = Number(line.dataset.end);
            return typedText.length >= lineStart && typedText.length < lineEnd;
        });
        const visibleLineIndex = activeLineIndex < 0 ? lines.length - 1 : activeLineIndex;
        const firstVisibleLine = Math.max(0, Math.min(visibleLineIndex - 1, lines.length - 3));

        lines.forEach((line, index) => {
            const isVisible = index >= firstVisibleLine && index < firstVisibleLine + 3;
            line.classList.toggle("is-active", index === visibleLineIndex);
            line.classList.toggle("is-blurred", isVisible && index !== visibleLineIndex);
            line.classList.toggle("is-hidden", !isVisible);
        });
    }

    keepCurrentCharacterVisible();
}

function keepCurrentCharacterVisible() {
    if (window.innerWidth > 700 || isFreeStyle) {
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
    if (startTime === null) {
        return 0;
    }

    return Math.min((Date.now() - startTime) / 1000, testDuration);
}

function countCorrectCharacters(typedText) {
    let correctCharacters = 0;

    for (let i = 0; i < typedText.length; i++) {
        if (typedText[i] === textToType[i]) {
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

function updateTimer() {
    const elapsedSeconds = getElapsedSeconds();
    const timeLeft = Math.max(0, Math.ceil(testDuration - elapsedSeconds));

    timeDisplay.textContent = timeLeft;
    updateStats();

    if (elapsedSeconds >= testDuration) {
        timerStatus.classList.add("timer-expired");
        timeoutBuzzer.currentTime = 0;
        timeoutBuzzer.play().catch(() => {});
        finishTest();
    }
}


/* =========================
   START / FINISH / RESTART
========================= */

function startTest() {
    isRunning = true;
    startTime = Date.now();
    timerStatus.classList.remove("timer-expired");
    resultAnnouncer.textContent = "";

    clearInterval(timer);
    // Ticks often and reads the real clock, so the countdown never drifts.
    timer = setInterval(updateTimer, 200);
}

function finishTest() {
    isRunning = false;
    clearInterval(timer);
    updateStats(true);
    typingInput.disabled = true;

    resultAnnouncer.textContent = `Test complete. ${wpmDisplay.textContent} words per minute, `
        + `${accuracyDisplay.textContent} percent accuracy.`;

    // Lets the PR panel (PR Function.js) save the result.
    document.dispatchEvent(new CustomEvent("keyflow:testcomplete", {
        detail: {
            correctChars: countCorrectCharacters(typingInput.value),
            seconds: getElapsedSeconds(),
            accuracy: getAccuracy(),
            wpm: Number(wpmDisplay.textContent),
        },
    }));

    if (isFreeStyle) {
        const stats = document.querySelector(".free-style-stats");
        stats?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
}

function restartTest() {
    if (isFreeStyle && typeof window.generateFreeStyleText === "function") {
        textToType = window.generateFreeStyleText();
    }

    clearInterval(timer);

    isRunning = false;
    startTime = null;
    previousValue = "";
    typedKeystrokes = 0;
    correctKeystrokes = 0;

    typingInput.value = "";
    typingInput.disabled = false;
    renderText();
    timeDisplay.textContent = testDuration;
    wpmDisplay.textContent = 0;
    accuracyDisplay.textContent = 100;
    resultAnnouncer.textContent = "";
    timerStatus.classList.remove("timer-expired");
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

    for (let i = firstChange; i < firstChange + addedCount; i++) {
        typedKeystrokes++;

        if (newValue[i] === textToType[i]) {
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

typingInput.addEventListener("input", checkTyping);
// Pasting or dropping text would skip the actual typing.
typingInput.addEventListener("paste", blockEvent);
typingInput.addEventListener("drop", blockEvent);
restartButton.addEventListener("click", restartTest);

renderText();
timeDisplay.textContent = testDuration;

if (isFreeStyle) {
    window.addEventListener("resize", renderText);
}
