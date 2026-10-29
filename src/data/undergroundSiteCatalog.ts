/**
 * Underground cities, caves, tunnels, subterranean settlements, and bunkers.
 * Initial curated map subset based on the user-supplied Bold Earth guide.
 * The source is a popular secondary compilation, not a primary archaeological gazetteer.
 * Coordinates are approximate locality pins; individual claims and access status require
 * confirmation from official site or scholarly sources before being treated as established.
 */
export type UndergroundSiteRecord = {
  name: string;
  lat: number;
  lon: number;
  year: number;
  category: 'underground';
  tags: string[];
  desc: string;
  sourceUrl: string;
};

const SOURCE = 'https://theboldearth.com/stories/underground-cities-caves-tunnels-every-country';
const TAGS = ['UNDERGROUND CITIES', 'UNDERGROUND SITES', 'CAVES & TUNNELS', 'HISTORICAL SITES'];

export const UNDERGROUND_SITE_CATALOG: UndergroundSiteRecord[] = [
  { name: 'Derinkuyu Underground City', lat: 38.3737, lon: 34.7340, year: -800, category: 'underground', tags: TAGS, desc: 'Multi-level subterranean settlement in Cappadocia, Türkiye, with rooms and ventilation shafts. The pin marks the visitor site; exact construction phases are debated.', sourceUrl: SOURCE },
  { name: 'Kaymakli Underground City', lat: 38.4611, lon: 34.7519, year: -700, category: 'underground', tags: TAGS, desc: 'Extensive multi-level underground settlement in Cappadocia, Türkiye. Map pin is approximate to the public site entrance.', sourceUrl: SOURCE },
  { name: 'Özkonak Underground City', lat: 38.8250, lon: 34.5620, year: -500, category: 'underground', tags: TAGS, desc: 'Subterranean complex north of Avanos in Cappadocia, Türkiye; commonly interpreted as a refuge and settlement network.', sourceUrl: SOURCE },
  { name: 'Petra Rock-Cut City', lat: 30.3285, lon: 35.4444, year: -300, category: 'underground', tags: TAGS, desc: 'Nabataean city with extensive rock-cut tombs, chambers, and water infrastructure. This is a rock-cut archaeological city, not a wholly underground city.', sourceUrl: SOURCE },
  { name: 'Matera Sassi and Cave Dwellings', lat: 40.6664, lon: 16.6080, year: -700, category: 'underground', tags: TAGS, desc: 'Historic settlement in southern Italy with dwellings, churches, and rooms excavated into limestone; chronology varies by structure.', sourceUrl: SOURCE },
  { name: 'Paris Catacombs', lat: 48.8338, lon: 2.3324, year: 1786, category: 'underground', tags: TAGS, desc: 'Ossuary established in former limestone quarries beneath Paris. Public access is restricted to the official visitor route.', sourceUrl: SOURCE },
  { name: 'Naples Underground', lat: 40.8518, lon: 14.2576, year: -700, category: 'underground', tags: TAGS, desc: 'Connected historic underground spaces include Greek and Roman water infrastructure, cisterns, quarries, and wartime shelters; individual tours cover different routes.', sourceUrl: SOURCE },
  { name: 'Wieliczka Salt Mine', lat: 49.9833, lon: 20.0556, year: 1200, category: 'underground', tags: TAGS, desc: 'Historic salt mine near Kraków with underground chambers, shafts, and chapels; a UNESCO World Heritage property.', sourceUrl: SOURCE },
  { name: 'Hospital in the Rock', lat: 47.5010, lon: 19.0280, year: 1944, category: 'underground', tags: TAGS, desc: 'Wartime hospital and later civil-defence facility in the Buda Castle hill cave system, Budapest.', sourceUrl: SOURCE },
  { name: 'RÉSO Underground City', lat: 45.5019, lon: -73.5674, year: 1962, category: 'underground', tags: TAGS, desc: 'Downtown Montreal pedestrian network linking shopping, transit, offices, and public buildings. Pin is a central reference point for a distributed network.', sourceUrl: SOURCE },
  { name: 'PATH Underground Network', lat: 43.6487, lon: -79.3800, year: 1900, category: 'underground', tags: TAGS, desc: 'Toronto’s connected underground pedestrian system linking offices, transit, and retail; the pin represents the central network, not a single entrance.', sourceUrl: SOURCE },
  { name: 'Seattle Underground', lat: 47.6015, lon: -122.3303, year: 1890, category: 'underground', tags: TAGS, desc: 'Preserved former street and building spaces beneath parts of Seattle’s Pioneer Square after street-level rebuilding.', sourceUrl: SOURCE },
  { name: 'Mammoth Cave', lat: 37.1862, lon: -86.1005, year: -10000, category: 'underground', tags: TAGS, desc: 'Vast limestone cave system in Kentucky, USA, with a very long surveyed passage network and archaeological evidence of Indigenous use.', sourceUrl: SOURCE },
  { name: 'Carlsbad Caverns', lat: 32.1479, lon: -104.5567, year: -1000, category: 'underground', tags: TAGS, desc: 'Major limestone cave system in New Mexico, USA, with large chambers and protected cave formations.', sourceUrl: SOURCE },
  { name: 'Cu Chi Tunnels', lat: 11.0510, lon: 106.4630, year: 1940, category: 'underground', tags: TAGS, desc: 'Historic tunnel network northwest of Ho Chi Minh City associated with wartime logistics and shelter; public exhibits cover selected sections.', sourceUrl: SOURCE },
  { name: 'Puerto Princesa Underground River', lat: 10.1770, lon: 118.9260, year: 0, category: 'underground', tags: TAGS, desc: 'Navigable underground river and cave system on Palawan, Philippines, within a UNESCO-listed national park.', sourceUrl: SOURCE },
  { name: 'Hang Sơn Đoòng', lat: 17.4538, lon: 106.2860, year: 0, category: 'underground', tags: TAGS, desc: 'Enormous natural cave in Phong Nha–Kẻ Bàng, Vietnam. Access is controlled and generally requires an authorized expedition.', sourceUrl: SOURCE },
  { name: 'Coober Pedy Underground Dwellings', lat: -29.0135, lon: 134.7540, year: 1915, category: 'underground', tags: TAGS, desc: 'Australian outback town known for homes, churches, and other spaces excavated underground to moderate extreme surface temperatures.', sourceUrl: SOURCE },
  { name: 'Longyou Caves', lat: 29.0300, lon: 119.1700, year: -200, category: 'underground', tags: TAGS, desc: 'Large human-made caverns in Zhejiang, China. Their construction date and original purpose remain uncertain.', sourceUrl: SOURCE },
  { name: 'Edinburgh Vaults', lat: 55.9486, lon: -3.1883, year: 1788, category: 'underground', tags: TAGS, desc: 'Historic chambers formed beneath the South Bridge in Edinburgh; specific access and historical interpretations vary by vault and tour.', sourceUrl: SOURCE },
  { name: 'Dixia Cheng Underground City', lat: 39.9042, lon: 116.4074, year: 1970, category: 'underground', tags: TAGS, desc: 'Cold War-era shelter and tunnel project in Beijing. The supplied guide describes a broad network; exact extent and current public access should be checked with local authorities.', sourceUrl: SOURCE },
  { name: 'Diefenbunker', lat: 45.3507, lon: -76.0470, year: 1961, category: 'underground', tags: TAGS, desc: 'Former Canadian Cold War emergency government headquarters near Carp, Ontario, now a museum.', sourceUrl: SOURCE },
  { name: 'Greenbrier Bunker', lat: 37.7873, lon: -80.3064, year: 1962, category: 'underground', tags: TAGS, desc: 'Former concealed emergency relocation facility for the US Congress beneath the Greenbrier resort in West Virginia; now interpreted as a historic site.', sourceUrl: SOURCE },
  { name: 'Chavín de Huántar Underground Galleries', lat: -9.5938, lon: -77.1775, year: -900, category: 'underground', tags: TAGS, desc: 'Archaeological ceremonial complex in Peru containing stone-built galleries and passageways. Included here for its documented subterranean architecture.', sourceUrl: SOURCE },
  { name: 'Ajanta Cave Monasteries', lat: 20.5519, lon: 75.7033, year: -200, category: 'underground', tags: TAGS, desc: 'Rock-cut Buddhist monasteries and worship halls in Maharashtra, India, with painted and sculpted interiors.', sourceUrl: SOURCE },
  { name: 'Ellora Cave Complex', lat: 20.0268, lon: 75.1780, year: 600, category: 'underground', tags: TAGS, desc: 'Rock-cut Buddhist, Hindu, and Jain cave temples in Maharashtra, India, including the monumental Kailasa temple.', sourceUrl: SOURCE },
  { name: 'Dambulla Cave Temple', lat: 7.8567, lon: 80.6492, year: -100, category: 'underground', tags: TAGS, desc: 'Cave temple complex in Sri Lanka with painted and sculpted Buddhist shrines.', sourceUrl: SOURCE },
  { name: 'Bunk’Art 1', lat: 41.3494, lon: 19.8560, year: 1978, category: 'underground', tags: TAGS, desc: 'Large Cold War-era bunker on the outskirts of Tirana, Albania, now a museum.', sourceUrl: SOURCE },
  { name: 'Sarajevo Tunnel of Hope', lat: 43.8230, lon: 18.3360, year: 1993, category: 'underground', tags: TAGS, desc: 'Wartime tunnel built during the siege of Sarajevo to connect the besieged city with territory beyond the airport perimeter.', sourceUrl: SOURCE },
  { name: 'Manzana de las Luces Tunnels', lat: -34.6118, lon: -58.3730, year: 1700, category: 'underground', tags: TAGS, desc: 'Historic tunnel and subterranean remains in central Buenos Aires; interpretations of the network’s original extent and connections vary.', sourceUrl: SOURCE },
  { name: 'Joya de Cerén Archaeological Site', lat: 13.8278, lon: -89.3600, year: 600, category: 'underground', tags: TAGS, desc: 'Maya farming settlement preserved under volcanic ash in El Salvador. It is buried archaeological architecture, not an underground city designed for habitation.', sourceUrl: SOURCE },
];
