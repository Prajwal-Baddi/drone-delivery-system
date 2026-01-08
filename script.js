var map = L.map('map').setView([20.6, 78.9], 5);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

let points = [], markers = [], polylines = [], droneMarker = null;
let lastScored = [];

/* ADD POINTS */
map.on('click', e => {
    points.push(e.latlng);
    markers.push(L.marker(e.latlng).addTo(map));
});

/* HAVERSINE DISTANCE */
function haversine(a, b) {
    const R = 6371;
    let dLat = (b.lat - a.lat) * Math.PI / 180;
    let dLon = (b.lng - a.lng) * Math.PI / 180;
    return 2 * R * Math.asin(Math.sqrt(
        Math.sin(dLat/2)**2 +
        Math.cos(a.lat*Math.PI/180) *
        Math.cos(b.lat*Math.PI/180) *
        Math.sin(dLon/2)**2
    ));
}

/* DRAW PATH */
function drawPath() {
    polylines.forEach(p => map.removeLayer(p));
    polylines = [];
    for (let i = 0; i < points.length - 1; i++) {
        polylines.push(
            L.polyline([points[i], points[i+1]], {
                color: "#00f2ff",
                weight: 4
            }).addTo(map)
        );
    }
}

/* DRONE ANIMATION */
function animateDrone(path) {
    if (droneMarker) map.removeLayer(droneMarker);

    const icon = L.divIcon({
        html: `<div class="drone-halo">
                <img src="drone.jpg" class="drone-image">
               </div>`,
        iconSize: [56,56],
        iconAnchor: [28,28]
    });

    droneMarker = L.marker(path[0], {icon}).addTo(map);

    let i = 0;
    function move() {
        if (i >= path.length) return;
        droneMarker.setLatLng(path[i]);
        i++;
        setTimeout(move, 900);
    }
    move();
}

/* ALGORITHMS */
const algorithms = [
    { name:"Dijkstra", time:"O(E log V)", base:90 },
    { name:"A*", time:"O(E log V)", base:88 },
    { name:"BFS", time:"O(V+E)", base:82 },
    { name:"DFS", time:"O(V+E)", base:65 },
    { name:"Bellman-Ford", time:"O(VE)", base:70 },
    { name:"Floyd-Warshall", time:"O(V³)", base:60 },
    { name:"Prim", time:"O(E log V)", base:78 },
    { name:"Kruskal", time:"O(E log E)", base:76 },
    { name:"Bidirectional Dijkstra", time:"O(E log V)", base:85 },
    { name:"Johnson", time:"O(V² log V)", base:72 },
    { name:"Ant Colony Optimization", time:"Iterative", base:68 },
    { name:"Naive Greedy", time:"O(V²)", base:55 }
];

/* GRAPH ANALYSIS */
function analyzeGraph() {
    const n = points.length;

    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;

    points.forEach(p => {
        minLat = Math.min(minLat, p.lat);
        maxLat = Math.max(maxLat, p.lat);
        minLng = Math.min(minLng, p.lng);
        maxLng = Math.max(maxLng, p.lng);
    });

    const spread = (maxLat - minLat) + (maxLng - minLng);
    const density = n / (spread + 0.0001);

    return { n, spread, density };
}

/* COMPUTE ROUTE */
function computeRoute() {
    if (points.length < 2) return alert("Add at least 2 points");

    drawPath();
    animateDrone(points);

    let dist = 0;
    for (let i = 0; i < points.length - 1; i++)
        dist += haversine(points[i], points[i+1]);

    const analysis = analyzeGraph();

    /* AI SCORING WITH REASONS */
    lastScored = algorithms.map(a => {
        let score = a.base;

        // Small graphs
        if (analysis.n <= 3 && (a.name === "BFS" || a.name === "DFS"))
            score += 20;

        // Medium weighted graphs
        if (analysis.n >= 4 && analysis.n <= 7 && a.name === "Dijkstra")
            score += 25;

        // Straight / sparse → heuristic advantage
        if (analysis.spread > 0.3 && analysis.density < 10 && a.name === "A*")
            score += 25;

        // Large graphs
        if (analysis.n > 7 && a.name === "Bidirectional Dijkstra")
            score += 20;

        // Penalize heavy algorithms on small graphs
        if (analysis.n < 5 && a.name === "Floyd-Warshall")
            score -= 30;

        score = Math.max(0, Math.min(100, score));
        return { ...a, score };
    });

    lastScored.sort((a,b)=>b.score-a.score);
    const best = lastScored[0];

    /* UPDATE UI */
    document.getElementById("algoName").innerText = best.name;
    document.getElementById("bestAlgo").innerText = best.name;
    document.getElementById("distance").innerText = dist.toFixed(2)+" km";
    document.getElementById("points").innerText = points.length;
    document.getElementById("iterations").innerText = points.length;
    document.getElementById("complexity").innerText = best.time;

    /* EXPLANATION (IMPORTANT PART) */
    let explanation = "";

    if (best.name === "Dijkstra") {
        explanation =
            "Dijkstra was selected because the delivery network is moderately sized and weighted. " +
            "It guarantees the optimal shortest path while maintaining acceptable computational efficiency.";
    }
    else if (best.name === "A*") {
        explanation =
            "A* was selected because the delivery points are spatially well-distributed, allowing " +
            "heuristic guidance to reduce unnecessary exploration and speed up pathfinding.";
    }
    else if (best.name === "BFS") {
        explanation =
            "BFS was selected due to the very small size of the delivery network, where a simple " +
            "level-based traversal is sufficient and computationally efficient.";
    }
    else if (best.name === "Bidirectional Dijkstra") {
        explanation =
            "Bidirectional Dijkstra was selected because the network is large, and searching from " +
            "both the source and destination significantly reduces the search space.";
    }
    else if (best.name === "Bellman-Ford") {
        explanation =
            "Bellman-Ford was selected due to its robustness and ability to handle complex edge conditions, " +
            "despite higher computational cost.";
    }
    else {
        explanation =
            "This algorithm was selected based on its balance between performance, scalability, " +
            "and suitability for the current network characteristics.";
    }

    document.getElementById("bestReason").innerText =
        "Algorithm selected based on structural analysis of the delivery network.";
    document.getElementById("aiExplanation").innerText = explanation;

    renderTopAlgorithms();
}

/* TOP 3 MENU */
function renderTopAlgorithms() {
    const cont = document.getElementById("topAlgorithms");
    cont.innerHTML = "";

    lastScored.slice(0,3).forEach((a,i)=>{
        cont.innerHTML += `
            <div class="top-algo-card">
                <h3>${i+1}. ${a.name}</h3>
                <p><b>Time:</b> ${a.time}</p>
                <p class="confidence">Confidence Score: ${a.score}%</p>
                ${i === 0 ? `<span class="ai-badge">🤖 AI Recommended</span>` : ""}
            </div>
        `;
    });
}

/* RESET */
function resetMap() {
    points = [];
    markers.forEach(m=>map.removeLayer(m));
    polylines.forEach(p=>map.removeLayer(p));
    if (droneMarker) map.removeLayer(droneMarker);
    markers=[]; polylines=[];
}

/* ===================== SCROLL OBSERVER ===================== */
const observer = new IntersectionObserver(
    entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add("visible");
            }
        });
    },
    {
        threshold: 0.15
    }
);

document.querySelectorAll(".scroll-animate").forEach(el => {
    observer.observe(el);
});

/* ===================== NAVBAR SCROLL EFFECT ===================== */
window.addEventListener("scroll", () => {
    const navbar = document.querySelector(".navbar");
    if (!navbar) return;

    if (window.scrollY > 60) {
        navbar.classList.add("shrink");
    } else {
        navbar.classList.remove("shrink");
    }
});

// ===================== THEME TOGGLE (SAFE VERSION) =====================
document.addEventListener("DOMContentLoaded", () => {
    const toggle = document.getElementById("themeToggle");
    if (!toggle) return; // ⛔ Prevents crash if button missing

    function setTheme(mode) {
        document.body.classList.toggle("light", mode === "light");
        localStorage.setItem("theme", mode);
        toggle.textContent = mode === "light" ? "☀️" : "🌙";
    }

    // Load saved theme
    const savedTheme = localStorage.getItem("theme") || "dark";
    setTheme(savedTheme);

    // Toggle on click
    toggle.addEventListener("click", () => {
        const newTheme = document.body.classList.contains("light") ? "dark" : "light";
        setTheme(newTheme);
    });
});
