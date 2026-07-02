const MAX_CONCURRENT = 16;
let activeCount = 0;
const waitQueue: (() => void)[] = [];

function pump() {
  while (activeCount < MAX_CONCURRENT && waitQueue.length > 0) {
    activeCount++;
    waitQueue.shift()!();
  }
}

function freeSlot() {
  activeCount--;
  pump();
}

export interface SlotHandle {
  complete(): void;
  cancel(): void;
}

export function requestSlot(onReady: () => void): SlotHandle {
  type State = "waiting" | "active" | "done";
  let state: State = "waiting";

  function start() {
    state = "active";
    onReady();
  }

  if (activeCount < MAX_CONCURRENT) {
    activeCount++;
    start();
  } else {
    waitQueue.push(start);
  }

  return {
    complete() {
      if (state === "active") {
        state = "done";
        freeSlot();
      }
    },
    cancel() {
      if (state === "waiting") {
        state = "done";
        const i = waitQueue.indexOf(start);
        if (i !== -1) waitQueue.splice(i, 1);
      } else if (state === "active") {
        state = "done";
        freeSlot();
      }
    },
  };
}
