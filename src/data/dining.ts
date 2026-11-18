export type Diet = "vegetarian" | "vegan" | "gluten-free";
export type CrowdLevel = "Quiet" | "Moderate" | "Busy" | "Very busy";

export type MenuItem = { name: string; tags: Diet[] };

export type DiningHall = {
  id: string;
  name: string;
  short: string;
  lat: number;
  lng: number;
  college: boolean;
  lunch: MenuItem[];
  dinner: MenuItem[];
};

const LUNCH: MenuItem[] = [
  { name: "Roasted vegetable bowl", tags: ["vegetarian", "vegan", "gluten-free"] },
  { name: "Herb grilled chicken", tags: ["gluten-free"] },
  { name: "Lentil and rice plate", tags: ["vegetarian", "vegan", "gluten-free"] },
  { name: "Margherita pizza", tags: ["vegetarian"] },
  { name: "Tofu stir fry", tags: ["vegetarian", "vegan"] },
  { name: "Turkey sandwich", tags: [] },
  { name: "Greek salad", tags: ["vegetarian", "gluten-free"] },
  { name: "Black bean tacos", tags: ["vegetarian", "vegan"] },
];

const DINNER: MenuItem[] = [
  { name: "Baked salmon", tags: ["gluten-free"] },
  { name: "Mushroom risotto", tags: ["vegetarian", "gluten-free"] },
  { name: "Chickpea curry", tags: ["vegetarian", "vegan", "gluten-free"] },
  { name: "Pasta primavera", tags: ["vegetarian"] },
  { name: "Roast chicken", tags: ["gluten-free"] },
  { name: "Sesame noodles", tags: ["vegetarian", "vegan"] },
  { name: "Beef stew", tags: ["gluten-free"] },
  { name: "Stuffed peppers", tags: ["vegetarian", "vegan", "gluten-free"] },
];

function menu(index: number, source: MenuItem[]): MenuItem[] {
  return [0, 1, 2].map((offset) => source[(index + offset * 3) % source.length]);
}

function hall(id: string, name: string, short: string, lat: number, lng: number, college: boolean, index: number): DiningHall {
  return { id, name, short, lat, lng, college, lunch: menu(index, LUNCH), dinner: menu(index + 1, DINNER) };
}

export const DINING_HALLS: DiningHall[] = [
  hall("silliman", "Silliman Dining Hall", "Silliman", 41.3146, -72.9226, true, 0),
  hall("timothy-dwight", "Timothy Dwight Dining Hall", "TD", 41.3092, -72.9304, true, 1),
  hall("branford", "Branford Dining Hall", "Branford", 41.3094, -72.9296, true, 2),
  hall("saybrook", "Saybrook Dining Hall", "Saybrook", 41.309, -72.929, true, 3),
  hall("davenport", "Davenport Dining Hall", "Davenport", 41.3085, -72.9312, true, 4),
  hall("pierson", "Pierson Dining Hall", "Pierson", 41.3082, -72.932, true, 5),
  hall("jonathan-edwards", "Jonathan Edwards Dining Hall", "JE", 41.3089, -72.9284, true, 6),
  hall("berkeley", "Berkeley Dining Hall", "Berkeley", 41.3103, -72.9316, true, 7),
  hall("grace-hopper", "Grace Hopper Dining Hall", "Hopper", 41.31, -72.9321, true, 8),
  hall("trumbull", "Trumbull Dining Hall", "Trumbull", 41.3107, -72.9308, true, 9),
  hall("morse", "Morse Dining Hall", "Morse", 41.3125, -72.9319, true, 10),
  hall("ezra-stiles", "Ezra Stiles Dining Hall", "Stiles", 41.3128, -72.9324, true, 11),
  hall("benjamin-franklin", "Benjamin Franklin Dining Hall", "Franklin", 41.3154, -72.9262, true, 12),
  hall("pauli-murray", "Pauli Murray Dining Hall", "Murray", 41.3161, -72.9249, true, 13),
  hall("commons", "Commons Dining Hall", "Commons", 41.3084, -72.9288, false, 14),
  hall("slifka", "Slifka Center", "Slifka", 41.3119, -72.9262, false, 15),
];

export const CROWD_LABEL = "Typical for this time.";
