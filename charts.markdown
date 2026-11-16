---
layout: default
title: Avotrex charts
---

{% include table-export.html %}
{% include quick-links.html %} 

<script src="https://cdn.plot.ly/plotly-2.35.2.min.js"></script>
<script>window.AVOTREX_DATA_URL = "{{ '/data/Avotrex_traits_v1.csv' | relative_url }}";</script>

<div id="island-chart" style="height:420px"></div>
<div id="era-controls"></div>
<div id="scatter-chart" style="height:480px"></div>

<script src="{{ '/graphs/common.js' | relative_url }}"></script>
<script src="{{ '/graphs/charts.js' | relative_url }}"></script>