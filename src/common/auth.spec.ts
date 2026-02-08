import { API_KEY_MISSING_MESSAGE, extractApiKey, extractTokenApiKey } from './auth';

describe('auth helpers', () => {
	it('extracts API key from query param first', () => {
		const req = { headers: { apikey: 'header-key' } };
		expect(extractApiKey(req, 'query-key')).toBe('query-key');
	});

	it('extracts API key from headers', () => {
		const req = { headers: { apikey: 'header-key' } };
		expect(extractApiKey(req)).toBe('header-key');
	});

	it('returns null for blank API key', () => {
		const req = { headers: { apikey: '   ' } };
		expect(extractApiKey(req)).toBeNull();
		expect(API_KEY_MISSING_MESSAGE).toBe('Apikey cannot be blank');
	});

	it('extracts Token auth key', () => {
		const req = { headers: { authorization: 'Token listen-key' } };
		expect(extractTokenApiKey(req)).toBe('listen-key');
	});

	it('returns null for invalid token schema', () => {
		const req = { headers: { authorization: 'Bearer listen-key' } };
		expect(extractTokenApiKey(req)).toBeNull();
	});
});
