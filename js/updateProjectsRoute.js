// This script is a Node.js Express route handler.  It is not a client-side JavaScript.
// It does not run in the browser.
// It is initiated when the "Update Projects Table" button in the download.html
// file is clicked - sending a POST request to /api/update-projects
// Its intent is to truncate and append the 'projects' table in HighwayPlan_data.db
// using the latest eda_current_enact_plan_data_set.csv in data/downloads/ folder.
// The CSV file is read, and each row is inserted into the 'projects' table.

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

const router = express.Router();

const DB_PATH = path.join(__dirname, 'data', 'HighwayPlan_data.db');
const CSV_PATH = path.join(__dirname, 'data', 'downloads', 'eda_current_enact_plan_data_set.csv');

router.post('/api/update-projects', async (req, res) => {
  console.log('Route hit: /api/update-projects');
  let responded = false;
  try {
    // Open DB
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('Failed to open DB:', err);
        if (!responded) { responded = true; res.json({ success: false, error: 'Failed to open DB: ' + err.message }); }
      }
    });
    console.log('DB opened');

    // Truncate table
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM projects', function(err) {
        if (err) {
          console.error('Failed to truncate table:', err);
          if (!responded) { responded = true; res.json({ success: false, error: 'Failed to truncate table: ' + err.message }); }
          reject(err);
        } else {
          console.log('Table truncated');
          resolve();
        }
      });
    });

    // Read CSV and insert rows
    const insertPromises = [];
    const columns = [];
    let firstRow = true;
    await new Promise((resolve, reject) => {
      fs.createReadStream(CSV_PATH)
        .pipe(csv())
        .on('data', (row) => {
          if (firstRow) {
            for (const col in row) columns.push(col);
            firstRow = false;
            console.log('CSV columns:', columns);
          }
          const placeholders = columns.map(() => '?').join(',');
          const sql = `INSERT INTO projects (${columns.join(',')}) VALUES (${placeholders})`;
          const values = columns.map(col => row[col]);
          insertPromises.push(new Promise((res2, rej2) => {
            db.run(sql, values, function(err) {
              if (err) {
                console.error('Insert error:', err, 'Row:', row);
                if (!responded) { responded = true; res.json({ success: false, error: 'Insert error: ' + err.message }); }
                rej2(err);
              } else res2();
            });
          }));
        })
        .on('end', () => {
          console.log('CSV read complete');
          resolve();
        })
        .on('error', (err) => {
          console.error('CSV read error:', err);
          if (!responded) { responded = true; res.json({ success: false, error: 'CSV read error: ' + err.message }); }
          reject(err);
        });
    });
    await Promise.all(insertPromises);
    db.close((err) => {
      if (err) console.error('Error closing DB:', err);
      else console.log('DB closed');
    });
    if (!responded) { responded = true; res.json({ success: true }); }
  } catch (error) {
    console.error('Update projects error:', error);
    if (!responded) {
      try {
        res.json({ success: false, error: error.message });
      } catch (e) {
        res.status(500).send('Critical error: ' + e.message);
      }
    }
  }
});

module.exports = router;
