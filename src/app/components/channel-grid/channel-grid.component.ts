import {
  ChangeDetectionStrategy,
  Component,
  NO_ERRORS_SCHEMA,
  computed,
  inject,
} from '@angular/core';
import { NativeScriptCommonModule } from '@nativescript/angular';

import { ChannelRow, SacnUniverse } from '../../models/sacn.models';
import { SacnService } from '../../services/sacn.service';
import { CHANNEL_BG, CHANNEL_TEXT } from '../../utils/channel-colors';

@Component({
  selector: 'ns-channel-grid',
  templateUrl: './channel-grid.component.html',
  styleUrls: ['./channel-grid.component.css'],
  imports: [NativeScriptCommonModule],
  schemas: [NO_ERRORS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChannelGridComponent {
  readonly sacnService = inject(SacnService);

  /** Expose color tables to the template. */
  readonly bgColors  = CHANNEL_BG;
  readonly txtColors = CHANNEL_TEXT;

  /** Header details derived from the selected universe. */
  readonly selectedUniverse = computed<SacnUniverse | null>(() => {
    const id = this.sacnService.selectedUniverseId();
    if (id === null) return null;
    return this.sacnService.universes().find(u => u.id === id) ?? null;
  });

  readonly hasSelection = computed<boolean>(() => this.sacnService.selectedUniverseId() !== null);

  /** TrackBy for the row-ListView – rows never change position. */
  trackByRowIndex(_: number, row: ChannelRow): number {
    return row.rowIndex;
  }
}
