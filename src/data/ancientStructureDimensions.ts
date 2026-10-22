/**
 * Reference dimensions for a small, explicitly selected sample of famous ancient structures.
 * Heights are approximate and not directly comparable in every case: pyramid heights may be
 * original reconstructed heights, while mound/stone heights use different measurement bases.
 * This sample is descriptive, not a representative dataset for calculating a universal mean.
 */
export interface AncientStructureDimension {
  id: string;
  name: string;
  lat: number;
  lon: number;
  location: string;
  approximateHeightFt: number;
  heightBasis: string;
  evidenceNote: string;
  geometryClaim?: string;
  numberSystem?: 'decimal' | 'vigesimal' | 'sexagesimal' | 'mixed-or-context-dependent';
  numberSystemNote?: string;
  sourceUrl: string;
}

export const ANCIENT_STRUCTURE_DIMENSIONS: AncientStructureDimension[] = [
  {
    id: 'great-pyramid-giza',
    name: 'Great Pyramid of Giza',
    lat: 29.9792, lon: 31.1342, location: 'Giza, Egypt',
    approximateHeightFt: 481,
    heightBasis: 'Original reconstructed height; the pyramid is shorter today after loss of casing stones and summit material.',
    evidenceNote: 'Often given as about 481–481.4 ft. The base-perimeter / twice-height relationship is a mathematical observation; intent to encode pi is debated.',
    sourceUrl: 'https://www.britannica.com/topic/Great-Pyramid-of-Giza'
  },
  {
    id: 'pyramid-of-khafre',
    name: 'Pyramid of Khafre',
    lat: 29.9761, lon: 31.1309, location: 'Giza, Egypt',
    approximateHeightFt: 471,
    heightBasis: 'Original reconstructed height; present height is lower.',
    evidenceNote: 'Approximate original height, not a measurement of the current surviving structure.',
    sourceUrl: 'https://www.britannica.com/topic/Pyramid-of-Khafre'
  },
  {
    id: 'red-pyramid',
    name: 'Red Pyramid',
    lat: 29.8084, lon: 31.2062, location: 'Dahshur, Egypt',
    approximateHeightFt: 344,
    heightBasis: 'Approximate original height.',
    evidenceNote: 'The matching rounded height sometimes quoted for the Bent Pyramid is not evidence of a universal stable-height limit; footprint, angle, substrate and construction history differ.',
    sourceUrl: 'https://www.britannica.com/topic/Red-Pyramid'
  },
  {
    id: 'bent-pyramid',
    name: 'Bent Pyramid',
    lat: 29.7901, lon: 31.2098, location: 'Dahshur, Egypt',
    approximateHeightFt: 344,
    heightBasis: 'Approximate original height.',
    evidenceNote: 'The change in slope is well known, but the claim that 344 ft is an exact structural height limit is not established.',
    sourceUrl: 'https://www.britannica.com/topic/Bent-Pyramid'
  },
  {
    id: 'lighthouse-of-alexandria',
    name: 'Lighthouse of Alexandria (Pharos)',
    lat: 31.2139, lon: 29.8856, location: 'Alexandria, Egypt',
    approximateHeightFt: 330,
    heightBasis: 'Frequently cited approximate reconstruction; original dimensions remain uncertain.',
    evidenceNote: 'The structure is lost and its height estimates vary among historical reconstructions; treat 330 ft as approximate.',
    sourceUrl: 'https://www.britannica.com/topic/lighthouse-of-Alexandria'
  },
  {
    id: 'great-pyramid-cholula',
    name: 'Great Pyramid of Cholula',
    lat: 19.0577, lon: -98.3002, location: 'Cholula, Puebla, Mexico',
    approximateHeightFt: 217,
    heightBasis: 'Approximate height above the surrounding plain; the monument includes a large natural/modified hill and layered construction.',
    evidenceNote: 'Height definitions differ depending on whether measured from the surrounding plain or another base datum.',
    sourceUrl: 'https://www.britannica.com/place/Cholula'
  },
  {
    id: 'pyramid-of-the-sun',
    name: 'Pyramid of the Sun',
    lat: 19.6925, lon: -98.8438, location: 'Teotihuacan, Mexico',
    approximateHeightFt: 215,
    heightBasis: 'Approximate surviving monument height.',
    evidenceNote: 'A comparison with Egyptian pyramids does not by itself establish a shared universal engineering threshold.',
    geometryClaim: 'Claimed perimeter/height match is not exact with the quoted values: 2,932 / 215 ≈ 13.64, while 4π ≈ 12.57. Treat the exact 4π claim as unverified.',
    sourceUrl: 'https://whc.unesco.org/en/list/414/'
  },
  {
    id: 'step-pyramid-djoser',
    name: 'Step Pyramid of Djoser',
    lat: 29.8713, lon: 31.2165, location: 'Saqqara, Egypt',
    approximateHeightFt: 205,
    heightBasis: 'Approximate original height.',
    evidenceNote: 'Height is rounded; do not interpret similarity to other monuments as proof of a universal limit without a broader, methodologically consistent sample.',
    sourceUrl: 'https://www.britannica.com/topic/Step-Pyramid-of-Djoser'
  },
  {
    id: 'newgrange-mound',
    name: 'Newgrange Mound',
    lat: 53.6946, lon: -6.4756, location: 'County Meath, Ireland',
    approximateHeightFt: 40,
    heightBasis: 'Approximate mound height; measurement varies with the chosen ground/profile datum.',
    evidenceNote: 'A mound is not directly comparable to a pyramid’s reconstructed apex height or to individual standing stones.',
    sourceUrl: 'https://whc.unesco.org/en/list/659/'
  },
  {
    id: 'stonehenge-sarsen-stones',
    name: 'Stonehenge Sarsen Stones',
    lat: 51.1789, lon: -1.8262, location: 'Wiltshire, England',
    approximateHeightFt: 24,
    heightBasis: 'Approximate height quoted for the tallest sarsen uprights, not a mean height for all stones.',
    evidenceNote: 'Stonehenge contains stones of different types and dimensions; 24 ft should not be treated as the average height of all sarsens or bluestones.',
    sourceUrl: 'https://whc.unesco.org/en/list/373/'
  }

  {
    id: 'parthenon-athens',
    name: 'Parthenon',
    lat: 37.9715, lon: 23.7267, location: 'Athens, Greece',
    approximateHeightFt: 45,
    heightBasis: 'Approximate height to roofline; published dimensions depend on measurement convention.',
    evidenceNote: 'Known for careful proportions and optical refinements. Claims that its facade or column spacing exactly encodes the golden ratio depend on which dimensions are selected and are debated.',
    geometryClaim: 'A visual resemblance to phi ≈ 1.618 is not proof that builders used the golden ratio as an explicit design rule. The often-cited 4:9 proportion depends on which architectural dimensions are selected.',
    numberSystem: 'mixed-or-context-dependent',
    numberSystemNote: 'Greek architectural practice is often described through whole-number ratios and geometric construction. Modern decimal measurements do not prove that builders used decimal fractions.'
    sourceUrl: 'https://whc.unesco.org/en/list/404/'
  },
  {
    id: 'temple-of-kukulkan-chichen-itza',
    name: 'Temple of Kukulkan (El Castillo)',
    lat: 20.6829, lon: -88.5686, location: 'Chichen Itza, Yucatan, Mexico',
    approximateHeightFt: 98,
    heightBasis: 'Approximate overall height; values vary by measurement datum.',
    evidenceNote: 'Four stairways are commonly described as having 91 steps each; 4 × 91 plus the top platform is interpreted as 365. Equinox-season light and shadow effects are documented, but visibility depends on conditions.',
    geometryClaim: 'The 365-step interpretation is a widely discussed calendrical reading, not proof that every feature was engineered with modern mathematical precision.',
    sourceUrl: 'https://whc.unesco.org/en/list/483/'
  },
  {
    id: 'borobudur-temple',
    name: 'Borobudur Temple',
    lat: -7.6079, lon: 110.2038, location: 'Central Java, Indonesia',
    approximateHeightFt: 115,
    heightBasis: 'Approximate height above surrounding ground; estimates depend on restoration and datum.',
    evidenceNote: 'Borobudur has square terraces and circular upper platforms in a Buddhist cosmological layout. A specific 4:6:9 scaling rule or direct Fibonacci relationship is not established here.',
    geometryClaim: 'Treat exact 4:6:9 and golden-ratio claims as hypotheses unless supported by dimension-by-dimension architectural analysis.',
    sourceUrl: 'https://whc.unesco.org/en/list/592/'
  },

  {
    id: 'mohenjo-daro-indus-city',
    name: 'Mohenjo-daro',
    lat: 27.3242, lon: 68.1385, location: 'Sindh, Pakistan',
    approximateHeightFt: 0,
    heightBasis: 'Urban archaeological site; no single comparable structure height assigned.',
    evidenceNote: 'Indus Valley archaeology documents standardized weights, brick proportions and planned streets. The Indus script remains undeciphered, so the exact notation system behind these practices is uncertain.',
    geometryClaim: 'Standardized measures show metrology, but do not prove that builders encoded decimal representations of pi or phi.',
    numberSystem: 'mixed-or-context-dependent',
    numberSystemNote: 'Do not label the Indus civilization definitively base-10: its full numerical notation is not securely known.',
    sourceUrl: 'https://whc.unesco.org/en/list/138/'
  },
  {
    id: 'harappa-indus-city',
    name: 'Harappa',
    lat: 30.6310, lon: 72.8656, location: 'Punjab, Pakistan',
    approximateHeightFt: 0,
    heightBasis: 'Urban archaeological site; no single comparable structure height assigned.',
    evidenceNote: 'Harappan archaeology documents standardized bricks, weights and measures. The undeciphered Indus script limits certainty about their exact number notation.',
    geometryClaim: 'Uniform brick ratios and planning are evidence of standardization, not direct proof that pi or phi was intentionally represented as a decimal.',
    numberSystem: 'mixed-or-context-dependent',
    numberSystemNote: 'The evidence does not establish the Indus civilization’s complete counting notation as definitively decimal or vigesimal.',
    sourceUrl: 'https://whc.unesco.org/en/list/138/'
  },

  {
    id: 'pantheon-rome',
    name: 'Pantheon',
    lat: 41.8986, lon: 12.4769, location: 'Rome, Italy',
    approximateHeightFt: 142,
    heightBasis: 'Approximate interior height to dome apex; the interior diameter is also about 142 ft.',
    evidenceNote: 'The interior is famously organized around a near-spherical relationship between height and diameter. Roman builders used geometric setting-out methods; modern decimal measurements do not imply they used decimal fractions.',
    geometryClaim: 'The approximate equality of interior height and diameter is a geometric relationship, not evidence that the architects encoded an irrational decimal.',
    numberSystem: 'mixed-or-context-dependent',
    numberSystemNote: 'Roman measures and practical geometric construction were used. Do not attribute modern decimal notation to builders because dimensions are now expressed in decimal feet or metres.',
    sourceUrl: 'https://whc.unesco.org/en/list/91/'
  },
  {
    id: 'tikal-maya-ceremonial-center',
    name: 'Tikal — Maya ceremonial center',
    lat: 17.2220, lon: -89.6237, location: 'Petén, Guatemala',
    approximateHeightFt: 230,
    heightBasis: 'Approximate height commonly cited for a tallest temple-pyramid; not representative of every Tikal structure.',
    evidenceNote: 'Tikal belongs to the broader Maya architectural and calendrical tradition. Individual building heights vary substantially.',
    geometryClaim: 'Maya numeration was generally vigesimal (base 20), but this does not prove a single base-20 rule governed every architectural dimension.',
    numberSystem: 'vigesimal',
    numberSystemNote: 'Maya mathematics used a base-20 system and place-value notation, with calendar-specific conventions.',
    sourceUrl: 'https://whc.unesco.org/en/list/64/'
  },
];
