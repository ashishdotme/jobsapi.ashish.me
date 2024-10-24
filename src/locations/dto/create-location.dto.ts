export class CreateLocationDto {
	locations: Location[];
}

export class Location {
	geometry: Geometry;
	properties: Properties;
}

export class Geometry {
	coordinates: number[];
}

export class Properties {
	battery_state: string;
	timestamp: string;
	battery_level: number;
}
