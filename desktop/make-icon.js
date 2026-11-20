// One-off helper: renders ../favicon.svg to build/icon.png (512x512) so
// electron-builder can make the Windows .ico. Run with: npm run icon
const { app, BrowserWindow } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const SIZE = 512;

app.whenReady().then(async () => {
    const svg = fs.readFileSync(path.join(__dirname, "..", "favicon.svg"), "utf8");
    const html = `<html><body style="margin:0;background:transparent">
        <img src="data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}" width="${SIZE}" height="${SIZE}">
        </body></html>`;

    const win = new BrowserWindow({
        width: SIZE, height: SIZE, show: false, transparent: true, frame: false,
        useContentSize: true, webPreferences: { offscreen: true },
    });
    await win.loadURL(`data:text/html;base64,${Buffer.from(html).toString("base64")}`);
    await new Promise((r) => setTimeout(r, 300));

    const image = await win.webContents.capturePage({ x: 0, y: 0, width: SIZE, height: SIZE });
    fs.mkdirSync(path.join(__dirname, "build"), { recursive: true });
    fs.writeFileSync(path.join(__dirname, "build", "icon.png"), image.resize({ width: SIZE, height: SIZE }).toPNG());
    console.log("Wrote build/icon.png");
    app.quit();
});
