/**
 * Core domain models for the sACN (E1.31) viewer.
 */

/** Metadata for a universe currently receiving sACN data. */
export interface SacnUniverse {
  readonly id: number;          // 1 – 63999
  readonly label: string;       // "Universe N"
  readonly sourceName: string;  // UTF-8 source name from packet
  readonly priority: number;    // 0 – 200 (default 100)
  readonly lastUpdated: number; // Date.now() timestamp
  readonly packetRate: number;  // approximate packets/sec
  readonly packetCount: number; // total packets received
}

/** A fully parsed E1.31 data packet. */
export interface SacnPacket {
  readonly universe: number;
  readonly priority: number;
  readonly sourceName: string;
  readonly sequenceNumber: number;
  readonly dmxValues: Uint8Array; // always 512 bytes
}

/** One channel cell inside the grid (single DMX slot). */
export interface ChannelCell {
  readonly channel: number; // 1 – 512
  value: number;            // 0 – 255
}

/** One row in the channel grid (8 channels side-by-side). */
export interface ChannelRow {
  readonly rowIndex: number;     // 0 – 63
  readonly startChannel: number; // 1, 9, 17, …
  cells: ChannelCell[];
}
