---
layout: default
title: Avotrex tree
---

{% include table-export.html %}
{% include quick-links.html %} 

<script>
window.AVOTREX_DATA_URL = "{{ '/data/Avotrex_traits_v1.csv' | relative_url }}";
window.AVOTREX_TAXONOMY_URL = "{{ '/data/Avotrex_taxonomy_v1.csv' | relative_url }}";
</script>

<a data-species-link="{{ '/quality/' | relative_url }}">Data quality →</a>

<input id="species-search" list="species-list" placeholder="Scientific or common name" autocomplete="off" aria-label="Search species">
<datalist id="species-list"></datalist>
<p id="species-message" aria-live="polite"></p>

<div id="species-header"></div>
<div id="species-tree"></div>

<script src="{{ '/graphs/common.js' | relative_url }}"></script>
<script src="{{ '/graphs/species_common.js' | relative_url }}"></script>
<script src="{{ '/graphs/species_tree.js' | relative_url }}"></script>