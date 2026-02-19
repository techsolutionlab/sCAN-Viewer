import { Injectable, Signal, WritableSignal, computed, signal } from '@angular/core';
import { ChannelCell, ChannelRow, SacnPacket, SacnUniverse } from '../models/sacn.models';
import { parseE131Packet } from '../utils/sacn-parser';

// ── helpers ─────────────────────────────────────────────────────────────────

const EMPTY_DMX = new Uint8Array(512);
const ROWS_COUNT = 64;   // 512 / 8
const COLS_COUNT = 8;

function buildChannelRows(values: Uint8Array): ChannelRow[] {
  const rows: ChannelRow[] = [];
  for (let r = 0; r < ROWS_COUNT; r++) {
    const cells: ChannelCell[] = [];
    for (let c = 0; c < COLS_COUNT; c++) {
      const idx = r * COLS_COUNT + c;
      cells.push({ channel: idx + 1, value: values[idx] ?? 0 });
    }
    rows.push({ rowIndex: r, startChannel: r * COLS_COUNT + 1, cells });
  }
  return rows;
}

interface RateWindow {
  count: number;
  windowStart: number;
  rate: number;
}

// ── service ──────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class SacnService {
  // ── universe list (updated on first sight + every METADATA_INTERVAL ms) ──
  private readonly _universesMap = new Map<number, SacnUniverse>();
  readonly universes: WritableSignal<SacnUniverse[]> = signal<SacnUniverse[]>([]);

  // ── per-universe DMX data – each universe gets its own signal so that
  //    updating universe N never triggers the channel-grid for universe M ───
  private readonly _dmxSignals = new Map<number, WritableSignal<Uint8Array>>();

  // ── selected universe ────────────────────────────────────────────────────
  readonly selectedUniverseId: WritableSignal<number | null> = signal<number | null>(null);

  /**
   * Reactive 64-row grid for the currently selected universe.
   * Only recomputes when the selected universe changes OR new DMX data
   * arrives for it – other universes don't affect this computation.
   */
  readonly selectedChannelRows: Signal<ChannelRow[]> = computed<ChannelRow[]>(() => {
    const id = this.selectedUniverseId();
    if (id === null) return [];
    const sig = this._dmxSignals.get(id);
    return buildChannelRows(sig ? sig() : EMPTY_DMX);
  });

  // ── metadata flush timer ─────────────────────────────────────────────────
  private readonly _rateWindows = new Map<number, RateWindow>();
  private readonly METADATA_INTERVAL = 2000; // ms

  constructor() {
    // Periodically refresh the universe list signal so that packet-rate
    // and lastUpdated values stay visible in the sidebar.
    setInterval(() => this._flushUniverses(), this.METADATA_INTERVAL);
  }

  // ── public API ────────────────────────────────────────────────────────────

  /** Select a universe by id; the channel-grid reacts immediately. */
  selectUniverse(id: number): void {
    this.selectedUniverseId.set(id);
  }

  /** Feed a raw UDP buffer; invalid packets are silently ignored. */
  processRawPacket(data: Uint8Array): void {
    const packet = parseE131Packet(data);
    if (packet) this._applyPacket(packet);
  }

  /** Feed an already-parsed packet (used by the simulator). */
  applyPacket(packet: SacnPacket): void {
    this._applyPacket(packet);
  }

  // ── internal ──────────────────────────────────────────────────────────────

  private _applyPacket(packet: SacnPacket): void {
    const { universe, priority, sourceName, dmxValues } = packet;

    const isNew = !this._dmxSignals.has(universe);

    // Ensure a DMX signal exists for this universe.
    if (isNew) {
      this._dmxSignals.set(universe, signal(new Uint8Array(512)));
    }

    // Update DMX data signal (only triggers channel-grid if this is the selected universe).
    this._dmxSignals.get(universe)!.set(dmxValues);

    // Track packet rate in a 1-second rolling window.
    const rate = this._trackRate(universe);

    // Update universe metadata.
    const prev = this._universesMap.get(universe);
    this._universesMap.set(universe, {
      id: universe,
      label: `Universe ${universe}`,
      sourceName,
      priority,
      lastUpdated: Date.now(),
      packetRate: rate,
      packetCount: (prev?.packetCount ?? 0) + 1,
    });

    // Immediately push the universe list for newly seen universes.
    if (isNew) {
      this._flushUniverses();
      // Auto-select the first universe that arrives.
      if (this.selectedUniverseId() === null) {
        this.selectedUniverseId.set(universe);
      }
    }
  }

  private _flushUniverses(): void {
    const sorted = Array.from(this._universesMap.values())
      .sort((a, b) => a.id - b.id);
    this.universes.set(sorted);
  }

  private _trackRate(universe: number): number {
    const now = Date.now();
    let w = this._rateWindows.get(universe);
    if (!w) {
      w = { count: 0, windowStart: now, rate: 0 };
      this._rateWindows.set(universe, w);
    }
    w.count++;
    const elapsed = now - w.windowStart;
    if (elapsed >= 1000) {
      w.rate = Math.round((w.count * 1000) / elapsed);
      w.count = 0;
      w.windowStart = now;
    }
    return w.rate;
  }
}
