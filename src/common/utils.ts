import { Logger } from '@nestjs/common';
import axios from 'axios';
import { formatLogMessage } from './logging';

const logger = new Logger('CommonUtils');

export const sendEvent = async (type: string, message: string): Promise<void> => {
	try {
		await axios.post('https://api.ashish.me/events', {
			type,
			message,
		});
	} catch {
		logger.warn(formatLogMessage('event.send.failed', { type, message }));
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
		logger.warn(formatLogMessage('omdb.lookup.failed', { title }));
		return null;
	}
};

export const fetchDetailsFromOmdbByImdbId = async (imdbId: string, omdbApiKey): Promise<any> => {
	try {
		const response = await axios.get(`http://www.omdbapi.com/?i=${encodeURIComponent(imdbId)}&apikey=${omdbApiKey}`);
		if (!response.data || response.data.Response === 'False') {
			return null;
		}
		return response.data;
	} catch {
		logger.warn(formatLogMessage('omdb.lookup.failed', { imdbId }));
		return null;
	}
};
