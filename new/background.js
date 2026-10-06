// file://D:\projects\nasdaq\new\background.js

function createAutomationWorker(onTick, onComplete) {
    // Worker code inline blob format mein wrapper
    const workerCode = `
    let timerId = null;
    self.onmessage = function (e) {
      const { action, interval = 300, initialDelay = 5000, logs = true } = e.data;
      
      if (action === 'START') {
        if (timerId) clearInterval(timerId);
        
        setTimeout(() => {
          let count = 0;
          timerId = setInterval(() => {
            count++;
            self.postMessage({ type: 'TICK', count: count, logs: logs });
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
            onTick(e.data.count, e.data.logs);
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

// Custom wrapper setup export for extension runtime
function setupAutomationTimer(callbacks = {}) {
    const { onTick, onComplete } = callbacks;

    return createAutomationWorker(
        (count, logs = true) => {
            const time = moment().tz("Asia/Karachi").format('hh:mm:ss A');

            if (logs) {
                console.log(`[${count}] - ${time}`);
            }

            if (typeof onTick === 'function') onTick(count, time, logs);
        },
        () => {
            console.log("Worker Completed Execution.");
            if (typeof onComplete === 'function') onComplete();
        }
    );
}