import { UpdatesBridgeOpsController } from './updates-bridge-ops.controller';

describe('UpdatesBridgeOpsController', () => {
	let controller: UpdatesBridgeOpsController;
	let service: {
		getOverview: jest.Mock;
		getRecentPosts: jest.Mock;
	};

	beforeEach(() => {
		process.env.ASHISHDOTME_TOKEN = 'test-key';
		service = {
			getOverview: jest.fn(),
			getRecentPosts: jest.fn(),
		};
		controller = new UpdatesBridgeOpsController(service as any);
	});

	afterEach(() => {
		delete process.env.ASHISHDOTME_TOKEN;
	});

	it('returns updates overview when an api key is present', async () => {
		service.getOverview.mockResolvedValue({ threads: { connected: false } });

		const result = await controller.getOverview({
			headers: { apikey: 'test-key' },
			query: {},
		} as any);

		expect(service.getOverview).toHaveBeenCalled();
		expect(result).toEqual({ threads: { connected: false } });
	});

	it('returns recent bridged posts when an api key is present', async () => {
		service.getRecentPosts.mockResolvedValue([{ id: 'post-1' }]);

		const result = await controller.getRecentPosts(
			{
				headers: { apikey: 'test-key' },
				query: {},
			} as any,
			'25',
		);

		expect(service.getRecentPosts).toHaveBeenCalledWith(25);
		expect(result).toEqual([{ id: 'post-1' }]);
	});
});
