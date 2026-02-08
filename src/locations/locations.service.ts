import { Injectable, Logger } from '@nestjs/common';
import { CreateLocationDto } from './dto/create-location.dto';
import axios from 'axios';
import { sendEvent } from '../common/utils';

@Injectable()
export class LocationsService {
	private readonly logger = new Logger(LocationsService.name);

	async create(createLocationDto: CreateLocationDto, apiKey: string) {
		if (!createLocationDto.locations?.length) {
			this.logger.warn('Location creation rejected: empty locations array');
			return { error: 'Locations cannot be blank' };
		}

		const location = createLocationDto.locations[createLocationDto.locations.length - 1];
		const level = Math.round(location.properties.battery_level * 100);
		const newLocation = {
			batteryLevel: level,
			batteryState: location.properties.battery_state,
			coordinates: location.geometry.coordinates,
			timestamp: location.properties.timestamp,
		};

		try {
			await this.postLocation(newLocation, apiKey);
			return { result: 'ok' };
		} catch (error) {
			await sendEvent('create_location_failed', JSON.stringify(newLocation));
			this.logger.error(`Location creation failed: ${error.message}`, error.stack);
			return { error: `Failed to create location - ${error.message}` };
		}
	}

	private async postLocation(newLocation: any, apikey: string): Promise<any> {
		const config = {
			headers: {
				apikey: apikey,
			},
		};
		const response = await axios.post('https://api.ashish.me/locations', newLocation, config);
		return response.data;
	}
}
