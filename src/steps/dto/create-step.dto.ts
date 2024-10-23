export class CreateStepDto {
	data: Data[];
	name: string;
	units: string;
}

export class Data {
	asleep?: number;
	awake?: number;
	core?: number;
	date: string;
	deep?: number;
	inBed?: number;
	inBedEnd?: string;
	inBedStart?: string;
	rem?: number;
	sleepEnd?: string;
	sleepStart?: string;
	source: string;
	qty?: number;
}
