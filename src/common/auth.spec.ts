import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { API_KEY_INVALID_MESSAGE, API_KEY_MISSING_MESSAGE, extractApiKey, extractTokenApiKey, getApiKeyError, requireApiKey, requireTokenApiKey } from './auth';

const VALID_TEST_API_KEY = 'test-api-key';

describe('extractApiKey', () => {
	const originalToken = process.env.ASHISHDOTME_TOKEN;

	beforeEach(() => {
		process.env.ASHISHDOTME_TOKEN = `${VALID_TEST_API_KEY},other-key`;
	});

	afterEach(() => {
		process.env.ASHISHDOTME_TOKEN = originalToken;
	});

	it('accepts lowercase apikey query params', () => {
		const req = {
			query: { apikey: VALID_TEST_API_KEY },
			headers: {},
		};

		expect(extractApiKey(req)).toBe(VALID_TEST_API_KEY);
		expect(getApiKeyError(req)).toBeNull();
	});

	it('accepts camelCase apiKey query params', () => {
		const req = {
			query: { apiKey: VALID_TEST_API_KEY },
			headers: {},
		};

		expect(extractApiKey(req)).toBe(VALID_TEST_API_KEY);
		expect(getApiKeyError(req)).toBeNull();
	});

	it('still validates invalid camelCase apiKey query params', () => {
		const req = {
			query: { apiKey: 'wrong-key' },
			headers: {},
		};

		expect(extractApiKey(req)).toBeNull();
		expect(getApiKeyError(req)).toBe(API_KEY_INVALID_MESSAGE);
	});
});

describe('requireApiKey', () => {
	const originalToken = process.env.ASHISHDOTME_TOKEN;

	beforeEach(() => {
		process.env.ASHISHDOTME_TOKEN = `${VALID_TEST_API_KEY},other-key`;
	});

	afterEach(() => {
		process.env.ASHISHDOTME_TOKEN = originalToken;
	});

	it('throws bad request when the key is missing', () => {
		expect(() => requireApiKey({ query: {}, headers: {} })).toThrow(new BadRequestException(API_KEY_MISSING_MESSAGE));
	});

	it('throws unauthorized when the key is invalid', () => {
		expect(() =>
			requireApiKey({
				query: { apiKey: 'wrong-key' },
				headers: {},
			}),
		).toThrow(new UnauthorizedException(API_KEY_INVALID_MESSAGE));
	});

	it('returns the validated key when it is present', () => {
		expect(
			requireApiKey({
				query: { apiKey: VALID_TEST_API_KEY },
				headers: {},
			}),
		).toBe(VALID_TEST_API_KEY);
	});
});

describe('requireTokenApiKey', () => {
	const originalToken = process.env.ASHISHDOTME_TOKEN;

	beforeEach(() => {
		process.env.ASHISHDOTME_TOKEN = `${VALID_TEST_API_KEY},other-key`;
	});

	afterEach(() => {
		process.env.ASHISHDOTME_TOKEN = originalToken;
	});

	it('throws bad request when the token header is missing', () => {
		expect(() => requireTokenApiKey({ headers: {} })).toThrow(new BadRequestException(API_KEY_MISSING_MESSAGE));
	});

	it('throws unauthorized when the token header is invalid', () => {
		expect(() =>
			requireTokenApiKey({
				headers: { authorization: 'Token wrong-key' },
			}),
		).toThrow(new UnauthorizedException(API_KEY_INVALID_MESSAGE));
	});

	it('returns the validated token key when present', () => {
		expect(
			requireTokenApiKey({
				headers: { authorization: `Token ${VALID_TEST_API_KEY}` },
			}),
		).toBe(VALID_TEST_API_KEY);
		expect(
			extractTokenApiKey({
				headers: { authorization: `Token ${VALID_TEST_API_KEY}` },
			}),
		).toBe(VALID_TEST_API_KEY);
	});
});
