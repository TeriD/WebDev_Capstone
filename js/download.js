document.getElementById('downloadBtn').onclick = function() {
  const files = [
    {
      url: "https://maps.kytc.ky.gov/arcgis/rest/services/Apps/ActiveHighwayPlan_Ext_Prd/MapServer/0/query?where=1=1&outFields=*&f=geojson",
      filename: "Awarded_Highway_Plans.geojson"
    },
    {
      url: "https://maps.kytc.ky.gov/arcgis/rest/services/Apps/ActiveHighwayPlan_Ext_Prd/MapServer/1/query?where=1=1&outFields=*&f=geojson",
      filename: "Current_Highway_Plans.geojson"
    },
    {
      url: "https://storage.googleapis.com/kytc-trak/data_hub_csv/eda_current_enact_plan_data_set.csv",
      filename: "Current_Enact_Plan_Data_Set.csv"
    }
  ];
  const status = document.getElementById('status');
  status.textContent = 'Downloading...';

  Promise.all(files.map(file =>
    fetch(file.url)
      .then(response => {
        if (!response.ok) throw new Error('Network response was not ok');
        // For the raw endpoint, use .text(), otherwise .json()
        if (file.url.endsWith('/1')) {
          return response.text();
        } else {
          return response.json();
        }
      })
      .then(data => {
        let blob;
        if (typeof data === 'string') {
          blob = new Blob([data], {type: "application/json"});
        } else {
          blob = new Blob([JSON.stringify(data)], {type: "application/geo+json"});
        }
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = file.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      })
  ))
  .then(() => {
    status.textContent = 'Download complete! Check your Downloads folder.';
  })
  .catch(err => {
    status.textContent = 'Download failed: ' + err.message;
  });
};

document.getElementById('updateProjectsBtn').onclick = function() {
  const status = document.getElementById('status');
  status.textContent = 'Updating projects table...';
  fetch('/api/update-projects', { method: 'POST' })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        status.textContent = 'Projects table updated successfully!';
      } else {
        status.textContent = 'Update failed: ' + (data.error || 'Unknown error');
      }
    })
    .catch(err => {
      status.textContent = 'Update failed: ' + err.message;
    });
};
