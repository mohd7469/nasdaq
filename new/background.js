// file://D:\projects\nasdaq\new\background.js

function createAutomationWorker(onTick, onComplete) {
  // Worker code inline blob format mein wrapper
  const workerCode = `
    let timerId = null;
    self.onmessage = function (e) {
      const { action, interval = 300, maxRuns = 20, initialDelay = 5000 } = e.data;
      if (action === 'START') {
        if (timerId) clearInterval(timerId);
        setTimeout(() => {
          let count = 0;
          timerId = setInterval(() => {
            count++;
            self.postMessage({ type: 'TICK', count: count });
            if (count >= maxRuns) {
              clearInterval(timerId);
              timerId = null;
              self.postMessage({ type: 'STOPPED' });
            }
          }, interval);
        }, initialDelay);
      }
      if (action === 'STOP') {
        if (timerId) clearInterval(timerId);
        timerId = null;
        self.postMessage({ type: 'STOPPED' });
      }
    };
  `;

  const blob = new Blob([workerCode], { type: 'application/javascript' });
  const worker = new Worker(URL.createObjectURL(blob));

  worker.onmessage = function (e) {
    if (e.data.type === 'TICK' && onTick) {
      onTick(e.data.count);
    }
    if (e.data.type === 'STOPPED' && onComplete) {
      onComplete();
    }
  };

  return {
    start: (options = {}) => worker.postMessage({ action: 'START', ...options }),
    stop: () => worker.postMessage({ action: 'STOP' }),
    terminate: () => worker.terminate()
  };
}