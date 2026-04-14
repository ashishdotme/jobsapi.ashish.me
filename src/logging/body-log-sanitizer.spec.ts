import { normalizeLogBody, sanitizeLogBody, sanitizeLogPath } from './body-log-sanitizer';

describe('sanitizeLogBody', () => {
	it('redacts apiKey fields recursively', () => {
		expect(
			sanitizeLogBody({
				apiKey: 'top-level',
				apikey: 'lowercase',
				nested: {
					apiKey: 'nested',
					list: [{ apiKey: 'array-value' }, { apikey: 'array-lowercase' }, { ok: true }],
				},
			}),
		).toEqual({
			apiKey: '[Redacted]',
			apikey: '[Redacted]',
			nested: {
				apiKey: '[Redacted]',
				list: [{ apiKey: '[Redacted]' }, { apikey: '[Redacted]' }, { ok: true }],
			},
		});
	});

	it('preserves primitive values and null', () => {
		expect(sanitizeLogBody('value')).toBe('value');
		expect(sanitizeLogBody(42)).toBe(42);
		expect(sanitizeLogBody(false)).toBe(false);
		expect(sanitizeLogBody(null)).toBeNull();
	});
});

describe('normalizeLogBody', () => {
	it('converts undefined to null', () => {
		expect(normalizeLogBody(undefined)).toBeNull();
	});

	it('sanitizes arrays recursively', () => {
		expect(normalizeLogBody([{ apiKey: 'secret' }, 'ok'])).toEqual([{ apiKey: '[Redacted]' }, 'ok']);
	});

	it('returns safe placeholders for unsupported values', () => {
		expect(normalizeLogBody(Buffer.from('abc'))).toBe('[buffer]');
		expect(normalizeLogBody(new Map())).toBe('[unserializable]');
	});
});

describe('sanitizeLogPath', () => {
	it('redacts apikey query parameters', () => {
		expect(sanitizeLogPath('/metrics?apikey=secret&ok=1')).toBe('/metrics?apikey=%5BRedacted%5D&ok=1');
		expect(sanitizeLogPath('/movies?apiKey=secret')).toBe('/movies?apiKey=%5BRedacted%5D');
	});

	it('leaves paths without sensitive query params unchanged', () => {
		expect(sanitizeLogPath('/movies?sort=desc')).toBe('/movies?sort=desc');
		expect(sanitizeLogPath('/movies')).toBe('/movies');
	});
});
