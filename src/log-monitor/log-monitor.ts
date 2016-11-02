import { Component, Input, ApplicationRef } from '@angular/core';
import { Observable } from 'rxjs/Observable';
import { Observer } from 'rxjs/Observer';
import { Subject } from 'rxjs/Subject';
import 'rxjs/Rx';
import { map } from 'rxjs/operator/map';
import { StoreDevtools } from '@ngrx/store-devtools';
import { select } from '@ngrx/core/operator/select';
import { LogEntryItem } from './log-entry-item';
import { Store } from "@ngrx/store";

interface FileReaderEventTarget extends EventTarget {
  result: string
}

interface FileReaderEvent extends Event {
  target: FileReaderEventTarget;
  getMessage(): string;
}


@Component({
  selector: 'log-monitor',
  styles: [`
    :host {
      display: block;
      background-color: #2A2F3A;
      font-family: 'monaco', 'Consolas', 'Lucida Console', monospace;
      position: relative;
      overflow-y: hidden;
      width: 100%;
      height: 100%;
      min-width: 300px;
      direction: ltr;
    }

    .button-bar {
      text-align: center;
      border-bottom-width: 1px;
      border-bottom-style: solid;
      border-color: transparent;
      z-index: 1;
      display: flex;
      flex-direction: row;
      padding: 0 4px;
    }

    .elements {
      position: absolute;
      left: 0;
      right: 0;
      top: 38px;
      bottom: 0;
      overflow-x: hidden;
      overflow-y: auto;
    }
  `],
  template: `
    <div class="button-bar">
      <log-monitor-button (action)="handleReset()">
        Reset
      </log-monitor-button>

      <log-monitor-button (action)="handleRollback()">
        Revert
      </log-monitor-button>

      <log-monitor-button (action)="handleSweep()" [disabled]="canSweep$ | async">
        Sweep
      </log-monitor-button>

      <log-monitor-button (action)="handleCommit()" [disabled]="canCommit$ | async">
        Commit
      </log-monitor-button>
      <log-monitor-button (action)="handleExport()">
        Export
      </log-monitor-button>
      <log-monitor-button (action)="handleImport()">
        Import
      </log-monitor-button>
    </div>
    <div class="elements">
      <log-monitor-entry
        *ngFor="let item of (items$ | async); let i = index"
        [item]="item"
        [disabled]="i === 0"
        [expandEntries]="expandEntries"
        (toggle)="handleToggle($event.id)">
      </log-monitor-entry>
    </div>
  `
})
export class LogMonitorComponent {
  @Input() expandEntries: boolean = true;

  public items$: Observable<LogEntryItem[]>;
  public canRevert$: Observable<boolean>;
  public canSweep$: Observable<boolean>;
  public canCommit$: Observable<boolean>;
  export$ = new Subject();
  import$ = new Subject();

  constructor(private devtools: StoreDevtools, private store: Store<any>, private ref: ApplicationRef) {
    this.canRevert$ = select.call(devtools.liftedState, s => !(s.computedStates.length > 1 ));
    this.canSweep$ = select.call(devtools.liftedState, s => !(s.skippedActionIds.length > 0));
    this.canCommit$ = select.call(devtools.liftedState, s => !(s.computedStates.length > 1));

    this.items$ = map.call(devtools.liftedState, ({ actionsById, skippedActionIds, stagedActionIds, computedStates }) => {
        const actions = [];

        for (let i = 0; i < stagedActionIds.length; i++) {
          const actionId = stagedActionIds[i];
          const action = actionsById[actionId].action;
          const { state, error } = computedStates[i];
          let previousState;
          if (i > 0) {
            previousState = computedStates[i - 1].state;
          }

          actions.push({
            key: actionId,
            collapsed: skippedActionIds.indexOf(actionId) > -1,
            action,
            actionId,
            state,
            previousState,
            error
          });
        }

        return actions;
      });

    this.initImporter();
    this.initExporter();
  }

  private initExporter() {
    let downloadLink = document.createElement('a');

    this.devtools.liftedState
      .sample(this.export$)
      .subscribe(state => {
        let actionsJsonStr = JSON.stringify(state.actionsById);
        let timestamp = (new Date()).getTime();
        let actionsJsonUri = "data:application/octet-stream," + encodeURIComponent(actionsJsonStr);

        downloadLink.setAttribute('href', actionsJsonUri);
        downloadLink.setAttribute('download', `states-${timestamp}.json`);

        this.triggerClick(downloadLink);
      });
  }

  private initImporter() {
    let inputElement = document.createElement('input');
    inputElement.value = null;
    inputElement.setAttribute('type', 'file');

    this.import$.subscribe(() => {
      this.triggerClick(inputElement);
    });

    Observable
      .fromEvent(inputElement, 'change')
      .subscribe(() => {
        this.devtools.reset();

        let file = inputElement.files[0];
        let reader = new FileReader();

        let onload$ = Observable.create((observer: Observer<FileReaderEvent>) => {
          reader.onload = observer.next.bind(observer);
          reader.onabort = observer.error.bind(observer);
        });
        inputElement.value = '';
        onload$.subscribe((event: FileReaderEvent) => {
          let actions = JSON.parse(event.target.result);

          actions = Object
            .keys(actions)
            .map(key => actions[key])
            .forEach(item => {
              this.store.dispatch(item.action);
              this.ref.tick();  // FileReader onload event doesn't trigger angular change detection
            });
        }, (err) => {
          console.log(err);
        });

        reader.readAsText(file);
      });
  }

  private triggerClick(element) {
    if (document.createEvent) {
      var event = document.createEvent('MouseEvents');
      event.initEvent('click', true, true);
      element.dispatchEvent(event);
    }
    else {
      element.click();
    }
  }

  handleToggle(id: number) {
    this.devtools.toggleAction(id);
  }

  handleReset() {
    this.devtools.reset();
  }

  handleRollback() {
    this.devtools.rollback();
  }

  handleSweep() {
    this.devtools.sweep();
  }

  handleCommit() {
    this.devtools.commit();
  }

  handleImport() {
    this.import$.next();
  }

  handleExport() {
    this.export$.next();
  }


}
