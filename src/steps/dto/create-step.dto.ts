export class CreateStepDto {
	data: Data;
}

export class Data {
	metrics: Metric[];
}

export class Metric {
	units: string;
	name: string;
	data: Daum[];
}

export class Daum {
	source: string;
	date: string;
	qty: number;
}
