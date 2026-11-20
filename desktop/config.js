// Desktop app settings.
//
// API_BASE is the address of the live Keyflow site on Netlify. The app sends
// every /api/... request (save PR, leaderboard, restore IGN) there, so those
// features work in the app exactly as they do on the website.
// Leave it empty to run without them: tests still work, saving is disabled.
module.exports = {
    API_BASE: "", // e.g. "https://keyflow.netlify.app"
};
