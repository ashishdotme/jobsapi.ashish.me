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

		const authHeader = { Authorization: `Bearer ${session.data.accessJwt}` };
		const embed = await this.buildImageEmbed(input.mediaUrls, authHeader);

		const record: Record<string, unknown> = {
			$type: 'app.bsky.feed.post',
			text: input.text,
			createdAt: new Date().toISOString(),
		};
		if (embed) {
			record.embed = embed;
		}

		const response = await axios.post(
			'https://bsky.social/xrpc/com.atproto.repo.createRecord',
			{
				repo: session.data.did,
				collection: 'app.bsky.feed.post',
				record,
			},
			{ headers: authHeader },
		);

		return { uri: response.data.uri };
	}

	private async buildImageEmbed(mediaUrls: string[], authHeader: { Authorization: string }): Promise<Record<string, unknown> | null> {
		if (mediaUrls.length === 0) {
			return null;
		}

		const images = await Promise.all(
			mediaUrls.slice(0, 4).map(async url => {
				const downloaded = await axios.get(url, { responseType: 'arraybuffer' });
				const contentType = downloaded.headers['content-type'] ?? 'image/jpeg';

				const uploaded = await axios.post('https://bsky.social/xrpc/com.atproto.repo.uploadBlob', downloaded.data, { headers: { ...authHeader, 'Content-Type': contentType } });
				return { alt: '', image: uploaded.data.blob };
			}),
		);

		return { $type: 'app.bsky.embed.images', images };
	}
}
