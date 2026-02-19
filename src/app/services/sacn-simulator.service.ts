/**
 * SacnSimulatorService
 *
 * Generates synthetic DMX packets at ~30 fps for development and demo use.
 * Produces animated wave patterns across a configurable set of universes.
 */

import { Injectable, inject } from '@angular/core';
import { SacnPacket } from '../models/sacn.models';
import { SacnService } from './sacn.service';

const SIMULATED_UNIVERSES = [1, 2, 3, 4, 5];
const UPDATE_FPS = 30;
const SOURCE_NAME = 'sACN Simulator';

@Injectable({ providedIn: 'root' })
export class SacnSimulatorService {
  private readonly sacnService = inject(SacnService);

  private timer: ReturnType<typeof setInterval> | null = null;
  private frame = 0;

  private _isRunning = false;
  get isRunning(): boolean {
    return this._isRunning;
  }

  start(): void {
    if (this._isRunning) return;
    this._isRunning = true;

    // Seed with the first frame immediately so the UI shows something.
    this._tick();

    this.timer = setInterval(() => this._tick(), 1000 / UPDATE_FPS);
  }

  stop(): void {
    if (!this._isRunning) return;
    this._isRunning = false;
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private _tick(): void {
    this.frame++;
    for (const universe of SIMULATED_UNIVERSES) {
      this.sacnService.applyPacket(this._makePacket(universe));
    }
  }

  private _makePacket(universe: number): SacnPacket {
    const dmxValues = new Uint8Array(512);
    const t = (this.frame / UPDATE_FPS) * (Math.PI * 2);
    const uOff = universe * 1.1; // phase offset per universe

    for (let i = 0; i < 512; i++) {
      // Three overlapping waves + a slow chase give life to the channels.
      const wave1 = Math.sin(t + i * 0.03 + uOff) * 0.5 + 0.5;
      const wave2 = Math.sin(t * 0.7 + i * 0.07 - uOff) * 0.25 + 0.25;
      const chase = ((this.frame + i + universe * 17) % 48) < 24 ? 0.15 : 0;

      dmxValues[i] = Math.round(Math.min(255, (wave1 + wave2 + chase) * 180));
    }

    return {
      universe,
      priority: 100,
      sourceName: SOURCE_NAME,
      sequenceNumber: this.frame % 256,
      dmxValues,
    };
  }
}
