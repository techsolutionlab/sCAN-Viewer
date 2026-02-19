/**
 * SacnListenerService
 *
 * Spawns the NativeScript Worker that opens a UDP MulticastSocket on Android
 * and forwards raw E1.31 packets to SacnService for parsing.
 *
 * On non-Android platforms (e.g. iOS stub or desktop preview) calling
 * start() is a no-op; use SacnSimulatorService instead.
 */

import { Injectable, inject } from '@angular/core';
import { isAndroid } from '@nativescript/core';
import { SacnService } from './sacn.service';

@Injectable({ providedIn: 'root' })
export class SacnListenerService {
  private readonly sacnService = inject(SacnService);

  private worker: Worker | null = null;
  private _isRunning = false;

  get isRunning(): boolean {
    return this._isRunning;
  }

  /** Start the real UDP listener (Android only). */
  start(): void {
    if (this._isRunning) return;

    if (!isAndroid) {
      console.warn('SacnListenerService: real UDP listener is Android-only.');
      return;
    }

    try {
      // The path resolves relative to the app root (src/).
      this.worker = new Worker('~/app/workers/sacn-listener.worker');

      this.worker.onmessage = (msg: MessageEvent) => {
        const payload = msg.data as { type: string; data?: number[]; message?: string };

        switch (payload.type) {
          case 'ready':
            console.log('[sACN] Listener worker ready, listening on port 5568.');
            break;

          case 'packet':
            if (payload.data) {
              this.sacnService.processRawPacket(new Uint8Array(payload.data));
            }
            break;

          case 'error':
            console.error('[sACN] Worker error:', payload.message);
            this._isRunning = false;
            break;
        }
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.worker as any).onerror = (err: ErrorEvent) => {
        console.error('[sACN] Worker threw:', err.message);
        this._isRunning = false;
      };

      this.worker.postMessage({ cmd: 'start' });
      this._isRunning = true;

    } catch (err) {
      console.error('[sACN] Could not spawn worker:', err);
    }
  }

  /** Stop the listener and clean up the worker. */
  stop(): void {
    if (!this._isRunning) return;
    this.worker?.postMessage({ cmd: 'stop' });
    setTimeout(() => {
      this.worker?.terminate();
      this.worker = null;
    }, 600); // give worker time to close socket
    this._isRunning = false;
  }
}
