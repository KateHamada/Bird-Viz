// TODO:
// add a table that shows the quality of data for each species, refer to species_common.js for what data to look at

// hint
// How each *_imputation_type code reads on the page
const SOURCE_TEXT = {
  Literature: 'From the literature',
  Measured_skin: 'Measured on skin specimens',
  Imputed_from_skeleton: 'Imputed from skeleton measurements',
  Imputed_from_bodySize: 'Imputed from body size',
  Imputed: 'Imputed',
  Estimated_from_descriptions: 'Estimated from descriptions',
  Estimated_from_GenusMedian: 'Estimated from the genus median',
  Estimated_from_FamilyMedian: 'Estimated from the family median'
};
const DIRECT_CODES = ['Literature', 'Measured_skin'];