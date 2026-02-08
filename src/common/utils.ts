import { Logger } from '@nestjs/common';
import axios from 'axios';

const logger = new Logger('CommonUtils');

export const sendEvent = async (type: string, message: string): Promise<void> => {
	try {
		await axios.post('https://api.ashish.me/events', {
			type,
			message,
		});
	} catch {
		logger.warn(`Failed to send event "${type}"`);
	}
};

export const fetchDetailsFromOmdb = async (title: string, omdbApiKey): Promise<any> => {
	try {
		const response = await axios.get(`http://www.omdbapi.com/?t=${encodeURIComponent(title)}&apikey=${omdbApiKey}`);
		if (!response.data || response.data.Response === 'False') {
			return null;
		}
		return response.data;
	} catch {
		logger.warn(`OMDb lookup failed for title "${title}"`);
		return null;
	}
};

export const fetchDetailsFromImdb = async (title: string): Promise<any> => {
	try {
		const response = await axios.get(`https://imdb.ashish.me/search?query=${encodeURIComponent(title)}`);

		if (!response.data || !response.data.results?.length) {
			throw new Error(`Failed to fetch details from IMDB - Not found`);
		}

		const imdbId = response.data.results[0].id;
		const year = response.data.results[0].year;
		const finalResponse = await axios.get(`https://imdb.ashish.me/title/${imdbId.trim()}`);
		finalResponse.data.year = year;
		return finalResponse.data;
	} catch {
		logger.warn(`IMDb lookup failed for title "${title}"`);
		return null;
	}
};
