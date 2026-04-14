import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { ListensService } from './listens.service';

describe('ListensService history mapping', () => {
	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('maps upstream listens into a ListenBrainz payload in newest-first order', async () => {
		jest.spyOn(axios, 'get').mockResolvedValue({
			data: [
				{
					id: 1,
					title: 'Near Dark',
					artist: 'Burial',
					album: 'Untrue',
					listenDate: '2024-04-01T19:33:20.000Z',
				},
				{
					id: 2,
					title: 'Archangel',
					artist: 'Burial',
					album: 'Untrue',
					listenDate: '2024-04-01T20:33:20.000Z',
				},
			],
		} as any);

		const service = new ListensService({ get: jest.fn() } as unknown as ConfigService);

		await expect(service.getUserListens('testuser', {} as any)).resolves.toEqual({
			payload: {
				count: 2,
				latest_listen_ts: 1712003600,
				listens: [
					{
						listened_at: 1712003600,
						track_metadata: {
							artist_name: 'Burial',
							track_name: 'Archangel',
							release_name: 'Untrue',
							additional_info: {},
						},
						user_name: 'testuser',
					},
					{
						listened_at: 1712000000,
						track_metadata: {
							artist_name: 'Burial',
							track_name: 'Near Dark',
							release_name: 'Untrue',
							additional_info: {},
						},
						user_name: 'testuser',
					},
				],
				oldest_listen_ts: 1712000000,
				user_id: 'testuser',
			},
		});
	});

	it('applies exclusive min_ts and max_ts filters before shaping the response', async () => {
		jest.spyOn(axios, 'get').mockResolvedValue({
			data: [
				{
					id: 1,
					title: 'Near Dark',
					artist: 'Burial',
					album: 'Untrue',
					listenDate: '2024-04-01T19:33:20.000Z',
				},
				{
					id: 2,
					title: 'Archangel',
					artist: 'Burial',
					album: 'Untrue',
					listenDate: '2024-04-01T20:33:20.000Z',
				},
				{
					id: 3,
					title: 'Etched Headplate',
					artist: 'Burial',
					album: 'Untrue',
					listenDate: '2024-04-01T21:33:20.000Z',
				},
			],
		} as any);

		const service = new ListensService({ get: jest.fn() } as unknown as ConfigService);

		await expect(
			service.getUserListens('testuser', {
				min_ts: 1712000000,
				max_ts: 1712007200,
			} as any),
		).resolves.toEqual({
			payload: {
				count: 1,
				latest_listen_ts: 1712003600,
				listens: [
					{
						listened_at: 1712003600,
						track_metadata: {
							artist_name: 'Burial',
							track_name: 'Archangel',
							release_name: 'Untrue',
							additional_info: {},
						},
						user_name: 'testuser',
					},
				],
				oldest_listen_ts: 1712003600,
				user_id: 'testuser',
			},
		});
	});

	it('applies count after filtering and requests a limited upstream slice when only count is provided', async () => {
		const getSpy = jest.spyOn(axios, 'get').mockResolvedValue({
			data: [
				{
					id: 2,
					title: 'Archangel',
					artist: 'Burial',
					album: 'Untrue',
					listenDate: '2024-04-01T20:33:20.000Z',
				},
				{
					id: 1,
					title: 'Near Dark',
					artist: 'Burial',
					album: 'Untrue',
					listenDate: '2024-04-01T19:33:20.000Z',
				},
			],
		} as any);

		const service = new ListensService({ get: jest.fn() } as unknown as ConfigService);
		const result = await service.getUserListens('testuser', { count: 1 } as any);

		expect(result.payload.listens).toEqual([
			{
				listened_at: 1712003600,
				track_metadata: {
					artist_name: 'Burial',
					track_name: 'Archangel',
					release_name: 'Untrue',
					additional_info: {},
				},
				user_name: 'testuser',
			},
		]);
		expect(getSpy).toHaveBeenCalledWith('https://api.ashish.me/listens', {
			params: {
				limit: 1,
			},
		});
	});

	it('returns zero timestamps when no listens remain after filtering', async () => {
		jest.spyOn(axios, 'get').mockResolvedValue({
			data: [
				{
					id: 2,
					title: 'Archangel',
					artist: 'Burial',
					album: 'Untrue',
					listenDate: '2024-04-01T20:33:20.000Z',
				},
			],
		} as any);

		const service = new ListensService({ get: jest.fn() } as unknown as ConfigService);

		await expect(
			service.getUserListens('testuser', {
				min_ts: 1712003600,
			} as any),
		).resolves.toEqual({
			payload: {
				count: 0,
				latest_listen_ts: 0,
				listens: [],
				oldest_listen_ts: 0,
				user_id: 'testuser',
			},
		});
	});
});
