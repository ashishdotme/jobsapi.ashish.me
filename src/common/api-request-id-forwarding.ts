import axios, { AxiosHeaders, InternalAxiosRequestConfig } from 'axios';
import { getRequestId } from './request-context';

const API_HOSTNAME = 'api.ashish.me';

let installed = false;

const shouldForwardRequestId = (config: InternalAxiosRequestConfig): boolean => {
	if (!config.url) {
		return false;
	}

	try {
		return new URL(config.url).hostname === API_HOSTNAME;
	} catch {
		return false;
	}
};

export const applyApiRequestIdForwarding = (): void => {
	if (installed) {
		return;
	}

	axios.interceptors.request.use(config => {
		const requestId = getRequestId();
		if (!requestId || !shouldForwardRequestId(config)) {
			return config;
		}

		const headers = AxiosHeaders.from(config.headers);
		headers.set('x-request-id', requestId);
		config.headers = headers;

		return config;
	});

	installed = true;
};
