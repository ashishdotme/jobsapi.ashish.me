const REDACTED_VALUE = '[Redacted]';
const SENSITIVE_KEYS = new Set(['apikey']);

function isPlainObject(value: unknown): value is Record<string, unknown> {
	if (value === null || typeof value !== 'object') {
		return false;
	}

	return Object.getPrototypeOf(value) === Object.prototype;
}

export function sanitizeLogBody(value: unknown): unknown {
	if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
		return value;
	}

	if (Array.isArray(value)) {
		return value.map(item => sanitizeLogBody(item));
	}

	if (isPlainObject(value)) {
		return Object.fromEntries(Object.entries(value).map(([key, entryValue]) => [key, SENSITIVE_KEYS.has(key.toLowerCase()) ? REDACTED_VALUE : sanitizeLogBody(entryValue)]));
	}

	if (Buffer.isBuffer(value)) {
		return '[buffer]';
	}

	return '[unserializable]';
}

export function normalizeLogBody(value: unknown): unknown {
	if (typeof value === 'undefined') {
		return null;
	}

	return sanitizeLogBody(value);
}

export function sanitizeLogPath(path: string): string {
	const [pathname, query] = path.split('?', 2);
	if (!query) {
		return path;
	}

	const searchParams = new URLSearchParams(query);
	for (const key of searchParams.keys()) {
		if (SENSITIVE_KEYS.has(key.toLowerCase())) {
			searchParams.set(key, REDACTED_VALUE);
		}
	}

	return `${pathname}?${searchParams.toString()}`;
}
