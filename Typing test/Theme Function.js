const themeToggle = document.getElementById("themeToggle");
const savedTheme = localStorage.getItem("keyflow-theme");

if (savedTheme === "light") {
    document.body.classList.add("light-mode");
}

function setThemeAttribute() {
    document.documentElement.dataset.theme = document.body.classList.contains("light-mode")
        ? "light"
        : "dark";
}

setThemeAttribute();

function updateThemeToggle() {
    const isLightMode = document.body.classList.contains("light-mode");

    themeToggle.setAttribute("aria-pressed", String(!isLightMode));
    themeToggle.setAttribute(
        "aria-label",
        isLightMode ? "Switch to dark mode" : "Switch to light mode"
    );
    themeToggle.innerHTML = isLightMode
        ? "<span aria-hidden=\"true\">&#9788;</span>"
        : "<span aria-hidden=\"true\">&#9790;</span>";
}

updateThemeToggle();

themeToggle.addEventListener("click", function () {
    document.body.classList.toggle("light-mode");
        setThemeAttribute();

    localStorage.setItem(
        "keyflow-theme",
        document.body.classList.contains("light-mode") ? "light" : "dark"
    );

    updateThemeToggle();
});
