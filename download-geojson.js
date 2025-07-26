// download-geojson.js
// This script is a Node.js script that downloads GeoJSON files from specified URLs.
// It is not a client-side JavaScript.
// It is intended to be run on the server side, typically triggered by a request from a
// client-side application or manually via command line.
const https = require('https');
const fs = require('fs');
const path = require('path');

const layers = [
  {
    url: 'https://maps.kytc.ky.gov/arcgis/rest/services/Apps/ActiveHighwayPlan_Ext_Prd/MapServer/0/query?where=1=1&outFields=*&f=geojson',
    filename: 'Awarded_Highway_Plans.geojson'
  },
  {
    url: 'https://maps.kytc.ky.gov/arcgis/rest/services/Apps/ActiveHighwayPlan_Ext_Prd/MapServer/1/query?where=1=1&outFields=*&f=geojson',
    filename: 'Other_Highway_Plans.geojson'
  }
];

const outDir = path.join(__dirname, 'data', 'downloads');
fs.mkdirSync(outDir, { recursive: true });

layers.forEach(layer => {
  const outFile = path.join(outDir, layer.filename);
  https.get(layer.url, (res) => {
    if (res.statusCode !== 200) {
      console.error(`Failed to download ${layer.filename}:`, res.statusCode);
      res.resume();
      return;
    }
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      fs.writeFileSync(outFile, data);
      console.log(`${layer.filename} downloaded and saved to`, outFile);
    });
  }).on('error', (e) => {
    console.error(`Error downloading ${layer.filename}:`, e.message);
  });
});
