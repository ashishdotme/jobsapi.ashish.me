import { Logger } from '@nestjs/common';
import axios from 'axios';
import { MetricsService } from './metrics.service';

jest.mock('axios');

describe('MetricsService', () => {
	const mockedAxios = axios as jest.Mocked<typeof axios>;

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('returns aggregated statuses and continues after upstream failures', async () => {
		mockedAxios.post
			.mockResolvedValueOnce({
				data: {
					ok: true,
					metricType: 'steps',
					action: 'created',
					date: '3/1/26',
					message: 'Created new record.',
				},
			} as any)
			.mockRejectedValueOnce({
				response: {
					status: 500,
					data: {
						ok: false,
						metricType: 'steps',
						action: 'failed',
						date: '3/2/26',
						message: 'Database temporarily unavailable',
					},
				},
			} as any)
			.mockResolvedValueOnce({
				data: {
					ok: true,
					metricType: 'sleep',
					action: 'updated',
					date: '3/7/26',
					message: 'Updated existing record because incoming value was higher.',
				},
			} as any);

		const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
		const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
		const service = new MetricsService();

		const result = await service.create(
			{
				data: {
					metrics: [
						{
							name: 'step_count',
							units: 'count',
							data: [
								{ source: 'Phone', date: '2026-03-01 12:00:00 AM +0000', qty: 1000 },
								{ source: 'Phone', date: '2026-03-02 12:00:00 AM +0000', qty: 2000 },
							],
						},
						{
							name: 'sleep_analysis',
							units: 'hr',
							data: [
								{
									source: 'Phone',
									date: '2026-03-07 12:00:00 AM +0000',
									sleepStart: '2026-03-07 01:00:00 AM +0000',
									sleepEnd: '2026-03-07 08:30:00 AM +0000',
								},
							],
						},
					],
				},
			} as any,
			'api-key',
		);

		expect(result).toEqual(
			expect.objectContaining({
				ok: true,
				totals: {
					received: 3,
					processed: 3,
					created: 1,
					updated: 1,
					skipped: 0,
					failed: 1,
					invalid: 0,
				},
				statuses: [
					expect.objectContaining({ action: 'created', date: '3/1/26' }),
					expect.objectContaining({ action: 'failed', date: '3/2/26' }),
					expect.objectContaining({ action: 'updated', date: '3/7/26' }),
				],
			}),
		);
		expect(mockedAxios.post).toHaveBeenCalledTimes(3);
		expect(errorSpy).toHaveBeenCalled();
		expect(logSpy).toHaveBeenCalled();
	});

	it('records invalid metrics in the status list and still returns 200 payload', async () => {
		mockedAxios.post.mockResolvedValue({
			data: {
				ok: true,
				metricType: 'steps',
				action: 'created',
				date: '3/1/26',
				message: 'Created new record.',
			},
		} as any);

		const service = new MetricsService();

		const result = await service.create(
			{
				data: {
					metrics: [
						{
							name: 'step_count',
							units: 'count',
							data: [
								{ source: 'Phone', date: '2026-03-01 12:00:00 AM +0000', qty: 1000 },
								{ source: 'Phone', date: '2026-03-02 12:00:00 AM +0000' },
							],
						},
					],
				},
			} as any,
			'api-key',
		);

		expect(result.totals).toEqual({
			received: 2,
			processed: 2,
			created: 1,
			updated: 0,
			skipped: 0,
			failed: 0,
			invalid: 1,
		});
		expect(result.statuses).toEqual([
			expect.objectContaining({ action: 'created', date: '3/1/26' }),
			expect.objectContaining({
				action: 'invalid',
				message: 'Step metric is missing qty.',
			}),
		]);
		expect(mockedAxios.post).toHaveBeenCalledTimes(1);
	});
});
