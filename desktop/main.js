// Keyflow desktop app (Electron).
//
// The website's own HTML/CSS/JS files are loaded unchanged through a private
// app://keyflow/ address. Requests to /api/... are forwarded to the live
// Netlify site set in config.js, so the leaderboard and Save-your-PR work.

const { app, BrowserWindow, Menu, net, protocol, session, shell } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { API_BASE } = require("./config");

const SCHEME = "app";
const HOST = "keyflow";
const START_URL = `${SCHEME}://${HOST}/index.html`;

// Installed app: site files are copied into resources/site.
// During development: they are the website files one folder up.
const SITE_DIR = app.isPackaged
    ? path.join(process.resourcesPath, "site")
    : path.join(__dirname, "..");

// Must run before the app is ready. "standard" + "secure" give the pages a
// normal origin, so localStorage (theme, saved IGN key) and fetch work.
protocol.registerSchemesAsPrivileged([
    { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

function jsonError(status, message) {
    return new Response(JSON.stringify({ error: message }), {
        status,
        headers: { "content-type": "application/json" },
    });
}

async function forwardToApi(request, url) {
    if (!API_BASE) {
        return jsonError(503, "Saving PRs and the leaderboard aren't set up in this version of the app.");
    }

    const target = new URL(url.pathname + url.search, API_BASE);
    const hasBody = request.method !== "GET" && request.method !== "HEAD";

    return net.fetch(target.toString(), {
        method: request.method,
        headers: { "content-type": request.headers.get("content-type") || "application/json" },
        body: hasBody ? await request.text() : undefined,
    });
}

function serveFile(url) {
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
    const filePath = path.normalize(path.join(SITE_DIR, relative));

    // Don't let a crafted URL read files outside the site folder.
    if (filePath !== SITE_DIR && !filePath.startsWith(SITE_DIR + path.sep)) {
        return new Response("Not found", { status: 404 });
    }

    return net.fetch(pathToFileURL(filePath).toString());
}

function handleAppRequest(request) {
    const url = new URL(request.url);

    if (url.host !== HOST) {
        return new Response("Not found", { status: 404 });
    }

    if (url.pathname.startsWith("/api/")) {
        return forwardToApi(request, url);
    }

    return serveFile(url);
}

function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 820,
        minWidth: 800,
        minHeight: 600,
        backgroundColor: "#0d1117",
        title: "Keyflow",
        icon: path.join(__dirname, "build", "icon.png"),
        autoHideMenuBar: true,
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
        },
    });

    // Open external links (mailto:, https://...) in the user's browser.
    win.webContents.setWindowOpenHandler(({ url }) => {
        if (!url.startsWith(`${SCHEME}://`)) shell.openExternal(url);
        return { action: "deny" };
    });

    win.webContents.on("will-navigate", (event, url) => {
        if (!url.startsWith(`${SCHEME}://`)) {
            event.preventDefault();
            shell.openExternal(url);
        }
    });

    win.loadURL(START_URL);
}

function buildMenu() {
    const template = [
        {
            label: "Keyflow",
            submenu: [
                { label: "Home", accelerator: "Alt+Home", click: (_, win) => win && win.loadURL(START_URL) },
                { role: "reload" },
                { type: "separator" },
                { role: "quit" },
            ],
        },
        {
            label: "View",
            submenu: [
                { role: "resetZoom" },
                { role: "zoomIn" },
                { role: "zoomOut" },
                { type: "separator" },
                { role: "togglefullscreen" },
                ...(app.isPackaged ? [] : [{ role: "toggleDevTools" }]),
            ],
        },
        {
            label: "Navigate",
            submenu: [
                { label: "Back", accelerator: "Alt+Left", click: (_, win) => win && win.webContents.navigationHistory.goBack() },
                { label: "Forward", accelerator: "Alt+Right", click: (_, win) => win && win.webContents.navigationHistory.goForward() },
            ],
        },
    ];

    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// Only one copy of the app at a time; a second launch focuses the first.
if (!app.requestSingleInstanceLock()) {
    app.quit();
} else {
    app.on("second-instance", () => {
        const [win] = BrowserWindow.getAllWindows();
        if (win) {
            if (win.isMinimized()) win.restore();
            win.focus();
        }
    });

    app.whenReady().then(() => {
        protocol.handle(SCHEME, handleAppRequest);

        // AdSense doesn't allow ads inside desktop apps, so block its scripts here.
        session.defaultSession.webRequest.onBeforeRequest(
            { urls: ["*://pagead2.googlesyndication.com/*", "*://*.doubleclick.net/*"] },
            (_, callback) => callback({ cancel: true }),
        );

        buildMenu();
        createWindow();
    });

    app.on("window-all-closed", () => app.quit());
}
