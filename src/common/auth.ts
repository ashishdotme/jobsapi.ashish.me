export const API_KEY_MISSING_MESSAGE = 'Apikey cannot be blank';

export const extractApiKey = (req: any, apiKeyParam?: string): string | null => {
	const headerApiKey = req?.headers?.apikey ?? req?.headers?.apiKey;
	const rawKey = apiKeyParam ?? headerApiKey;
	const apiKey = Array.isArray(rawKey) ? rawKey[0] : rawKey;

	if (typeof apiKey !== 'string' || !apiKey.trim()) {
		return null;
	}

	return apiKey.trim();
};

export const extractTokenApiKey = (req: any): string | null => {
	const authorization = req?.headers?.authorization;

	if (typeof authorization !== 'string') {
		return null;
	}

	const [scheme, token] = authorization.split(' ');
	if (scheme !== 'Token' || !token?.trim()) {
		return null;
	}

	return token.trim();
};
