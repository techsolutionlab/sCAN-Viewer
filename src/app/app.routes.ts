import { Routes } from '@angular/router';
import { SacnViewerComponent } from './sacn-viewer/sacn-viewer.component';

export const routes: Routes = [
  { path: '', redirectTo: '/sacn', pathMatch: 'full' },
  { path: 'sacn', component: SacnViewerComponent },
];
