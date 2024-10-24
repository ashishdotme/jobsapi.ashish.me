export class CreateMetricDto {
	data: Data;
}

export class Data {
	metrics: Metric[];
}

export class Metric {
	name: string;
	data: Daum[];
	units: string;
}

export class Daum {
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
