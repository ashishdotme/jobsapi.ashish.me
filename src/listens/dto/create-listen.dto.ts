export interface CreateListenDto {
	listen_type: string;
	payload: Payload[];
}

export interface Payload {
	listened_at: number;
	track_metadata: TrackMetadata;
}

export interface TrackMetadata {
	artist_name: string;
	track_name: string;
	release_name: string;
	additional_info: AdditionalInfo;
}

export interface AdditionalInfo {
	duration: number;
}
