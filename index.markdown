---
layout: default
title: Avotrex map
---

<!-- 
{% include quick-links.html %} 
quicklinks was used as a navbar (idk if we're gonna use it)
-->
{% include table-export.html %}
{% include quick-links.html %} 

<script src="https://cdn.plot.ly/plotly-2.35.2.min.js"></script>
<script>window.AVOTREX_DATA_URL = "{{ '/data/Avotrex_traits_v1.csv' | relative_url }}";</script>

<div id="era-controls"></div>
<label for="map-color">Color map by:</label>
<select id="map-color">
  <option value="flight">Flight ability</option>
  <option value="era">Era lost</option>
  <option value="endemicity">Island vs. continental</option>
</select>
<div id="map-chart" style="height:520px"></div>

<script src="{{ '/graphs/common.js' | relative_url }}"></script>
<script src="{{ '/graphs/map.js' | relative_url }}"></script>