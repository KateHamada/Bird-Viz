---
layout: default
title: Avotrex data quality
---

{% include table-export.html %}
{% include quick-links.html %} 

<script>
window.AVOTREX_DATA_URL = "{{ '/data/Avotrex_traits_v1.csv' | relative_url }}";
window.AVOTREX_TAXONOMY_URL = "{{ '/data/Avotrex_taxonomy_v1.csv' | relative_url }}";
</script>

<input id="species-search" list="species-list" placeholder="Scientific or common name" autocomplete="off" aria-label="Search species">
<datalist id="species-list"></datalist>
<div id="species-browse"></div>
<p id="species-message" aria-live="polite"></p>

<div id="species-header" data-compact></div>
<a href="{{ '/species_tree.html' | relative_url }}">See taxonomic tree →</a>
<div id="species-quality"></div>

<script src="{{ '/graphs/common.js' | relative_url }}"></script>
<script src="{{ '/graphs/species_common.js' | relative_url }}"></script>
<script src="{{ '/graphs/species_quality.js' | relative_url }}"></script>