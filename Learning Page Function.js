document.querySelectorAll(".lesson-card").forEach(function (card) {
    const title = card.querySelector("h3").textContent.trim();
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const link = document.createElement("a");

    link.className = "lesson-link";
    link.href = `lesson-${slug}.html`;
    link.setAttribute("aria-label", `Practise typing: ${title}`);

    while (card.firstChild) {
        link.appendChild(card.firstChild);
    }

    card.appendChild(link);
});
