import { UpdatesBridgeController } from './updates-bridge.controller';

describe('UpdatesBridgeController', () => {
	let controller: UpdatesBridgeController;
	let authService: {
		createAuthorizationUrl: jest.Mock;
		handleCallback: jest.Mock;
	};

	beforeEach(() => {
		process.env.ASHISHDOTME_TOKEN = 'test-key';
		authService = {
			createAuthorizationUrl: jest.fn(),
			handleCallback: jest.fn(),
		};
		controller = new UpdatesBridgeController(authService as any);
	});

	afterEach(() => {
		delete process.env.ASHISHDOTME_TOKEN;
	});

	it('requires an api key when starting the threads oauth flow', async () => {
		authService.createAuthorizationUrl.mockResolvedValue('https://threads.net/oauth/authorize?state=state-1');

		const result = await controller.startThreadsAuth({ headers: { apikey: 'test-key' }, query: {} } as any, '/dashboard/settings');

		expect(result).toEqual({
			authorizationUrl: 'https://threads.net/oauth/authorize?state=state-1',
		});
	});

	it('redirects to the auth service callback result', async () => {
		authService.handleCallback.mockResolvedValue('/dashboard/settings?threads=connected');
		const res = { redirect: jest.fn() };

		await controller.handleThreadsCallback('code-1', 'state-1', res as any);

		expect(res.redirect).toHaveBeenCalledWith('/dashboard/settings?threads=connected');
	});
});
