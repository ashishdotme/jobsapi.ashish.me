import { BadRequestException } from '@nestjs/common';
import { ThreadsAuthService } from './threads-auth.service';

describe('ThreadsAuthService', () => {
	let service: ThreadsAuthService;
	let repository: {
		saveOAuthState: jest.Mock;
		getOAuthState: jest.Mock;
		deleteOAuthState: jest.Mock;
		saveIntegration: jest.Mock;
	};
	let threadsClient: {
		buildAuthorizationUrl: jest.Mock;
		exchangeCodeForToken: jest.Mock;
		exchangeForLongLivedToken: jest.Mock;
		fetchIdentity: jest.Mock;
	};
	let configService: { get: jest.Mock };

	beforeEach(() => {
		repository = {
			saveOAuthState: jest.fn(),
			getOAuthState: jest.fn(),
			deleteOAuthState: jest.fn(),
			saveIntegration: jest.fn(),
		};
		threadsClient = {
			buildAuthorizationUrl: jest.fn(),
			exchangeCodeForToken: jest.fn(),
			exchangeForLongLivedToken: jest.fn(),
			fetchIdentity: jest.fn(),
		};
		configService = {
			get: jest.fn((key: string) => {
				if (key === 'THREADS_REDIRECT_URI') {
					return 'https://jobsapi.ashish.me/auth/threads/callback';
				}
				if (key === 'APP_URL') {
					return 'https://jobsapi.ashish.me';
				}
				return undefined;
			}),
		};
		service = new ThreadsAuthService(
			repository as any,
			threadsClient as any,
			configService as any,
		);
	});

	it('creates an authorization url for allowed local returnTo values', async () => {
		repository.saveOAuthState.mockResolvedValue({
			state: 'state-1',
			returnTo: '/dashboard/settings',
		});
		threadsClient.buildAuthorizationUrl.mockReturnValue(
			'https://threads.net/oauth/authorize?state=state-1',
		);

		const result = await service.createAuthorizationUrl('/dashboard/settings');

		expect(repository.saveOAuthState).toHaveBeenCalledWith('/dashboard/settings');
		expect(threadsClient.buildAuthorizationUrl).toHaveBeenCalledWith({
			state: 'state-1',
			redirectUri: 'https://jobsapi.ashish.me/auth/threads/callback',
		});
		expect(result).toBe('https://threads.net/oauth/authorize?state=state-1');
	});

	it('rejects disallowed external returnTo values', async () => {
		await expect(
			service.createAuthorizationUrl('https://evil.example.com/steal'),
		).rejects.toBeInstanceOf(BadRequestException);
	});

	it('validates oauth state and persists the integration on callback', async () => {
		repository.getOAuthState.mockResolvedValue({
			state: 'state-1',
			returnTo: '/dashboard/settings',
			expiresAt: new Date(Date.now() + 60_000).toISOString(),
		});
		threadsClient.exchangeCodeForToken.mockResolvedValue({
			accessToken: 'short-lived',
			userId: '123',
		});
		threadsClient.exchangeForLongLivedToken.mockResolvedValue({
			accessToken: 'long-lived',
			expiresIn: 60 * 24 * 60 * 60,
		});
		threadsClient.fetchIdentity.mockResolvedValue({
			id: '123',
			username: 'ashish',
		});

		const redirectUrl = await service.handleCallback('code-1', 'state-1');

		expect(repository.deleteOAuthState).toHaveBeenCalledWith('state-1');
		expect(repository.saveIntegration).toHaveBeenCalledWith(
			expect.objectContaining({
				threadsUserId: '123',
				threadsUsername: 'ashish',
				accessToken: 'long-lived',
			}),
		);
		expect(redirectUrl).toBe('/dashboard/settings?threads=connected');
	});

	it('rejects missing or expired oauth states on callback', async () => {
		repository.getOAuthState.mockResolvedValue(null);

		await expect(service.handleCallback('code-1', 'missing')).rejects.toBeInstanceOf(
			BadRequestException,
		);
	});
});
