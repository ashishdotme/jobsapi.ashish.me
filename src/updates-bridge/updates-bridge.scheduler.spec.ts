import { UpdatesBridgeScheduler } from './updates-bridge.scheduler';

describe('UpdatesBridgeScheduler', () => {
	it('delegates scheduled work to the bridge service', async () => {
		const service = {
			runScheduledSync: jest.fn().mockResolvedValue(undefined),
		};
		const scheduler = new UpdatesBridgeScheduler(service as any);

		await scheduler.handleCron();

		expect(service.runScheduledSync).toHaveBeenCalled();
	});
});
