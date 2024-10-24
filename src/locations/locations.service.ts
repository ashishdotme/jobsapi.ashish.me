import { Injectable } from '@nestjs/common';
import { CreateLocationDto } from './dto/create-location.dto';
import axios from 'axios';

@Injectable()
export class LocationsService {
	async create(createLocationDto: CreateLocationDto, apiKey: string) {
		const location = createLocationDto.locations[createLocationDto.locations.length - 1];
		const level = Math.round(location.properties.battery_level * 100);
		const newLocation = {
			batteryLevel: level,
			batteryState: location.properties.battery_state,
			coordinates: location.geometry.coordinates,
			timestamp: location.properties.timestamp,
		};
		console.log(newLocation);
		await this.postLocation(newLocation, apiKey);
		return { result: 'ok' };
	}

	private async postLocation(newLocation: any, apikey: string): Promise<any> {
		try {
			const config = {
				headers: {
					apikey: apikey,
				},
			};
			const response = await axios.post('https://api.ashish.me/locations', newLocation, config);
			return response.data;
		} catch (error) {
			console.error(error.response.data);
		}
	}
}
