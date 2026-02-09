export const API_KEY_MISSING_MESSAGE = 'Apikey cannot be blank';
export const API_KEY_INVALID_MESSAGE = 'Invalid apikey';

const normalizeApiKey = (rawKey: unknown): string | null => {
	const apiKey = Array.isArray(rawKey) ? rawKey[0] : rawKey;
	if (typeof apiKey !== 'string' || !apiKey.trim()) {
		return null;
	}

	return apiKey.trim();
};

export const extractApiKey = (req: any, apiKeyParam?: string): string | null => {
	const headerApiKey = req?.headers?.apikey ?? req?.headers?.apiKey;
	const rawKey = apiKeyParam ?? headerApiKey;
	const apiKey = normalizeApiKey(rawKey);

	if (!apiKey) {
		return null;
	}

	const configuredApiKeys = (process.env.API_KEYS ?? process.env.API_KEY ?? '')
		.split(',')
		.map(x => x.trim())
		.filter(Boolean);

	if (!configuredApiKeys.length || !configuredApiKeys.includes(apiKey)) {
		return null;
	}

	return apiKey;
};

export const getApiKeyError = (req: any, apiKeyParam?: string): string | null => {
	const headerApiKey = req?.headers?.apikey ?? req?.headers?.apiKey;
	const rawKey = apiKeyParam ?? headerApiKey;
	const apiKey = normalizeApiKey(rawKey);

	if (!apiKey) {
		return API_KEY_MISSING_MESSAGE;
	}

	const configuredApiKeys = (process.env.API_KEYS ?? process.env.API_KEY ?? '')
		.split(',')
		.map(x => x.trim())
		.filter(Boolean);

	if (!configuredApiKeys.length || !configuredApiKeys.includes(apiKey)) {
		return API_KEY_INVALID_MESSAGE;
	}

	return null;
};

export const extractTokenApiKey = (req: any): string | null => {
	const authorization = req?.headers?.authorization;

	if (typeof authorization !== 'string') {
		return null;
	}

	const [scheme, token] = authorization.split(' ');
	const normalizedToken = normalizeApiKey(token);

	if (scheme !== 'Token' || !normalizedToken) {
		return null;
	}

	const configuredApiKeys = (process.env.API_KEYS ?? process.env.API_KEY ?? '')
		.split(',')
		.map(x => x.trim())
		.filter(Boolean);

	if (!configuredApiKeys.length || !configuredApiKeys.includes(normalizedToken)) {
		return null;
	}

	return normalizedToken;
};
