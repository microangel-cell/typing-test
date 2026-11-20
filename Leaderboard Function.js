// Leaderboard page: Free Style / Practice / Learn tabs, the "My stats" card and IGN restore.
(function () {
    const Player = window.KeyflowPlayer;
    const rows = document.getElementById("leaderboardRows");
    const head = document.getElementById("leaderboardHead");
    const caption = document.getElementById("boardCaption");
    const rules = document.getElementById("boardRules");
    const panel = document.getElementById("boardPanel");
    const picker = document.getElementById("boardPicker");
    const select = document.getElementById("boardSelect");
    const tabs = Array.from(document.querySelectorAll(".board-tabs [role=tab]"));
    const card = document.getElementById("my-stats");
    const BOARD_STORAGE_KEY = "keyflow-leaderboard";

    let currentBoard = "free-style";
    let leaderboardEntries = [];
    let leaderboardKind = "test";
    let requestNumber = 0;

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

    /* ---------- which board is showing ---------- */

    function categoryOfBoard(boardId) {
        if (boardId === "overall-practice") return "practice";
        if (boardId === "overall-learn") return "learn";
        return Player.categoryOf(boardId);
    }

    function isKnownBoard(boardId) {
        if (["free-style", "overall-practice", "overall-learn"].includes(boardId)) return true;
        const category = Player.categoryOf(boardId);
        return Boolean(category) && Player.testsInCategory(category).includes(boardId);
    }

    // "#practice" / "#learn" open that tab's Overall board; "#practice-7" opens one paragraph.
    function boardFromHash() {
        const hash = decodeURIComponent(window.location.hash.slice(1));
        if (hash === "practice") return "overall-practice";
        if (hash === "learn") return "overall-learn";
        return isKnownBoard(hash) ? hash : null;
    }

    function rememberedBoard() {
        try {
            const saved = localStorage.getItem(BOARD_STORAGE_KEY);
            return isKnownBoard(saved) ? saved : null;
        } catch {
            return null;
        }
    }

    // Where a "go and type it" link should point for each board.
    function pageForBoard(boardId) {
        if (boardId === "free-style") return ["Free Style.html", "Take the Free Style test →"];
        if (boardId === "overall-practice") return ["Practice.html", "Start practising →"];
        if (boardId === "overall-learn") return ["Learn While Typing.html", "Start a lesson →"];
        const practice = /^practice-(\d+)$/.exec(boardId);
        if (practice) return [`Typing Test Practicepage${practice[1]}.html`, "Type this paragraph →"];
        return [`${boardId}.html`, "Type this lesson →"];
    }

    function boardTitle(boardId) {
        if (boardId === "overall-practice") return "Practice overall";
        if (boardId === "overall-learn") return "Learn overall";
        return Player.testLabel(boardId);
    }

    function renderRules(boardId) {
        const [href, linkText] = pageForBoard(boardId);
        let text;

        if (boardId === "free-style") {
            text = "Each player's best 60-second Free Style result.";
        } else if (boardId.startsWith("overall-")) {
            const isPractice = boardId === "overall-practice";
            text = `The average of each player's best WPM across the ${isPractice ? "paragraphs" : "lessons"} they've completed `
                + `with ${Player.MIN_ACCURACY}%+ accuracy. At least ${Player.OVERALL_MIN_COMPLETED} needed to appear.`;
        } else {
            text = `Each player's best result on ${boardTitle(boardId)}.`;
        }

        rules.replaceChildren(text, " ", el("a", { href }, linkText));
        caption.textContent = `Top 50: ${boardTitle(boardId)}`;
    }

    function fillPicker(category) {
        const overallId = `overall-${category}`;
        const groupLabel = category === "practice" ? "Paragraphs" : "Lessons";
        const group = el("optgroup", { label: groupLabel },
            Player.testsInCategory(category).map((testId) => el("option", { value: testId }, Player.testLabel(testId))));

        select.replaceChildren(
            el("option", { value: overallId }, category === "practice" ? "Overall (all paragraphs)" : "Overall (all lessons)"),
            group,
        );
    }

    function showBoard(boardId, { focusTab = false } = {}) {
        currentBoard = boardId;
        const category = categoryOfBoard(boardId);

        tabs.forEach((tab) => {
            const selected = tab.dataset.category === category;
            tab.setAttribute("aria-selected", String(selected));
            tab.tabIndex = selected ? 0 : -1;
            if (selected) {
                panel.setAttribute("aria-labelledby", tab.id);
                if (focusTab) tab.focus();
            }
        });

        if (category === "free-style") {
            picker.hidden = true;
        } else {
            picker.hidden = false;
            if (select.dataset.category !== category) {
                fillPicker(category);
                select.dataset.category = category;
            }
            select.value = boardId;
        }

        try {
            localStorage.setItem(BOARD_STORAGE_KEY, boardId);
        } catch {
            // Not remembered; that's fine.
        }

        const hash = boardId === "overall-practice" ? "practice" : boardId === "overall-learn" ? "learn" : boardId;
        history.replaceState(null, "", `#${hash}`);

        renderRules(boardId);
        loadLeaderboard();
    }

    tabs.forEach((tab, index) => {
        tab.addEventListener("click", () => {
            const category = tab.dataset.category;
            showBoard(category === "free-style" ? "free-style" : `overall-${category}`);
        });

        // Arrow keys move between tabs (standard tab-list keyboard pattern).
        tab.addEventListener("keydown", (event) => {
            const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
            if (!step) return;
            event.preventDefault();
            const next = tabs[(index + step + tabs.length) % tabs.length];
            const category = next.dataset.category;
            showBoard(category === "free-style" ? "free-style" : `overall-${category}`, { focusTab: true });
        });
    });

    select.addEventListener("change", () => showBoard(select.value));

    window.addEventListener("hashchange", () => {
        const fromHash = boardFromHash();
        if (fromHash && fromHash !== currentBoard) showBoard(fromHash);
    });

    /* ---------- leaderboard table ---------- */

    function renderHead() {
        const columns = leaderboardKind === "overall"
            ? ["#", "Player", "Avg WPM", "Accuracy", "Completed"]
            : ["#", "Player", "WPM", "Accuracy", "Date"];
        head.replaceChildren(el("tr", {}, columns.map((column) => el("th", { scope: "col" }, column))));
    }

    function statusRow(...message) {
        rows.replaceChildren(el("tr", {}, el("td", { colspan: "5", class: "leaderboard-status" }, ...message)));
    }

    function emptyMessage() {
        if (currentBoard === "free-style") {
            return `No scores yet. Be the first! Finish a Free Style test with ${Player.MIN_ACCURACY}% accuracy or more.`;
        }
        if (currentBoard.startsWith("overall-")) {
            const unit = currentBoard === "overall-practice" ? "paragraphs" : "lessons";
            return `No one is on this board yet. Complete ${Player.OVERALL_MIN_COMPLETED} ${unit} with ${Player.MIN_ACCURACY}%+ accuracy to be first.`;
        }
        return `No scores on ${boardTitle(currentBoard)} yet. Be the first!`;
    }

    function renderTable() {
        const me = Player.getPlayer();
        renderHead();

        if (leaderboardEntries.length === 0) {
            statusRow(emptyMessage());
            return;
        }

        rows.replaceChildren(...leaderboardEntries.map((entry, index) => {
            const isMe = me && me.ign === entry.ign && me.tag === entry.tag;
            const player = el("td", {},
                el("span", { class: "lb-ign" }, entry.ign),
                el("span", { class: "lb-tag" }, `#${entry.tag}`),
                isMe ? el("span", { class: "lb-you" }, "you") : null);

            const cells = leaderboardKind === "overall"
                ? [
                    el("td", { class: "lb-wpm" }, Math.round(entry.avgWpm)),
                    el("td", {}, `${entry.avgAccuracy}%`),
                    el("td", {}, el("span", { class: "lb-completed" }, `${entry.completed}/${entry.total}`)),
                ]
                : [
                    el("td", { class: "lb-wpm" }, entry.wpm),
                    el("td", {}, `${entry.accuracy}%`),
                    el("td", {}, Player.formatDate(entry.date)),
                ];

            return el("tr", { class: isMe ? "is-me" : null }, el("td", {}, index + 1), player, cells);
        }));
    }

    async function loadLeaderboard() {
        const thisRequest = ++requestNumber;
        const boardId = currentBoard;
        leaderboardKind = boardId.startsWith("overall-") ? "overall" : "test";
        renderHead();
        statusRow("Loading the leaderboard…");

        try {
            const data = await Player.fetchLeaderboard(boardId);
            if (thisRequest !== requestNumber) return; // A newer board was picked meanwhile.
            leaderboardEntries = data.entries;
            leaderboardKind = data.kind;
            renderTable();
        } catch (error) {
            if (thisRequest !== requestNumber) return;
            statusRow(
                `Couldn't load the leaderboard. ${error.message} `,
                el("button", { type: "button", class: "kf-button secondary", onclick: loadLeaderboard }, "Try again"),
            );
        }
    }

    /* ---------- my stats card ---------- */

    function setCard(...children) {
        // Skip empty values; replaceChildren would print them as "null"/"false".
        card.replaceChildren(...children.filter((child) => child != null && child !== false));
    }

    function sparkline(history) {
        // Oldest on the left, newest on the right.
        const values = history.map((entry) => entry.wpm).reverse();
        const svgNS = "http://www.w3.org/2000/svg";
        // Stretches to the card's full width; strokes keep their thickness.
        const width = 100;
        const height = 48;
        const svg = document.createElementNS(svgNS, "svg");
        svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
        svg.setAttribute("preserveAspectRatio", "none");
        svg.setAttribute("class", "sparkline");
        svg.setAttribute("role", "img");
        svg.setAttribute("aria-label", `WPM over your last ${values.length} tests, oldest first: ${values.join(", ")}`);

        if (values.length < 2) {
            return svg;
        }

        const max = Math.max(...values);
        const min = Math.min(...values);
        const range = max - min || 1;
        const points = values.map((value, index) => {
            const x = (index / (values.length - 1)) * (width - 2) + 1;
            const y = height - 4 - ((value - min) / range) * (height - 8);
            return [x, y];
        });

        const line = document.createElementNS(svgNS, "polyline");
        line.setAttribute("points", points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" "));
        svg.appendChild(line);

        // Dot on the latest result: a zero-length line with round caps stays
        // circular even though the chart is stretched (a <circle> would not).
        const [lastX, lastY] = points[points.length - 1];
        const dot = document.createElementNS(svgNS, "polyline");
        dot.setAttribute("class", "sparkline-dot");
        dot.setAttribute("points", `${lastX.toFixed(1)},${lastY.toFixed(1)} ${lastX.toFixed(1)},${lastY.toFixed(1)}`);
        svg.appendChild(dot);

        return svg;
    }

    function stat(label, value, note) {
        return el("div", { class: "my-stat" },
            el("span", { class: "my-stat-label" }, label),
            el("strong", {}, value),
            note ? el("span", { class: "my-stat-note" }, note) : null);
    }

    function overallStat(label, overall) {
        if (!overall || overall.completed === 0) {
            return stat(label, "—", "none completed yet");
        }
        const note = overall.completed < Player.OVERALL_MIN_COMPLETED
            ? `${overall.completed}/${overall.total} · ${Player.OVERALL_MIN_COMPLETED - overall.completed} more to rank`
            : `${overall.completed}/${overall.total} completed`;
        return stat(label, `${Math.round(overall.avgWpm)} WPM`, note);
    }

    function renderStats(saved, player) {
        const summary = Player.summarise(player.history);
        const freeStylePR = player.prs["free-style"];
        const fullPlayer = { ...saved, ...player, key: saved.key };
        const signOutArea = el("div", { class: "sign-out-area" });

        function showSignOutButton() {
            signOutArea.classList.remove("is-confirming");
            signOutArea.replaceChildren(el("button", {
                type: "button",
                class: "kf-link-button",
                onclick: showSignOutConfirm,
            }, "Use a different IGN on this device"));
        }

        function showSignOutConfirm() {
            signOutArea.classList.add("is-confirming");
            signOutArea.replaceChildren(
                el("p", { class: "kf-help" }, "Download your key first, or you won't be able to get this IGN back. Remove it from this browser?"),
                el("div", { class: "kf-row" },
                    el("button", { type: "button", class: "kf-button danger", onclick: () => {
                        Player.forgetPlayer();
                        renderRestore();
                        renderTable();
                    } }, "Remove"),
                    el("button", { type: "button", class: "kf-button secondary", onclick: showSignOutButton }, "Cancel"),
                ),
            );
        }

        showSignOutButton();

        const trendText = summary && summary.trend !== null
            ? `${summary.trend > 0 ? "▲ +" : summary.trend < 0 ? "▼ " : ""}${summary.trend} WPM`
            : "—";

        setCard(
            el("div", { class: "my-stats-head" },
                el("h2", {}, el("span", { class: "lb-ign" }, player.ign), el("span", { class: "lb-tag" }, `#${player.tag}`)),
                el("span", { class: "kf-help" }, summary ? `${summary.count} recent tests` : "No tests yet"),
            ),
            el("div", { class: "my-stats-grid" },
                stat("Free Style PR", freeStylePR ? `${freeStylePR.wpm} WPM` : "—", freeStylePR ? `${freeStylePR.accuracy}% accuracy` : "no result yet"),
                overallStat("Practice avg", player.overall && player.overall.practice),
                overallStat("Learn avg", player.overall && player.overall.learn),
                stat("Trend", trendText, summary && summary.trend !== null ? "newer vs older half" : "needs 4+ tests"),
            ),
            summary && summary.count >= 2
                ? el("p", { class: "sparkline-caption" },
                    `Last ${summary.count} tests · avg ${summary.averageWpm} WPM · ${summary.averageAccuracy}% accuracy`)
                : null,
            summary && summary.count >= 2 ? sparkline(player.history) : null,
            !saved.keySaved
                ? el("p", { class: "kf-error" }, "You haven't confirmed saving your key yet. Download it now so you don't lose this IGN.")
                : null,
            // Same 4-column grid as the stat boxes, so the buttons line up with them.
            el("div", { class: "my-stats-actions" },
                el("button", { type: "button", class: "kf-button", onclick: () => Player.downloadStatsFile(fullPlayer) }, "Download my stats"),
                el("button", { type: "button", class: "kf-button secondary", onclick: () => {
                    Player.downloadKeyFile(fullPlayer);
                    Player.updatePlayer({ keySaved: true });
                } }, "Download key again"),
            ),
            el("div", { class: "my-stats-footer" },
                el("p", { class: "kf-help" }, "Your stats file is safe to share. Your key file is private; anyone with it can post scores as you."),
                signOutArea,
            ),
        );
    }

    function renderRestore(errorMessage = "") {
        const input = el("input", {
            type: "text",
            id: "restoreKey",
            class: "kf-input",
            placeholder: "KF-XXXX-XXXX-XXXX-XXXX-XXXX",
            spellcheck: "false",
            autocapitalize: "characters",
            autocomplete: "off",
        });
        const fileInput = el("input", { type: "file", id: "restoreFile", accept: ".txt,text/plain", class: "sr-only" });
        const error = el("p", { class: "kf-error", role: "alert" }, errorMessage);
        error.hidden = !errorMessage;

        async function tryRestore(text, button) {
            error.hidden = true;
            if (button) {
                button.disabled = true;
                button.textContent = "Restoring…";
            }
            try {
                await Player.restore(text);
                await loadStats();
                renderTable();
            } catch (restoreError) {
                renderRestore(restoreError.message);
            }
        }

        fileInput.addEventListener("change", async () => {
            const file = fileInput.files[0];
            if (!file) return;
            if (file.size > 20000) {
                renderRestore("That file is too big to be a Keyflow key file.");
                return;
            }
            tryRestore(await file.text());
        });

        const form = el("form", {
            class: "restore-form",
            novalidate: true,
            onsubmit: (event) => {
                event.preventDefault();
                tryRestore(input.value, form.querySelector("button[type=submit]"));
            },
        },
            el("label", { for: "restoreKey", class: "kf-label" }, "Paste your secret key"),
            el("div", { class: "kf-row" },
                input,
                el("button", { type: "submit", class: "kf-button" }, "Restore"),
            ),
            el("div", { class: "kf-row" },
                el("span", { class: "kf-help" }, "or"),
                fileInput,
                el("label", { for: "restoreFile", class: "kf-button secondary file-button" }, "Upload key file (.txt)"),
            ),
            error,
        );

        card.replaceChildren(
            el("h2", { id: "restore" }, "Restore my IGN"),
            el("p", { class: "kf-help" },
                "Got a key from another device? Restore it to see your stats here. New here? ",
                el("a", { href: "Free Style.html" }, "Finish a Free Style test"),
                " to create your IGN."),
            form,
        );
    }

    async function loadStats() {
        const saved = Player.getPlayer();

        if (!saved) {
            renderRestore();
            return;
        }

        card.replaceChildren(el("p", { class: "kf-help" }, "Loading your stats…"));

        try {
            const player = await Player.fetchMe();
            Player.updatePlayer({ prs: player.prs });
            renderStats(Player.getPlayer(), player);
        } catch (error) {
            card.replaceChildren(
                el("p", { class: "kf-error" }, `Couldn't load your stats. ${error.message}`),
                el("button", { type: "button", class: "kf-button secondary", onclick: loadStats }, "Try again"),
            );
        }
    }

    // "#restore" and "#my-stats" scroll to the card; any other hash may name a board.
    const scrollToCard = ["#restore", "#my-stats"].includes(window.location.hash);

    loadStats().then(() => {
        if (scrollToCard) {
            card.scrollIntoView({ block: "start" });
        }
    });
    showBoard(boardFromHash() || rememberedBoard() || "free-style");
})();
