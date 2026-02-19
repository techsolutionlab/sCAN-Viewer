/**
 * E1.31 (sACN) packet parser.
 */

import { SacnPacket } from '../models/sacn.models';

/** The 12-byte ACN packet identifier string. */
const ACN_PACKET_IDENTIFIER = [
  0x41, 0x53, 0x43, 0x2d, 0x45, 0x31, 0x2e,
  0x31, 0x37, 0x00, 0x00, 0x00,
];

const VECTOR_ROOT_E131_DATA    = 0x00000004;
const VECTOR_E131_DATA_PACKET  = 0x00000002;

const MIN_PACKET_LENGTH = 126;
const DMX_DATA_OFFSET   = 126;
const DMX_CHANNEL_COUNT = 512;

/**
 * Parse a raw UDP buffer into a {@link SacnPacket}.
 * Returns `null` if the buffer is not a valid E1.31 data packet.
 */
export function parseE131Packet(data: Uint8Array): SacnPacket | null {
  if (data.length < MIN_PACKET_LENGTH) return null;

  // ── Preamble ─────────────────────────────────────────────────────────────
  if (data[0] !== 0x00 || data[1] !== 0x10) return null;

  // ── ACN Packet Identifier ────────────────────────────────────────────────
  for (let i = 0; i < ACN_PACKET_IDENTIFIER.length; i++) {
    if (data[4 + i] !== ACN_PACKET_IDENTIFIER[i]) return null;
  }

  // ── Root Layer Vector ────────────────────────────────────────────────────
  const rootVector =
    (((data[18] << 24) | (data[19] << 16) | (data[20] << 8) | data[21]) >>> 0);
  if (rootVector !== VECTOR_ROOT_E131_DATA) return null;

  // ── Framing Layer Vector ─────────────────────────────────────────────────
  const framingVector =
    (((data[40] << 24) | (data[41] << 16) | (data[42] << 8) | data[43]) >>> 0);
  if (framingVector !== VECTOR_E131_DATA_PACKET) return null;

  // ── Source Name (null-terminated UTF-8, 64 bytes) ────────────────────────
  let sourceName = '';
  for (let i = 44; i < 108; i++) {
    if (data[i] === 0) break;
    sourceName += String.fromCharCode(data[i]);
  }
  if (!sourceName) sourceName = 'Unknown';

  // ── Scalar fields ────────────────────────────────────────────────────────
  const priority       = data[108];
  const sequenceNumber = data[111];
  const universe       = (data[113] << 8) | data[114];

  if (universe < 1 || universe > 63999) return null;

  // ── DMX Values ───────────────────────────────────────────────────────────
  const dmxValues = new Uint8Array(DMX_CHANNEL_COUNT);
  const end = Math.min(DMX_DATA_OFFSET + DMX_CHANNEL_COUNT, data.length);
  dmxValues.set(data.subarray(DMX_DATA_OFFSET, end));

  return { universe, priority, sourceName, sequenceNumber, dmxValues };
}
