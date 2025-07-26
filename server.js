// server.js
const express = require('express');
const { exec } = require('child_process');
const path = require('path');


const app = express();
const PORT = 3000;

// For parsing JSON bodies (not strictly needed here, but good practice)
app.use(express.json());

// Serve static files (including download.html)
app.use(express.static(__dirname));

// Endpoint to trigger the download script
app.get('/js/download-geojson', (req, res) => {
  exec('node js/download-geojson.js', (error, stdout, stderr) => {
    if (error) {
      res.status(500).send('Download failed:\n' + stderr);
    } else {
      res.send('Download complete!\n' + stdout);
    }
  });
});


// --- Add the updateProjectsRoute ---
const updateProjectsRoute = require('./updateProjectsRoute');
app.use(updateProjectsRoute);

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
