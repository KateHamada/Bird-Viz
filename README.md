# Bird Visualization

Website link: https://katehamada.github.io/Bird-Viz/

A GitHub Pages (Jekyll) site for our Bird Visualization Dashboard for ICS 484 Data Visualization class.

## TODO
- **Complete the data-quality view** (`species_quality.markdown` / `graphs/species_quality.js`)
  - Add the species-level quality table and explain which values are measured, sourced
    from literature, imputed, or estimated.
  - Use the existing species search and shared species data-loading code.
- **Finish the map enhancements** (`graphs/map.js`)
  - Add a slider to move between eras.
  - Add ring colors for continental versus island species.
  - Show flighted versus flightless birds in the ring/map display.

## Completed
- **Species tree page** (`species_tree.markdown`, `graphs/species_tree.js`)
  - Added species search and taxonomic-tree visualization.
  - Added links between the species tree and data-quality pages.
- **Map foundation** (`index.markdown`, `graphs/map.js`)
  - Replaced the previous shared-renderer map with a CSV-backed Plotly map.
  - Added era-based traces with legend toggles, species hover details, and
    body-mass-scaled markers.
- **Data-quality page scaffolding** (`species_quality.markdown`)
  - Added species search/browse controls, shared data URLs, and the quality-view
    container.
- **Navigation updates** (`_includes/quick-links.html`)
  - Added links for the map, species tree, and data-quality pages.
  - Disabled the detailed-charts link because the old charts page was removed.
- **Local development documentation**
  - Added Ruby/Jekyll installation, dependency, and local-server instructions.

## Local Development Guide

### 1. Install Ruby 3.3

#### Windows Setup
Open PowerShell as Administrator and run:
```powershell
winget install RubyInstallerTeam.RubyWithDevKit.3.3
$env:Path = "C:\Ruby33-x64\bin;" + $env:Path
```

#### MacOS Setup
Open Terminal and run (requires [Homebrew](https://brew.sh/)):
```zsh
brew install ruby@3.3
echo 'export PATH="/opt/homebrew/opt/ruby@3.3/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

---

### 2. Verify Installation
Check that Ruby 3.3 is active in your terminal:
```bash
ruby -v
```

---

### 3. Install Dependencies
Navigate to your local repository directory and run:
```bash
gem install bundler
bundle install
bundle update github-pages
```

---

### 4. Run Locally
Launch the Jekyll local development server:
```bash
bundle exec jekyll serve
```
You should see something like this:
```
[stuff]...
    Server address: http://127.0.0.1:4000/Bird-Viz/
  Server running... press ctrl-c to stop.
Terminate batch job (Y/N)? 
```
Open `http://127.0.0.1:4000/Bird-Viz/` in your web browser to preview your site.

---


## Overview of Structure

Bird-Viz is organized as a Jekyll site. Markdown pages define the page layout and
HTML containers, while JavaScript files load the data and populate those
containers in the browser.

```text
Bird-Viz/
├── index.markdown             # Map page
├── species_tree.markdown      # Taxonomic tree page
├── species_quality.markdown   # Species data-quality page
├── about.markdown             # Project and team information
├── data/                      # AVOTREX CSV files and source-data notes
├── graphs/
│   ├── common.js              # Shared CSV parsing, cleaning, and era filtering
│   ├── species_common.js      # Shared species search, browsing, and navigation
│   ├── map.js                 # Map renderer
│   ├── species_tree.js        # Taxonomic tree renderer
│   └── species_quality.js     # Data-quality renderer
├── _includes/                 # Shared Jekyll components, such as quick links
├── _layouts/                  # Jekyll page layouts
└── _config.yml                # Site metadata, base URL, and build settings
```

### How data is parsed and displayed

1. The source data is stored in `data/`. The main visualization data comes from
   `Avotrex_traits_v1.csv`; the species pages also use
   `Avotrex_taxonomy_v1.csv`.
2. Each visualization page sets the CSV paths in `window` variables before
   loading its scripts. This lets the same JavaScript work both locally and
   under the GitHub Pages `/Bird-Viz/` base path.
3. `graphs/common.js` fetches the traits CSV and parses it with a small
   quote-aware CSV parser. It converts numeric fields such as latitude,
   longitude, flight ability, and body mass to numbers, assigns each record to
   an extinction/status era, and removes rows that do not contain the numeric
   values required by the visualizations.
4. The map renderer uses the cleaned records to create Plotly geographic
   traces. Marker position comes from latitude and longitude, marker size is
   based on log-scaled body mass, and hover text shows species, taxonomy,
   status, location, flight ability, and body mass.
5. The species pages load the taxonomy CSV through `species_common.js`, index
   species by scientific and common name, and connect the selected species to
   its traits. `species_tree.js` displays the taxonomy as nested
   superorder, order, family, genus, and species HTML nodes. The quality page
   uses the same selected-species data flow for its quality display.
6. Shared controls, such as the era slider, filter the records before the
   renderers run. The renderers then redraw the map or page content using the
   visible subset while retaining the complete dataset for stable scales.
