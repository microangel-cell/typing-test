// Netlify Function: the Keyflow scores API. The logic lives in ../lib/keyflow-api.mjs.
import { getStore } from "@netlify/blobs";
import { handleRequest } from "../lib/keyflow-api.mjs";

export default async (request, context) => {
    // "strong" consistency so a score is visible to the very next request.
    const store = getStore({ name: "keyflow", consistency: "strong" });

    return handleRequest(request, {
        store,
        ip: context.ip || "unknown",
        now: Date.now(),
    });
};

export const config = {
    path: ["/api/register", "/api/score", "/api/me", "/api/leaderboard"],
};
