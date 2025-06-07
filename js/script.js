// script.js

// ==============================
// DOM ELEMENTS
// ==============================
const countyInput = document.getElementById('countyInput');
const countyList = document.getElementById('countyList');
const districtSelect = document.getElementById('district');
const projectTypeSelect = document.getElementById('projectType');
const downloadBtn = document.getElementById('downloadBtn');
const clearFiltersBtn = document.getElementById('clearFiltersBtn');
const layerControls = document.getElementById('layerControls');

// ==============================
// MAP INITIALIZATION
// ==============================
const kyBounds = [
  [36.4, -89.7],
  [39.2, -81.9]
];

const map = L.map('map', {
  maxBounds: kyBounds,
  maxBoundsViscosity: 1.0,
  zoomSnap: 0.25
}).fitBounds(kyBounds);

L.control.resetView = function (opts) {
  const control = L.control({ position: opts.position || 'topleft' });

  control.onAdd = function (map) {
    const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
    container.style.backgroundColor = '#ffffff';
    container.style.border = '1px solid #666';
    container.style.borderRadius = '4px';
    container.style.padding = '6px 8px';
    container.style.cursor = 'pointer';
    container.style.boxShadow = '0 1px 5px rgba(0,0,0,0.65)';
    container.title = 'Click to reset the map to Kentucky extent';
    container.innerHTML = '🔄';
    container.onclick = function () {
      map.fitBounds(kyBounds);
    };
    return container;
  };

  return control;
};

L.control.resetView({ position: 'topleft' }).addTo(map);

const topoBasemap = L.esri.basemapLayer('Topographic');
topoBasemap.addTo(map);

// ==============================
// GEOJSON OVERLAYS (DRAW ORDER)
// ==============================
const overlayLayers = {};

const layerDefs = [
  { label: 'State Roads', url: 'data/KY_State_Roads.geojson', style: { color: '#252525', weight: 1.5, dashArray: '4,2' } },
  { label: 'Major Roads', url: 'data/KY_Major_Roads.geojson', style: { color: '#636363', weight: 1 } },
  { label: 'Local Roads', url: 'data/KY_Local_Roads.geojson', style: { color: '#cccccc', weight: 0.8 } },
  { label: 'State Mileposts', url: 'data/KY_State_Road_Mileposts.geojson', isPoint: true, pointStyle: { radius: 2, fillColor: '#4d004b', color: '#fff', weight: 1, opacity: 1, fillOpacity: 1 } },
  { label: 'Bridges', url: 'data/KY_Bridge_Points.geojson', isPoint: true, pointStyle: { radius: 4, fillColor: '#ff7800', color: '#000', weight: 1, opacity: 1, fillOpacity: 0.8 } },
  { label: 'Current Projects', url: 'data/Current_Highway_Plan_Projects.geojson', style: { color: '#2c7fb8', weight: 2 } },
  { label: 'Awarded Projects', url: 'data/Awarded_Current_Highway_Plan_Projects.geojson', style: { color: '#f03b20', weight: 2 } },
  { label: 'County Boundaries', url: 'data/KY_Counties_Districts.geojson', style: { color: '#1d91c0', weight: 1, fillOpacity: 0 } },
  { label: 'District Boundaries', url: 'data/KYTC_Districts_WM.geojson', style: { color: '#575A5A', weight: 1, dashArray: '4,2'} }
];

function setupSidebarLayerToggles(layers) {
  if (!layerControls) return;
  layerControls.innerHTML = '';
  Object.entries(layers).forEach(([label, layer]) => {
    const id = `toggle_${label.replace(/\s+/g, '_')}`;

    const wrapper = document.createElement('div');
    wrapper.style.marginBottom = '0.5rem';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = id;
    checkbox.checked = map.hasLayer(layer);

    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        map.addLayer(layer);
      } else {
        map.removeLayer(layer);
      }
    });

    const labelEl = document.createElement('label');
    labelEl.setAttribute('for', id);
    labelEl.textContent = label;
    labelEl.style.marginLeft = '0.4rem';

    wrapper.appendChild(checkbox);
    wrapper.appendChild(labelEl);
    layerControls.appendChild(wrapper);
  });
}

Promise.all(layerDefs.map(def =>
  fetch(def.url)
    .then(res => res.json())
    .then(data => {
      const layer = L.geoJSON(data, {
        style: def.style,
        pointToLayer: def.isPoint ? (f, latlng) => L.circleMarker(latlng, def.pointStyle) : undefined,
        onEachFeature: (feature, layer) => {
          const props = feature.properties;
          const popup = Object.entries(props).map(([k, v]) => `<strong>${k}</strong>: ${v}`).join('<br>');
          layer.bindPopup(popup);
        }
      });

      overlayLayers[def.label] = layer;

      if (def.label === "Awarded Projects") {
        layer.addTo(map);
      }

      return true;
    })
)).then(() => {
  setupSidebarLayerToggles(overlayLayers);
});

// ==============================
// LOAD COUNTY/DISTRICT FILTER DATA
// ==============================
fetch('./data/ky_counties_districts.geojson')
  .then(res => res.json())
  .then(geojson => {
    const counties = new Set();
    const districts = new Set();

    geojson.features.forEach(feature => {
      const props = feature.properties;
      counties.add(props.NAME);
      districts.add(props.district);
    });

    if (districtSelect) {
      districtSelect.innerHTML = '<option value="All">All</option>';
      [...districts].sort((a, b) => a - b).forEach(d => {
        const opt = document.createElement('option');
        opt.value = d;
        opt.textContent = d;
        districtSelect.appendChild(opt);
      });
    }

    if (countyList) {
      countyList.innerHTML = '';
      [...counties].sort().forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        countyList.appendChild(opt);
      });
    }
  })
  .catch(err => console.error('❌ Failed to load GeoJSON:', err));

// ==============================
// FILTER FUNCTION — ZOOM LOGIC
// ==============================
function filterData() {
  const projectType = projectTypeSelect?.value || 'All';
  const district = districtSelect?.value || 'All';
  const county = countyInput?.value || 'All';

  console.log('Filtering:', { projectType, district, county });

  let zoomed = false;

  if (county !== 'All' && overlayLayers['County Boundaries']) {
    overlayLayers['County Boundaries'].eachLayer(layer => {
      const props = layer.feature?.properties;
      if (props && props.NAME?.toLowerCase() === county.toLowerCase()) {
        map.fitBounds(layer.getBounds(), { padding: [20, 20] });
        zoomed = true;
      }
    });
  }

  if (!zoomed && district !== 'All' && overlayLayers['County Boundaries']) {
    const boundsList = [];
    overlayLayers['County Boundaries'].eachLayer(layer => {
      const props = layer.feature?.properties;
      const featureDistrict = props?.district?.toString().trim();
      if (featureDistrict === district.toString().trim()) {
        boundsList.push(layer.getBounds());
      }
    });
    if (boundsList.length > 0) {
      const combinedBounds = boundsList.reduce((acc, b) => acc.extend(b), L.latLngBounds());
      map.fitBounds(combinedBounds, { padding: [20, 20] });
    }
  }
}

if (districtSelect) districtSelect.addEventListener('change', filterData);
if (countyInput) countyInput.addEventListener('change', filterData);

// ==============================
// DOWNLOAD BUTTON
// ==============================
if (downloadBtn) {
  downloadBtn.addEventListener('click', () => {
    const csv = 'ProjectType,District,County,Length\nResurfacing,7,Fayette,2.5';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'filtered_projects.csv';
    a.click();
    URL.revokeObjectURL(url);
  });
}

if (clearFiltersBtn) {
  clearFiltersBtn.addEventListener('click', () => {
    districtSelect.value = 'All';
    countyInput.value = '';
    projectTypeSelect.value = 'All';
    map.fitBounds(kyBounds);
    console.log('🔄 Filters cleared');
  });
}

// ==============================
// Collapsible Section Handling
// ==============================
document.querySelectorAll('.collapsible').forEach(btn => {
  btn.addEventListener('click', () => {
    const content = btn.nextElementSibling;
    content.classList.toggle('show');
    btn.textContent = btn.textContent.includes('▾')
      ? btn.textContent.replace('▾', '▸')
      : btn.textContent.replace('▸', '▾');
  });
});