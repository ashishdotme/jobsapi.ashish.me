export type MediaType = 'movie' | 'show';

export interface MediaDetails {
	title: string;
	description: string;
	language: string;
	year: number;
	genre: string;
	rating: number;
	imdbId: string | null;
	tmdbId: number | null;
	posterUrl: string | null;
}

export interface MediaMetadataProvider {
	readonly name: string;
	fetch(title: string, type: MediaType): Promise<MediaDetails | null>;
}
