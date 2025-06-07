const serviceUrl = "https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services/NTAD_National_Highway_Planning_Network/FeatureServer/0";
const queryUrl = `${serviceUrl}/query`;
const BATCH_SIZE = 500;

document.getElementById("fetchButton").addEventListener("click", async () => {
  const output = document.getElementById("output");
  output.textContent = "Fetching data...";

  try {
    const geojson = await fetchAllFeatures();
    output.textContent = `Fetched ${geojson.features.length} features. See console for full GeoJSON.`;
    console.log("Full GeoJSON:", geojson);
  } catch (err) {
    output.textContent = `Error: ${err.message}`;
    console.error(err);
  }
});

async function fetchAllObjectIds() {
  const url = `${queryUrl}?where=1%3D1&returnIdsOnly=true&f=json`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to get Object IDs: ${response.status}`);
  const data = await response.json();
  return data.objectIds || [];
}

async function fetchFeaturesByIds(objectIds) {
  const idsParam = objectIds.join(",");
  const url = `${queryUrl}?objectIds=${idsParam}&outFields=*&f=geojson`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to get features: ${response.status}`);
  return await response.json();
}

async function fetchAllFeatures() {
  const allObjectIds = await fetchAllObjectIds();
  if (!allObjectIds.length) throw new Error("No features found.");

  const features = [];
  for (let i = 0; i < allObjectIds.length; i += BATCH_SIZE) {
    const batchIds = allObjectIds.slice(i, i + BATCH_SIZE);
    console.log(`Fetching ${i + 1} to ${i + batchIds.length} of ${allObjectIds.length}`);
    const geojson = await fetchFeaturesByIds(batchIds);
    features.push(...geojson.features);
  }

  return {
    type: "FeatureCollection",
    features: features
  };
}