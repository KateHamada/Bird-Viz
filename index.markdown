---
layout: home
---

<!-- 
{% include quick-links.html %} 
quicklinks was used as a navbar (idk if we're gonna use it)
-->
{% include table-export.html %}

<script src="https://cdn.plot.ly/plotly-2.35.2.min.js"></script>

<label for="map-color">Color map by:</label>
<select id="map-color">
  <option value="flight">Flight ability</option>
  <option value="status">Status</option>
  <option value="endemicity">Island vs. continental</option>
</select>

<div id="map-chart" style="height:520px"></div>
<div id="island-chart" style="height:420px"></div>
<div id="scatter-chart" style="height:480px"></div>

<script src="graphs/graph.js"></script>
