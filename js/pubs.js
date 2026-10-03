// pubs.js — the record, as stars. role: 'lead' (first/corresponding), 'co'; kind: J journal, C conference, R report, T thesis; status: '', 'review', 'prep'
export const THEMES = {
  emotion:  { en: 'Light & emotion', ja: '光と感情', az: 300 },
  glare:    { en: 'Glare & HDR metrology', ja: 'グレアとHDR計測', az: 30 },
  daylight: { en: 'Daylight, façades & patterns', ja: '昼光・ファサード・パターン', az: 120 },
  health:   { en: 'Health & indoor comfort', ja: '健康と室内環境', az: 210 }
};

export const PUBS = [
  // theses
  { y: 2012, k: 'T', role: 'lead', th: 'emotion', t: 'Perceived lighting quality: a critique of the appraisal path', v: 'MSc thesis, University College London', a: 'Kim, D.H.' },
  { y: 2018, k: 'T', role: 'lead', th: 'emotion', t: 'Light and emotion: exploring human affect in lighting', v: 'PhD dissertation, University College London', a: 'Kim, D.H.' },
  // journals
  { y: 2016, k: 'J', role: 'lead', th: 'emotion', t: 'A cross-cultural study on perceived lighting quality and occupants’ well-being between UK and South Korea', v: 'Energy and Buildings 119', a: 'Kim, D.H., Mansfield, K.P.' },
  { y: 2017, k: 'J', role: 'lead', th: 'daylight', t: 'Revisiting prediction tools for daylight adequacy and its potential improvement', v: 'Int. J. Korean Inst. Ecological Architecture and Environment 17', a: 'Kim, D.H.' },
  { y: 2018, k: 'J', role: 'lead', th: 'emotion', t: 'Development of a psychological pathway model linking lighting quality to well-being in indoor café environments', v: 'Indoor and Built Environment 27', a: 'Kim, D.H.' },
  { y: 2018, k: 'J', role: 'lead', th: 'emotion', t: 'Perceived adequacy of illumination and pedestrians’ night-time experiences in urban obscured spaces: a case of London', v: 'Indoor and Built Environment 27', a: 'Kim, D.H., Noh, K.B.' },
  { y: 2020, k: 'J', role: 'co', th: 'health', t: 'Workshop with 335 primary school children in the Netherlands: what is needed to improve the IEQ in their classrooms?', v: 'Building and Environment 168', a: 'Bluyssen, P.M., Kim, D.H., Eijkelenboom, A., Ortiz, M.' },
  { y: 2020, k: 'J', role: 'lead', th: 'health', t: 'Clustering of office workers from the OFFICAIR study in the Netherlands based on their self-reported health and comfort', v: 'Building and Environment 176', a: 'Kim, D.H., Bluyssen, P.M.' },
  { y: 2020, k: 'J', role: 'co', th: 'health', t: 'First results of self-reported health and comfort of staff in outpatient areas of hospitals in the Netherlands', v: 'Building and Environment 177', a: 'Eijkelenboom, A., Kim, D.H., Bluyssen, P.M.' },
  { y: 2021, k: 'J', role: 'lead', th: 'emotion', t: 'Creating positive atmosphere and emotion in an office-like environment: a methodology for the lit environment', v: 'Building and Environment 194', a: 'Kim, D.H., Mansfield, K.P.' },
  { y: 2021, k: 'J', role: 'co', th: 'health', t: 'First SenseLab studies with primary school children: exposure to different environmental configurations in the experience room', v: 'Intelligent Buildings International 13', a: 'Bluyssen, P.M., Zhang, D., Kim, D.H., Eijkelenboom, A., Ortiz, M.' },
  { y: 2022, k: 'J', role: 'co', th: 'health', t: 'Substantiation of home occupant archetypes with the use of generative techniques: analysis and results of the focus groups', v: 'Intelligent Buildings International 14', a: 'Ortiz, M., Kim, D.H., Bluyssen, P.M.' },
  { y: 2025, k: 'J', role: 'co', th: 'glare', t: 'Comparative analysis of LDR vs. HDR imaging: quantifying luminosity variability and sky dynamics through image processing techniques', v: 'Building and Environment 269', a: 'Cho, Y., Poletto, A.L., Kim, D.H., Karmann, C., Andersen, M.' },
  // conference papers
  { y: 2014, k: 'C', role: 'lead', th: 'daylight', t: 'Daylight analysis: a case study on the Snowdon Visitor Centre in Wales', v: '45th International HVAC&R Congress, Belgrade', a: 'Kim, D.H., Mansfield, K.P.' },
  { y: 2017, k: 'C', role: 'lead', th: 'emotion', t: 'Light, emotion and interaction', v: 'CIE Midterm Meeting, Jeju', a: 'Kim, D.H., Mansfield, K.P.' },
  { y: 2018, k: 'C', role: 'lead', th: 'emotion', t: 'For the darkness seekers in Central Seoul: the moonlight tour at Changdeokgung Palace', v: 'Symposium on Promotion and Protection of the Night Sky, Capraia', a: 'Kim, D.H., Geong, G.C.' },
  { y: 2023, k: 'C', role: 'lead', th: 'glare', t: 'Performance investigation of cameras using HDR sensors for daylight glare evaluations', v: '30th Session of the CIE, Ljubljana', a: 'Kim, D.H., Quek, G., Wienold, J.' },
  { y: 2025, k: 'C', role: 'lead', th: 'glare', t: 'A validation study of the CIE UGR correction method for non-uniform lighting conditions', v: 'CIE 2025 Midterm Meeting, Vienna', a: 'Kim, D.H., Wienold, J.' },
  { y: 2025, k: 'C', role: 'co', th: 'glare', t: 'Characterization of high-dynamic-range imaging measurement systems by using a high contrast luminance reference source', v: 'CIE 2025 Midterm Meeting, Vienna', a: 'Ferrero, A., Bouroussis, C., Kliment, P., Linduska, P., Saez, A.M., Kim, D.H., et al.' },
  { y: 2026, k: 'J', role: 'co', th: 'glare', t: 'A refined workflow to calibrate HDR images of daylit scenes', v: 'LEUKOS', a: 'Wasilewski, S., Kim, D.H., Germann, E., Andersen, M.', doi: '10.1080/15502724.2026.2666908' },
  { y: 2026, k: 'J', role: 'co', th: 'glare', t: 'Daylit sky categorization using image processing: a comparison with CIE standards', v: 'Lighting Research & Technology', a: 'Cho, Y., Poletto, A.L., Kim, D.H., Andersen, M.' },
  // HiDyn consortium reports (EPM 21NRM01)
  { y: 2025, k: 'R', role: 'co', th: 'glare', t: 'Report on the relevance of existing quality indices, and the need for new ones, for HDR imaging luminance measurement systems in glare and obtrusive light assessment', v: 'EPM 21NRM01 HiDyn', a: 'Wienold, J., Bouroussis, C.A., Kim, D.H., Ledig, J., Ferrero, A., Gevaux, L.' },
  { y: 2025, k: 'R', role: 'co', th: 'glare', t: 'Implementation of an open-source HDR algorithm for traceable luminance images scaled to spot measurements', v: 'EPM 21NRM01 HiDyn', a: 'Gevaux, L., Dupiau, A., Ferrero, A., Kim, D.H., Wienold, J., et al.' },
  { y: 2025, k: 'R', role: 'co', th: 'glare', t: 'Good practice guide: characterisation of HDR imaging instruments (ILMDs and RGB matrix sensor cameras) after CIE 232:2019 and CIE 244:2021', v: 'EPM 21NRM01 HiDyn', a: 'Ferrero, A., Kliment, P., Bouroussis, C.A., Gevaux, L., Dupiau, A., Kim, D.H., et al.' },
  { y: 2026, k: 'R', role: 'co', th: 'glare', t: 'Good practice guide on the inter-comparability of HDR luminance measurements, with guidelines on uncertainty, glare and obtrusive light assessment', v: 'EPM 21NRM01 HiDyn', a: 'Bouroussis, C.A., Ferrero, A., Kliment, P., Gevaux, L., Dupiau, A., Kim, D.H., et al.' },
  // dawn: under review / in preparation
  { y: 2026, k: 'J', role: 'lead', th: 'daylight', status: 'prep', t: 'Do visually interesting sunlight and façade patterns mitigate our discomfort glare perception in an office-like environment?', v: 'In preparation', a: 'Kim, D.H., Quek, G., Wienold, J., Andersen, M.' },
  { y: 2026, k: 'J', role: 'lead', th: 'daylight', status: 'prep', t: 'Research gap in building façade control to link human comfort: a literature review', v: 'In preparation · Solskin', a: 'Kim, D.H., Crosby, S., Di Natale, L., Schlueter, A.' },
  { y: 2026, k: 'J', role: 'co', th: 'daylight', status: 'review', t: 'Healthy and comfortable classroom lighting', v: 'Under review · with KTH Lighting Design', a: '' },
  { y: 2026, k: 'J', role: 'co', th: 'daylight', status: 'review', t: 'Image-based characterisation of material optical properties for indoor daylight simulation', v: 'Under review', a: 'Forouzandeh, N., Nan, L., Stoter, J., Kim, D.H., Brembilla, E.' }
];
