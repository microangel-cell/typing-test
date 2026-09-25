const typingInput = document.getElementById("typingInput");
const restartButton = document.getElementById("restartButton");

const timeDisplay = document.getElementById("time");
const wpmDisplay = document.getElementById("wpm");
const accuracyDisplay = document.getElementById("accuracy");
const textDisplay = document.getElementById("textDisplay");
const timerStatus = document.body.classList.contains("free-style-page")
    ? timeDisplay.closest("p")
    : timeDisplay.parentElement;

let textToType = document.body.dataset.text;
const testDuration = Number(document.body.dataset.duration) || 60;

let timeLeft = testDuration;
let timer = null;
let isRunning = false;
let startTime = null;
let backspacePresses = 0;
const timeoutBuzzer = document.getElementById("timeoutBuzzer")
    || new Audio("Wrong_Buzzer_-_Sound_Effect(360p).mp3");
timeoutBuzzer.preload = "auto";

function renderText() {
    textDisplay.replaceChildren();

    if (document.body.classList.contains("free-style-page")) {
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

        updateTextHighlight("");
        return;
    }

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

    if (document.body.classList.contains("free-style-page")) {
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

    typingInput.classList.toggle(
        "input-warning",
        typedText.length > textToType.length
    );
}

renderText();

if (document.body.classList.contains("free-style-page")) {
    window.addEventListener("resize", function () {
        const typedText = typingInput.value;
        renderText();
        updateTextHighlight(typedText);
    });
}

restartButton.addEventListener("click", restartTest);


/* =========================
   START TEST
========================= */

function startTest() {

    // Reset values
    timeLeft = testDuration;
    timeDisplay.textContent = timeLeft;
    wpmDisplay.textContent = 0;
    accuracyDisplay.textContent = 100;
    backspacePresses = 0;
    timerStatus.classList.remove("timer-expired");

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
        timerStatus.classList.add("timer-expired");
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

    if (
        document.body.classList.contains("free-style-page")
        && typeof window.generateFreeStyleText === "function"
    ) {
        textToType = window.generateFreeStyleText();
    }

    clearInterval(timer);

    timeLeft = testDuration;
    isRunning = false;
    startTime = null;
    backspacePresses = 0;

    typingInput.value = "";
    typingInput.disabled = false;
    renderText();
    timeDisplay.textContent = timeLeft;
    wpmDisplay.textContent = 0;
    accuracyDisplay.textContent = 100;
    timerStatus.classList.remove("timer-expired");
    typingInput.focus();
}
