// "Save your PR" panel shown under the statistics on every test page.
// Needs Player Function.js, and the typing script's keyflow:testcomplete events.
(function () {
    const Player = window.KeyflowPlayer;
    const testId = document.body.dataset.testId;
    const main = document.querySelector("main");

    if (!Player || !testId || !main) {
        return;
    }

    const testName = Player.testLabel(testId);
    let state = "idle"; // idle | form | saving | key | result | error
    let pendingResult = null;
    let lastResponse = null;

    /* ---------- tiny DOM builder (text is never parsed as HTML) ---------- */

    function el(tag, attributes = {}, ...children) {
        const element = document.createElement(tag);

        Object.entries(attributes).forEach(([name, value]) => {
            if (name === "class") element.className = value;
            else if (name.startsWith("on")) element.addEventListener(name.slice(2), value);
            else if (value === true) element.setAttribute(name, "");
            else if (value !== false && value != null) element.setAttribute(name, value);
        });

        children.flat().forEach((child) => {
            if (child != null && child !== false) {
                element.append(child instanceof Node ? child : document.createTextNode(String(child)));
            }
        });

        return element;
    }

    /* ---------- panel shell ---------- */

    const hint = el("div", { class: "pr-hint" });
    const body = el("div", { class: "pr-body", hidden: true });
    const panel = el("aside", { class: "pr-panel", "aria-label": "Personal best" }, hint, body);
    main.appendChild(panel);

    function renderHint() {
        const player = Player.getPlayer();
        const pr = player && player.prs ? player.prs[testId] : null;

        hint.replaceChildren();
        hint.hidden = !player;

        if (!player) {
            return;
        }

        hint.append(
            el("span", { class: "pr-hint-name" }, Player.displayName(player)),
            pr
                ? el("span", {}, "PR here: ", el("strong", {}, `${pr.wpm} WPM`), ` · ${pr.accuracy}%`)
                : el("span", {}, "No PR on this test yet"),
        );
    }

    function show(...children) {
        // Skip empty values; replaceChildren would print them as "null"/"false".
        body.replaceChildren(...children.filter((child) => child != null && child !== false));
        body.hidden = false;
    }

    function hideBody() {
        body.replaceChildren();
        body.hidden = true;
    }

    /* ---------- states ---------- */

    function renderForm(errorMessage = "") {
        state = "form";
        const input = el("input", {
            type: "text",
            id: "prIgn",
            class: "kf-input",
            maxlength: "16",
            autocomplete: "nickname",
            spellcheck: "false",
            autocapitalize: "off",
            placeholder: "Your IGN",
            "aria-describedby": "prIgnHelp",
        });
        const error = el("p", { class: "kf-error", role: "alert" }, errorMessage);
        error.hidden = !errorMessage;

        const form = el("form", {
            class: "pr-form",
            novalidate: true,
            onsubmit: (event) => {
                event.preventDefault();
                createIgn(input.value.trim(), error, form);
            },
        },
            el("label", { for: "prIgn", class: "kf-label" }, "Choose an IGN"),
            el("div", { class: "kf-row" },
                input,
                el("button", { type: "submit", class: "kf-button" }, "Save"),
            ),
            el("p", { id: "prIgnHelp", class: "kf-help" },
                "3–16 letters, numbers or _. Others can use the same name; your #tag tells you apart."),
            error,
        );

        show(
            el("h2", { class: "pr-title" }, "Save your PR"),
            el("p", { class: "pr-summary" }, `This run: ${pendingResult.wpm} WPM · ${Math.round(pendingResult.accuracy)}% on ${testName}.`),
            form,
            el("p", { class: "kf-help" },
                "Already have a key? ",
                el("a", { href: "leaderboard.html#restore" }, "Restore my IGN"),
            ),
        );

        input.focus();
    }

    async function createIgn(ign, errorElement, form) {
        if (!/^[A-Za-z0-9_]{3,16}$/.test(ign)) {
            errorElement.textContent = "Your IGN must be 3–16 letters, numbers or underscores.";
            errorElement.hidden = false;
            return;
        }

        const button = form.querySelector("button");
        button.disabled = true;
        button.textContent = "Saving…";

        try {
            await Player.register(ign);
        } catch (error) {
            renderForm(error.message);
            return;
        }

        // Save the score straight away so it isn't lost, then show the key step.
        await saveScore({ showKeyStepFirst: true });
    }

    function renderKeyStep() {
        state = "key";
        const player = Player.getPlayer();
        const continueButton = el("button", {
            type: "button",
            class: "kf-button",
            disabled: true,
            onclick: () => {
                Player.updatePlayer({ keySaved: true });
                renderHint();
                if (lastResponse) renderResult(lastResponse);
                else renderError(pendingErrorMessage);
            },
        }, "Continue");

        const checkbox = el("input", {
            type: "checkbox",
            id: "prKeySaved",
            onchange: (event) => { continueButton.disabled = !event.target.checked; },
        });

        const keyCode = el("code", { class: "key-box" }, player.key);
        const copyStatus = el("span", { class: "kf-help", role: "status" });

        show(
            el("h2", { class: "pr-title" }, "✓ You're ", el("strong", {}, Player.displayName(player))),
            el("p", { class: "pr-summary" },
                "This is your secret key. It's the only way to get this IGN back on another device or browser. We can't recover it for you."),
            el("div", { class: "kf-row key-row" },
                keyCode,
                el("button", {
                    type: "button",
                    class: "kf-button secondary",
                    onclick: () => copyText(player.key, copyStatus),
                }, "Copy"),
                copyStatus,
            ),
            el("div", { class: "kf-row" },
                el("button", {
                    type: "button",
                    class: "kf-button secondary",
                    onclick: () => Player.downloadKeyFile(player),
                }, "Download key (.txt)"),
            ),
            el("label", { class: "kf-check", for: "prKeySaved" },
                checkbox,
                " I've saved my key. Without it, I can't recover this IGN on another device."),
            el("div", { class: "kf-row" }, continueButton),
        );
    }

    let pendingErrorMessage = "";

    async function saveScore({ showKeyStepFirst = false } = {}) {
        state = "saving";
        lastResponse = null;
        pendingErrorMessage = "";
        show(el("p", { class: "pr-summary", role: "status" }, "Saving your result…"));

        try {
            lastResponse = await Player.submitScore(testId, pendingResult);
        } catch (error) {
            pendingErrorMessage = error.message;
        }

        const player = Player.getPlayer();

        if (showKeyStepFirst || (player && !player.keySaved)) {
            renderKeyStep();
        } else if (lastResponse) {
            renderResult(lastResponse);
        } else {
            renderError(pendingErrorMessage);
        }

        renderHint();
    }

    function renderResult(response) {
        state = "result";
        const player = Player.getPlayer();
        const { score, isNewPR, previousPR, leaderboard } = response;
        const pr = response.player.prs[testId];

        const headline = isNewPR
            ? el("p", { class: "pr-headline is-new", role: "status" },
                "★ New PR on ", testName, "! ",
                el("strong", {}, `${score.wpm} WPM`), ` · ${score.accuracy}%`,
                previousPR ? ` (was ${previousPR.wpm})` : "")
            : el("p", { class: "pr-headline", role: "status" },
                `This run: ${score.wpm} WPM · ${score.accuracy}%. Your PR is still `,
                el("strong", {}, `${pr.wpm} WPM`), ". Keep going!");

        let boardLine = null;
        if (testId === "free-style") {
            if (!leaderboard.qualified) {
                boardLine = "Reach 85% accuracy to appear on the leaderboard.";
            } else if (leaderboard.rank) {
                boardLine = `Your leaderboard rank: #${leaderboard.rank}`;
            } else {
                boardLine = "Not in the top 100 yet. Keep practising!";
            }
        }

        show(
            headline,
            boardLine && el("p", { class: "pr-summary" }, boardLine),
            el("p", { class: "pr-links" },
                el("span", {}, "Saved as ", el("strong", {}, Player.displayName(player))),
                el("a", { href: "leaderboard.html" }, "View leaderboard →"),
                el("a", { href: "leaderboard.html#my-stats" }, "My stats →"),
            ),
        );
    }

    function renderError(message) {
        state = "error";
        show(
            el("p", { class: "kf-error", role: "alert" }, `Your result wasn't saved. ${message}`),
            el("div", { class: "kf-row" },
                el("button", { type: "button", class: "kf-button", onclick: () => saveScore() }, "Try again"),
            ),
        );
    }

    function copyText(text, statusElement) {
        const done = () => { statusElement.textContent = "Copied!"; };

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(done, () => {
                statusElement.textContent = "Select the key and copy it manually.";
            });
        } else {
            statusElement.textContent = "Select the key and copy it manually.";
        }
    }

    /* ---------- events from the typing script ---------- */

    document.addEventListener("keyflow:testcomplete", (event) => {
        // Don't interrupt someone who is still saving their new key.
        if (state === "key" || state === "saving") {
            return;
        }

        pendingResult = event.detail;

        if (pendingResult.correctChars < 1 || pendingResult.seconds < 3) {
            state = "result";
            show(el("p", { class: "pr-summary" }, "Type a little more to save a result."));
            return;
        }

        if (Player.getPlayer()) {
            saveScore();
        } else {
            renderForm();
        }
    });

    document.addEventListener("keyflow:testreset", () => {
        // Keep the key step (and an in-progress save) visible until it's finished.
        if (state !== "key" && state !== "saving") {
            state = "idle";
            hideBody();
        }
        renderHint();
    });

    renderHint();
})();
