const lessons = {
    "fractions": ["Fractions", "Mathematics", "A fraction represents part of a whole. Its numerator shows the parts we have, while its denominator shows the equal parts in the whole."],
    "patterns": ["Patterns", "Mathematics", "A number pattern follows a rule. Looking for the change between terms can help us predict the next number with confidence."],
    "geometry": ["Geometry", "Mathematics", "A triangle has three sides, and the angles inside any triangle add up to one hundred and eighty degrees."],
    "percentages": ["Percentages", "Mathematics", "A percentage means a part out of one hundred. It can describe discounts, test results, and changes in a quantity."],
    "the-water-cycle": ["The Water Cycle", "Science", "Heat from the Sun causes water to evaporate. The water vapour cools into clouds and returns to Earth as precipitation."],
    "forces": ["Forces", "Science", "A force is a push or a pull. Forces can change an object's speed, direction, or shape."],
    "plant-life": ["Plant Life", "Science", "Plants use sunlight, water, and carbon dioxide to make food through a process called photosynthesis."],
    "the-solar-system": ["The Solar System", "Science", "The solar system contains the Sun and the objects that orbit it, including planets, moons, asteroids, and comets."],
    "character": ["Character", "English Literature", "A character is a person, animal, or figure in a story. Writers reveal character through actions, speech, thoughts, and relationships."],
    "setting": ["Setting", "English Literature", "The setting tells us where and when a story happens. It can shape the mood and influence the choices of the characters."],
    "poetry": ["Poetry", "English Literature", "Poets use rhythm, imagery, and carefully chosen words to express ideas and feelings in a concentrated form."],
    "theme": ["Theme", "English Literature", "A theme is a central idea in a work of literature, such as friendship, courage, justice, or the search for identity."],
    "evidence": ["Evidence", "History", "Historians study sources such as letters, tools, photographs, and buildings to learn about people who lived in the past."],
    "ancient-civilisations": ["Ancient Civilisations", "History", "Ancient civilisations developed systems of writing, government, trade, farming, and architecture that shaped later societies."],
    "cause-and-effect": ["Cause and Effect", "History", "Historical events usually have several causes and consequences. Comparing them helps us understand change over time."],
    "chronology": ["Chronology", "History", "Chronology is the arrangement of events in the order they happened. Timelines make relationships between events easier to see."],
    "maps": ["Maps", "General Knowledge", "Maps use symbols, scale, and direction to represent places. A compass helps us describe the position of one place from another."],
    "communication": ["Communication", "General Knowledge", "Communication allows people to share information through speech, writing, images, gestures, and technology."],
    "healthy-habits": ["Healthy Habits", "General Knowledge", "Regular movement, balanced meals, enough sleep, and good hygiene help the body and mind work well."],
    "digital-citizenship": ["Digital Citizenship", "General Knowledge", "Good digital citizens protect private information, check sources, and treat other people with respect online."],
    "landforms": ["Landforms", "Geography", "Mountains, valleys, rivers, and plains are landforms that shape the surface of Earth."],
    "algorithms": ["Algorithms", "Computer Science", "An algorithm is a clear sequence of instructions used to solve a problem or complete a task."],
    "colour": ["Colour", "Art", "Artists use colour to create contrast, mood, balance, and emphasis in an artwork."],
    "rhythm": ["Rhythm", "Music", "Rhythm is the pattern of beats and pauses that gives music its movement through time."],
    "vocabulary": ["Vocabulary", "Languages", "Vocabulary is the collection of words we understand and use to communicate ideas clearly."],
    "wellbeing": ["Wellbeing", "Health", "Wellbeing includes caring for physical health, mental health, relationships, and daily habits."]
};

const lesson = lessons[document.body.dataset.topic];

if (!lesson) {
    window.location.replace("Learn While Typing.html");
} else {
    const [title, subject, text] = lesson;
    document.title = `${title} | Keyflow`;
    document.body.dataset.text = text;
    document.body.innerHTML = `
        <header class="site-header test-header">
            <a class="brand" href="Typing Test Homepage.html" aria-label="Keyflow home"><span class="brand-mark">K</span><span>Keyflow</span></a>
            <nav aria-label="Main navigation">
                <a class="nav-link home-link" href="Typing Test Homepage.html"><span class="home-icon" aria-hidden="true">⌂</span> Home</a>
                <a class="nav-link" href="Typing Test Practicepage1.html">Practice</a>
                <a class="nav-link active" href="Learn While Typing.html">Learn</a>
                <button class="theme-toggle" id="themeToggle" type="button" aria-label="Switch to light mode" aria-pressed="false"><span aria-hidden="true">☾</span></button>
            </nav>
        </header>
        <div class="practice-layout lesson-layout">
            <main>
                <section>
                    <h2>${title}</h2>
                    <p>Type this ${subject} lesson as accurately as possible.</p>
                    <p id="textDisplay" aria-label="Text to type"></p>
                    <input type="text" id="typingInput" placeholder="Start typing here..." autocomplete="off">
                    <button class="restart-button" id="restartButton" type="button">Restart test</button>
                </section>
                <section>
                    <h2>Statistics</h2>
                    <p>Time: <span id="time">60</span>s</p>
                    <p>WPM: <span id="wpm">0</span></p>
                    <p>Accuracy: <span id="accuracy">100</span>%</p>
                </section>
            </main>
        </div>
        <footer><div class="footerbox"><p>Keyflow Typing Practice</p></div></footer>
        <audio id="timeoutBuzzer" preload="auto"><source src="Wrong_Buzzer_-_Sound_Effect(360p).mp3" type="audio/mpeg"></audio>`;

    const typingScript = document.createElement("script");
    typingScript.src = "Typing Test Function.js";
    typingScript.async = false;
    document.body.appendChild(typingScript);

    const themeScript = document.createElement("script");
    themeScript.src = "Theme Function.js";
    themeScript.async = false;
    document.body.appendChild(themeScript);
}
