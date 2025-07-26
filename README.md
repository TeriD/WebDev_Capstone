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
├── css/
│   └── style.css             # Custom styling
├── data/
│   ├── *.geojson             # Spatially aware files for map display
│   ├── HighwayPlan_data.db   # SQLite database with project data
│   └── *.csv                 # Tabular data to be imporeted into SQLite db
├── images                    # Reference images, wireframes and icons in the project
├── js/
│   └── download.js
│   └── script.js             # Main application logic
│   └── updateProjectsRoute.js # Node.js Express route handler
├── node_modules/             # Contains all the packages and dependencies installed
 for your Node.js project. These are libraries required by your application, such as Express, sqlite3, csv-parser, and any other modules listed in your package.json. The folder is automatically managed by npm (Node Package Manager) and should not be edited manually. It is essential for running your server-side code.
├── References/                # Supporting documentation
│   └── CapstoneProjectPlan.pdf
├── download-geojson.js        # Node.js script that downloads GeoJSON files from specified URLs.
├── download.html             # Data refresh options page
├── help.html                 # User assistance page for details on Web UI & tools
├── index.html                # Main dashboard page
├── package-lock.json         # Records the exact versions of every installed dependency (and their dependencies), ensuring consistent installs across different environments. It helps guarantee that everyone working on the project uses the same package versions, improving reliability and reproducibility.
├── package.json              # Defines the metadata and dependencies for your Node.js project. It lists the packages your project needs (like express, sqlite3, and csv-parser), along with their version requirements. This file allows npm to install the correct libraries and helps manage, share, and run your project consistently.
├── README.md                 # Project Overview and Details regarding the project.
├── requirements.txt          # Lists Node.js packages (express, sqlite3, csv-parser), which should actually be managed in package.json for Node.js. If your project is Node.js-based, this file is not needed; use package.json instead.
├── server.js                 # Main entry point for your Node.js web server. It sets up an Express application, configures middleware, serves static files, and defines API endpoints (such as /js/download-geojson and /api/update-projects). It listens for HTTP requests on a specified port (3000), allowing your web application and backend services to run and interact with users and other systems.
```


## License

This project is for educational/demonstration purposes.
