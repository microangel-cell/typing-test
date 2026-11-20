// Keyflow scores API: IGN registration, score saving, player stats and leaderboards.
// Storage is any object with the Netlify Blobs store methods used below
// (get, getWithMetadata, setJSON), so the logic can be tested without Netlify.
//
// Leaderboards:
//   free-style, practice-1..20, lesson-<slug>   one board per test (best WPM)
//   overall-practice, overall-learn             average of a player's best WPM per
//                                               paragraph/lesson, min. 5 completed
import { createHash, randomBytes, randomInt } from "node:crypto";

export const LEADERBOARD_MIN_ACCURACY = 85;
export const OVERALL_MIN_COMPLETED = 5;
const LEADERBOARD_STORED = 100;
const LEADERBOARD_SHOWN = 50;
const HISTORY_LENGTH = 20;
const MAX_WPM = 250;
const MIN_SECONDS = 3;
const MIN_SECONDS_BETWEEN_SCORES = 3;
const REGISTRATIONS_PER_HOUR = 10;
const PRACTICE_COUNT = 20;

const LESSON_SLUGS = [
    "algorithms", "ancient-civilisations", "cause-and-effect", "character", "chronology",
    "colour", "communication", "digital-citizenship", "evidence", "forces", "fractions",
    "geometry", "healthy-habits", "landforms", "maps", "patterns", "percentages",
    "plant-life", "poetry", "rhythm", "setting", "the-solar-system", "the-water-cycle",
    "theme", "vocabulary", "wellbeing",
];

const CATEGORY_TOTALS = { practice: PRACTICE_COUNT, learn: LESSON_SLUGS.length };

// Words blocked inside IGNs (checked after undoing common number swaps like 4 -> a).
const BLOCKED_WORDS = [
    "fuck", "shit", "bitch", "cunt", "dick", "cock", "pussy", "whore", "slut", "porn",
    "rape", "nazi", "hitler", "nigg", "fag", "retard", "penis", "vagina", "anus", "kys",
];

const KEY_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford base32, no I/L/O/U
const KEY_PATTERN = /KF(?:-[0-9A-Z]{4}){5}/;

class ApiError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

/* ---------- helpers ---------- */

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function json(status, body) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
}

export function isValidTestId(testId) {
    if (testId === "free-style") return true;

    const practice = /^practice-(\d{1,2})$/.exec(testId);
    if (practice) {
        const number = Number(practice[1]);
        return String(number) === practice[1] && number >= 1 && number <= PRACTICE_COUNT;
    }

    const lesson = /^lesson-([a-z-]+)$/.exec(testId);
    return Boolean(lesson && LESSON_SLUGS.includes(lesson[1]));
}

export function categoryOf(testId) {
    if (testId.startsWith("practice-")) return "practice";
    if (testId.startsWith("lesson-")) return "learn";
    return null;
}

function isValidBoardId(boardId) {
    return boardId === "overall-practice" || boardId === "overall-learn" || isValidTestId(boardId);
}

function isTimedTest(testId) {
    return testId === "free-style" || testId.startsWith("practice-");
}

export function validateIgn(rawIgn) {
    const ign = typeof rawIgn === "string" ? rawIgn.trim() : "";

    if (!/^[A-Za-z0-9_]{3,16}$/.test(ign)) {
        throw new ApiError(400, "Your IGN must be 3–16 letters, numbers or underscores.");
    }

    const normalised = ign.toLowerCase()
        .replace(/_/g, "")
        .replace(/0/g, "o").replace(/1/g, "i").replace(/3/g, "e")
        .replace(/4/g, "a").replace(/5/g, "s").replace(/7/g, "t");

    if (BLOCKED_WORDS.some((word) => normalised.includes(word))) {
        throw new ApiError(400, "Please choose a different IGN.");
    }

    return ign;
}

export function generateKey() {
    const bytes = randomBytes(20);
    let characters = "";

    for (const byte of bytes) {
        characters += KEY_ALPHABET[byte % 32];
    }

    return `KF-${characters.match(/.{4}/g).join("-")}`;
}

export function extractKey(rawKey) {
    if (typeof rawKey !== "string") return null;
    const match = KEY_PATTERN.exec(rawKey.toUpperCase());
    return match ? match[0] : null;
}

function isBetterScore(candidate, current) {
    if (!current) return true;
    if (candidate.wpm !== current.wpm) return candidate.wpm > current.wpm;
    return candidate.accuracy > current.accuracy;
}

function sortTestBoard(entries) {
    return entries.sort((a, b) =>
        b.wpm - a.wpm
        || b.accuracy - a.accuracy
        || a.date.localeCompare(b.date));
}

function sortOverallBoard(entries) {
    return entries.sort((a, b) =>
        b.avgWpm - a.avgWpm
        || b.avgAccuracy - a.avgAccuracy
        || b.completed - a.completed
        || a.date.localeCompare(b.date));
}

// A player's overall standing in "practice" or "learn", from their best
// qualifying (85%+) result on each paragraph or lesson.
export function computeOverall(boards, category) {
    const results = Object.entries(boards)
        .filter(([testId]) => categoryOf(testId) === category)
        .map(([, score]) => score);

    if (results.length === 0) {
        return { completed: 0, total: CATEGORY_TOTALS[category], avgWpm: 0, avgAccuracy: 0 };
    }

    const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
    return {
        completed: results.length,
        total: CATEGORY_TOTALS[category],
        avgWpm: Math.round(mean(results.map((score) => score.wpm)) * 10) / 10,
        avgAccuracy: Math.round(mean(results.map((score) => score.accuracy))),
    };
}

// Older records kept one Free Style best in `board`; now every test has one in `boards`.
function withBoards(record) {
    if (!record.boards) {
        record.boards = record.board ? { "free-style": record.board } : {};
    }
    delete record.board;
    return record;
}

// Read-modify-write with an ETag check, retried if someone else wrote first.
async function updateJSON(store, key, update, fallback) {
    for (let attempt = 0; attempt < 10; attempt++) {
        if (attempt > 0) {
            // Random back-off so competing writers stop colliding.
            await wait(Math.random() * 40 * attempt);
        }

        const existing = await store.getWithMetadata(key, { type: "json" });
        const current = existing ? existing.data : fallback;
        const next = update(structuredClone(current));

        if (next === undefined) {
            return current;
        }

        const result = existing
            ? await store.setJSON(key, next, { onlyIfMatch: existing.etag })
            : await store.setJSON(key, next, { onlyIfNew: true });

        if (result.modified) {
            return next;
        }
    }

    throw new ApiError(503, "The server is busy. Please try again.");
}

async function readBody(request) {
    try {
        const body = await request.json();
        if (body && typeof body === "object") return body;
    } catch {
        // Fall through to the error below.
    }
    throw new ApiError(400, "Invalid request.");
}

async function findPlayerByKey(store, rawKey) {
    const key = extractKey(rawKey);
    if (!key) {
        throw new ApiError(401, "That secret key doesn't look right. It starts with KF-.");
    }

    const lookup = await store.get(`keys/${sha256(key)}`, { type: "json" });
    if (!lookup) {
        throw new ApiError(401, "No IGN matches that secret key.");
    }

    const player = await store.get(`players/${lookup.playerId}`, { type: "json" });
    if (!player) {
        throw new ApiError(401, "No IGN matches that secret key.");
    }

    return withBoards(player);
}

function publicPlayer(player) {
    return {
        ign: player.ign,
        tag: player.tag,
        createdAt: player.createdAt,
        prs: player.prs,
        boards: player.boards,
        history: player.history,
        overall: {
            practice: computeOverall(player.boards, "practice"),
            learn: computeOverall(player.boards, "learn"),
        },
    };
}

/* ---------- leaderboard writes ---------- */

// Makes sure a test board holds the player's best qualifying score. Returns their rank.
async function upsertTestBoard(store, testId, player, best) {
    const board = await updateJSON(store, `leaderboard/${testId}`, (data) => {
        const existing = data.entries.find((entry) => entry.playerId === player.id);
        if (existing && !isBetterScore(best, existing)) {
            return undefined; // Already up to date; no write needed.
        }
        const others = data.entries.filter((entry) => entry.playerId !== player.id);
        others.push({ playerId: player.id, ign: player.ign, tag: player.tag, ...best });
        data.entries = sortTestBoard(others).slice(0, LEADERBOARD_STORED);
        return data;
    }, { entries: [] });

    const index = board.entries.findIndex((entry) => entry.playerId === player.id);
    return index >= 0 ? index + 1 : null;
}

// Makes sure an overall board reflects the player's current standing. Returns their rank.
async function upsertOverallBoard(store, category, player, overall, date) {
    if (overall.completed < OVERALL_MIN_COMPLETED) {
        return null;
    }

    const board = await updateJSON(store, `leaderboard/overall-${category}`, (data) => {
        const existing = data.entries.find((entry) => entry.playerId === player.id);
        if (existing
            && existing.avgWpm === overall.avgWpm
            && existing.avgAccuracy === overall.avgAccuracy
            && existing.completed === overall.completed) {
            return undefined; // Already up to date.
        }
        const others = data.entries.filter((entry) => entry.playerId !== player.id);
        others.push({
            playerId: player.id,
            ign: player.ign,
            tag: player.tag,
            avgWpm: overall.avgWpm,
            avgAccuracy: overall.avgAccuracy,
            completed: overall.completed,
            total: overall.total,
            date: existing && existing.avgWpm === overall.avgWpm ? existing.date : date,
        });
        data.entries = sortOverallBoard(others).slice(0, LEADERBOARD_STORED);
        return data;
    }, { entries: [] });

    const index = board.entries.findIndex((entry) => entry.playerId === player.id);
    return index >= 0 ? index + 1 : null;
}

/* ---------- endpoints ---------- */

async function register(request, { store, ip, now }) {
    const body = await readBody(request);
    const ign = validateIgn(body.ign);

    // Limit how many IGNs one connection can create per hour.
    const hourWindow = Math.floor(now / 3_600_000);
    const limitKey = `ratelimit/register/${sha256(`${ip}|${hourWindow}`)}`;
    const limit = await updateJSON(store, limitKey, (record) => {
        record.count += 1;
        return record;
    }, { count: 0 });

    if (limit.count > REGISTRATIONS_PER_HOUR) {
        throw new ApiError(429, "Too many new IGNs from this connection. Please try again later.");
    }

    const playerId = randomBytes(9).toString("base64url");
    let tag = null;

    for (let attempt = 0; attempt < 25 && !tag; attempt++) {
        const candidate = String(randomInt(1000, 10000));
        const claim = await store.setJSON(
            `names/${ign.toLowerCase()}-${candidate}`,
            { playerId },
            { onlyIfNew: true },
        );
        if (claim.modified) tag = candidate;
    }

    if (!tag) {
        throw new ApiError(409, "That IGN is very popular. Please choose another.");
    }

    const key = generateKey();
    const createdAt = new Date(now).toISOString();
    const player = {
        id: playerId,
        ign,
        tag,
        createdAt,
        prs: {},
        boards: {},
        history: [],
        lastSubmitAt: 0,
    };

    await store.setJSON(`players/${playerId}`, player);
    await store.setJSON(`keys/${sha256(key)}`, { playerId });

    return json(201, { ign, tag, key, createdAt });
}

async function saveScore(request, { store, now }) {
    const body = await readBody(request);
    const player = await findPlayerByKey(store, body.key);
    const { testId } = body;
    const correctChars = Number(body.correctChars);
    const seconds = Number(body.seconds);
    const accuracy = Number(body.accuracy);

    if (typeof testId !== "string" || !isValidTestId(testId)) {
        throw new ApiError(400, "Unknown test.");
    }
    if (!Number.isInteger(correctChars) || correctChars < 1 || correctChars > 5000) {
        throw new ApiError(400, "Invalid result.");
    }
    if (!Number.isFinite(seconds) || seconds < MIN_SECONDS || seconds > (isTimedTest(testId) ? 61 : 3600)) {
        throw new ApiError(400, "Invalid result.");
    }
    if (!Number.isFinite(accuracy) || accuracy < 0 || accuracy > 100) {
        throw new ApiError(400, "Invalid result.");
    }

    // WPM is worked out here rather than trusted from the browser.
    const wpm = Math.round((correctChars / 5) / (seconds / 60));
    if (wpm > MAX_WPM) {
        throw new ApiError(400, "That result is faster than we can accept.");
    }

    const date = new Date(now).toISOString();
    const score = { wpm, accuracy: Math.round(accuracy), date };
    const qualified = score.accuracy >= LEADERBOARD_MIN_ACCURACY;
    let previousPR = null;
    let isNewPR = false;
    let improvedBoard = false;

    const updated = await updateJSON(store, `players/${player.id}`, (record) => {
        withBoards(record);

        if (now - record.lastSubmitAt < MIN_SECONDS_BETWEEN_SCORES * 1000) {
            throw new ApiError(429, "Results are arriving too quickly. Please wait a moment.");
        }

        previousPR = record.prs[testId] || null;
        isNewPR = isBetterScore(score, previousPR);
        if (isNewPR) record.prs[testId] = score;

        if (qualified) {
            improvedBoard = isBetterScore(score, record.boards[testId]);
            if (improvedBoard) record.boards[testId] = score;
        }

        record.history = [{ testId, ...score }, ...record.history].slice(0, HISTORY_LENGTH);
        record.lastSubmitAt = now;
        return record;
    });

    let rank = null;
    let overall = null;

    // On every qualifying result, make sure the boards hold the player's best.
    // This also repairs a board if an earlier write was lost.
    if (qualified && updated.boards[testId]) {
        rank = await upsertTestBoard(store, testId, player, updated.boards[testId]);
    }

    const category = categoryOf(testId);
    if (category) {
        const standing = computeOverall(updated.boards, category);
        const overallRank = qualified
            ? await upsertOverallBoard(store, category, player, standing, date)
            : null;
        overall = {
            category,
            ...standing,
            needed: Math.max(0, OVERALL_MIN_COMPLETED - standing.completed),
            rank: overallRank,
        };
    }

    return json(200, {
        testId,
        score,
        isNewPR,
        previousPR,
        leaderboard: {
            qualified,
            improved: improvedBoard,
            rank,
            overall,
        },
        player: publicPlayer(updated),
    });
}

async function getMe(request, { store }) {
    const body = await readBody(request);
    const player = await findPlayerByKey(store, body.key);
    return json(200, { player: publicPlayer(player) });
}

async function getLeaderboard(request, { store }) {
    const params = new URL(request.url).searchParams;
    const boardId = params.get("board") || params.get("test") || "free-style";

    if (!isValidBoardId(boardId)) {
        throw new ApiError(400, "Unknown leaderboard.");
    }

    const isOverall = boardId.startsWith("overall-");
    const data = await store.get(`leaderboard/${boardId}`, { type: "json" });
    const entries = (data ? data.entries : [])
        .slice(0, LEADERBOARD_SHOWN)
        .map((entry) => (isOverall
            ? {
                ign: entry.ign,
                tag: entry.tag,
                avgWpm: entry.avgWpm,
                avgAccuracy: entry.avgAccuracy,
                completed: entry.completed,
                total: entry.total,
                date: entry.date,
            }
            : { ign: entry.ign, tag: entry.tag, wpm: entry.wpm, accuracy: entry.accuracy, date: entry.date }));

    return json(200, {
        board: boardId,
        kind: isOverall ? "overall" : "test",
        minAccuracy: LEADERBOARD_MIN_ACCURACY,
        minCompleted: isOverall ? OVERALL_MIN_COMPLETED : null,
        entries,
    });
}

const ROUTES = {
    "POST /api/register": register,
    "POST /api/score": saveScore,
    "POST /api/me": getMe,
    "GET /api/leaderboard": getLeaderboard,
};

export async function handleRequest(request, context) {
    const { pathname } = new URL(request.url);
    const route = ROUTES[`${request.method} ${pathname.replace(/\/$/, "")}`];

    if (!route) {
        return json(404, { error: "Not found." });
    }

    try {
        return await route(request, context);
    } catch (error) {
        if (error instanceof ApiError) {
            return json(error.status, { error: error.message });
        }
        console.error(error);
        return json(500, { error: "Something went wrong on the server." });
    }
}
