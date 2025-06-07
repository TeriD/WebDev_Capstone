// Example: List of available layers (replace with dynamic fetch if needed)
const availableLayers = [
    { name: "Road Projects", file: "data/road_projects.geojson" },
    { name: "Bridge Projects", file: "data/bridge_projects.geojson" },
    { name: "Safety Zones", file: "data/safety_zones.geojson" }
];

// Store references to Leaflet layers
const leafletLayers = {};

// Function to add checkboxes for each layer
function populateLayerControls() {
    const container = document.getElementById('layerControls');
    container.innerHTML = '';
    availableLayers.forEach((layer, idx) => {
        const id = `layer-toggle-${idx}`;
        const div = document.createElement('div');
        div.className = "form-check";
        div.innerHTML = `
            <input class="form-check-input" type="checkbox" value="" id="${id}" data-file="${layer.file}">
            <label class="form-check-label" for="${id}">${layer.name}</label>
        `;
        container.appendChild(div);
    });
}

// Function to handle layer toggling
function setupLayerToggleHandlers(map) {
    document.getElementById('layerControls').addEventListener('change', function (e) {
        if (e.target.classList.contains('form-check-input')) {
            const file = e.target.getAttribute('data-file');
            if (e.target.checked) {
                // Load and add the layer
                fetch(file)
                    .then(res => res.json())
                    .then(data => {
                        const geoLayer = L.geoJSON(data).addTo(map);
                        leafletLayers[file] = geoLayer;
                    });
            } else {
                // Remove the layer
                if (leafletLayers[file]) {
                    map.removeLayer(leafletLayers[file]);
                    delete leafletLayers[file];
                }
            }
        }
    });
}

// Initialize map and controls
document.addEventListener('DOMContentLoaded', function () {
    // Initialize your Leaflet map
    const map = L.map('map').setView([37.8, -85.0], 7);

    // Add a base layer (example)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
    }).addTo(map);

    populateLayerControls();
    setupLayerToggleHandlers(map);

    // ...other map logic...
});