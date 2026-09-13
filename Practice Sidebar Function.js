const practiceSidebar = document.getElementById("practiceSidebar");
const sidebarToggle = document.getElementById("sidebarToggle");
const savedSidebarState = localStorage.getItem("keyflow-sidebar");

const additionalParagraphs = [
    ["16", "Focused Energy", "Typing Test Practicepage16.html"],
    ["17", "Measured Rhythm", "Typing Test Practicepage17.html"],
    ["18", "Bright Ideas", "Typing Test Practicepage18.html"],
    ["19", "Strong Foundations", "Typing Test Practicepage19.html"],
    ["20", "Complete the Set", "Typing Test Practicepage20.html"]
];

const paragraphNav = document.querySelector(".paragraph-nav");
const currentPage = decodeURIComponent(window.location.pathname);

additionalParagraphs.forEach(function ([index, name, page]) {
    const paragraphLink = document.createElement("a");
    paragraphLink.className = "paragraph-link";
    paragraphLink.href = page;
    paragraphLink.innerHTML = `<span class="paragraph-index">${index}</span><span class="paragraph-name">${name}</span>`;

    if (currentPage.endsWith(page)) {
        paragraphLink.classList.add("active");
    }

    paragraphNav.appendChild(paragraphLink);
});

if (savedSidebarState === "collapsed") {
    practiceSidebar.classList.add("collapsed");
}

function updateSidebarToggle() {
    const isCollapsed = practiceSidebar.classList.contains("collapsed");

    sidebarToggle.setAttribute("aria-expanded", String(!isCollapsed));
    sidebarToggle.setAttribute(
        "aria-label",
        isCollapsed ? "Expand practice sidebar" : "Collapse practice sidebar"
    );
}

updateSidebarToggle();

sidebarToggle.addEventListener("click", function () {
    practiceSidebar.classList.toggle("collapsed");

    localStorage.setItem(
        "keyflow-sidebar",
        practiceSidebar.classList.contains("collapsed") ? "collapsed" : "expanded"
    );

    updateSidebarToggle();
});
