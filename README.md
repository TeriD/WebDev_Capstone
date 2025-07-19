# KY Highway Projects Dashboard

An interactive web dashboard for visualizing Kentucky highway project data with filtering capabilities and interactive mapping.

## Features

- **Interactive Maps**: Click on highway project lines to view detailed information
- **Multi-Level Filtering**: Filter by district, county, and project type with automatic chart updates
- **Dynamic Panel Titles**: Panel titles automatically update to reflect active filters (e.g., "Projects in District 2" or "Projects in Fayette County")
- **Project Type Classification**: Intelligent project categorization using crosswalk database for standardized filtering
- **Data Visualization**: Pie charts and bar charts showing project statistics with real-time updates
- **Advanced Data Table**: Sortable, filterable, and paginated table with export capabilities
- **Data Export**: Download project data in CSV, JSON, or Excel formats
- **Multiple Basemaps**: Switch between OpenStreetMap, Esri World Street Map, USGS Topo, and OpenTopoMap
- **Clear All Filters**: One-click button to reset all active filters
- **Responsive Design**: Works on desktop and mobile devices

## Live Demo

Visit the dashboard at: `https://[your-username].github.io/[repository-name]/`

## Technologies Used

- **Frontend**: HTML5, CSS3, JavaScript
- **Mapping**: Leaflet.js with multiple basemap options
- **Charts**: Chart.js for data visualization
- **Data Table**: Tabulator.js for advanced table features
- **Database**: SQLite with SQL.js for client-side queries
- **Styling**: Bootstrap 5.3.3 for responsive design

## Data Sources

- Kentucky Transportation Cabinet (KYTC)
- Highway project data and geographic boundaries
- County and district boundary files

## Filtering System

The dashboard provides three levels of filtering that can be used independently or in combination:

### District Filter
- Filter by KYTC districts (1-12)
- Automatically zooms to district boundaries
- Updates all charts and tables to show district-specific data

### County Filter
- Search-enabled dropdown with all Kentucky counties
- Type to search for specific counties
- Zooms to county boundaries when selected

### Project Type Filter
- Intelligent categorization using crosswalk database
- Maps raw project types to standardized categories
- Search functionality to quickly find project types
- Visual indicator shows active filter with green dot

### Dynamic Titles
- Panel titles automatically update to reflect active filters
- Examples:
  - "Projects in District 2"
  - "Projects in Fayette County"
  - "Projects in District 2 in Fayette County (Bridge Construction)"
- Clear visual feedback about what data is being displayed

## Usage

1. Open the dashboard in a web browser
2. Click "Load Database" to load the highway project data
3. Use the filter controls in the top-right corner:
   - **District Filter** (maroon clock icon): Filter by KYTC district (1-12)
   - **County Filter** (grey square icon): Search and filter by county name
   - **Project Type Filter** (road icon): Filter by standardized project categories
   - **Clear All** (CLR button): Reset all active filters at once
4. **Panel titles automatically update** to show active filters (e.g., "Projects in District 2 in Fayette County")
5. Click on highway project lines (colored lines on map) to view detailed project information
6. Use the table's built-in sorting and filtering capabilities
7. Export data using the CSV, JSON, or Excel buttons
8. Switch basemaps using the map control in the top-right corner
9. Charts and data automatically update based on selected filters

## File Structure

```text
├── index.html              # Main dashboard page
├── css/
│   └── style.css           # Custom styling
├── js/
│   └── script.js           # Main application logic
├── data/
│   ├── *.geojson          # Geographic boundary files
│   ├── Capstone_data.db   # SQLite database with project data
│   └── project_type_crosswalk.csv  # Project type mapping for standardization
└── images/
    ├── *.png              # Project images and wireframes
    └── road-location-icon.png  # Custom icon for project type filter
```

## License

This project is for educational/demonstration purposes.
