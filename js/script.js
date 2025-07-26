/* =====================================================
   KY Highway Projects Dashboard JavaScript
   =====================================================

   This file contains all JavaScript functionality for the Kentucky Highway Projects Dashboard.

   Main components:
   1. Basemap definitions and map initialization
   2. Chart creation and management (Chart.js)
   3. Database operations (SQLite with SQL.js)
   4. Interactive filtering (district and county)
   5. GeoJSON layer management
   6. User interface controls

   Dependencies:
   - Leaflet.js for interactive mapping
   - Chart.js for pie charts and bar charts
   - SQL.js for client-side SQLite database operations
   - Bootstrap for responsive UI components
   ===================================================== */

/* =====================================================
   1. BASEMAP DEFINITIONS AND MAP VARIABLES
   ===================================================== */
/**
 * Basemap tile layer definitions
 * These provide different background maps for the dashboard
 * Users can switch between these using the basemap control
 */
const basemaps = {
    // OpenStreetMap - Free, open-source map tiles
    OpenStreetMap: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }),

    // Esri World Street Map - Professional street map tiles
    'Esri World Street Map': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom, 2012'
    }),

    // USGS Topographic Map - Detailed topographic maps
    'USGS Topo': L.tileLayer('https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 20,
        attribution: 'Tiles courtesy of the <a href="https://usgs.gov/">U.S. Geological Survey</a>'
    }),

    // OpenTopoMap - Open-source topographic maps
    'OpenTopoMap': L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        maxZoom: 17,
        attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
    })
};

// Current active basemap (default to OpenStreetMap)
let currentBasemap = 'OpenStreetMap';

/* =====================================================
   2. CHART VARIABLES AND PROJECT COUNTERS
   ===================================================== */
// Chart.js chart instances (global references for updates/destruction)
let projectsPieChart = null;      // Pie chart showing awarded vs current projects
let projectYearsChart = null;     // Horizontal bar chart showing project distribution by year

// Project count tracking object
let projectCounts = {
    awarded: 0,    // Number of awarded projects
    current: 0     // Number of current projects
};

/* =====================================================
   3. FILTER VARIABLES AND LAYER STORAGE
   ===================================================== */
// Active filter tracking
let currentDistrictFilter = null;  // Currently selected district filter
let currentCountyFilter = null;    // Currently selected county filter
let currentProjectTypeFilter = null;  // Currently selected project type filter

// Project layer storage for filtering
let currentProjectsLayer = null;   // Store current projects layer for filtering
let awardedProjectsLayer = null;   // Store awarded projects layer for filtering

// Layer storage for zoom functionality
let districtLayers = {};  // Store district boundary layers for zooming to specific districts
let countyLayers = {};    // Store county boundary layers for zooming to specific counties

/* =====================================================
   UI TITLE UPDATE FUNCTIONS
   ===================================================== */

/**
 * Updates the Projects panel and table titles based on active filters
 * This provides clear visual feedback about what data is currently being displayed
 */
function updatePanelTitles() {
    const projectsPanelTitle = document.getElementById('projectsPanelTitle');
    const tableDataTitle = document.getElementById('tableDataTitle');

    // Build title suffix for Projects panel (only district and county filters)
    let projectsTitleSuffix = '';
    if (currentDistrictFilter) {
        projectsTitleSuffix += ` in District ${currentDistrictFilter}`;
    }
    if (currentCountyFilter) {
        projectsTitleSuffix += ` in ${currentCountyFilter} County`;
    }

    // Build title suffix for data table (all filters including project type)
    let tableTitleSuffix = '';
    if (currentDistrictFilter) {
        tableTitleSuffix += ` in District ${currentDistrictFilter}`;
    }
    if (currentCountyFilter) {
        tableTitleSuffix += ` in ${currentCountyFilter} County`;
    }
    if (currentProjectTypeFilter) {
        // Get the display name for the project type from the database
        const displayName = getProjectTypeDisplayName(currentProjectTypeFilter);
        tableTitleSuffix += ` (${displayName})`;
    }

    // Update the titles
    if (projectsPanelTitle) {
        if (projectsTitleSuffix) {
            // For Projects panel, adjust font size to fit width, no weight changes
            projectsPanelTitle.innerHTML = `Projects${projectsTitleSuffix}`;
            projectsPanelTitle.classList.add('has-filter');
        } else {
            projectsPanelTitle.textContent = 'Projects';
            projectsPanelTitle.classList.remove('has-filter');
        }
    }

    if (tableDataTitle) {
        if (tableTitleSuffix) {
            tableDataTitle.innerHTML = `Highway Projects Data${tableTitleSuffix}`;
        } else {
            tableDataTitle.textContent = 'Highway Projects Data';
        }
    }
}

/**
 * Gets the display name for a project type category from the database
 * @param {string} category - The project type category
 * @returns {string} The display name for the category
 */
function getProjectTypeDisplayName(category) {
    if (!database || !category) return category;

    try {
        const stmt = database.prepare("SELECT DISTINCT dropdown_display_name FROM crosswalk WHERE dropdown_category = ? LIMIT 1");
        stmt.bind([category]);

        if (stmt.step()) {
            const row = stmt.getAsObject();
            return row.dropdown_display_name || category;
        }

        return category;
    } catch (error) {
        console.error('Error getting project type display name:', error);
        return category;
    }
}

/* =====================================================
   4. CHART CREATION FUNCTIONS
   ===================================================== */
/**
 * Creates or updates the horizontal bar chart showing project distribution by year
 * @param {Object} yearData - Object with year as key and project count as value
 * @example yearData = { "2024": 15, "2025": 23, "2026": 18 }
 */
function createProjectYearsChart(yearData) {
    console.log('createProjectYearsChart called with:', yearData);

    // Get the canvas element for the chart
    const ctx = document.getElementById('projectYearsChart');
    console.log('Canvas element found:', ctx);

    // Error handling - ensure canvas element exists
    if (!ctx) {
        console.error('Canvas element with id "projectYearsChart" not found');
        return;
    }

    // Get 2D rendering context for the canvas
    const context = ctx.getContext('2d');

    // Destroy existing chart if it exists (prevents memory leaks)
    if (projectYearsChart) {
        projectYearsChart.destroy();
    }

    // Process data for chart creation
    const years = Object.keys(yearData).sort();           // Extract and sort years
    const counts = years.map(year => yearData[year]);     // Extract corresponding counts

    console.log('Years:', years);
    console.log('Counts:', counts);

    // Handle empty data case
    if (years.length === 0) {
        console.log('No data to display in years chart');
        return;
    }

    // Create new Chart.js horizontal bar chart
    projectYearsChart = new Chart(context, {
        type: 'bar',    // Chart type
        data: {
            labels: years,      // X-axis labels (years)
            datasets: [{
                data: counts,               // Y-axis values (project counts)
                backgroundColor: '#3c5e49', // Bar fill color (dark green)
                borderColor: '#2F5441',     // Bar border color (darker green)
                borderWidth: 1              // Border width
            }]
        },
        options: {
            indexAxis: 'y',           // Makes bars horizontal instead of vertical
            responsive: true,         // Resize chart with container
            maintainAspectRatio: false, // Allow flexible aspect ratio
            plugins: {
                legend: {
                    display: false    // Hide legend (not needed for single dataset)
                },
                tooltip: {
                    callbacks: {
                        // Custom tooltip formatting
                        label: function(context) {
                            return `${context.parsed.x} projects`;
                        }
                    }
                },
                datalabels: {
                    anchor: 'end',       // Position labels at end of bars
                    align: 'right',      // Align text to right
                    color: 'white',      // White text color
                    font: {
                        weight: 'bold',  // Bold font weight
                        size: 11         // Font size
                    },
                    formatter: function(value) {
                        return value;    // Display the actual value
                    },
                    offset: -10         // Offset from anchor point
                }
            },
            scales: {
                x: {
                    beginAtZero: true,   // Start X-axis at zero
                    ticks: {
                        stepSize: 1,     // Step size for X-axis
                        font: {
                            size: 10     // Font size for X-axis labels
                        }
                    }
                },
                y: {
                    ticks: {
                        font: {
                            size: 10     // Font size for Y-axis labels
                        }
                    }
                }
            }
        },
        // Custom plugin to draw value labels inside bars
        plugins: [{
            afterDatasetsDraw: function(chart) {
                const ctx = chart.ctx;
                chart.data.datasets.forEach((dataset, i) => {
                    const meta = chart.getDatasetMeta(i);
                    meta.data.forEach((bar, index) => {
                        const data = dataset.data[index];

                        // Set text styling
                        ctx.fillStyle = 'white';
                        ctx.font = 'bold 11px sans-serif';
                        ctx.textAlign = 'right';
                        ctx.textBaseline = 'middle';

                        // Position text inside the bar, right-justified
                        const x = bar.x - 8;
                        const y = bar.y;

                        ctx.fillText(data, x, y);
                    });
                });
            }
        }]
    });
}

/**
 * Creates or updates the pie chart showing awarded vs current projects
 * This function also updates the legend values and total count display
 */
function createProjectsPieChart() {
    // Get canvas context for pie chart
    const ctx = document.getElementById('projectsPieChart').getContext('2d');

    // Destroy existing chart if it exists (prevents memory leaks)
    if (projectsPieChart) {
        projectsPieChart.destroy();
    }

    // Update the total count and legend displays
    const total = projectCounts.awarded + projectCounts.current;
    document.getElementById('totalProjectCount').textContent = total.toLocaleString();
    document.getElementById('awardedCount').textContent = projectCounts.awarded.toLocaleString();
    document.getElementById('currentCount').textContent = projectCounts.current.toLocaleString();

    // Create new Chart.js pie chart
    projectsPieChart = new Chart(ctx, {
        type: 'pie',    // Chart type
        data: {
            labels: ['Awarded Projects', 'Current Projects'],  // Slice labels
            datasets: [{
                data: [projectCounts.awarded, projectCounts.current],  // Slice values
                backgroundColor: [
                    '#71716C', // Gray for awarded projects
                    '#2F5441'  // Dark green for current projects
                ],
                borderColor: '#ffffff',    // White border between slices
                borderWidth: 2            // Border width
            }]
        },
        options: {
            responsive: true,              // Resize with container
            maintainAspectRatio: true,     // Keep aspect ratio
            plugins: {
                legend: {
                    display: false         // Hide default legend (using custom legend)
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const total = projectCounts.awarded + projectCounts.current;
                            const percentage = total > 0 ? Math.round((context.parsed / total) * 100) : 0;
                            return context.label + ': ' + context.parsed.toLocaleString() + ' (' + percentage + '%)';
                        }
                    }
                }
            }
        }
    });
}

// Update project counts and refresh chart
function updateProjectCounts(type, count) {
    projectCounts[type] = count;
    createProjectsPieChart();
}

// Basemap control functions
function createBasemapControl(map) {
    const control = L.control({ position: 'topright' });

    control.onAdd = function() {
        const div = L.DomUtil.create('div', 'basemap-control');

        div.innerHTML = `
            <button class="basemap-toggle-btn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                </svg>
            </button>
            <div class="basemap-menu">
                ${Object.keys(basemaps).map(name =>
                    `<button class="basemap-option ${name === currentBasemap ? 'active' : ''}" data-basemap="${name}">
                        ${name}
                    </button>`
                ).join('')}
            </div>
        `;

        // Prevent map events when clicking on control
        L.DomEvent.disableClickPropagation(div);
        L.DomEvent.disableScrollPropagation(div);

        // Toggle menu visibility
        const toggleBtn = div.querySelector('.basemap-toggle-btn');
        const menu = div.querySelector('.basemap-menu');

        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            menu.classList.toggle('show');
        });

        // Close menu when clicking outside
        document.addEventListener('click', () => {
            menu.classList.remove('show');
        });

        // Handle basemap selection
        menu.addEventListener('click', (e) => {
            if (e.target.classList.contains('basemap-option')) {
                const selectedBasemap = e.target.dataset.basemap;
                switchBasemap(map, selectedBasemap);

                // Update active state
                menu.querySelectorAll('.basemap-option').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');

                menu.classList.remove('show');
            }
        });

        return div;
    };

    return control;
}

// District filter control functions
function createDistrictFilterControl(map) {
    const control = L.control({ position: 'topright' });

    control.onAdd = function() {
        const div = L.DomUtil.create('div', 'district-filter-control');

        div.innerHTML = `
            <button class="district-filter-btn">
                🗺️
            </button>
            <div class="district-filter-menu">
                <div class="district-filter-header">
                    <span>Filter by District</span>
                    <button class="clear-filter-btn" title="Clear Filter">×</button>
                </div>
                <div class="district-options-container">
                    <div class="loading-districts">Loading districts...</div>
                </div>
            </div>
        `;

        // Prevent map events when clicking on control
        L.DomEvent.disableClickPropagation(div);
        L.DomEvent.disableScrollPropagation(div);

        // Toggle menu visibility
        const toggleBtn = div.querySelector('.district-filter-btn');
        const menu = div.querySelector('.district-filter-menu');

        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            menu.classList.toggle('show');

            // Load districts when menu is opened for the first time
            if (menu.classList.contains('show') && !menu.dataset.loaded) {
                loadDistrictOptions(div);
                menu.dataset.loaded = 'true';
            }
        });

        // Close menu when clicking outside
        document.addEventListener('click', () => {
            menu.classList.remove('show');
        });

        // Clear filter button
        const clearBtn = div.querySelector('.clear-filter-btn');
        clearBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            clearDistrictFilter(map);
            menu.classList.remove('show');
        });

        return div;
    };

    return control;
}

// Clear All Filters control function
function createClearAllControl(map) {
    const control = L.control({ position: 'topright' });

    control.onAdd = function() {
        const div = L.DomUtil.create('div', 'clear-all-control');

        div.innerHTML = `
            <button class="clear-all-btn" title="Clear All Filters">CLR</button>
        `;

        // Prevent map events when clicking on control
        L.DomEvent.disableClickPropagation(div);
        L.DomEvent.disableScrollPropagation(div);

        // Clear all filters button
        const clearAllBtn = div.querySelector('.clear-all-btn');
        clearAllBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            clearAllFilters(map);
        });

        return div;
    };

    return control;
}

// Project Type filter control function
function createProjectTypeFilterControl(map) {
    const control = L.control({ position: 'topright' });

    control.onAdd = function() {
        const div = L.DomUtil.create('div', 'project-type-filter-control');

        div.innerHTML = `
            <button class="project-type-filter-btn">
                <img src="images/road-location-icon.png" alt="Project Type Filter" width="16" height="16" style="opacity: 0.7;">
            </button>
            <div class="project-type-filter-menu">
                <div class="project-type-filter-header">
                    <span>Filter by Project Type</span>
                    <button class="clear-project-type-filter-btn" title="Clear Filter">×</button>
                </div>
                <div class="project-type-search-container">
                    <input type="text" class="project-type-search-input" placeholder="Type project type..." autocomplete="off">
                    <div class="project-type-options-container">
                        <div class="loading-project-types">Loading project types...</div>
                    </div>
                </div>
            </div>
        `;

        // Prevent map events when clicking on control
        L.DomEvent.disableClickPropagation(div);
        L.DomEvent.disableScrollPropagation(div);

        // Toggle menu visibility
        const toggleBtn = div.querySelector('.project-type-filter-btn');
        const menu = div.querySelector('.project-type-filter-menu');

        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            menu.classList.toggle('show');

            // Load project types when menu is opened for the first time
            if (menu.classList.contains('show') && !menu.dataset.loaded) {
                loadProjectTypeOptions(div);
                menu.dataset.loaded = 'true';

                // Focus the search input
                const searchInput = div.querySelector('.project-type-search-input');
                setTimeout(() => searchInput.focus(), 100);
            }
        });

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!div.contains(e.target)) {
                menu.classList.remove('show');
            }
        });

        // Clear filter button
        const clearBtn = div.querySelector('.clear-project-type-filter-btn');
        clearBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            clearProjectTypeFilter(map);
            menu.classList.remove('show');
        });

        return div;
    };

    return control;
}

// Load project type options from database
function loadProjectTypeOptions(controlDiv) {
    if (!database) {
        const container = controlDiv.querySelector('.project-type-options-container');
        container.innerHTML = '<div class="error-message">Database not loaded</div>';
        return;
    }

    try {
        console.log('Loading project types from database...');

        // Query the crosswalk table to get project type categories
        const stmt = database.prepare("SELECT DISTINCT dropdown_category, dropdown_display_name FROM crosswalk ORDER BY dropdown_category");
        const projectTypes = [];

        while (stmt.step()) {
            const row = stmt.getAsObject();
            if (row.dropdown_category && row.dropdown_category !== '') {
                projectTypes.push({
                    category: row.dropdown_category,
                    display: row.dropdown_display_name || row.dropdown_category
                });
            }
        }

        console.log('Found project types:', projectTypes);

        const container = controlDiv.querySelector('.project-type-options-container');
        const searchInput = controlDiv.querySelector('.project-type-search-input');

        // Create options HTML
        const optionsHTML = projectTypes.map(type =>
            `<div class="project-type-option" data-value="${type.category}">${type.display}</div>`
        ).join('');

        container.innerHTML = optionsHTML;

        // Add search functionality
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const options = container.querySelectorAll('.project-type-option');

            options.forEach(option => {
                const text = option.textContent.toLowerCase();
                const matches = text.includes(searchTerm);
                option.style.display = matches ? 'block' : 'none';
            });
        });

        // Add click handlers to options
        const options = container.querySelectorAll('.project-type-option');
        options.forEach(option => {
            option.addEventListener('click', () => {
                const projectType = option.dataset.value;
                const displayName = option.textContent;

                // Update the button to show selected project type with icon
                const btn = controlDiv.querySelector('.project-type-filter-btn');
                btn.innerHTML = `
                    <img src="images/road-location-icon.png" alt="Project Type Filter" width="16" height="16" style="opacity: 1;">
                    <div style="position: absolute; top: -2px; right: -2px; width: 8px; height: 8px; background: #244332; border-radius: 50%; border: 1px solid white;"></div>
                `;
                btn.title = `Filtered by: ${displayName}`;

                // Apply the filter
                applyProjectTypeFilter(map, projectType);

                // Close the menu
                const menu = controlDiv.querySelector('.project-type-filter-menu');
                menu.classList.remove('show');
            });
        });

    } catch (error) {
        console.error('Error loading project types:', error);
        const container = controlDiv.querySelector('.project-type-options-container');
        container.innerHTML = '<div class="error-message">Error loading project types</div>';
    }
}

// Apply project type filter
function applyProjectTypeFilter(map, projectType) {
    console.log('Applying project type filter:', projectType);

    // Update global filter state
    currentProjectTypeFilter = projectType;

    // Update panel titles to reflect the filter
    updatePanelTitles();

    // Check if layers exist
    console.log('Current projects layer exists:', !!currentProjectsLayer);
    console.log('Awarded projects layer exists:', !!awardedProjectsLayer);

    // Apply to map layers
    if (currentProjectsLayer) {
        console.log('Filtering current projects layer...');
        let matchCount = 0;
        let totalCount = 0;

        currentProjectsLayer.eachLayer(function(layer) {
            totalCount++;
            if (layer.feature && layer.feature.properties) {
                const projectProps = layer.feature.properties;

                // Check if project matches the selected type using crosswalk
                const matchesType = checkProjectTypeMatch(projectProps, projectType);

                if (matchesType) {
                    matchCount++;
                    layer.setStyle({
                        fillOpacity: 0.7,
                        opacity: 0.8
                    });
                } else {
                    layer.setStyle({
                        fillOpacity: 0.1,
                        opacity: 0.3
                    });
                }
            }
        });

        console.log(`Current projects: ${matchCount} matches out of ${totalCount} total`);
    }

    if (awardedProjectsLayer) {
        console.log('Filtering awarded projects layer...');
        let matchCount = 0;
        let totalCount = 0;

        awardedProjectsLayer.eachLayer(function(layer) {
            totalCount++;
            if (layer.feature && layer.feature.properties) {
                const projectProps = layer.feature.properties;

                // Check if project matches the selected type using crosswalk
                const matchesType = checkProjectTypeMatch(projectProps, projectType);

                if (matchesType) {
                    matchCount++;
                    layer.setStyle({
                        fillOpacity: 0.7,
                        opacity: 0.8
                    });
                } else {
                    layer.setStyle({
                        fillOpacity: 0.1,
                        opacity: 0.3
                    });
                }
            }
        });

        console.log(`Awarded projects: ${matchCount} matches out of ${totalCount} total`);
    }

    // Update charts and table
    updateChartsAndTable();
}

// Check if project matches the selected type using crosswalk
function checkProjectTypeMatch(projectProps, selectedType) {
    if (!database) return false;

    try {
        // Get the raw project type from the project data - use the correct GeoJSON property name
        const rawProjectType = projectProps.KYTCDynamic_HighwaysDBOTED_CHIPS_ACTIVEPLANSYP_RPT_TYPEWORK ||
                             projectProps.TYPE_WORK ||
                             projectProps.type_work ||
                             projectProps.project_type ||
                             projectProps.PROJECT_TYPE || '';

        if (!rawProjectType) {
            console.log('No project type found in properties:', Object.keys(projectProps));
            return false;
        }

        // Query crosswalk table to find the dropdown category for this raw project type
        const stmt = database.prepare("SELECT dropdown_category FROM crosswalk WHERE raw_project_type = ?");
        stmt.bind([rawProjectType]);

        if (stmt.step()) {
            const row = stmt.getAsObject();
            const matches = row.dropdown_category === selectedType;
            console.log(`Checking match: ${rawProjectType} -> ${row.dropdown_category} === ${selectedType} = ${matches}`);
            return matches;
        }

        console.log(`No crosswalk entry found for project type: ${rawProjectType}`);
        return false;
    } catch (error) {
        console.error('Error checking project type match:', error);
        return false;
    }
}

// Clear project type filter
function clearProjectTypeFilter(map) {
    console.log('Clearing project type filter');

    // Reset global filter state
    currentProjectTypeFilter = null;

    // Update panel titles to reflect cleared filters
    updatePanelTitles();

    // Reset map layers
    if (currentProjectsLayer) {
        currentProjectsLayer.eachLayer(function(layer) {
            layer.setStyle({
                fillOpacity: 0.7,
                opacity: 0.8
            });
        });
    }

    if (awardedProjectsLayer) {
        awardedProjectsLayer.eachLayer(function(layer) {
            layer.setStyle({
                fillOpacity: 0.7,
                opacity: 0.8
            });
        });
    }

    // Reset button to default state
    const btn = document.querySelector('.project-type-filter-btn');
    if (btn) {
        btn.innerHTML = `
            <img src="images/road-location-icon.png" alt="Project Type Filter" width="16" height="16" style="opacity: 0.7;">
        `;
        btn.title = "Project Type Filter";
    }

    // Update charts and table
    updateChartsAndTable();
}

// County filter control function
function createCountyFilterControl(map) {
    const control = L.control({ position: 'topright' });

    control.onAdd = function() {
        const div = L.DomUtil.create('div', 'county-filter-control');

        div.innerHTML = `
            <button class="county-filter-btn">
                🏘️
            </button>
            <div class="county-filter-menu">
                <div class="county-filter-header">
                    <span>Filter by County</span>
                    <button class="clear-county-filter-btn" title="Clear Filter">×</button>
                </div>
                <div class="county-search-container">
                    <input type="text" class="county-search-input" placeholder="Type county name..." autocomplete="off">
                    <div class="county-options-container">
                        <div class="loading-counties">Loading counties...</div>
                    </div>
                </div>
            </div>
        `;

        // Prevent map events when clicking on control
        L.DomEvent.disableClickPropagation(div);
        L.DomEvent.disableScrollPropagation(div);

        // Toggle menu visibility
        const toggleBtn = div.querySelector('.county-filter-btn');
        const menu = div.querySelector('.county-filter-menu');

        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            menu.classList.toggle('show');

            // Load counties when menu is opened for the first time
            if (menu.classList.contains('show') && !menu.dataset.loaded) {
                loadCountyOptions(div);
                menu.dataset.loaded = 'true';

                // Focus the search input
                const searchInput = div.querySelector('.county-search-input');
                setTimeout(() => searchInput.focus(), 100);
            }
        });

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!div.contains(e.target)) {
                menu.classList.remove('show');
            }
        });

        // Clear filter button
        const clearBtn = div.querySelector('.clear-county-filter-btn');
        clearBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            clearCountyFilter(map);
            menu.classList.remove('show');
        });

        return div;
    };

    return control;
}

// Load county options from database
function loadCountyOptions(controlDiv) {
    if (!database) {
        const container = controlDiv.querySelector('.county-options-container');
        container.innerHTML = '<div class="error-message">Database not loaded</div>';
        return;
    }

    try {
        console.log('Loading counties from database...');

        // Query the Basic_Project_Info table to get actual county names used in project data
        const stmt = database.prepare("SELECT DISTINCT COUNTY FROM Basic_Project_Info WHERE COUNTY IS NOT NULL AND COUNTY != '' ORDER BY COUNTY");
        const counties = [];

        while (stmt.step()) {
            const row = stmt.getAsObject();
            if (row.COUNTY && row.COUNTY !== '') {
                counties.push(row.COUNTY);
            }
        }
        stmt.free();

        console.log('Counties found:', counties.length, counties.slice(0, 10)); // Log first 10 for verification

        const container = controlDiv.querySelector('.county-options-container');
        const searchInput = controlDiv.querySelector('.county-search-input');

        if (counties.length === 0) {
            container.innerHTML = '<div class="error-message">No counties found in database</div>';
            return;
        }

        // Store counties for autocomplete
        window.allCounties = counties;

        // Display all counties initially
        displayCountyOptions(counties, container, controlDiv);

        // Add search functionality
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const filteredCounties = counties.filter(county =>
                county.toLowerCase().includes(searchTerm)
            );
            displayCountyOptions(filteredCounties, container, controlDiv);
        });

        // Prevent dropdown from closing when clicking on search input
        searchInput.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // Prevent dropdown from closing when typing in search input
        searchInput.addEventListener('keydown', (e) => {
            e.stopPropagation();
        });

    } catch (error) {
        console.error('Error loading counties:', error);
        const container = controlDiv.querySelector('.county-options-container');
        container.innerHTML = '<div class="error-message">Error loading counties: ' + error.message + '</div>';
    }
}

// Display county options in the dropdown
function displayCountyOptions(counties, container, controlDiv) {
    if (counties.length === 0) {
        container.innerHTML = '<div class="no-results">No counties found</div>';
        return;
    }

    container.innerHTML = counties.map(county =>
        `<button class="county-option" data-county="${county}">
            ${county}
        </button>`
    ).join('');

    // Add click handlers for county options
    container.addEventListener('click', (e) => {
        if (e.target.classList.contains('county-option')) {
            const selectedCounty = e.target.dataset.county;
            applyCountyFilter(selectedCounty);

            // Update visual state
            container.querySelectorAll('.county-option').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');

            // Update search input
            const searchInput = controlDiv.querySelector('.county-search-input');
            searchInput.value = selectedCounty;

            // Close menu
            controlDiv.querySelector('.county-filter-menu').classList.remove('show');
        }
    });
}

// Load district options from database
function loadDistrictOptions(controlDiv) {
    if (!database) {
        const container = controlDiv.querySelector('.district-options-container');
        container.innerHTML = '<div class="error-message">Database not loaded</div>';
        return;
    }

    try {
        // First, let's check what columns are in KYTC_Districts table
        const columnsStmt = database.prepare("PRAGMA table_info(KYTC_Districts)");
        const columns = [];
        while (columnsStmt.step()) {
            const row = columnsStmt.getAsObject();
            columns.push(row.name);
        }
        columnsStmt.free();

        console.log('KYTC_Districts table columns:', columns);

        let districts = [];

        // Try to get districts from KYTC_Districts table using the correct column name
        try {
            // Try different possible column names
            let query = "";
            if (columns.includes('Name')) {
                query = "SELECT DISTINCT Name FROM KYTC_Districts WHERE Name IS NOT NULL ORDER BY Name";
            } else if (columns.includes('DISTRICT')) {
                query = "SELECT DISTINCT DISTRICT FROM KYTC_Districts WHERE DISTRICT IS NOT NULL ORDER BY DISTRICT";
            } else if (columns.includes('district')) {
                query = "SELECT DISTINCT district FROM KYTC_Districts WHERE district IS NOT NULL ORDER BY district";
            } else {
                throw new Error('No suitable district column found in KYTC_Districts table');
            }

            console.log('Using query:', query);
            const stmt = database.prepare(query);
            while (stmt.step()) {
                const row = stmt.getAsObject();
                const districtValue = row.Name || row.DISTRICT || row.district;
                if (districtValue) {
                    // Extract district number if the name is like "District 1", "District 2", etc.
                    const match = districtValue.toString().match(/(\d+)/);
                    if (match) {
                        const districtNum = parseInt(match[1]);
                        // Only include valid district numbers (1-12)
                        if (districtNum >= 1 && districtNum <= 12) {
                            districts.push(districtNum);
                        }
                    }
                }
            }
            stmt.free();
            console.log('Districts found from KYTC_Districts:', districts);
        } catch (error) {
            console.log('Could not get districts from KYTC_Districts:', error.message);

            // Fallback: try Basic_Project_Info
            try {
                const stmt = database.prepare("SELECT DISTINCT DISTRICT FROM Basic_Project_Info WHERE DISTRICT IS NOT NULL ORDER BY DISTRICT");
                while (stmt.step()) {
                    const row = stmt.getAsObject();
                    if (row.DISTRICT) {
                        districts.push(row.DISTRICT);
                    }
                }
                stmt.free();
                console.log('Districts found from Basic_Project_Info:', districts);
            } catch (basicError) {
                console.log('Could not get districts from Basic_Project_Info:', basicError.message);
            }
        }

        const container = controlDiv.querySelector('.district-options-container');

        if (districts.length === 0) {
            container.innerHTML = '<div class="error-message">No districts found in database</div>';
            return;
        }

        // Remove duplicates and sort numerically
        const uniqueDistricts = [...new Set(districts)].sort((a, b) => a - b);

        // Create district options
        container.innerHTML = uniqueDistricts.map(district =>
            `<button class="district-option" data-district="${district}">
                District ${district}
            </button>`
        ).join('');

        // Add click handlers for district options
        container.addEventListener('click', (e) => {
            if (e.target.classList.contains('district-option')) {
                const selectedDistrict = e.target.dataset.district;
                applyDistrictFilter(selectedDistrict);

                // Update visual state
                container.querySelectorAll('.district-option').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');

                // Close menu
                controlDiv.querySelector('.district-filter-menu').classList.remove('show');
            }
        });

    } catch (error) {
        console.error('Error loading districts:', error);
        const container = controlDiv.querySelector('.district-options-container');
        container.innerHTML = '<div class="error-message">Error loading districts: ' + error.message + '</div>';
    }
}

// Apply county filter
function applyCountyFilter(countyName) {
    console.log('Applying county filter:', countyName);

    currentCountyFilter = countyName;

    // Update the county filter button to show active state with dot indicator
    const btn = document.querySelector('.county-filter-btn');
    if (btn) {
        btn.innerHTML = `
            🏘️
            <div style="position: absolute; top: -2px; right: -2px; width: 8px; height: 8px; background: #244332; border-radius: 50%; border: 1px solid white;"></div>
        `;
        btn.title = `Filtered by: ${countyName} County`;
    }

    // Update panel titles to reflect the filter
    updatePanelTitles();

    // Zoom to county boundary
    zoomToCounty(countyName);

    // Update charts with filtered data
    loadFilteredProjectsAwardedDataByCounty(countyName);
    loadFilteredProjectCountByYearByCounty(countyName);

    // Update table with filtered data
    loadFilteredBasicProjectInfoByCounty(countyName);
}

// Clear county filter
function clearCountyFilter(map) {
    console.log('Clearing county filter');

    currentCountyFilter = null;

    // Update panel titles to reflect cleared filters
    updatePanelTitles();

    // Reset map view to original position and zoom
    if (window.mainMap) {
        // Reset to original Kentucky view
        window.mainMap.setView([37.8, -85.0], 7);

        // Alternative: If we have the projects layer, fit to its bounds
        if (window.allProjectsLayer) {
            console.log('Fitting map to all projects bounds');
            window.mainMap.fitBounds(window.allProjectsLayer.getBounds());
        }
    }

    // Reload data (this will respect any remaining district or project type filters)
    if (currentDistrictFilter) {
        loadFilteredProjectsAwardedData(currentDistrictFilter);
        loadFilteredProjectCountByYear(currentDistrictFilter);
        loadFilteredBasicProjectInfo(currentDistrictFilter);
    } else {
        loadProjectsAwardedData();
        loadProjectCountByYear();
        loadBasicProjectInfo();
    }

    // Clear active states from county options only
    document.querySelectorAll('.county-option').forEach(btn => btn.classList.remove('active'));

    // Reset the county filter button to its original state
    const btn = document.querySelector('.county-filter-btn');
    if (btn) {
        btn.innerHTML = '🏘️';
        btn.title = 'County Filter';
    }

    // Clear search input
    document.querySelectorAll('.county-search-input').forEach(input => input.value = '');

    console.log('County filter cleared');
}

// Zoom to specific county
function zoomToCounty(countyName) {
    console.log('Attempting to zoom to county:', countyName);
    console.log('Available county layers:', Object.keys(countyLayers));
    console.log('Total county layers available:', Object.keys(countyLayers).length);

    // Try to find a match with different case variations
    const exactMatch = countyLayers[countyName];
    const upperMatch = countyLayers[countyName.toUpperCase()];
    const lowerMatch = countyLayers[countyName.toLowerCase()];
    const titleMatch = countyLayers[countyName.charAt(0).toUpperCase() + countyName.slice(1).toLowerCase()];

    console.log('Exact match:', exactMatch ? 'Found' : 'Not found');
    console.log('Upper match:', upperMatch ? 'Found' : 'Not found');
    console.log('Lower match:', lowerMatch ? 'Found' : 'Not found');
    console.log('Title match:', titleMatch ? 'Found' : 'Not found');

    // Try each match in order
    let foundLayer = exactMatch || upperMatch || lowerMatch || titleMatch;

    if (foundLayer) {
        console.log(`Zooming to ${countyName} County using found layer`);
        window.mainMap.fitBounds(foundLayer.getBounds());
    } else {
        console.warn(`County ${countyName} layer not found for zooming`);
        console.log('Available counties (first 10):', Object.keys(countyLayers).slice(0, 10));

        // Try to find partial matches
        const partialMatches = Object.keys(countyLayers).filter(key =>
            key.toLowerCase().includes(countyName.toLowerCase()) ||
            countyName.toLowerCase().includes(key.toLowerCase())
        );
        console.log('Partial matches:', partialMatches);

        if (partialMatches.length > 0) {
            console.log(`Trying to zoom using partial match: ${partialMatches[0]}`);
            window.mainMap.fitBounds(countyLayers[partialMatches[0]].getBounds());
        }
    }
}

// Apply district filter
function applyDistrictFilter(districtNumber) {
    console.log('Applying district filter:', districtNumber);

    currentDistrictFilter = districtNumber;

    // Update the district filter button to show active state with dot indicator
    const btn = document.querySelector('.district-filter-btn');
    if (btn) {
        btn.innerHTML = `
            🗺️
            <div style="position: absolute; top: -2px; right: -2px; width: 8px; height: 8px; background: #244332; border-radius: 50%; border: 1px solid white;"></div>
        `;
        btn.title = `Filtered by: District ${districtNumber}`;
    }

    // Update panel titles to reflect the filter
    updatePanelTitles();

    // Zoom to district boundary
    zoomToDistrict(districtNumber);

    // Update charts with filtered data
    loadFilteredProjectsAwardedData(districtNumber);
    loadFilteredProjectCountByYear(districtNumber);

    // Update table with filtered data
    loadFilteredBasicProjectInfo(districtNumber);
}

// Clear district filter
function clearDistrictFilter(map) {
    console.log('Clearing district filter');

    currentDistrictFilter = null;

    // Reset the district filter button to default state
    const btn = document.querySelector('.district-filter-btn');
    if (btn) {
        btn.innerHTML = '🗺️';
        btn.title = 'District Filter';
    }

    // Update panel titles to reflect cleared filters
    updatePanelTitles();

    // Reset map view to original position and zoom
    if (window.mainMap) {
        // Reset to original Kentucky view
        window.mainMap.setView([37.8, -85.0], 7);

        // Alternative: If we have the projects layer, fit to its bounds
        if (window.allProjectsLayer) {
            console.log('Fitting map to all projects bounds');
            window.mainMap.fitBounds(window.allProjectsLayer.getBounds());
        }
    }

    // Reload data (this will respect any remaining county or project type filters)
    if (currentCountyFilter) {
        loadFilteredProjectsAwardedDataByCounty(currentCountyFilter);
        loadFilteredProjectCountByYearByCounty(currentCountyFilter);
        loadFilteredBasicProjectInfoByCounty(currentCountyFilter);
    } else {
        loadProjectsAwardedData();
        loadProjectCountByYear();
        loadBasicProjectInfo();
    }

    // Clear active states from district options only
    document.querySelectorAll('.district-option').forEach(btn => btn.classList.remove('active'));

    console.log('District filter cleared');
}

// Clear all filters function
function clearAllFilters(map) {
    console.log('Clearing all filters (district, county, and project type)');

    // Clear all filter states
    currentDistrictFilter = null;
    currentCountyFilter = null;
    currentProjectTypeFilter = null;

    // Update panel titles to reflect cleared filters
    updatePanelTitles();

    // Reset map view to original position and zoom
    if (window.mainMap) {
        // Reset to original Kentucky view
        window.mainMap.setView([37.8, -85.0], 7);

        // Alternative: If we have the projects layer, fit to its bounds
        if (window.allProjectsLayer) {
            console.log('Fitting map to all projects bounds');
            window.mainMap.fitBounds(window.allProjectsLayer.getBounds());
        }
    }

    // Reset map layers for project type filter
    if (currentProjectsLayer) {
        currentProjectsLayer.eachLayer(function(layer) {
            layer.setStyle({
                fillOpacity: 0.7,
                opacity: 0.8
            });
        });
    }

    if (awardedProjectsLayer) {
        awardedProjectsLayer.eachLayer(function(layer) {
            layer.setStyle({
                fillOpacity: 0.7,
                opacity: 0.8
            });
        });
    }

    // Reset project type button to default state
    const projectTypeBtn = document.querySelector('.project-type-filter-btn');
    if (projectTypeBtn) {
        projectTypeBtn.innerHTML = `
            <img src="images/road-location-icon.png" alt="Project Type Filter" width="16" height="16" style="opacity: 0.7;">
        `;
        projectTypeBtn.title = "Project Type Filter";
    }

    // Reset district filter button to default state
    const districtBtn = document.querySelector('.district-filter-btn');
    if (districtBtn) {
        districtBtn.innerHTML = '🏛️';
        districtBtn.title = 'District Filter';
    }

    // Reset county filter button to default state
    const countyBtn = document.querySelector('.county-filter-btn');
    if (countyBtn) {
        countyBtn.innerHTML = '🏘️';
        countyBtn.title = 'County Filter';
    }

    // Reload original data
    loadProjectsAwardedData();
    loadProjectCountByYear();
    loadBasicProjectInfo();

    // Clear active states from all filter options
    document.querySelectorAll('.district-option').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.county-option').forEach(btn => btn.classList.remove('active'));

    // Clear search inputs
    document.querySelectorAll('.county-search-input').forEach(input => input.value = '');

    console.log('All filters cleared and data reset to original state');
}

// Zoom to specific district
function zoomToDistrict(districtNumber) {
    console.log('Attempting to zoom to district:', districtNumber);
    console.log('Available district layers:', Object.keys(districtLayers));
    console.log('All district layers object:', districtLayers);

    // Convert districtNumber to both number and string to try both
    const numKey = parseInt(districtNumber);
    const strKey = districtNumber.toString();

    console.log('Looking for district with keys:', numKey, 'and', strKey);

    // Find the district layer and zoom to its bounds
    if (districtLayers[numKey]) {
        console.log(`Zooming to District ${numKey} (number key)`);
        window.mainMap.fitBounds(districtLayers[numKey].getBounds());
    } else if (districtLayers[strKey]) {
        console.log(`Zooming to District ${strKey} (string key)`);
        window.mainMap.fitBounds(districtLayers[strKey].getBounds());
    } else {
        console.warn(`No district layer found for District ${districtNumber}`);
        console.warn('Available district keys:', Object.keys(districtLayers));
        console.warn('Available district layers count:', Object.keys(districtLayers).length);

        // Try to find any layer that might match
        for (const key in districtLayers) {
            console.log(`District layer key "${key}" (type: ${typeof key}):`, districtLayers[key]);
        }
    }
}

function switchBasemap(map, basemapName) {
    // Remove current basemap
    if (map.currentBasemapLayer) {
        map.removeLayer(map.currentBasemapLayer);
    }

    // Add new basemap
    map.currentBasemapLayer = basemaps[basemapName];
    map.currentBasemapLayer.addTo(map);

    // Update current basemap reference
    currentBasemap = basemapName;
}

// GeoJSON layer loading function
function loadGeoJSONLayer(map, file, style, layerName) {
    return fetch(file)
        .then(res => res.json())
        .then(data => {
            const layer = L.geoJSON(data, {
                style: style,
                onEachFeature: (feature, layer) => {
                    const props = feature.properties || {};
                    let popupContent = '';

                    // Customize popup content based on layer type
                    if (file.includes('Highway_Plans')) {
                        // For highway projects, show project details using actual GeoJSON property names
                        const projectId = props.KYTCDynamic_HighwaysDBOTED_CHIPS_ACTIVEPLANDIST_ITEM ||
                                         props.KYTCDynamic_HighwaysDBOProject_Locations_LineIdentifier ||
                                         'Unknown';
                        const description = props.KYTCDynamic_HighwaysDBOTED_CHIPS_ACTIVEPLANSYP_RPT_DESC ||
                                          props.DESCRIPTION || 'No description available';
                        const location = props.KYTCDynamic_HighwaysDBOTED_CHIPS_ACTIVEPLANLOCUNIQUE ||
                                        props.ROUTE || '';
                        const county = props.KYTCDynamic_HighwaysDBOTED_CHIPS_ACTIVEPLANCOUNTYNAME ||
                                      props.COUNTY || '';
                        const planYear = props.KYTCDynamic_HighwaysDBOTED_CHIPS_ACTIVEPLANPLANYEAR || '';
                        const status = file.includes('Awarded') ? 'Awarded' : 'Current';

                        popupContent = `
                            <div style="font-family: Arial, sans-serif; min-width: 250px; max-width: 350px;">
                                <h4 style="margin: 0 0 10px 0; color: ${file.includes('Awarded') ? '#0066cc' : '#006600'};">
                                    ${status} Highway Project
                                </h4>
                                <p><strong>Project ID:</strong> ${projectId}</p>
                                ${county ? `<p><strong>County:</strong> ${county}</p>` : ''}
                                ${location ? `<p><strong>Location:</strong> ${location}</p>` : ''}
                                ${planYear ? `<p><strong>Plan Year:</strong> ${planYear}</p>` : ''}
                                <p><strong>Description:</strong> ${description}</p>
                            </div>
                        `;
                    } else if (file.includes('KY_Counties')) {
                        // For counties, show county name
                        const countyName = props.COUNTY || props.NAME || props.COUNTY_NAME || 'Unknown County';
                        popupContent = `<strong>${countyName} County</strong>`;
                    } else if (file.includes('KYTC_Districts')) {
                        // For districts, show district information
                        const districtNum = props.DISTNBR || props.DISTRICT || props.NUMBER || 'Unknown';
                        popupContent = `<strong>KYTC District ${districtNum}</strong>`;
                    } else {
                        // Fallback for other layers
                        const desc = props.DESCRIPTION || props.NAME || layerName;
                        popupContent = `<strong>${desc}</strong>`;
                    }

                    layer.bindPopup(popupContent);
                }
            }).addTo(map);

            // Special handling for districts - group features by district number
            if (file.includes('KYTC_Districts')) {
                console.log('Processing KYTC_Districts for zoom functionality...');

                // Group features by district number
                const districtGroups = {};

                data.features.forEach(feature => {
                    const districtNum = feature.properties.DISTNBR;
                    if (districtNum !== undefined && districtNum !== null) {
                        if (!districtGroups[districtNum]) {
                            districtGroups[districtNum] = [];
                        }
                        districtGroups[districtNum].push(feature);
                    }
                });

                // Create layer groups for each district
                Object.keys(districtGroups).forEach(districtNum => {
                    const districtFeatures = districtGroups[districtNum];
                    const districtLayer = L.geoJSON({
                        type: 'FeatureCollection',
                        features: districtFeatures
                    });

                    // Store with both number and string keys
                    districtLayers[districtNum] = districtLayer;
                    districtLayers[districtNum.toString()] = districtLayer;

                    console.log(`Created district layer for District ${districtNum} with ${districtFeatures.length} features`);
                });

                console.log('Finished processing districts. Total district layers:', Object.keys(districtLayers).length / 2); // Divide by 2 because we store both number and string keys
            }

            // Special handling for counties - group features by county name
            if (file.includes('KY_Counties')) {
                console.log('Processing KY_Counties for zoom functionality...');

                // Group features by county name
                const countyGroups = {};

                data.features.forEach(feature => {
                    const countyName = feature.properties.COUNTY || feature.properties.NAME;
                    if (countyName) {
                        if (!countyGroups[countyName]) {
                            countyGroups[countyName] = [];
                        }
                        countyGroups[countyName].push(feature);
                    }
                });

                // Create layer groups for each county
                Object.keys(countyGroups).forEach(countyName => {
                    const countyFeatures = countyGroups[countyName];
                    const countyLayer = L.geoJSON({
                        type: 'FeatureCollection',
                        features: countyFeatures
                    });

                    // Store county layer
                    countyLayers[countyName] = countyLayer;

                    console.log(`Created county layer for ${countyName} County with ${countyFeatures.length} features`);
                });

                console.log('Finished processing counties. Total county layers:', Object.keys(countyLayers).length);
            }

            return layer;
        })
        .catch(err => {
            console.error(`Failed to load ${layerName}:`, err);
            return null;
        });
}

// KYTC API control function
function createKYTCAPIControl(map) {
    const control = L.control({ position: 'topright' });

    control.onAdd = function() {
        const div = L.DomUtil.create('div', 'kytc-api-control');

        div.innerHTML = `
            <button class="kytc-api-btn">
                🛣️
            </button>
        `;

        // Prevent map events when clicking on control
        L.DomEvent.disableClickPropagation(div);
        L.DomEvent.disableScrollPropagation(div);

        // Handle button click
        const apiBtn = div.querySelector('.kytc-api-btn');
        apiBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            enableKYTCAPIMode(map);
        });

        return div;
    };

    return control;
}

// Enable KYTC API selection mode
function enableKYTCAPIMode(map) {
    console.log('KYTC API mode enabled');

    // Show instruction text box
    showKYTCInstructions(map);

    // Enable project line selection mode
    enableProjectLineSelection(map);
}

// Show KYTC API instructions
function showKYTCInstructions(map) {
    // Remove existing instruction box if any
    const existingBox = document.querySelector('.kytc-instruction-box');
    if (existingBox) {
        existingBox.remove();
    }

    // Create instruction box
    const instructionBox = document.createElement('div');
    instructionBox.className = 'kytc-instruction-box';
    instructionBox.innerHTML = `
        <div class="kytc-instruction-content">
            <p>Select a project line in the map for full route information.</p>
            <div class="kytc-buttons">
                <button class="kytc-cancel-btn" title="Cancel">✕</button>
            </div>
        </div>
    `;

    // Add to the actual map element, not the map container
    const mapElement = document.querySelector('#map');
    mapElement.appendChild(instructionBox);

    // Handle cancel button
    const cancelBtn = instructionBox.querySelector('.kytc-cancel-btn');
    cancelBtn.addEventListener('click', () => {
        disableKYTCAPIMode(map);
    });
}

// Update KYTC instructions with selected values
function updateKYTCInstructionsWithValues(rtNeUnique, bmp, emp) {
    const instructionBox = document.querySelector('.kytc-instruction-box');
    if (!instructionBox) return;

    // Check if values are available
    if (!rtNeUnique || bmp === undefined || emp === undefined) {
        instructionBox.innerHTML = `
            <div class="kytc-instruction-content">
                <p style="color: #d32f2f;">Selected project is missing required route information.</p>
                <div class="kytc-buttons">
                    <button class="kytc-cancel-btn" title="Cancel">✕</button>
                </div>
            </div>
        `;
    } else {
        instructionBox.innerHTML = `
            <div class="kytc-instruction-content">
                <p><strong>Selected Route Information:</strong></p>
                <p><strong>RT_NE_Unique:</strong> ${rtNeUnique}</p>
                <p><strong>BMP:</strong> ${bmp}</p>
                <p><strong>EMP:</strong> ${emp}</p>
                <div class="kytc-buttons">
                    <button class="kytc-get-info-btn" title="Get Route Information">Get Route Info</button>
                    <button class="kytc-cancel-btn" title="Cancel">✕</button>
                </div>
            </div>
        `;

        // Add event listener for the Get Route Info button
        const getInfoBtn = instructionBox.querySelector('.kytc-get-info-btn');
        if (getInfoBtn) {
            getInfoBtn.addEventListener('click', () => {
                callKYTCAPI(rtNeUnique, bmp, emp, window.mainMap);
            });
        }
    }

    // Re-add cancel button event listener
    const cancelBtn = instructionBox.querySelector('.kytc-cancel-btn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            disableKYTCAPIMode(window.mainMap);
        });
    }
}

// Enable project line selection
function enableProjectLineSelection(map) {
    // Store original cursor
    const mapElement = map.getContainer();
    mapElement.style.cursor = 'crosshair';

    console.log('Enabling project line selection...');
    console.log('Current projects layer available:', !!currentProjectsLayer);
    console.log('Awarded projects layer available:', !!awardedProjectsLayer);

    // Add click handler to project layers
    if (currentProjectsLayer) {
        let layerCount = 0;
        currentProjectsLayer.eachLayer(function(layer) {
            layerCount++;
            layer.off('click'); // Remove existing handlers
            layer.on('click', function(e) {
                console.log('Current project layer clicked!');
                e.originalEvent.preventDefault();
                e.originalEvent.stopPropagation();
                L.DomEvent.stopPropagation(e);
                handleProjectLineSelection(e, layer, map);
            });
        });
        console.log(`Attached click handlers to ${layerCount} current project features`);
    }

    if (awardedProjectsLayer) {
        let layerCount = 0;
        awardedProjectsLayer.eachLayer(function(layer) {
            layerCount++;
            layer.off('click'); // Remove existing handlers
            layer.on('click', function(e) {
                console.log('Awarded project layer clicked!');
                e.originalEvent.preventDefault();
                e.originalEvent.stopPropagation();
                L.DomEvent.stopPropagation(e);
                handleProjectLineSelection(e, layer, map);
            });
        });
        console.log(`Attached click handlers to ${layerCount} awarded project features`);
    }
}

// Handle project line selection
function handleProjectLineSelection(e, layer, map) {
    console.log('Project line selected:', layer.feature.properties);

    // Close any existing popups to prevent interference
    map.closePopup();

    const properties = layer.feature.properties;

    // Use the correct GeoJSON property names
    const rtNeUnique = properties.KYTCDynamic_HighwaysDBOTED_CHIPS_ACTIVEPLANRT_NE_UNIQUE;
    const bmp = properties.KYTCDynamic_HighwaysDBOTED_CHIPS_ACTIVEPLANBMP;
    const emp = properties.KYTCDynamic_HighwaysDBOTED_CHIPS_ACTIVEPLANEMP;

    console.log('Extracted values:', { rtNeUnique, bmp, emp });

    // Update instruction box with the selected values
    updateKYTCInstructionsWithValues(rtNeUnique, bmp, emp);

    // Don't disable selection mode yet - let user decide what to do next
}

// Call KYTC Spatial API
async function callKYTCAPI(routeUniqueId, beginMp, endMp, map) {
    console.log('API call parameters:', { routeUniqueId, beginMp, endMp });

    const baseUrl = 'https://kytc-api-v100-lts-qrntk7e3ra-uc.a.run.app/api/route/GetRouteInfoByRouteAndTwoMilepoints';
    const params = new URLSearchParams({
        route_unique_id: routeUniqueId,
        begin_mp: beginMp,
        end_mp: endMp,
        return_m: 'False',
        return_full_geom: 'False',
        return_points: 'False',
        return_keys: 'County_Name, Route_Unique_Identifier, Route, Road_Name, Bridge_Identifier, Direction, Surface_Type, Traffic_Last_Count, Type_Operation',
        return_format: 'json',
        request_id: 'PLBNw5AuokKnX%2BUrNZcvTQ%3D%3D',
        output_epsg: '4326'
    });

    const apiUrl = `${baseUrl}?${params.toString()}`;

    try {
        console.log('Calling KYTC API:', apiUrl);
        console.log('Full API URL:', apiUrl);

        const response = await fetch(apiUrl);

        if (!response.ok) {
            console.error(`HTTP error! status: ${response.status}`);
            console.error('Response:', await response.text());
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('KYTC API response:', data);

        // Show results in popup panel
        showKYTCResults(data, map);

    } catch (error) {
        console.error('KYTC API call failed:', error);
        alert('Failed to retrieve route information. Please try again.');
    }
}

// Show KYTC API results in popup panel
function showKYTCResults(data, map) {
    // Remove existing popup if any
    const existingPopup = document.querySelector('.kytc-results-popup');
    if (existingPopup) {
        existingPopup.remove();
    }

    // Create popup panel
    const popup = document.createElement('div');
    popup.className = 'kytc-results-popup';

    // Format the data for display
    let resultsHTML = '<h6>Route Information</h6>';

    if (data && data.Route_Info && Array.isArray(data.Route_Info) && data.Route_Info.length > 0) {
        resultsHTML += '<div class="kytc-results-content">';

        // Get the first route info item (they're usually similar)
        const routeInfo = data.Route_Info[0];

        // Display summary information from the first record
        resultsHTML += `<div class="kytc-summary">
            <div class="kytc-result-item">
                <strong>County:</strong> ${routeInfo.County_Name || 'N/A'}
            </div>
            <div class="kytc-result-item">
                <strong>Route:</strong> ${routeInfo.Route || 'N/A'}
            </div>
            <div class="kytc-result-item">
                <strong>Road Name:</strong> ${routeInfo.Road_Name || 'N/A'}
            </div>
            <div class="kytc-result-item">
                <strong>Direction:</strong> ${routeInfo.Direction || 'N/A'}
            </div>
            <div class="kytc-result-item">
                <strong>Surface Type:</strong> ${routeInfo.Surface_Type || 'N/A'}
            </div>
            <div class="kytc-result-item">
                <strong>Traffic Count:</strong> ${routeInfo.Traffic_Last_Count ? routeInfo.Traffic_Last_Count.toLocaleString() : 'N/A'}
            </div>
            <div class="kytc-result-item">
                <strong>Operation Type:</strong> ${routeInfo.Type_Operation || 'N/A'}
            </div>
        </div>`;

        // Collect all bridge identifiers from all records
        const bridges = [];
        data.Route_Info.forEach(record => {
            if (record.Bridge_Identifier && Array.isArray(record.Bridge_Identifier)) {
                record.Bridge_Identifier.forEach(bridge => {
                    if (bridge && !bridges.includes(bridge)) {
                        bridges.push(bridge);
                    }
                });
            }
        });

        if (bridges.length > 0) {
            resultsHTML += `<div class="kytc-result-item">
                <strong>Bridges on Route:</strong> ${bridges.join(', ')}
            </div>`;
        }

        // Show record count
        resultsHTML += `<div class="kytc-result-item" style="margin-top: 10px; font-style: italic;">
            <strong>Total Route Segments:</strong> ${data.Route_Info.length}
        </div>`;

        resultsHTML += '</div>';
    } else {
        resultsHTML += '<p>No route information available.</p>';
    }

    // Add data license information if available
    if (data && data.Data_License_Use) {
        resultsHTML += `<div class="kytc-license" style="margin-top: 10px; font-size: 0.8em; color: #666; display: flex; justify-content: center; align-items: center; width: 100%;">
            <a href="${data.Data_License_Use}" target="_blank">Data License & Usage Terms</a>
        </div>`;
    }

    resultsHTML += `
        <div class="kytc-button-container" style="margin-top: 15px; display: flex; justify-content: center; align-items: center;">
            <button class="kytc-copy-btn" style="margin-right: 18px; padding: 4px 8px; font-size: 12px; background: #3c5e49; color: white; border: 1px solid #3c5e49; border-radius: 4px; cursor: pointer; width: 70px; height: 28px; box-sizing: border-box; display: flex; align-items: center; justify-content: center;" title="Copy route information">📋 Copy</button>
            <button class="kytc-print-btn" style="margin-right: 4px; padding: 4px 8px; font-size: 12px; background: #709072; color: white; border: 1px solid #709072; border-radius: 4px; cursor: pointer; width: 70px; height: 28px; box-sizing: border-box; display: flex; align-items: center; justify-content: center;" title="Print route information">🖨️ Print</button>
            <button class="kytc-close-btn" style="padding: 4px 8px; font-size: 12px; background: #e6ebe6; color: #2e2f2b; border: 1px solid #ccc; border-radius: 4px; cursor: pointer; width: 70px; height: 28px; box-sizing: border-box; display: flex; align-items: center; justify-content: center;">✕ Close</button>
        </div>
    `;

    popup.innerHTML = resultsHTML;

    // Add to left panels (overlaying the Project Years panel)
    document.querySelector('.left-panels').appendChild(popup);

    // Handle close button
    const closeBtn = popup.querySelector('.kytc-close-btn');
    closeBtn.addEventListener('click', () => {
        popup.remove();
        // Also close the instructions popup when results are closed
        disableKYTCAPIMode(map);
    });

    // Handle copy button
    const copyBtn = popup.querySelector('.kytc-copy-btn');
    copyBtn.addEventListener('click', () => {
        copyRouteInformation(data);
    });

    // Handle print button
    const printBtn = popup.querySelector('.kytc-print-btn');
    printBtn.addEventListener('click', () => {
        printRouteInformation(data);
    });
}

// Copy route information to clipboard
function copyRouteInformation(data) {
    if (!data || !data.Route_Info || !Array.isArray(data.Route_Info) || data.Route_Info.length === 0) {
        alert('No route information available to copy.');
        return;
    }

    const routeInfo = data.Route_Info[0];

    // Format the information as text
    let textContent = `KYTC Route Information\n`;
    textContent += `========================\n\n`;
    textContent += `County: ${routeInfo.County_Name || 'N/A'}\n`;
    textContent += `Route: ${routeInfo.Route || 'N/A'}\n`;
    textContent += `Road Name: ${routeInfo.Road_Name || 'N/A'}\n`;
    textContent += `Direction: ${routeInfo.Direction || 'N/A'}\n`;
    textContent += `Surface Type: ${routeInfo.Surface_Type || 'N/A'}\n`;
    textContent += `Traffic Count: ${routeInfo.Traffic_Last_Count ? routeInfo.Traffic_Last_Count.toLocaleString() : 'N/A'}\n`;
    textContent += `Operation Type: ${routeInfo.Type_Operation || 'N/A'}\n`;

    // Add bridge information if available
    const bridges = [];
    data.Route_Info.forEach(record => {
        if (record.Bridge_Identifier && Array.isArray(record.Bridge_Identifier)) {
            record.Bridge_Identifier.forEach(bridge => {
                if (bridge && !bridges.includes(bridge)) {
                    bridges.push(bridge);
                }
            });
        }
    });

    if (bridges.length > 0) {
        textContent += `Bridges on Route: ${bridges.join(', ')}\n`;
    }

    textContent += `Total Route Segments: ${data.Route_Info.length}\n\n`;

    // Add data license if available
    if (data.Data_License_Use) {
        textContent += `Data License: ${data.Data_License_Use}\n`;
    }

    // Copy to clipboard
    navigator.clipboard.writeText(textContent).then(() => {
        // Show success feedback
        const copyBtn = document.querySelector('.kytc-copy-btn');
        const originalText = copyBtn.innerHTML;
        copyBtn.innerHTML = '✓ Copied!';
        copyBtn.style.background = '#2e7d32';

        setTimeout(() => {
            copyBtn.innerHTML = originalText;
            copyBtn.style.background = '#3c5e49';
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy text: ', err);
        alert('Failed to copy route information to clipboard.');
    });
}

// Print route information
function printRouteInformation(data) {
    if (!data || !data.Route_Info || !Array.isArray(data.Route_Info) || data.Route_Info.length === 0) {
        alert('No route information available to print.');
        return;
    }

    const routeInfo = data.Route_Info[0];

    // Create a new window for printing
    const printWindow = window.open('', '_blank');

    // Generate HTML content for printing
    let printContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>KYTC Route Information</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 800px;
                    margin: 20px auto;
                    padding: 20px;
                }
                h1 {
                    color: #3c5e49;
                    border-bottom: 2px solid #3c5e49;
                    padding-bottom: 10px;
                }
                .info-item {
                    margin: 10px 0;
                    display: flex;
                    align-items: center;
                }
                .info-label {
                    font-weight: bold;
                    width: 150px;
                    flex-shrink: 0;
                }
                .info-value {
                    flex: 1;
                }
                .license {
                    margin-top: 30px;
                    padding: 15px;
                    background: #f5f5f5;
                    border-left: 4px solid #3c5e49;
                    font-size: 0.9em;
                }
                @media print {
                    body { margin: 0; }
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            <h1>KYTC Route Information</h1>

            <div class="info-item">
                <div class="info-label">County:</div>
                <div class="info-value">${routeInfo.County_Name || 'N/A'}</div>
            </div>

            <div class="info-item">
                <div class="info-label">Route:</div>
                <div class="info-value">${routeInfo.Route || 'N/A'}</div>
            </div>

            <div class="info-item">
                <div class="info-label">Road Name:</div>
                <div class="info-value">${routeInfo.Road_Name || 'N/A'}</div>
            </div>

            <div class="info-item">
                <div class="info-label">Direction:</div>
                <div class="info-value">${routeInfo.Direction || 'N/A'}</div>
            </div>

            <div class="info-item">
                <div class="info-label">Surface Type:</div>
                <div class="info-value">${routeInfo.Surface_Type || 'N/A'}</div>
            </div>

            <div class="info-item">
                <div class="info-label">Traffic Count:</div>
                <div class="info-value">${routeInfo.Traffic_Last_Count ? routeInfo.Traffic_Last_Count.toLocaleString() : 'N/A'}</div>
            </div>

            <div class="info-item">
                <div class="info-label">Operation Type:</div>
                <div class="info-value">${routeInfo.Type_Operation || 'N/A'}</div>
            </div>
    `;

    // Add bridge information if available
    const bridges = [];
    data.Route_Info.forEach(record => {
        if (record.Bridge_Identifier && Array.isArray(record.Bridge_Identifier)) {
            record.Bridge_Identifier.forEach(bridge => {
                if (bridge && !bridges.includes(bridge)) {
                    bridges.push(bridge);
                }
            });
        }
    });

    if (bridges.length > 0) {
        printContent += `
            <div class="info-item">
                <div class="info-label">Bridges on Route:</div>
                <div class="info-value">${bridges.join(', ')}</div>
            </div>
        `;
    }

    printContent += `
            <div class="info-item">
                <div class="info-label">Total Route Segments:</div>
                <div class="info-value">${data.Route_Info.length}</div>
            </div>
    `;

    // Add data license if available
    if (data.Data_License_Use) {
        printContent += `
            <div class="license">
                <strong>Data License & Usage Terms:</strong><br>
                <a href="${data.Data_License_Use}" target="_blank">${data.Data_License_Use}</a>
            </div>
        `;
    }

    printContent += `
            <script>
                window.onload = function() {
                    window.print();
                    window.onafterprint = function() {
                        window.close();
                    };
                };
            </script>
        </body>
        </html>
    `;

    // Write content to the print window and trigger print
    printWindow.document.write(printContent);
    printWindow.document.close();
}

// Disable KYTC API mode
function disableKYTCAPIMode(map) {
    console.log('KYTC API mode disabled');

    // Remove instruction box
    const instructionBox = document.querySelector('.kytc-instruction-box');
    if (instructionBox) {
        instructionBox.remove();
    }

    // Restore cursor
    const mapElement = map.getContainer();
    mapElement.style.cursor = '';

    // Restore original click handlers for project layers
    restoreOriginalClickHandlers(map);
}

// Restore original click handlers
function restoreOriginalClickHandlers(map) {
    // This would restore the original popup functionality
    // For now, just remove the KYTC-specific handlers
    if (currentProjectsLayer) {
        currentProjectsLayer.eachLayer(function(layer) {
            layer.off('click');
        });
    }

    if (awardedProjectsLayer) {
        awardedProjectsLayer.eachLayer(function(layer) {
            layer.off('click');
        });
    }
}

// Main map initialization
function initializeMap() {
    const map = L.map('map').setView([37.8, -85.0], 7);

    // Store map reference globally
    window.mainMap = map;

    // Add default basemap
    map.currentBasemapLayer = basemaps[currentBasemap];
    map.currentBasemapLayer.addTo(map);

    // Add basemap control
    const basemapControl = createBasemapControl(map);
    basemapControl.addTo(map);

    // Add clear all control
    const clearAllControl = createClearAllControl(map);
    clearAllControl.addTo(map);

    // Add county filter control
    const countyFilterControl = createCountyFilterControl(map);
    countyFilterControl.addTo(map);

    // Add district filter control
    const districtFilterControl = createDistrictFilterControl(map);
    districtFilterControl.addTo(map);

    // Add project type filter control
    const projectTypeFilterControl = createProjectTypeFilterControl(map);
    projectTypeFilterControl.addTo(map);

    // Add KYTC API control
    const kytcAPIControl = createKYTCAPIControl(map);
    kytcAPIControl.addTo(map);

    // Load data layers - Load districts first to ensure they're available for zooming
    loadGeoJSONLayer(map, 'data/KYTC_Districts.geojson', {
        color: 'maroon',
        fillColor: "transparent",
        weight: 2,
        opacity: 0.8,
        interactive: false  // Make districts non-interactive so highway projects can be clicked
    }, 'District Boundary').then(layer => {
        if (layer) {
            console.log('KYTC_Districts layer loaded successfully');
            console.log('Available district layers after loading:', Object.keys(districtLayers));
            console.log('Total district layers stored:', Object.keys(districtLayers).length);
            console.log('District layers object:', districtLayers);

            // Log each district layer for verification
            Object.keys(districtLayers).forEach(key => {
                if (districtLayers[key] && districtLayers[key].getBounds) {
                    console.log(`District ${key}: bounds available`);
                } else {
                    console.log(`District ${key}: invalid layer or no bounds`);
                }
            });
        }
    });

    // Load counties before highway projects so they're underneath
    loadGeoJSONLayer(map, 'data/KY_Counties.geojson', {
        color: 'grey',
        fillColor: "transparent",
        weight: 1,
        opacity: 0.5,
        interactive: false  // Make counties non-interactive so highway projects can be clicked
    }, 'County Boundary');

    // Load highway projects after counties so they're on top
    loadGeoJSONLayer(map, 'data/Awarded_Highway_Plans.geojson', {
        color: 'blue',
        weight: 2,
        opacity: 0.8
    }, 'Awarded Project').then(layer => {
        if (layer) {
            awardedProjectsLayer = layer;  // Store in global variable
            window.allProjectsLayer = layer;
            map.fitBounds(layer.getBounds());
        }
    });

    loadGeoJSONLayer(map, 'data/Current_Highway_Plans.geojson', {
        color: 'green',
        weight: 2,
        opacity: 0.8
    }, 'Current Project').then(layer => {
        if (layer) {
            currentProjectsLayer = layer;  // Store in global variable
        }
    });

    return map;
}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", function () {
    // Initialize empty pie chart
    createProjectsPieChart();

    // Initialize map
    initializeMap();

    // Set up database loading
    setupDatabaseLoading();

    // Automatically load database on page load
    loadDatabase();
});

/* =====================================================
   5. DATABASE AND TABLE VARIABLES
   ===================================================== */

// Database variables
let database = null;  // SQLite database instance

// Tabulator.js table instance
let highwayProjectsTable = null;  // Global reference to the Tabulator table

/* =====================================================
   6. TABULATOR.JS TABLE CONFIGURATION AND FUNCTIONS
   ===================================================== */

/**
 * Initializes the Tabulator.js table with configuration
 * This creates an advanced data table with sorting, filtering, pagination, and export capabilities
 */
function initializeProjectsTable() {
    console.log('Initializing Tabulator.js table...');

    // Create new Tabulator table instance
    highwayProjectsTable = new Tabulator("#highway-projects-table", {
        // Table behavior configuration
        height: "400px",              // Fixed height with scrolling
        pagination: "local",          // Enable local pagination (client-side)
        paginationSize: 25,           // Show 25 rows per page
        paginationSizeSelector: [10, 25, 50, 100, true],  // Page size options (true = show all)

        // Column interaction features
        movableColumns: true,         // Allow users to reorder columns by dragging
        resizableColumns: true,       // Allow users to resize columns

        // Data interaction features
        selectable: true,            // Allow row selection
        selectableRangeMode: "click", // Select rows by clicking

        // Layout and styling - improved responsive behavior
        layout: "fitColumns",         // Fit columns to fill available space
        layoutColumnsOnNewData: true, // Recalculate column layout when new data is loaded
        responsiveLayout: "collapse", // Collapse columns on small screens
        responsiveLayoutCollapseStartOpen: false, // Start with collapsed columns closed

        // Auto-resize to fit container - enhanced for responsive behavior
        autoResize: true,             // Automatically resize when container changes

        // Column resizing behavior
        resizableColumnFit: true,     // Resize all columns to fit when one is resized
        resizableColumnGuide: true,   // Show guide when resizing columns

        // Placeholder text when table is empty
        placeholder: "No highway project data available. Click 'Load Database' to fetch data.",

        // Column definitions - these will be updated when data is loaded
        columns: [
            {
                title: "Loading...",
                field: "loading",
                width: 200,
                headerSort: false
            }
        ],

        // Event handlers
        tableBuilt: function() {
            console.log("Tabulator table built successfully");
            // Set up window resize listener for responsive behavior
            window.addEventListener('resize', function() {
                if (highwayProjectsTable) {
                    // Redraw table to recalculate column widths
                    highwayProjectsTable.redraw(true);
                }
            });
        },

        dataLoaded: function(data) {
            console.log(`Tabulator loaded ${data.length} rows`);
            updateTableRecordCount(data.length);
        },

        dataFiltered: function(filters, rows) {
            console.log(`Tabulator filtered to ${rows.length} rows`);
            updateTableRecordCount(rows.length, true);
        },

        // Row selection handler
        rowSelectionChanged: function(data, rows) {
            console.log(`Selected ${rows.length} rows`);
        }
    });

    // Set up export button event listeners
    setupExportButtons();

    console.log('Tabulator.js table initialized');
}

/**
 * Updates the record count display for the table
 * @param {number} count - Number of records to display
 * @param {boolean} filtered - Whether the count represents filtered results
 */
function updateTableRecordCount(count, filtered = false) {
    const recordCount = document.getElementById('recordCount');
    const paginationInfo = document.getElementById('paginationInfo');

    if (recordCount) {
        const filterText = filtered ? ' (filtered)' : '';
        recordCount.textContent = `Showing ${count.toLocaleString()} records${filterText}`;
    }

    // Update pagination info if table exists
    if (highwayProjectsTable && paginationInfo) {
        const pageInfo = highwayProjectsTable.getPageSize();
        const currentPage = highwayProjectsTable.getPage();
        const maxPage = highwayProjectsTable.getPageMax();

        if (pageInfo && pageInfo !== true) {  // true means "show all"
            paginationInfo.textContent = `Page ${currentPage} of ${maxPage}`;
        } else {
            paginationInfo.textContent = '';
        }
    }
}

/**
 * Creates dynamic column definitions based on database data
 * @param {Array} sampleRow - Sample data row to determine column structure
 * @returns {Array} Column definitions for Tabulator.js
 */
function createTableColumns(sampleRow) {
    const columns = [];

    // Special handling for commonly used columns with responsive width settings
    const columnConfig = {
        'DISTRICT': {
            title: "District",
            minWidth: 80,
            widthGrow: 1,
            headerFilter: "input"
        },
        'COUNTY': {
            title: "County",
            minWidth: 90,
            widthGrow: 1.5,
            headerFilter: "input"
        },
        'SYP_NO': {
            title: "SYP No",
            minWidth: 90,
            widthGrow: 1.2,
            headerFilter: "input"
        },
        'ROUTE': {
            title: "Route",
            minWidth: 75,
            widthGrow: 1,
            headerFilter: "input"
        },
        'TYPE_WORK': {
            title: "Type Work",
            minWidth: 150,
            widthGrow: 2,
            headerFilter: "input"
        },
        'BMP': {
            title: "BMP",
            minWidth: 60,
            widthGrow: 0.8,
            headerFilter: "input"
        },
        'EMP': {
            title: "EMP",
            minWidth: 60,
            widthGrow: 0.8,
            headerFilter: "input"
        },
        'DESCRIPTION': {
            title: "Description",
            minWidth: 250,
            widthGrow: 4,
            headerFilter: "input"
        },
        'BRIDGE_ID': {
            title: "Bridge ID",
            minWidth: 90,
            widthGrow: 1.2,
            headerFilter: "input"
        },
        'RSY_YEAR': {
            title: "Plan Year",
            minWidth: 80,
            widthGrow: 1,
            headerFilter: "input"
        },
        'AWARDED': {
            title: "Status",
            minWidth: 85,
            widthGrow: 1,
            headerFilter: "select",
            headerFilterParams: {
                values: {"": "All", "Yes": "Awarded", "No": "Current"}
            },
            formatter: function(cell) {
                // Custom formatter for awarded status
                const value = cell.getValue();
                if (value === "Yes" || value === "Y" || value === 1) {
                    return '<span class="badge bg-success">Awarded</span>';
                } else if (value === "No" || value === "N" || value === 0) {
                    return '<span class="badge bg-secondary">Current</span>';
                } else {
                    return '<span class="badge bg-secondary">Unknown</span>';
                }
            }
        }
    };

    // Create columns based on the sample row
    Object.keys(sampleRow).forEach((key, index) => {
        const config = columnConfig[key] || {
            title: formatColumnName(key),
            minWidth: 100,           // Minimum width for columns
            widthGrow: 1,            // Default growth factor
            headerFilter: "input"
        };

        columns.push({
            title: config.title,
            field: key,
            minWidth: config.minWidth || 80,  // Set minimum width
            widthGrow: config.widthGrow || 1, // Set growth factor for responsive behavior
            frozen: config.frozen || false,
            headerFilter: config.headerFilter,
            headerFilterParams: config.headerFilterParams,
            formatter: config.formatter,
            sorter: "string",            // Default sorter
            tooltip: true,               // Show tooltip on hover
            resizable: true              // Allow column resizing
        });
    });

    return columns;
}

/**
 * Sets up event listeners for export buttons
 */
function setupExportButtons() {
    console.log('Setting up export button event listeners...');

    // CSV Export
    const csvBtn = document.getElementById('downloadCSV');
    if (csvBtn) {
        csvBtn.addEventListener('click', function() {
            if (highwayProjectsTable) {
                console.log('Exporting data to CSV...');
                highwayProjectsTable.download("csv", "ky-highway-projects.csv");
            } else {
                alert('Table not initialized. Please load data first.');
            }
        });
    }

    // JSON Export
    const jsonBtn = document.getElementById('downloadJSON');
    if (jsonBtn) {
        jsonBtn.addEventListener('click', function() {
            if (highwayProjectsTable) {
                console.log('Exporting data to JSON...');
                highwayProjectsTable.download("json", "ky-highway-projects.json");
            } else {
                alert('Table not initialized. Please load data first.');
            }
        });
    }

    // Excel Export
    const xlsxBtn = document.getElementById('downloadXLSX');
    if (xlsxBtn) {
        xlsxBtn.addEventListener('click', function() {
            if (highwayProjectsTable) {
                console.log('Exporting data to Excel...');

                // Check if SheetJS library is loaded
                if (typeof XLSX === 'undefined') {
                    console.error('SheetJS library (XLSX) is not loaded. Excel export will not work.');
                    alert('Excel export requires the SheetJS library. Please check the browser console for details.');
                    return;
                }

                console.log('SheetJS library detected, proceeding with Excel export...');

                try {
                    highwayProjectsTable.download("xlsx", "ky-highway-projects.xlsx", {
                        sheetName: "Highway Projects"
                    });
                    console.log('Excel export initiated successfully');
                } catch (error) {
                    console.error('Error during Excel export:', error);
                    alert('Error during Excel export: ' + error.message);
                }
            } else {
                alert('Table not initialized. Please load data first.');
            }
        });
    }

    console.log('Export button event listeners set up');
}

// Setup database loading functionality
function setupDatabaseLoading() {
    const loadBtn = document.getElementById('loadDataBtn');
    if (loadBtn) {
        loadBtn.addEventListener('click', loadDatabase);
    }

    // Initialize the Tabulator table on page load
    initializeProjectsTable();
}

// Load SQLite database
async function loadDatabase() {
    console.log('loadDatabase function called');
    const loadBtn = document.getElementById('loadDataBtn');
    const recordCount = document.getElementById('recordCount');

    console.log('Elements found:', { loadBtn, recordCount });

    try {
        loadBtn.textContent = 'Initializing...';
        loadBtn.disabled = true;
        recordCount.textContent = 'Loading SQL.js library...';

        console.log('Initializing SQL.js...');
        // Initialize SQL.js
        const SQL = await initSqlJs({
            locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
        });

        recordCount.textContent = 'Fetching database file...';

        console.log('Fetching database file...');
        // Load the database file
        const response = await fetch('data/HighwayPlan_data.db');
        console.log('Fetch response:', response);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        recordCount.textContent = 'Processing database...';
        const arrayBuffer = await response.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        // Create database
        database = new SQL.Database(uint8Array);


        // Load the Basic_Project_Info table
        loadBasicProjectInfo();

        loadBtn.textContent = 'Database Loaded';
        // The loading message will be replaced by updateTableRecordCount() when data loads

    } catch (error) {
        console.error('Error loading database:', error);
        loadBtn.textContent = 'Load Database';
        recordCount.textContent = 'Error: ' + error.message + ' (Check browser console for details)';
        loadBtn.disabled = false;
    }
}

// Load and display Basic_Project_Info table
/**
 * Loads and displays Basic_Project_Info data using Tabulator.js
 * This function replaces the old HTML table with an advanced Tabulator table
 */
function loadBasicProjectInfo() {
    if (!database) {
        console.error('Database not loaded');
        return;
    }

    try {
        console.log('Loading Basic_Project_Info data for Tabulator table...');

        // Query the Basic_Project_Info view - get more records for better table demonstration
        const stmt = database.prepare("SELECT * FROM Basic_Project_Info LIMIT 1000");
        const rows = [];

        // Get all rows
        while (stmt.step()) {
            rows.push(stmt.getAsObject());
        }
        stmt.free();

        console.log(`Retrieved ${rows.length} rows from Basic_Project_Info`);

        if (rows.length === 0) {
            console.error('No data found in Basic_Project_Info view');
            updateTableRecordCount(0);
            return;
        }

        // Create year chart data from ProjectCount_Year view
        loadProjectCountByYear();

        // Create pie chart data from ProjectsAwarded view
        loadProjectsAwardedData();

        // Update Tabulator table with new data
        if (highwayProjectsTable) {
            console.log('Updating Tabulator table with new data...');

            // Create column definitions based on the first row
            const columns = createTableColumns(rows[0]);

            // Update table columns
            highwayProjectsTable.setColumns(columns);

            // Load data into the table
            highwayProjectsTable.setData(rows);

            console.log('Tabulator table updated successfully');
            // Ensure record count is updated after table loads
            updateTableRecordCount(rows.length);
        } else {
            console.error('Tabulator table not initialized');
            // Try to initialize the table if it doesn't exist
            initializeProjectsTable();
            // Recursively call this function after initialization
            setTimeout(() => loadBasicProjectInfo(), 100);
        }

    } catch (error) {
        console.error('Error loading Basic_Project_Info:', error);
        const recordCount = document.getElementById('recordCount');
        if (recordCount) {
            recordCount.textContent = 'Error: ' + error.message;
        }
    }
}

// Update charts and table with filtered data
function updateChartsAndTable() {
    console.log('Updating charts and table with current filters...');

    if (currentProjectTypeFilter) {
        console.log('Applying project type filter to data:', currentProjectTypeFilter);

        // Update charts with filtered data
        loadFilteredProjectsAwardedDataByProjectType(currentProjectTypeFilter);
        loadFilteredProjectCountByYearByProjectType(currentProjectTypeFilter);

        // Update table with filtered data
        loadFilteredBasicProjectInfoByProjectType(currentProjectTypeFilter);

    } else if (currentDistrictFilter) {
        console.log('Applying district filter to data:', currentDistrictFilter);

        // Update charts with filtered data
        loadFilteredProjectsAwardedData(currentDistrictFilter);
        loadFilteredProjectCountByYear(currentDistrictFilter);

        // Update table with filtered data
        loadFilteredBasicProjectInfo(currentDistrictFilter);

    } else if (currentCountyFilter) {
        console.log('Applying county filter to data:', currentCountyFilter);

        // Update charts with filtered data
        loadFilteredProjectsAwardedDataByCounty(currentCountyFilter);
        loadFilteredProjectCountByYearByCounty(currentCountyFilter);

        // Update table with filtered data
        loadFilteredBasicProjectInfoByCounty(currentCountyFilter);

    } else {
        console.log('No filters active, loading all data');

        // Load all data
        loadProjectsAwardedData();
        loadProjectCountByYear();
        loadBasicProjectInfo();
    }
}

// Load filtered data by project type
function loadFilteredProjectsAwardedDataByProjectType(projectType) {
    if (!database) {
        console.error('Database not loaded');
        return;
    }

    try {
        console.log('Loading filtered ProjectsAwarded data for project type:', projectType);

        // Query Basic_Project_Info with project type filter and count by status
        const stmt = database.prepare(`
            SELECT
                CASE
                    WHEN c.dropdown_category = ? THEN 'Awarded'
                    ELSE 'Current'
                END as status,
                COUNT(*) as count
            FROM Basic_Project_Info b
            LEFT JOIN crosswalk c ON b.TYPE_WORK = c.raw_project_type
            WHERE c.dropdown_category = ?
            GROUP BY status
        `);
        stmt.bind([projectType, projectType]);

        let awardedCount = 0;
        let currentCount = 0;

        while (stmt.step()) {
            const row = stmt.getAsObject();
            if (row.status === 'Awarded') {
                awardedCount = row.count || 0;
            } else {
                currentCount = row.count || 0;
            }
        }

        console.log('Filtered project type counts - Awarded:', awardedCount, 'Current:', currentCount);

        // Update project counts and refresh pie chart
        updateProjectCounts('awarded', awardedCount);
        updateProjectCounts('current', currentCount);
        createProjectsPieChart();

    } catch (error) {
        console.error('Error loading filtered ProjectsAwarded data by project type:', error);
    }
}

// Load filtered data by project type for year chart
function loadFilteredProjectCountByYearByProjectType(projectType) {
    if (!database) {
        console.error('Database not loaded');
        return;
    }

    try {
        console.log('Loading filtered ProjectCount_Year data for project type:', projectType);

        // Query Basic_Project_Info with project type filter and count by year
        const stmt = database.prepare(`
            SELECT
                RSY_YEAR as YEAR,
                COUNT(*) as record_count
            FROM Basic_Project_Info b
            LEFT JOIN crosswalk c ON b.TYPE_WORK = c.raw_project_type
            WHERE c.dropdown_category = ?
            GROUP BY RSY_YEAR
            ORDER BY RSY_YEAR
        `);
        stmt.bind([projectType]);

        const yearData = {};
        while (stmt.step()) {
            const row = stmt.getAsObject();
            const year = row.YEAR || row.year;
            const count = row.record_count || row.RECORD_COUNT || row.count;

            if (year && count !== undefined) {
                yearData[year] = count;
            }
        }

        console.log('Filtered project type year data:', yearData);

        // Update the years chart
        createProjectYearsChart(yearData);

    } catch (error) {
        console.error('Error loading filtered ProjectCount_Year data by project type:', error);
    }
}

// Load filtered table data by project type
function loadFilteredBasicProjectInfoByProjectType(projectType) {
    if (!database) {
        console.error('Database not loaded');
        return;
    }

    try {
        console.log('Loading filtered Basic_Project_Info for project type:', projectType);

        // Query Basic_Project_Info with project type filter
        const stmt = database.prepare(`
            SELECT b.*
            FROM Basic_Project_Info b
            LEFT JOIN crosswalk c ON b.TYPE_WORK = c.raw_project_type
            WHERE c.dropdown_category = ?
            LIMIT 1000
        `);
        stmt.bind([projectType]);

        const rows = [];
        while (stmt.step()) {
            rows.push(stmt.getAsObject());
        }
        stmt.free();

        console.log(`Found ${rows.length} records for project type: ${projectType}`);

        // Update Tabulator table with filtered data
        if (highwayProjectsTable) {
            if (rows.length === 0) {
                console.log('No data found for project type:', projectType);
                // Clear table data
                highwayProjectsTable.setData([]);
                updateTableRecordCount(0);
            } else {
                console.log('Updating Tabulator table with filtered project type data...');

                // Create column definitions if needed (first time loading)
                if (!highwayProjectsTable.getColumns().length ||
                    highwayProjectsTable.getColumns()[0].getField() === 'loading') {
                    const columns = createTableColumns(rows[0]);
                    highwayProjectsTable.setColumns(columns);
                }

                // Load filtered data into the table
                highwayProjectsTable.setData(rows);

                console.log('Tabulator table updated with filtered project type data');
            }
        } else {
            console.error('Tabulator table not initialized');
            // Initialize table and try again
            initializeProjectsTable();
            setTimeout(() => loadFilteredBasicProjectInfoByProjectType(projectType), 100);
        }

    } catch (error) {
        console.error('Error loading filtered Basic_Project_Info by project type:', error);
        const recordCount = document.getElementById('recordCount');
        if (recordCount) {
            recordCount.textContent = 'Error loading filtered project type data: ' + error.message;
        }
    }
}

// Load and display ProjectCount_Year data for the bar chart
function loadProjectCountByYear() {
    if (!database) {
        console.error('Database not loaded');
        return;
    }

    try {
        console.log('Loading ProjectCount_Year data...');

        // Query the ProjectCount_Year view
        const stmt = database.prepare("SELECT * FROM ProjectCount_Year ORDER BY YEAR");
        const rows = [];

        // Get all rows
        while (stmt.step()) {
            rows.push(stmt.getAsObject());
        }
        stmt.free();

        console.log('ProjectCount_Year data:', rows);

        if (rows.length === 0) {
            console.log('No data found in ProjectCount_Year view');
            return;
        }

        // Convert to the format expected by the chart
        const yearData = {};
        rows.forEach(row => {
            const year = row.YEAR || row.year;
            const count = row.record_count || row.RECORD_COUNT || row.count;

            if (year && count !== undefined) {
                yearData[year] = count;
            }
        });

        console.log('Processed year data for chart:', yearData);

        // Create the years chart
        if (Object.keys(yearData).length > 0) {
            createProjectYearsChart(yearData);
        } else {
            console.log('No valid year data found for chart');
        }

    } catch (error) {
        console.error('Error querying ProjectCount_Year:', error);

        // Fallback to the old method if the view doesn't exist
        try {
            console.log('Falling back to Basic_Project_Info for years chart...');
            const fallbackStmt = database.prepare("SELECT RSY_YEAR FROM Basic_Project_Info WHERE RSY_YEAR >= 2024");
            const yearData = {};

            while (fallbackStmt.step()) {
                const row = fallbackStmt.getAsObject();
                const rsyYear = parseInt(row.RSY_YEAR);
                if (!isNaN(rsyYear)) {
                    yearData[rsyYear] = (yearData[rsyYear] || 0) + 1;
                }
            }
            fallbackStmt.free();

            if (Object.keys(yearData).length > 0) {
                createProjectYearsChart(yearData);
            }

            console.log('Used fallback data for years chart:', yearData);
        } catch (fallbackError) {
            console.error('Fallback also failed:', fallbackError);
        }
    }
}

// Load filtered ProjectsAwarded data by district
function loadFilteredProjectsAwardedData(districtNumber) {
    if (!database) {
        console.error('Database not loaded');
        return;
    }

    try {
        console.log('Loading filtered ProjectsAwarded data for district:', districtNumber);

        // Format district number properly (ensure it's two digits with leading zero if needed)
        const formattedDistrict = `District ${districtNumber.toString().padStart(2, '0')}`;
        console.log('Formatted district string:', formattedDistrict);

        // Query the ProjectsAwarded_ByDistrict view
        const stmt = database.prepare("SELECT * FROM ProjectsAwarded_ByDistrict WHERE DISTRICT = ?");
        stmt.bind([formattedDistrict]);

        if (stmt.step()) {
            const row = stmt.getAsObject();
            console.log('Filtered ProjectsAwarded row data:', row);

            // The view contains aggregate counts in columns named "Awarded" and "Current"
            const awardedCount = row.Awarded || row.awarded || 0;
            const currentCount = row.Current || row.current || 0;

            console.log('Filtered counts - Awarded:', awardedCount, 'Current:', currentCount);

            // Update project counts and refresh pie chart
            projectCounts.awarded = awardedCount;
            projectCounts.current = currentCount;
            createProjectsPieChart();
        } else {
            console.log('No data found for district:', formattedDistrict);
            // Set counts to zero if no data found
            projectCounts.awarded = 0;
            projectCounts.current = 0;
            createProjectsPieChart();
        }

        stmt.free();

    } catch (error) {
        console.error('Error querying filtered ProjectsAwarded:', error);
    }
}// Load filtered ProjectCount_Year data by district
function loadFilteredProjectCountByYear(districtNumber) {
    if (!database) {
        console.error('Database not loaded');
        return;
    }

    try {
        console.log('Loading filtered ProjectCount_Year data for district:', districtNumber);

        // Format district number properly (ensure it's two digits with leading zero if needed)
        const formattedDistrict = `District ${districtNumber.toString().padStart(2, '0')}`;
        console.log('Formatted district string:', formattedDistrict);

        // First try to use the ProjectYears_ByDistrict view if it exists
        let stmt;
        let rows = [];

        try {
            console.log('Attempting to use ProjectYears_ByDistrict view...');
            stmt = database.prepare("SELECT * FROM ProjectYears_ByDistrict WHERE DISTRICT = ? ORDER BY RSY_YEAR");
            stmt.bind([formattedDistrict]);

            while (stmt.step()) {
                rows.push(stmt.getAsObject());
            }
            stmt.free();

            console.log('Successfully loaded from ProjectYears_ByDistrict:', rows);
        } catch (viewError) {
            console.log('ProjectYears_ByDistrict view not available, falling back to Basic_Project_Info');

            // Fallback: Query Basic_Project_Info with district filter and aggregate by year
            stmt = database.prepare(`
                SELECT RSY_YEAR as YEAR, COUNT(*) as record_count
                FROM Basic_Project_Info
                WHERE DISTRICT = ? AND RSY_YEAR >= 2024
                GROUP BY RSY_YEAR
                ORDER BY RSY_YEAR
            `);
            stmt.bind([formattedDistrict]);

            while (stmt.step()) {
                rows.push(stmt.getAsObject());
            }
            stmt.free();
        }

        console.log('Filtered ProjectCount_Year data:', rows);

        // Convert to the format expected by the chart
        const yearData = {};
        rows.forEach(row => {
            const year = row.RSY_YEAR || row.YEAR || row.year;
            const count = row.total_projects || row.record_count || row.RECORD_COUNT || row.count || row.Count;

            if (year && count !== undefined) {
                yearData[year] = count;
            }
        });

        console.log('Processed filtered year data for chart:', yearData);

        // Create the years chart
        if (Object.keys(yearData).length > 0) {
            createProjectYearsChart(yearData);
        } else {
            console.log('No valid year data found for district:', formattedDistrict);
            // Create empty chart
            createProjectYearsChart({});
        }

    } catch (error) {
        console.error('Error querying filtered ProjectCount_Year:', error);
    }
}

// Load filtered Basic_Project_Info data by district
/**
 * Loads filtered Basic_Project_Info data by district using Tabulator.js
 * @param {string|number} districtNumber - The district number to filter by
 */
function loadFilteredBasicProjectInfo(districtNumber) {
    if (!database) {
        console.error('Database not loaded');
        return;
    }

    try {
        console.log('Loading filtered Basic_Project_Info for district:', districtNumber);

        // Format district number properly (ensure it's two digits with leading zero if needed)
        const formattedDistrict = `District ${districtNumber.toString().padStart(2, '0')}`;
        console.log('Formatted district string:', formattedDistrict);

        // Query the Basic_Project_Info view with district filter - get more records for better filtering
        const stmt = database.prepare("SELECT * FROM Basic_Project_Info WHERE DISTRICT = ? LIMIT 1000");
        stmt.bind([formattedDistrict]);

        const rows = [];
        while (stmt.step()) {
            rows.push(stmt.getAsObject());
        }
        stmt.free();

        console.log(`Found ${rows.length} records for ${formattedDistrict}`);

        // Update Tabulator table with filtered data
        if (highwayProjectsTable) {
            if (rows.length === 0) {
                console.log('No data found for district:', formattedDistrict);
                // Clear table data
                highwayProjectsTable.setData([]);
                updateTableRecordCount(0);
            } else {
                console.log('Updating Tabulator table with filtered district data...');

                // Create column definitions if needed (first time loading)
                if (!highwayProjectsTable.getColumns().length ||
                    highwayProjectsTable.getColumns()[0].getField() === 'loading') {
                    const columns = createTableColumns(rows[0]);
                    highwayProjectsTable.setColumns(columns);
                }

                // Load filtered data into the table
                highwayProjectsTable.setData(rows);

                console.log('Tabulator table updated with filtered district data');
            }
        } else {
            console.error('Tabulator table not initialized');
            // Initialize table and try again
            initializeProjectsTable();
            setTimeout(() => loadFilteredBasicProjectInfo(districtNumber), 100);
        }

    } catch (error) {
        console.error('Error loading filtered Basic_Project_Info:', error);
        const recordCount = document.getElementById('recordCount');
        if (recordCount) {
            recordCount.textContent = 'Error loading filtered data: ' + error.message;
        }
    }
}

/**
 * Loads filtered ProjectsAwarded data by county
 * @param {string} countyName - The county name to filter by
 */
function loadFilteredProjectsAwardedDataByCounty(countyName) {
    if (!database) {
        console.error('Database not loaded');
        return;
    }

    try {
        console.log('Loading filtered ProjectsAwarded data for county:', countyName);

        // Query the ProjectsAwarded_ByCounty view
        const stmt = database.prepare("SELECT * FROM ProjectsAwarded_ByCounty WHERE COUNTY = ?");
        stmt.bind([countyName]);

        if (stmt.step()) {
            const row = stmt.getAsObject();
            console.log('Filtered ProjectsAwarded row data for county:', row);

            // The view contains aggregate counts in columns named "Awarded" and "Current"
            const awardedCount = row.Awarded || row.awarded || 0;
            const currentCount = row.Current || row.current || 0;

            console.log('Filtered counts - Awarded:', awardedCount, 'Current:', currentCount);

            // Update project counts and refresh pie chart
            projectCounts.awarded = awardedCount;
            projectCounts.current = currentCount;
            createProjectsPieChart();
        } else {
            console.log('No data found for county:', countyName);
            // Set counts to zero if no data found
            projectCounts.awarded = 0;
            projectCounts.current = 0;
            createProjectsPieChart();
        }

        stmt.free();

    } catch (error) {
        console.error('Error querying filtered ProjectsAwarded by county:', error);

        // Fallback: Query Basic_Project_Info and count awarded vs current by county
        try {
            console.log('Falling back to Basic_Project_Info for county pie chart...');
            const stmt = database.prepare(`
                SELECT
                    COUNT(CASE WHEN AWARDED IS NOT NULL AND AWARDED != '' THEN 1 END) as Awarded,
                    COUNT(CASE WHEN AWARDED IS NULL OR AWARDED = '' THEN 1 END) as Current
                FROM Basic_Project_Info
                WHERE COUNTY = ?
            `);
            stmt.bind([countyName]);

            if (stmt.step()) {
                const row = stmt.getAsObject();
                console.log('Fallback ProjectsAwarded row data for county:', row);

                const awardedCount = row.Awarded || 0;
                const currentCount = row.Current || 0;

                console.log('Fallback counts - Awarded:', awardedCount, 'Current:', currentCount);

                projectCounts.awarded = awardedCount;
                projectCounts.current = currentCount;
                createProjectsPieChart();
            }
            stmt.free();
        } catch (fallbackError) {
            console.error('Fallback also failed:', fallbackError);
        }
    }
}

// Load filtered ProjectCount_Year data by county
function loadFilteredProjectCountByYearByCounty(countyName) {
    if (!database) {
        console.error('Database not loaded');
        return;
    }

    try {
        console.log('Loading filtered ProjectCount_Year data for county:', countyName);

        // First try to use the ProjectYears_ByCounty view if it exists
        let stmt;
        let rows = [];

        try {
            console.log('Attempting to use ProjectYears_ByCounty view...');
            stmt = database.prepare("SELECT * FROM ProjectYears_ByCounty WHERE COUNTY = ? ORDER BY RSY_YEAR");
            stmt.bind([countyName]);

            while (stmt.step()) {
                rows.push(stmt.getAsObject());
            }
            stmt.free();

            console.log('Successfully loaded from ProjectYears_ByCounty:', rows);
        } catch (viewError) {
            console.log('ProjectYears_ByCounty view not available, falling back to Basic_Project_Info');

            // Fallback: Query Basic_Project_Info with county filter and aggregate by year
            stmt = database.prepare(`
                SELECT RSY_YEAR as YEAR, COUNT(*) as record_count
                FROM Basic_Project_Info
                WHERE COUNTY = ? AND RSY_YEAR >= 2024
                GROUP BY RSY_YEAR
                ORDER BY RSY_YEAR
            `);
            stmt.bind([countyName]);

            while (stmt.step()) {
                rows.push(stmt.getAsObject());
            }
            stmt.free();
        }

        console.log('Filtered ProjectCount_Year data for county:', rows);

        // Convert to the format expected by the chart
        const yearData = {};
        rows.forEach(row => {
            const year = row.RSY_YEAR || row.YEAR || row.year;
            const count = row.total_projects || row.record_count || row.RECORD_COUNT || row.count;

            if (year && count !== undefined) {
                yearData[year] = count;
            }
        });

        console.log('Processed filtered year data for county chart:', yearData);

        // Create the years chart
        if (Object.keys(yearData).length > 0) {
            createProjectYearsChart(yearData);
        } else {
            console.log('No valid year data found for county:', countyName);
            createProjectYearsChart({});
        }

    } catch (error) {
        console.error('Error querying filtered ProjectCount_Year by county:', error);
    }
}

// Load filtered Basic_Project_Info data by county
/**
 * Loads filtered Basic_Project_Info data by county using Tabulator.js
 * @param {string} countyName - The county name to filter by
 */
function loadFilteredBasicProjectInfoByCounty(countyName) {
    if (!database) {
        console.error('Database not loaded');
        return;
    }

    try {
        console.log('Loading filtered Basic_Project_Info for county:', countyName);

        // Query the Basic_Project_Info view with county filter - get more records for better filtering
        const stmt = database.prepare("SELECT * FROM Basic_Project_Info WHERE COUNTY = ? LIMIT 1000");
        stmt.bind([countyName]);

        const rows = [];
        while (stmt.step()) {
            rows.push(stmt.getAsObject());
        }
        stmt.free();

        console.log(`Found ${rows.length} records for ${countyName} County`);

        // Update Tabulator table with filtered data
        if (highwayProjectsTable) {
            if (rows.length === 0) {
                console.log('No data found for county:', countyName);
                // Clear table data
                highwayProjectsTable.setData([]);
                updateTableRecordCount(0);
            } else {
                console.log('Updating Tabulator table with filtered county data...');

                // Create column definitions if needed (first time loading)
                if (!highwayProjectsTable.getColumns().length ||
                    highwayProjectsTable.getColumns()[0].getField() === 'loading') {
                    const columns = createTableColumns(rows[0]);
                    highwayProjectsTable.setColumns(columns);
                }

                // Load filtered data into the table
                highwayProjectsTable.setData(rows);

                console.log('Tabulator table updated with filtered county data');
            }
        } else {
            console.error('Tabulator table not initialized');
            // Initialize table and try again
            initializeProjectsTable();
            setTimeout(() => loadFilteredBasicProjectInfoByCounty(countyName), 100);
        }

    } catch (error) {
        console.error('Error loading filtered Basic_Project_Info by county:', error);
        const recordCount = document.getElementById('recordCount');
        if (recordCount) {
            recordCount.textContent = 'Error loading filtered county data: ' + error.message;
        }
    }
}

/**
 * Loads and displays ProjectsAwarded data for the pie chart
 * This function queries the database for awarded vs current project statistics
 */
function loadProjectsAwardedData() {
    if (!database) {
        console.error('Database not loaded');
        return;
    }

    try {
        console.log('Loading ProjectsAwarded data...');

        // Query the ProjectsAwarded view
        const stmt = database.prepare("SELECT * FROM ProjectsAwarded");

        if (stmt.step()) {
            const row = stmt.getAsObject();
            console.log('ProjectsAwarded row data:', row);

            // The view contains aggregate counts in columns named "Awarded" and "Current"
            const awardedCount = row.Awarded || row.awarded || 0;
            const currentCount = row.Current || row.current || 0;

            console.log('Extracted counts - Awarded:', awardedCount, 'Current:', currentCount);

            // Update project counts and refresh pie chart
            projectCounts.awarded = awardedCount;
            projectCounts.current = currentCount;
            createProjectsPieChart();
        } else {
            console.log('No data found in ProjectsAwarded view');
        }

        stmt.free();

    } catch (error) {
        console.error('Error querying ProjectsAwarded:', error);

        // Fallback to counting all records as current projects if view doesn't exist
        try {
            console.log('Trying Basic_Project_Info as fallback for pie chart...');
            const fallbackStmt = database.prepare("SELECT COUNT(*) as count FROM Basic_Project_Info");
            fallbackStmt.step();
            const result = fallbackStmt.getAsObject();
            fallbackStmt.free();

            // For fallback, assume all are current projects
            projectCounts.awarded = 0;
            projectCounts.current = result.count;
            createProjectsPieChart();

            console.log('Used fallback data for pie chart:', result.count, 'total projects');
        } catch (fallbackError) {
            console.error('Fallback also failed:', fallbackError);
        }
    }
}

// Load and display ProjectCount_Year data for the bar chart
function loadProjectsByYear() {
    if (!database) {
        console.error('Database not loaded');
        return;
    }

    try {
        console.log('Loading ProjectCount_Year data...');

        // First, let's check if the table exists
        const checkStmt = database.prepare("SELECT name FROM sqlite_master WHERE type='table' OR type='view'");
        const tables = [];
        while (checkStmt.step()) {
            tables.push(checkStmt.getAsObject().name);
        }
        checkStmt.free();
        console.log('Available tables/views:', tables);

        // Query the ProjectCount_Year view
        const stmt = database.prepare("SELECT * FROM ProjectCount_Year");
        const rows = [];

        // Get all rows
        while (stmt.step()) {
            rows.push(stmt.getAsObject());
        }
        stmt.free();

        console.log('ProjectCount_Year data:', rows);

        if (rows.length === 0) {
            console.log('No data found in ProjectCount_Year view');
            return;
        }

        // Show the structure of the first row
        console.log('First row structure:', Object.keys(rows[0]));
        console.log('First row values:', rows[0]);

        // Convert to the format expected by the chart
        const yearData = {};
        rows.forEach(row => {
            // Check all possible column names
            console.log('Processing row:', row);

            const year = row.year || row.Year || row.YEAR || row.RSY_Year || row.rsy_year;
            const count = row.project_count || row.count || row.COUNT || row.projects || row.ProjectCount || row.projectcount;

            console.log('Extracted - Year:', year, 'Count:', count);

            // Remove the 2024 filter temporarily to see all data
            if (year && count) {
                yearData[year] = count;
            }
        });

        console.log('All processed year data for chart:', yearData);

        // Create the years chart
        if (Object.keys(yearData).length > 0) {
            createProjectYearsChart(yearData);
        } else {
            console.log('No valid year data found for chart');
        }

    } catch (error) {
        console.error('Error querying ProjectCount_Year:', error);

        // Try alternative table names
        try {
            console.log('Trying alternative table names...');
            const altStmt = database.prepare("SELECT * FROM Projects_by_Year LIMIT 5");
            const altRows = [];
            while (altStmt.step()) {
                altRows.push(altStmt.getAsObject());
            }
            altStmt.free();
            console.log('Projects_by_Year data:', altRows);
        } catch (altError) {
            console.log('Projects_by_Year also not found');
        }
    }
}

// Helper function to format column names
function formatColumnName(colName) {
    return colName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// Helper function to format cell values
function formatCellValue(value) {
    if (value === null || value === undefined || value === '') {
        return '<span class="text-muted">—</span>';
    }
    return String(value);
}

// Helper function to get total record count
function getTotalRecordCount() {
    try {
        const stmt = database.prepare("SELECT COUNT(*) as count FROM Basic_Project_Info");
        stmt.step();
        const result = stmt.getAsObject();
        stmt.free();
        return result.count;
    } catch (error) {
        return 'unknown';
    }
}