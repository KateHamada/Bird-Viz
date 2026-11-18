---
layout: default
title: Avotrex Bird Locations
---

{% include table-export.html %}
{% include quick-links.html %} 

# Avotrex Bird Locations

Each dot is a species, placed at its recorded latitude and longitude. Dot size scales with body mass. Click an era in the legend to hide or show it.

<label for="map-color">Color map by:</label>
<select id="map-color">
  <option value="flight">Flight ability</option>
  <option value="status">Status</option>
  <option value="era">Era lost</option>
  <option value="endemicity">Island vs. continental</option>
</select>
<div id="map-chart" style="width:100%; height:600px;"></div>
<div id="era-controls"></div>

<script src="https://cdn.plot.ly/plotly-3.5.1.min.js"></script>
<script src="{{ '/graphs/common.js' | relative_url }}"></script>
<script src="{{ '/graphs/map.js' | relative_url }}"></script>