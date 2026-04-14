import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class BlueskyClientService {
	constructor(private readonly configService: ConfigService) {}

	async publish(input: { text: string; mediaUrls: string[] }): Promise<{ uri: string }> {
		const session = await axios.post('https://bsky.social/xrpc/com.atproto.server.createSession', {
			identifier: this.configService.get<string>('BLUESKY_HANDLE'),
			password: this.configService.get<string>('BLUESKY_APP_PASSWORD'),
		});

		const response = await axios.post(
			'https://bsky.social/xrpc/com.atproto.repo.createRecord',
			{
				repo: session.data.did,
				collection: 'app.bsky.feed.post',
				record: {
					$type: 'app.bsky.feed.post',
					text: input.text,
					createdAt: new Date().toISOString(),
				},
			},
			{
				headers: {
					Authorization: `Bearer ${session.data.accessJwt}`,
				},
			},
		);

		return { uri: response.data.uri };
	}
}
