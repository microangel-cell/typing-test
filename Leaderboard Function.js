// Leaderboard page: top 50 Free Style table, the "My stats" card and IGN restore.
(function () {
    const Player = window.KeyflowPlayer;
    const rows = document.getElementById("leaderboardRows");
    const card = document.getElementById("my-stats");
    let leaderboardEntries = [];

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

    /* ---------- leaderboard table ---------- */

    function statusRow(message) {
        rows.replaceChildren(el("tr", {}, el("td", { colspan: "5", class: "leaderboard-status" }, message)));
    }

    function renderTable() {
        const me = Player.getPlayer();

        if (leaderboardEntries.length === 0) {
            statusRow("No scores yet. Be the first! Finish a Free Style test with 85% accuracy or more.");
            return;
        }

        rows.replaceChildren(...leaderboardEntries.map((entry, index) => {
            const isMe = me && me.ign === entry.ign && me.tag === entry.tag;
            return el("tr", { class: isMe ? "is-me" : null },
                el("td", {}, index + 1),
                el("td", {},
                    el("span", { class: "lb-ign" }, entry.ign),
                    el("span", { class: "lb-tag" }, `#${entry.tag}`),
                    isMe ? el("span", { class: "lb-you" }, "you") : null),
                el("td", { class: "lb-wpm" }, entry.wpm),
                el("td", {}, `${entry.accuracy}%`),
                el("td", {}, Player.formatDate(entry.date)),
            );
        }));
    }

    async function loadLeaderboard() {
        try {
            const data = await Player.fetchLeaderboard();
            leaderboardEntries = data.entries;
            renderTable();
        } catch (error) {
            rows.replaceChildren(el("tr", {}, el("td", { colspan: "5", class: "leaderboard-status" },
                `Couldn't load the leaderboard. ${error.message} `,
                el("button", { type: "button", class: "kf-button secondary", onclick: loadLeaderboard }, "Try again"))));
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

    function stat(label, value) {
        return el("div", { class: "my-stat" }, el("span", { class: "my-stat-label" }, label), el("strong", {}, value));
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
                el("span", { class: "kf-help" }, summary ? `Last ${summary.count} tests` : "No tests yet"),
            ),
            el("div", { class: "my-stats-grid" },
                stat("Free Style PR", freeStylePR ? `${freeStylePR.wpm} WPM` : "—"),
                stat("Average WPM", summary ? summary.averageWpm : "—"),
                stat("Average accuracy", summary ? `${summary.averageAccuracy}%` : "—"),
                stat("Trend", trendText),
            ),
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

    loadStats().then(() => {
        if (window.location.hash === "#restore" || window.location.hash === "#my-stats") {
            card.scrollIntoView({ block: "start" });
        }
    });
    loadLeaderboard();
})();
