import {
  ChangeDetectionStrategy,
  Component,
  NO_ERRORS_SCHEMA,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { NativeScriptCommonModule } from '@nativescript/angular';

import { UniverseSidebarComponent } from '../components/universe-sidebar/universe-sidebar.component';
import { ChannelGridComponent } from '../components/channel-grid/channel-grid.component';
import { SacnListenerService } from '../services/sacn-listener.service';
import { SacnSimulatorService } from '../services/sacn-simulator.service';
import { SacnService } from '../services/sacn.service';

type AppMode = 'live' | 'simulate' | 'idle';

@Component({
  selector: 'ns-sacn-viewer',
  templateUrl: './sacn-viewer.component.html',
  styleUrls: ['./sacn-viewer.component.css'],
  imports: [
    NativeScriptCommonModule,
    UniverseSidebarComponent,
    ChannelGridComponent,
  ],
  schemas: [NO_ERRORS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SacnViewerComponent implements OnInit, OnDestroy {
  // Not private so Angular's template compiler can reach them.
  readonly listener  = inject(SacnListenerService);
  readonly simulator = inject(SacnSimulatorService);
  readonly sacnService = inject(SacnService);

  /** Current operating mode – drives all reactive header bindings. */
  readonly mode = signal<AppMode>('idle');

  /** `true` while the simulator is running (signal-backed for zoneless CD). */
  readonly isSimulating = computed<boolean>(() => this.mode() === 'simulate');

  /** Derived status text shown in the header. */
  readonly statusText = computed<string>(() => {
    switch (this.mode()) {
      case 'live':     return 'LIVE';
      case 'simulate': return 'SIMULATE';
      default:         return 'IDLE';
    }
  });

  readonly statusColor = computed<string>(() => {
    switch (this.mode()) {
      case 'live':     return '#00e676'; // green
      case 'simulate': return '#ffab40'; // amber
      default:         return '#555555'; // grey
    }
  });

  readonly universeCount = computed<number>(() => this.sacnService.universes().length);

  ngOnInit(): void {
    // Start the real listener; it is a no-op on non-Android.
    this.listener.start();
    if (this.listener.isRunning) {
      this.mode.set('live');
    }
  }

  ngOnDestroy(): void {
    this.listener.stop();
    this.simulator.stop();
  }

  // ── Toolbar actions ──────────────────────────────────────────────────────

  toggleSimulate(): void {
    if (this.simulator.isRunning) {
      this.simulator.stop();
      this.mode.set(this.listener.isRunning ? 'live' : 'idle');
    } else {
      this.simulator.start();
      this.mode.set('simulate');
    }
  }

  toggleLive(): void {
    if (this.listener.isRunning) {
      this.listener.stop();
      this.mode.set(this.simulator.isRunning ? 'simulate' : 'idle');
    } else {
      this.listener.start();
      if (this.listener.isRunning) {
        this.mode.set('live');
      }
    }
  }
}
