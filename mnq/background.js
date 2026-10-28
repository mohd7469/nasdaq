// file://D:\projects\nasdaq\new\background.js

const PKT_TIMEZONE = 'Asia/Karachi';
const DXB_TIMEZONE = 'Asia/Dubai';

const getTimezone = (time = moment(), timezone = PKT_TIMEZONE) => {
    const m = moment(time).tz(timezone);
    return m.isValid() ? m : moment().tz(timezone);
};

function getTime() {
    return getTimezone().format('hh:mm:ss A');
}

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
    const { onInit, onTick, onComplete } = callbacks;

    // 1. One-Time Execution
    if (typeof onInit === 'function') {
        onInit(getTime());
    }

    // 2. Worker Execution
    return createAutomationWorker(
        (count, logs = true) => {
            if (logs) {
                console.log(`[Worker] - ${getTime()}`);
            }

            if (typeof onTick === 'function') onTick(count, getTime(), logs);
        },
        () => {
            console.log("Worker Completed Execution.");
            if (typeof onComplete === 'function') onComplete();
        }
    );
}