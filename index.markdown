---
layout: default
title: Avotrex Bird Locations
---

{% include table-export.html %}
{% include quick-links.html %}

# Avotrex Bird Locations

Each circle marks a recorded latitude and longitude; circles with multiple species are larger, and dot size scales with body mass. Click a circle to see the species at that location. Click an item in the legend to hide or show it (double-click to show only that item). Use the dropdown to change what the circles are colored by, and the slider below the map to step through the eras.

<style>
  .map-layout {
    display: grid;
    grid-template-columns: 250px minmax(0, 1fr);
    gap: 12px;
    position: relative;
  }
  #map-details {
    box-sizing: border-box;
    min-width: 0;
    height: 600px;
    overflow-y: auto;
    padding: 12px;
    border: 1px solid #ccc;
  }
  #map-details h2 { font-size: 1.1rem; margin-top: 0; }
  #map-details .species-list {
    display: grid;
    gap: 8px;
    list-style: none;
    margin: 0;
    min-width: 0;
    padding: 0;
  }
  #map-details .species-card {
    min-width: 0;
    overflow-wrap: anywhere;
    background: #fff;
    border: 1px solid #ccc;
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
    padding: 10px 12px;
  }
  #map-details .species-card p { font-size: 0.9rem; margin: 4px 0; }
  @media (max-width: 640px) {
    .map-layout { display: block; }
    #map-details {
      position: absolute;
      z-index: 1;
      top: 12px;
      left: 12px;
      width: min(70%, 260px);
      height: 576px;
      background: rgba(255, 255, 255, 0.95);
    }
  }
  .wrapper { max-width: 1400px; padding-left: 60px; padding-right: 50px; }
</style>

<label for="map-color">Color map by:</label>
<select id="map-color">
  <option value="flight">Flight ability</option>
  <option value="era" selected>Era lost</option>
  <option value="endemicity">Island vs. continental</option>
</select>

<div class="map-layout">
  <div id="map-details" aria-live="polite">Click a circle to see the species at this location.</div>
  <div id="map" style="width:100%; height:600px;">Loading map…</div>
</div>

<div id="era-controls"></div>

<script src="https://cdn.plot.ly/plotly-3.5.1.min.js"></script>
<script src="{{ '/graphs/common.js' | relative_url }}"></script>
<script src="{{ '/graphs/map.js' | relative_url }}"></script>