/**
 * Evidence-led archaeoacoustic reference records.
 * Frequencies are transcribed as reported by the cited research; do not round measured values to 110 Hz.
 */
export interface AcousticSiteEvidence {
  id: string;
  name: string;
  lat: number;
  lon: number;
  region: string;
  period: string;
  measuredFrequenciesHz: number[];
  researchBandHz?: number;
  measurementContext?: string;
  measurements?: { parameter: string; frequencyHz?: number; frequencyBand?: string; reportedValue: number; unit: string; method: string }[];
  status: 'published-measurement' | 'candidate-only';
  summary: string;
  caveat: string;
  sources: { label: string; url: string; year: number; publication: string }[];
}

export const ACOUSTIC_SITE_EVIDENCE: AcousticSiteEvidence[] = [
  {
    id: 'hal-saflieni-hypogeum',
    name: 'Ħal Saflieni Hypogeum — Oracle Room',
    lat: 35.8696,
    lon: 14.5068,
    region: 'Paola, Malta',
    period: 'Neolithic; commonly dated broadly to the 4th–3rd millennium BCE',
    measuredFrequenciesHz: [70, 114],
    researchBandHz: 110,
    status: 'published-measurement',
    summary: 'A 2015 archaeoacoustic paper reports strong room resonance at 70 Hz and 114 Hz. The 2017 peer-reviewed study applied a systematic acoustic measurement approach; a 2020 paper further examined the site’s measured frequency spectrum and geometry.',
    caveat: 'The reported upper resonance is 114 Hz, not 110 Hz. It is displayed in the 110 Hz investigation band only as a nearby measured result (difference: +4 Hz); the original measured value is preserved. This does not establish a global Earth resonance or a shared frequency at other ancient sites.',
    sources: [
      { label: 'Debertolis, Coimbra & Eneix (2015), Archaeoacoustic Analysis of the Ħal Saflieni Hypogeum in Malta', url: 'https://doi.org/10.15640/jaa.v3n1a4', year: 2015, publication: 'Journal of Anthropology and Archaeology 3(1)' },
      { label: 'Till (2017), An archaeoacoustic study of the Ħal Saflieni Hypogeum on Malta', url: 'https://doi.org/10.15184/aqy.2016.258', year: 2017, publication: 'Antiquity 91(355), 74–89' },
      { label: 'Wolfe, Swanson & Till (2020), The frequency spectrum and geometry of the Ħal Saflieni Hypogeum appear tuned', url: 'https://doi.org/10.1016/j.jasrep.2020.102623', year: 2020, publication: 'Journal of Archaeological Science: Reports 34, 102623' }
    ]

  },
  {
    id: 'la-pasiega-turret-cave', name: 'La Pasiega Turret Cave', lat: 43.286, lon: -3.967,
    region: 'Cantabria, Spain', period: 'Palaeolithic painted cave',
    measuredFrequenciesHz: [125, 250, 500, 1000, 2000], status: 'published-measurement',
    summary: 'Published in-situ acoustic characterization of a prehistoric painted cave. The study reports early decay time (EDT) by octave band, not a single natural resonance frequency.',
    measurementContext: 'Reported EDT: 1.92 s at 125 Hz, 1.62 s at 250 Hz, 1.58 s at 500 Hz, 1.40 s at 1000 Hz, and 1.16 s at 2000 Hz; reported average 1.54 s over 125–1000 Hz. Measurements were made at selected cave positions and compared with concert halls.',
    measurements: [
      { parameter: 'EDT', frequencyHz: 125, reportedValue: 1.92, unit: 's', method: 'In-situ impulse-response analysis; octave-band early decay time' },
      { parameter: 'EDT', frequencyHz: 250, reportedValue: 1.62, unit: 's', method: 'In-situ impulse-response analysis; octave-band early decay time' },
      { parameter: 'EDT', frequencyHz: 500, reportedValue: 1.58, unit: 's', method: 'In-situ impulse-response analysis; octave-band early decay time' },
      { parameter: 'EDT', frequencyHz: 1000, reportedValue: 1.40, unit: 's', method: 'In-situ impulse-response analysis; octave-band early decay time' },
      { parameter: 'EDT', frequencyHz: 2000, reportedValue: 1.16, unit: 's', method: 'In-situ impulse-response analysis; octave-band early decay time' }
    ],
    caveat: 'These values describe sound decay at each frequency band. They are not evidence that the cave produces or is tuned to 110 Hz.',
    sources: [{ label: 'Till (2019), Sound Archaeology: A Study of the Acoustics of Three World Heritage Sites', url: 'https://doi.org/10.3390/acoustics1030039', year: 2019, publication: 'Acoustics 1(3), 661–692' }]
  },
  {
    id: 'paphos-theatre', name: 'Paphos Theatre', lat: 34.7585, lon: 32.4053,
    region: 'Nea Paphos, Cyprus', period: 'Ancient theatre; used from approximately the 3rd century BCE to the late 4th century CE',
    measuredFrequenciesHz: [125, 250, 500, 1000, 2000], status: 'published-measurement',
    summary: 'An in-situ study examined early decay time at multiple audience positions and frequency bands in the ancient theatre.',
    measurementContext: 'The study reports octave-band EDT values that vary by receiver position. The paper/review reports a 1.79 s average over 125–2000 Hz; this is a band average, not a resonance peak. The primary paper discusses position-by-position differences and limitations of averaging.',
    measurements: [{ parameter: 'EDT average', frequencyBand: '125–2000 Hz average', reportedValue: 1.79, unit: 's', method: 'In-situ acoustic survey; omnidirectional source, multiple receiver positions, ODEON analysis' }],
    caveat: '1.79 s is the reported average across a 125–2000 Hz band, not a measurement at exactly 125 Hz or a resonance at 1.79 Hz. It is not evidence of a 110 Hz resonance.',
    sources: [
      { label: 'Till (2019), Sound Archaeology: A Study of the Acoustics of Three World Heritage Sites', url: 'https://doi.org/10.3390/acoustics1030039', year: 2019, publication: 'Acoustics 1(3), 661–692' },
      { label: 'Archaeoacoustics around the World: A Literature Review (2016–2022)', url: 'https://doi.org/10.3390/app13042361', year: 2023, publication: 'Applied Sciences 13(4), 2361' }
    ]
  },
  {
    id: 'acheiropoietos-basilica', name: 'Acheiropoietos Basilica', lat: 40.6355, lon: 22.9431,
    region: 'Thessaloniki, Greece', period: 'Early Byzantine basilica, 5th century CE',
    measuredFrequenciesHz: [500], status: 'published-measurement',
    summary: 'A published field-measurement summary reports reverberation time of 2.72 seconds in the 500 Hz band.',
    measurementContext: 'The 2023 literature review reports T60 = 2.72 s at 500 Hz. The summarized survey used an 8-second logarithmic sine sweep covering 20 Hz–24 kHz, repeated ten times per microphone location, with measurement microphones and a directional powered loudspeaker at multiple source/receiver positions.',
    measurements: [{ parameter: 'T60', frequencyHz: 500, reportedValue: 2.72, unit: 's', method: '8-second logarithmic sine sweep, 20 Hz–24 kHz, repeated 10 times per microphone location' }],
    caveat: 'T60 is reverberation time at the 500 Hz test band, not a natural resonance frequency generated by the building.',
    sources: [
      { label: 'Gerstel et al. (2018), Soundscapes of Byzantium: The Acheiropoietos Basilica and the Cathedral of Hagia Sophia in Thessaloniki', url: 'https://ascsa.edu.gr/publications/hesperia/article/87/1/177-213', year: 2018, publication: 'Hesperia 87(1), 177–213; primary field measurement study' },
      { label: 'Archaeoacoustics around the World: A Literature Review (2016–2022)', url: 'https://doi.org/10.3390/app13042361', year: 2023, publication: 'Applied Sciences 13(4), 2361; cross-check of reported T60 values' }
    ]
  },
  {
    id: 'hagia-sophia-thessaloniki', name: 'Hagia Sophia Cathedral', lat: 40.6328, lon: 22.9477,
    region: 'Thessaloniki, Greece', period: 'Early Byzantine church, broadly 7th century CE in its present form',
    measuredFrequenciesHz: [500], status: 'published-measurement',
    summary: 'A published field-measurement summary reports reverberation time of 2.86 seconds in the 500 Hz band for Hagia Sophia in Thessaloniki.',
    measurementContext: 'The 2023 literature review reports T60 = 2.86 s at 500 Hz. The summarized survey used an 8-second logarithmic sine sweep covering 20 Hz–24 kHz, repeated ten times per microphone location, with measurement microphones and a directional powered loudspeaker at multiple source/receiver positions. Measurements were scheduled at the same time of day to limit temperature and humidity variation.',
    measurements: [{ parameter: 'T60', frequencyHz: 500, reportedValue: 2.86, unit: 's', method: '8-second logarithmic sine sweep, 20 Hz–24 kHz, repeated 10 times per microphone location' }],
    caveat: 'This record refers to Hagia Sophia in Thessaloniki, Greece—not Istanbul. T60 is reverberation time at the 500 Hz test band, not a natural resonance frequency.',
    sources: [{ label: 'Archaeoacoustics around the World: A Literature Review (2016–2022)', url: 'https://doi.org/10.3390/app13042361', year: 2023, publication: 'Applied Sciences 13(4), 2361; Table 2 measurement summary' }]
  },
  {
    id: 'newgrange-chamber-resonance', name: 'Newgrange Passage Tomb — central chamber', lat: 53.6946, lon: -6.4756,
    region: 'County Meath, Ireland', period: 'Neolithic passage tomb, c. 3200 BCE',
    measuredFrequenciesHz: [110], researchBandHz: 110, status: 'published-measurement',
    summary: 'A 1996 archaeoacoustic study reported a primary chamber resonance at approximately 110 Hz at Newgrange.',
    measurementContext: 'Reported chamber resonance: approximately 110 Hz. This is a site-specific acoustic report, not evidence of a universal or astronomical 110 Hz signal.',
    measurements: [{ parameter: 'Primary chamber resonance', frequencyHz: 110, reportedValue: 110, unit: 'Hz', method: 'Acoustic resonance measurements of chambered prehistoric monuments; value reported approximately in the published literature' }],
    caveat: 'Approximate reported value. Re-measurement under documented conditions would be needed to assess uncertainty and reproducibility.',
    sources: [{ label: 'Jahn, Devereux & Ibison (1996), Resonance in ancient structures', url: 'https://doi.org/10.1121/1.414642', year: 1996, publication: 'Journal of the Acoustical Society of America 99, 649–658' },
      { label: 'Cook, Pajot & Leuchter (2008), Ancient Architectural Acoustic Resonance Patterns and Regional Brain Activity', url: 'https://doi.org/10.2752/175169608783489099', year: 2008, publication: 'Time and Mind 1(1), 95–104' }]
  },
  {
    id: 'stonehenge-chamber-acoustics', name: 'Stonehenge — acoustic model / resonance study', lat: 51.1789, lon: -1.8262,
    region: 'Wiltshire, England', period: 'Late Neolithic to Bronze Age monument',
    measuredFrequenciesHz: [114], status: 'candidate-only',
    summary: 'An exploratory acoustic modelling source reports an approximately 114 Hz relationship for Stonehenge; this is not a direct field measurement of an enclosed chamber.',
    measurementContext: 'The cited project compares predicted cavity dimensions with archaeological measurements and lists Stonehenge at approximately 114 Hz. This is model-based/exploratory evidence, not the same evidence class as a measured enclosed chamber resonance.',
    measurements: [{ parameter: 'Modelled acoustic frequency', frequencyHz: 114, reportedValue: 114, unit: 'Hz', method: 'Exploratory acoustic model compared against monument dimensions; not a controlled in-situ resonance measurement' }],
    caveat: 'Not a direct, controlled resonance measurement; avoid treating the approximate frequency as proof of intended tuning.',
    sources: [{ label: 'The Song of the Stone — ALBA Project', url: 'https://alba-project.org/song-of-the-stone/', year: 2026, publication: 'Exploratory acoustic model and site-dimension comparison' }]
  },
  {
    id: 'el-castillo-cave-amplification', name: 'El Castillo Cave — 108–110 Hz amplification band', lat: 43.2967, lon: -3.9994,
    region: 'Cantabria, Spain', period: 'Palaeolithic cave with evidence of prehistoric activity',
    measuredFrequenciesHz: [108, 110], researchBandHz: 110, status: 'published-measurement',
    summary: 'An archaeoacoustic study reported frequency-dependent amplification near 100 Hz, with the greatest effect at 108 and 110 Hz in a tested cave setup.',
    measurementContext: 'The study used simulated tones emitted at a proposed ritual location and recorded them at a likely audience position. The result is frequency-dependent sound amplification in the tested setup, not proof of a single intrinsic cave resonance or ancient tuning intent.',
    measurements: [{ parameter: 'Amplification test frequency', frequencyHz: 108, reportedValue: 108, unit: 'Hz', method: 'Simulated-tone playback and recorded sound-intensity comparison' }, { parameter: 'Amplification test frequency', frequencyHz: 110, reportedValue: 110, unit: 'Hz', method: 'Simulated-tone playback and recorded sound-intensity comparison' }],
    caveat: 'Setup-specific amplification, not proof that the cave produces a fixed 110 Hz resonance. Repeat measurements and geometry controls matter.',
    sources: [{ label: 'Gaona et al. (2014), Archaeoacoustic Investigation of a Prehistoric Cave Site: Frequency-Dependent Sound Amplification and Potential Relevance for Neurotheology', url: 'https://doi.org/10.14704/nq.2014.12.4.772', year: 2014, publication: 'NeuroQuantology 12(4)' }]
  },

  {
    id: 'waylands-smithy-resonance', name: "Wayland's Smithy — east and west chambers", lat: 51.5663, lon: -1.5976,
    region: 'Oxfordshire, England', period: 'Neolithic chambered long barrow',
    measuredFrequenciesHz: [102, 117], status: 'published-measurement',
    summary: "A published summary of the 1996 ancient-structure measurements reports different chamber resonances at Wayland's Smithy: about 102 Hz in the west chamber and 117 Hz in the east chamber.",
    measurementContext: 'West chamber: approximately 102 Hz; east chamber: approximately 117 Hz. These are chamber-specific reported values, not a single site-wide resonance.',
    measurements: [{ parameter: 'West chamber resonance', frequencyHz: 102, reportedValue: 102, unit: 'Hz', method: 'In-situ acoustic resonance measurement, as reported in the published study summary' }, { parameter: 'East chamber resonance', frequencyHz: 117, reportedValue: 117, unit: 'Hz', method: 'In-situ acoustic resonance measurement, as reported in the published study summary' }],
    caveat: 'Values are approximate and differ by chamber. Consult the original paper for full measurement uncertainty and setup details.',
    sources: [{ label: 'Jahn, Devereux & Ibison (1996), Acoustical resonances of assorted ancient structures', url: 'https://doi.org/10.1121/1.414642', year: 1996, publication: 'Journal of the Acoustical Society of America 99(2), 649–658' },
      { label: 'The phenomenon of resonance in the Labyrinth of Ravne — includes summary of six-site study and Wayland chamber values', url: 'https://sbresearchgroup.eu/index.php/en/articoli-in-inglese/99-the-phenomenon-of-resonance-in-the-labyrinth-of-ravne-preliminary-results', year: 2012, publication: 'Research summary' }]
  },
  {
    id: 'cairn-l-loughcrew-cohort', name: 'Cairn L — Loughcrew passage tomb (cohort resonance range)', lat: 53.7431, lon: -7.1124,
    region: 'County Meath, Ireland', period: 'Neolithic passage tomb',
    measuredFrequenciesHz: [95, 120], status: 'published-measurement',
    summary: 'Cairn L is listed among the six prehistoric structures investigated in the 1996 acoustic-resonance study; the study reports the six-site group resonances within 95–120 Hz.',
    measurementContext: 'The 95–120 Hz value is the published range for the six-structure study cohort, not a verified individual resonance value for Cairn L. The original paper should be checked before assigning a precise peak to this site.',
    measurements: [{ parameter: 'Cohort resonance range (not site-specific)', frequencyBand: '95–120 Hz across six structures', reportedValue: 95, unit: 'Hz lower bound', method: 'Published study summary; individual Cairn L peak not extracted from available source' }],
    caveat: 'Range-only cohort evidence. Do not interpret the endpoints as measured Cairn L peaks or as proof of a precise 110–112 Hz resonance.',
    sources: [{ label: 'Jahn, Devereux & Ibison (1996), Acoustical resonances of assorted ancient structures', url: 'https://doi.org/10.1121/1.414642', year: 1996, publication: 'Journal of the Acoustical Society of America 99(2), 649–658' }]
  },
  {
    id: 'cairn-i-loughcrew-cohort', name: 'Cairn I — Loughcrew passage tomb (cohort resonance range)', lat: 53.7443, lon: -6.7413,
    region: 'County Meath, Ireland', period: 'Neolithic passage tomb',
    measuredFrequenciesHz: [95, 120], status: 'published-measurement',
    summary: 'Cairn I is listed among the six prehistoric structures investigated in the 1996 acoustic-resonance study; the study reports the six-site group resonances within 95–120 Hz.',
    measurementContext: 'The 95–120 Hz value is the published range for the six-structure study cohort, not a verified individual resonance value for Cairn I. The original paper should be checked before assigning a precise peak to this site.',
    measurements: [{ parameter: 'Cohort resonance range (not site-specific)', frequencyBand: '95–120 Hz across six structures', reportedValue: 95, unit: 'Hz lower bound', method: 'Published study summary; individual Cairn I peak not extracted from available source' }],
    caveat: 'Range-only cohort evidence. Do not interpret the endpoints as measured Cairn I peaks or as proof of a precise 110–112 Hz resonance.',
    sources: [{ label: 'Jahn, Devereux & Ibison (1996), Acoustical resonances of assorted ancient structures', url: 'https://doi.org/10.1121/1.414642', year: 1996, publication: 'Journal of the Acoustical Society of America 99(2), 649–658' }]
  },
  {
    id: 'chun-quoit-cohort', name: 'Chûn Quoit — chambered tomb (cohort resonance range)', lat: 50.1504, lon: -5.6358,
    region: 'Cornwall, England', period: 'Neolithic chambered tomb',
    measuredFrequenciesHz: [95, 120], status: 'published-measurement',
    summary: 'Chûn Quoit is listed among the structures in the six-site 1996 acoustic-resonance study; the available summary reports the group range as 95–120 Hz.',
    measurementContext: 'The 95–120 Hz value is the cohort range across six tested structures, not a verified individual resonance value for Chûn Quoit.',
    measurements: [{ parameter: 'Cohort resonance range (not site-specific)', frequencyBand: '95–120 Hz across six structures', reportedValue: 95, unit: 'Hz lower bound', method: 'Published study summary; individual Chûn Quoit peak not extracted from available source' }],
    caveat: 'Range-only cohort evidence; do not claim a site-specific 110–112 Hz peak without the original per-site measurement.',
    sources: [{ label: 'Jahn, Devereux & Ibison (1996), Acoustical resonances of assorted ancient structures', url: 'https://doi.org/10.1121/1.414642', year: 1996, publication: 'Journal of the Acoustical Society of America 99(2), 649–658' }]
  },

  {
    id: 'west-kennet-long-barrow-candidate', name: 'West Kennet Long Barrow — acoustic candidate', lat: 51.4087, lon: -1.8509,
    region: 'Wiltshire, England', period: 'Neolithic long barrow, c. 3650 BCE',
    measuredFrequenciesHz: [110], researchBandHz: 110, status: 'candidate-only',
    summary: 'Added as a research candidate for low-frequency chamber acoustics; a reliable site-specific 110 Hz measurement was not verified from the supplied references.',
    measurementContext: 'The supplied list assigns approximately 110 Hz, but the evidence available here does not establish a reproducible measured resonance peak at this exact frequency.',
    caveat: 'Do not present 110 Hz as a confirmed measurement until a primary acoustic study with method, measurement position and uncertainty is identified.',
    sources: [{ label: 'Jahn, Devereux & Ibison (1996), Acoustical resonances of assorted ancient structures — background research', url: 'https://doi.org/10.1121/1.414642', year: 1996, publication: 'Journal of the Acoustical Society of America 99(2), 649–658' }]
  },
  {
    id: 'great-pyramid-kings-chamber-candidate', name: "Great Pyramid — King's Chamber acoustic candidate", lat: 29.9792, lon: 31.1342,
    region: 'Giza, Egypt', period: 'Old Kingdom, 4th Dynasty, c. 26th century BCE',
    measuredFrequenciesHz: [110, 117], researchBandHz: 110, status: 'candidate-only',
    summary: 'Research marker for claims of low-frequency chamber modes around 110–117 Hz and separate claims linking the chamber to A=432 Hz tuning. Neither claim is treated as proof that the chamber was intentionally tuned to either pitch.',
    measurementContext: 'Chamber modes depend on room geometry, boundary conditions, source and receiver positions. The 110–117 Hz figures and the A=432 Hz association remain research claims here, not verified site-specific measurements of an acoustic tuning system.'
    caveat: 'Candidate only. A=432 Hz is a musical tuning reference, not evidence of a room resonance; no evidence here proves the chamber was built for 432 Hz or that 110 Hz and 432 Hz form a designed system.'
    sources: [{ label: 'User-supplied reference: Interesting Engineering — temples and 111 Hz', url: 'https://interestingengineering.com/science/temples-resonates-frequency-111-hz', year: 2026, publication: 'Popular science article; claim requires primary-source verification' }]
  },
  {
    id: 'tarxien-temples-candidate', name: 'Tarxien Temples — low-frequency acoustic candidate', lat: 35.8692, lon: 14.5121,
    region: 'Tarxien, Malta', period: 'Neolithic temple complex, c. 3150–2500 BCE',
    measuredFrequenciesHz: [111], researchBandHz: 110, status: 'candidate-only',
    summary: 'Included as a site to investigate for low-frequency acoustics. The supplied 111 Hz claim has not been verified here as a published, site-specific resonance measurement.',
    measurementContext: 'A frequency label supplied in a secondary list is retained as a candidate search target, not as confirmed measurement data.',
    caveat: 'Do not infer that the temple shares the Hypogeum’s resonance merely because both are in Malta or have megalithic architecture.',
    sources: [{ label: 'User-supplied reference: Interesting Engineering — temples and 111 Hz', url: 'https://interestingengineering.com/science/temples-resonates-frequency-111-hz', year: 2026, publication: 'Popular science article; primary measurement source needs verification' }]
  },
  {
    id: 'mnajdra-temples-candidate', name: 'Mnajdra Temple Complex — low-frequency acoustic candidate', lat: 35.8272, lon: 14.4361,
    region: 'Qrendi, Malta', period: 'Neolithic temple complex, c. 3600–2500 BCE',
    measuredFrequenciesHz: [110], researchBandHz: 110, status: 'candidate-only',
    summary: 'Added as a research target for possible low-frequency acoustic behavior; no traceable primary measurement confirming exactly 110 Hz was established here.',
    measurementContext: 'The 110 Hz value comes from the supplied secondary list and is a hypothesis/search target, not a confirmed measurement in this catalog.',
    caveat: 'Solar alignments and architectural acoustics are separate questions; one does not demonstrate the other.',
    sources: [{ label: 'User-supplied reference: Interesting Engineering — temples and 111 Hz', url: 'https://interestingengineering.com/science/temples-resonates-frequency-111-hz', year: 2026, publication: 'Popular science article; primary measurement source needs verification' }]
  },
  {
    id: 'hagar-qim-candidate', name: 'Ħaġar Qim — low-frequency acoustic candidate', lat: 35.8277, lon: 14.4423,
    region: 'Qrendi, Malta', period: 'Neolithic temple complex, c. 3600–2500 BCE',
    measuredFrequenciesHz: [111], researchBandHz: 110, status: 'candidate-only',
    summary: 'Added as a research target for possible low-frequency acoustic behavior; the supplied 111 Hz claim has not been verified as a published site-specific measurement.',
    measurementContext: 'The frequency is preserved as a candidate research value from the supplied list, not as a confirmed acoustic peak.',
    caveat: 'Limestone construction alone does not establish a specific resonance frequency. A reproducible measurement study is needed.',
    sources: [{ label: 'User-supplied reference: Interesting Engineering — temples and 111 Hz', url: 'https://interestingengineering.com/science/temples-resonates-frequency-111-hz', year: 2026, publication: 'Popular science article; primary measurement source needs verification' }]
  },
  {
    id: 'bet-guvrin-bell-caves-candidate', name: 'Bet Guvrin Bell Caves — acoustic candidate', lat: 31.6062, lon: 34.8967,
    region: 'Judean Lowlands, Israel', period: 'Ancient quarry and bell-shaped cave complex; periods vary by cave',
    measuredFrequenciesHz: [110], researchBandHz: 110, status: 'candidate-only',
    summary: 'Added for future investigation of low-frequency behavior and reverberation in the bell caves. The supplied 110 Hz claim is not confirmed here as a measured resonance.',
    measurementContext: 'Cave reverberation or amplification does not by itself establish a fixed resonance at 110 Hz; this candidate needs a traceable field study.',
    caveat: 'Do not treat the secondary-list frequency as measured fact until primary measurements and the tested cave/position are documented.',
    sources: [{ label: 'User-supplied reference: The History Blog — ancient acoustic sites', url: 'https://www.thehistoryblog.com/archives/4114', year: 2009, publication: 'Secondary article; primary measurement source needs verification' }]
  },

  {
    id: 'vitthala-temple-musical-pillars-candidate',
    name: 'Vitthala Temple — Musical Pillars',
    lat: 15.3389, lon: 76.4672,
    region: 'Hampi, Karnataka, India',
    period: 'Vijayanagara period, primarily 15th–16th century CE',
    measuredFrequenciesHz: [], status: 'candidate-only',
    summary: 'Added as a musical-architecture site because the temple’s stone pillars are widely reported to produce different tones when struck. This is a variable-tone research category, not a verified Solfeggio-frequency installation.',
    measurementContext: 'The supplied description mentions 56 pillars and variable musical notes. No calibrated frequency table or reproducible measurements for individual pillars are included in this record.',
    caveat: 'Do not label the pillars as intentionally tuned to Solfeggio frequencies without measured pitch data and a primary study. Striking or touching protected heritage structures may be prohibited.',
    sources: [{ label: 'UNESCO World Heritage Centre — Group of Monuments at Hampi', url: 'https://whc.unesco.org/en/list/241/', year: 2026, publication: 'Heritage site overview; not a frequency measurement study' }]
  },
  {
    id: 'chavin-de-huantar-pututu-acoustics-candidate',
    name: 'Chavín de Huántar — galleries and pututu acoustics',
    lat: -9.5931, lon: -77.1778,
    region: 'Ancash, Peru',
    period: 'Formative-period ceremonial center, principally c. 1200–500 BCE',
    measuredFrequenciesHz: [110, 120], researchBandHz: 110, status: 'candidate-only',
    summary: 'Added as an archaeoacoustic site for the relationship between underground galleries and sound from Strombus-shell trumpets (pututus). The 110–120 Hz band is a research target from the supplied list, not a verified fixed site resonance.',
    measurementContext: 'The site is known for galleries and archaeological evidence of shell trumpets. The exact 110–120 Hz range in the supplied list has not been verified here as a controlled in-situ resonance measurement.',
    caveat: 'Evidence that instruments were used in a ceremonial space does not establish that the architecture was tuned to a specific frequency. Keep the frequency range marked as candidate-only.',
    sources: [{ label: 'UNESCO World Heritage Centre — Chavín (Archaeological Site)', url: 'https://whc.unesco.org/en/list/330/', year: 2026, publication: 'Heritage site overview; not a frequency measurement study' }]
  },
  {
    id: 'chartres-cathedral-432hz-claim-candidate',
    name: 'Chartres Cathedral — 432 Hz tuning claim',
    lat: 48.4480, lon: 1.4875,
    region: 'Chartres, France',
    period: 'Gothic cathedral, construction began in the 12th century CE',
    measuredFrequenciesHz: [432], status: 'candidate-only',
    summary: 'Added as a location associated with modern claims about sacred geometry and A=432 Hz tuning. This is a cultural/research claim marker, not a measured acoustic resonance of the cathedral.',
    measurementContext: 'The supplied list links the cathedral’s proportions to 432 Hz, but architectural dimensions alone do not demonstrate a particular musical tuning standard. No calibrated measurement establishing a 432 Hz building resonance is recorded here.',
    caveat: '432 Hz is a pitch reference used in some modern tuning discussions; it is not evidence of an ancient universal tuning standard or a natural room resonance. The historical claim requires primary documentary evidence.',
    sources: [{ label: 'UNESCO World Heritage Centre — Chartres Cathedral', url: 'https://whc.unesco.org/en/list/81/', year: 2026, publication: 'Heritage site overview; not a frequency measurement study' }]
  },
];
