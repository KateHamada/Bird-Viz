---
layout: default
title: Avotrex Bird Locations
---

{% include table-export.html %}
{% include quick-links.html %} 

# Avotrex Bird Locations

Each circle marks a recorded latitude and longitude; circles with multiple species are larger. Click a circle to see the species at that location. Click an era in the legend to hide or show it.

<div id="map" style="width:100%; height:600px;">Loading map…</div>
<div id="map-details" aria-live="polite" hidden></div>

<script src="https://cdn.plot.ly/plotly-2.35.2.min.js"></script>
<script src="{{ '/graphs/common.js' | relative_url }}"></script>
<script src="{{ '/graphs/map.js' | relative_url }}"></script>