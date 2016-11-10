import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Subject } from 'rxjs/Subject';
import { Observable } from "rxjs";

@Component({
  selector: 'ngrx-store-log-monitor',
  template: `
    <dock-monitor [toggleCommand]="toggleCommand" [positionCommand]="positionCommand">
      <log-monitor [expandEntries]="expandEntries" (liftedStore)="liftedStore.emit($event)"></log-monitor>
    </dock-monitor>
  `
})
export class StoreLogMonitorComponent {
  @Input() toggleCommand: string = 'ctrl-h';
  @Input() positionCommand: string = 'ctrl-m';
  @Input() expandEntries: boolean = false;
  @Output() liftedStore: EventEmitter<any>;

  constructor() {
    this.liftedStore = new EventEmitter<any>();
  }
}
