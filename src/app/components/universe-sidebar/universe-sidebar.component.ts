import {
  ChangeDetectionStrategy,
  Component,
  NO_ERRORS_SCHEMA,
  inject,
} from '@angular/core';
import { NativeScriptCommonModule } from '@nativescript/angular';

import { SacnUniverse } from '../../models/sacn.models';
import { SacnService } from '../../services/sacn.service';

@Component({
  selector: 'ns-universe-sidebar',
  templateUrl: './universe-sidebar.component.html',
  styleUrls: ['./universe-sidebar.component.css'],
  imports: [NativeScriptCommonModule],
  schemas: [NO_ERRORS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UniverseSidebarComponent {
  readonly sacnService = inject(SacnService);

  /** TrackBy for the ListView – stable key avoids full row re-creation. */
  trackByUniverseId(_: number, item: SacnUniverse): number {
    return item.id;
  }

  onSelectUniverse(universe: SacnUniverse): void {
    this.sacnService.selectUniverse(universe.id);
  }

  isSelected(universe: SacnUniverse): boolean {
    return this.sacnService.selectedUniverseId() === universe.id;
  }

  /** Live indicator: universe received a packet in the last 3 seconds. */
  isLive(universe: SacnUniverse): boolean {
    return Date.now() - universe.lastUpdated < 3000;
  }

  /** Formatted packet rate, e.g. "44 Hz" or "–" if not yet measured. */
  rateLabel(universe: SacnUniverse): string {
    return universe.packetRate > 0 ? `${universe.packetRate} Hz` : '–';
  }
}
