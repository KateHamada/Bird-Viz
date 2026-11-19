---
layout: default
title: Avotrex Bird Locations
---

{% include table-export.html %}
{% include quick-links.html %} 

# Avotrex Bird Locations

Each circle marks a recorded latitude and longitude; circles with multiple species are larger. Click a circle to see the species at that location. Click an era in the legend to hide or show it.

<style>
  .map-layout {
    display: grid;
    grid-template-columns: minmax(220px, 28%) minmax(0, 1fr);
    gap: 12px;
    position: relative;
  }
  #map-details {
    box-sizing: border-box;
    height: 600px;
    overflow-y: auto;
    padding: 12px;
    border: 1px solid #ccc;
  }
  #map-details h2 { font-size: 1.1rem; margin-top: 0; }
  #map-details ul { padding-left: 1.25rem; }
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
</style>

<div class="map-layout">
  <div id="map-details" aria-live="polite">Click a circle to see the species at this location.</div>
  <div id="map" style="width:100%; height:600px;">Loading map…</div>
</div>

<script src="https://cdn.plot.ly/plotly-2.35.2.min.js"></script>
<script src="{{ '/graphs/common.js' | relative_url }}"></script>
<script src="{{ '/graphs/map.js' | relative_url }}"></script>