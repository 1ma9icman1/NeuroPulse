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
];
