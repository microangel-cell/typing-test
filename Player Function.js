// Shared player helpers: the saved IGN + secret key, API calls, file downloads
// and stats summaries. Used by PR Function.js and Leaderboard Function.js.
window.KeyflowPlayer = (function () {
    const STORAGE_KEY = "keyflow-player";
    const KEY_PATTERN = /KF(?:-[0-9A-Z]{4}){5}/;

    const PARAGRAPH_NAMES = [
        "Classic Warm-up", "Focus and Flow", "Code Rhythm", "Steady Progress", "Clear Thinking",
        "Calm Momentum", "Sharp Accuracy", "Morning Routine", "Quiet Focus", "Digital Craft",
        "Patient Practice", "Fresh Start", "Forward Motion", "Thoughtful Pace", "Final Sprint",
        "Focused Energy", "Measured Rhythm", "Bright Ideas", "Strong Foundations", "Complete the Set",
    ];
    const SMALL_WORDS = ["and", "the", "of"];
    const LESSON_SLUGS = [
        "algorithms", "ancient-civilisations", "cause-and-effect", "character", "chronology",
        "colour", "communication", "digital-citizenship", "evidence", "forces", "fractions",
        "geometry", "healthy-habits", "landforms", "maps", "patterns", "percentages",
        "plant-life", "poetry", "rhythm", "setting", "the-solar-system", "the-water-cycle",
        "theme", "vocabulary", "wellbeing",
    ];
    const OVERALL_MIN_COMPLETED = 5;
    const MIN_ACCURACY = 85;

    /* ---------- saved player (this browser only) ---------- */

    function getPlayer() {
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
            return saved && saved.key && saved.ign ? saved : null;
        } catch {
            return null;
        }
    }

    function savePlayer(player) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(player));
        } catch {
            // Storage blocked: the player still works for this page view.
        }
    }

    function updatePlayer(changes) {
        const player = getPlayer();
        if (player) savePlayer({ ...player, ...changes });
    }

    function forgetPlayer() {
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch {
            // Nothing to remove.
        }
    }

    /* ---------- API ---------- */

    async function request(method, path, body) {
        let response;

        try {
            response = await fetch(path, {
                method,
                headers: body ? { "content-type": "application/json" } : undefined,
                body: body ? JSON.stringify(body) : undefined,
            });
        } catch {
            throw new Error("Couldn't reach the Keyflow server. Check your connection and try again.");
        }

        let data = null;
        try {
            data = await response.json();
        } catch {
            // Non-JSON response (e.g. the API isn't deployed).
        }

        if (!response.ok || !data) {
            throw new Error((data && data.error) || "The Keyflow server isn't available right now.");
        }

        return data;
    }

    async function register(ign) {
        const data = await request("POST", "/api/register", { ign });
        const player = {
            ign: data.ign,
            tag: data.tag,
            key: data.key,
            createdAt: data.createdAt,
            keySaved: false,
            prs: {},
        };
        savePlayer(player);
        return player;
    }

    async function submitScore(testId, result) {
        const player = getPlayer();
        const data = await request("POST", "/api/score", {
            key: player.key,
            testId,
            correctChars: result.correctChars,
            seconds: result.seconds,
            accuracy: result.accuracy,
        });
        updatePlayer({ prs: data.player.prs });
        return data;
    }

    async function fetchMe(rawKey) {
        const key = rawKey || (getPlayer() || {}).key;
        const data = await request("POST", "/api/me", { key });
        return data.player;
    }

    async function restore(rawText) {
        const key = extractKey(rawText);
        if (!key) {
            throw new Error("Couldn't find a secret key. It looks like KF-XXXX-XXXX-XXXX-XXXX-XXXX.");
        }

        const player = await fetchMe(key);
        savePlayer({
            ign: player.ign,
            tag: player.tag,
            key,
            createdAt: player.createdAt,
            keySaved: true,
            prs: player.prs,
        });
        return player;
    }

    function fetchLeaderboard(boardId = "free-style") {
        return request("GET", `/api/leaderboard?board=${encodeURIComponent(boardId)}`);
    }

    // Test ids for the Practice or Learn menu, in display order.
    function testsInCategory(category) {
        if (category === "practice") {
            return PARAGRAPH_NAMES.map((name, index) => `practice-${index + 1}`);
        }
        if (category === "learn") {
            return LESSON_SLUGS.map((slug) => `lesson-${slug}`)
                .sort((a, b) => testLabel(a).localeCompare(testLabel(b)));
        }
        return [];
    }

    function categoryOf(testId) {
        if (/^practice-\d+$/.test(testId)) return "practice";
        if (/^lesson-/.test(testId)) return "learn";
        if (testId === "free-style") return "free-style";
        return null;
    }

    function extractKey(text) {
        const match = KEY_PATTERN.exec(String(text || "").toUpperCase());
        return match ? match[0] : null;
    }

    /* ---------- labels and formatting ---------- */

    function testLabel(testId) {
        if (testId === "free-style") return "Free Style";

        const practice = /^practice-(\d+)$/.exec(testId);
        if (practice) {
            const number = Number(practice[1]);
            const name = PARAGRAPH_NAMES[number - 1];
            return `Paragraph ${String(number).padStart(2, "0")}${name ? ` · ${name}` : ""}`;
        }

        const lesson = /^lesson-(.+)$/.exec(testId);
        if (lesson) {
            const title = lesson[1].split("-")
                .map((word, index) => (index > 0 && SMALL_WORDS.includes(word)
                    ? word
                    : word[0].toUpperCase() + word.slice(1)))
                .join(" ");
            return `Lesson: ${title}`;
        }

        return testId;
    }

    function formatDate(iso, withTime = false) {
        const options = { day: "numeric", month: "short", year: "numeric" };
        if (withTime) Object.assign(options, { hour: "2-digit", minute: "2-digit" });
        return new Date(iso).toLocaleString("en-GB", options);
    }

    function displayName(player) {
        return `${player.ign}#${player.tag}`;
    }

    /* ---------- stats summary ---------- */

    function average(values) {
        return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
    }

    // history is newest first. Trend compares the newer half with the older half.
    function summarise(history) {
        if (!history || history.length === 0) {
            return null;
        }

        const wpms = history.map((entry) => entry.wpm);
        const half = Math.floor(history.length / 2);
        const trend = history.length >= 4
            ? Math.round(average(wpms.slice(0, half)) - average(wpms.slice(half, half * 2)))
            : null;

        return {
            count: history.length,
            averageWpm: Math.round(average(wpms)),
            averageAccuracy: Math.round(average(history.map((entry) => entry.accuracy))),
            best: Math.max(...wpms),
            worst: Math.min(...wpms),
            trend,
            trendHalf: half,
        };
    }

    /* ---------- downloads ---------- */

    function download(filename, text) {
        const blob = new Blob([text.replace(/\n/g, "\r\n")], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function fileSafeName(player) {
        return `${player.ign}-${player.tag}`;
    }

    function downloadKeyFile(player) {
        const text = [
            "KEYFLOW PLAYER KEY - keep this private",
            "",
            `IGN:         ${displayName(player)}`,
            `Secret key:  ${player.key}`,
            `Created:     ${formatDate(player.createdAt || new Date().toISOString())}`,
            "",
            "Use this on Keyflow > Leaderboard > \"Restore my IGN\"",
            "to get your scores back on another device or browser.",
            "",
            "Anyone with this key can post scores as you.",
            "Don't share this file. Share your stats file instead.",
            "",
        ].join("\n");

        download(`keyflow-key-${fileSafeName(player)}.txt`, text);
    }

    function pad(value, width) {
        return String(value).padEnd(width);
    }

    function downloadStatsFile(player) {
        const lines = [
            `KEYFLOW STATS - ${displayName(player)}`,
            `Generated: ${formatDate(new Date().toISOString(), true)}`,
            "",
            "PERSONAL BESTS",
        ];

        const prs = Object.entries(player.prs || {})
            .sort(([, a], [, b]) => b.wpm - a.wpm);

        if (prs.length === 0) {
            lines.push("  No results yet.");
        }

        prs.forEach(([testId, pr]) => {
            lines.push(`  ${pad(testLabel(testId), 38)}${pad(`${pr.wpm} WPM`, 9)}${pad(`${pr.accuracy}%`, 6)}${formatDate(pr.date)}`);
        });

        if (player.overall) {
            lines.push("", `OVERALL (best result per test, ${MIN_ACCURACY}%+ accuracy)`);
            [["Practice", player.overall.practice], ["Learn", player.overall.learn]].forEach(([name, overall]) => {
                const average = overall.completed ? `avg ${Math.round(overall.avgWpm)} WPM` : "no results yet";
                lines.push(`  ${pad(name, 22)}${pad(average, 16)}${overall.completed}/${overall.total} completed`);
            });
        }

        const summary = summarise(player.history);
        lines.push("", `SUMMARY (last ${summary ? summary.count : 0} tests)`);

        if (summary) {
            lines.push(`  ${pad("Average WPM", 22)}${summary.averageWpm}`);
            lines.push(`  ${pad("Average accuracy", 22)}${summary.averageAccuracy}%`);
            if (summary.trend !== null) {
                const sign = summary.trend > 0 ? "+" : "";
                lines.push(`  ${pad("Trend", 22)}${sign}${summary.trend} WPM (last ${summary.trendHalf} vs previous ${summary.trendHalf})`);
            }
            lines.push(`  ${pad("Best / worst", 22)}${summary.best} / ${summary.worst} WPM`);

            lines.push("", `LAST ${summary.count} TESTS`);
            lines.push(`  ${pad("#", 4)}${pad("Date", 20)}${pad("Test", 38)}${pad("WPM", 6)}Acc`);
            player.history.forEach((entry, index) => {
                lines.push(`  ${pad(index + 1, 4)}${pad(formatDate(entry.date, true), 20)}${pad(testLabel(entry.testId), 38)}${pad(entry.wpm, 6)}${entry.accuracy}%`);
            });
        } else {
            lines.push("  No results yet.");
        }

        lines.push("", "This file is safe to share. It doesn't contain your secret key.", "");
        download(`keyflow-stats-${fileSafeName(player)}.txt`, lines.join("\n"));
    }

    return {
        getPlayer,
        updatePlayer,
        forgetPlayer,
        register,
        submitScore,
        fetchMe,
        restore,
        fetchLeaderboard,
        testsInCategory,
        categoryOf,
        OVERALL_MIN_COMPLETED,
        MIN_ACCURACY,
        extractKey,
        testLabel,
        formatDate,
        displayName,
        summarise,
        downloadKeyFile,
        downloadStatsFile,
    };
})();
