export interface CreateListenDto {
  eventName: string;
  time: number;
  data: Data;
}

export interface Data {
  song: Song;
  songs: Song2[];
  currentlyPlaying: boolean;
}

export interface Song {
  parsed: Parsed;
  processed: Processed;
  noRegex: NoRegex;
  flags: Flags;
  metadata: Metadata;
  connector: Connector;
  controllerTabId: number;
}

export interface Parsed {
  track: string;
  artist: string;
  albumArtist: any;
  album: string;
  duration: number;
  uniqueID: string;
  currentTime: number;
  isPlaying: boolean;
  trackArt: string;
  isPodcast: boolean;
  originUrl: string;
  scrobblingDisallowedReason: any;
}

export interface Processed {
  track: string;
  artist: string;
  albumArtist: any;
  album: string;
  duration: number;
}

export interface NoRegex {
  track: string;
  artist: string;
  albumArtist: any;
  album: string;
  duration: any;
}

export interface Flags {
  isScrobbled: boolean;
  isCorrectedByUser: boolean;
  isRegexEditedByUser: IsRegexEditedByUser;
  isAlbumFetched: boolean;
  isValid: boolean;
  isMarkedAsPlaying: boolean;
  isSkipped: boolean;
  isReplaying: boolean;
  hasBlockedTag: boolean;
  isLovedInService: any;
  finishedProcessing: boolean;
}

export interface IsRegexEditedByUser {
  track: boolean;
  artist: boolean;
  album: boolean;
  albumArtist: boolean;
}

export interface Metadata {
  userloved: boolean;
  startTimestamp: number;
  label: string;
  trackArtUrl: string;
  artistUrl: string;
  trackUrl: string;
  albumUrl: string;
  userPlayCount: number;
  albumMbId: string;
}

export interface Connector {
  label: string;
  matches: string[];
  js: string;
  id: string;
  hasNativeScrobbler: boolean;
}

export interface Song2 {
  parsed: Parsed2;
  processed: Processed2;
  noRegex: NoRegex2;
  flags: Flags2;
  metadata: Metadata2;
  connector: Connector2;
  controllerTabId: number;
}

export interface Parsed2 {
  track: string;
  artist: string;
  albumArtist: any;
  album: string;
  duration: number;
  uniqueID: string;
  currentTime: number;
  isPlaying: boolean;
  trackArt: string;
  isPodcast: boolean;
  originUrl: string;
  scrobblingDisallowedReason: any;
}

export interface Processed2 {
  track: string;
  artist: string;
  albumArtist: any;
  album: string;
  duration: number;
}

export interface NoRegex2 {
  track: string;
  artist: string;
  albumArtist: any;
  album: string;
  duration: any;
}

export interface Flags2 {
  isScrobbled: boolean;
  isCorrectedByUser: boolean;
  isRegexEditedByUser: IsRegexEditedByUser2;
  isAlbumFetched: boolean;
  isValid: boolean;
  isMarkedAsPlaying: boolean;
  isSkipped: boolean;
  isReplaying: boolean;
  hasBlockedTag: boolean;
  isLovedInService: any;
  finishedProcessing: boolean;
}

export interface IsRegexEditedByUser2 {
  track: boolean;
  artist: boolean;
  album: boolean;
  albumArtist: boolean;
}

export interface Metadata2 {
  userloved: boolean;
  startTimestamp: number;
  label: string;
  trackArtUrl: string;
  artistUrl: string;
  trackUrl: string;
  albumUrl: string;
  userPlayCount: number;
  albumMbId: string;
}

export interface Connector2 {
  label: string;
  matches: string[];
  js: string;
  id: string;
  hasNativeScrobbler: boolean;
}
