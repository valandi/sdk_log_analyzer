const { parentPort, workerData } = require('worker_threads');

const regexPatterns = {
  timestampRegex: /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/,
  statusCodeRegex: /(.*)status code (4\d{2}|5\d{2})(.*)/,
  exceptionRegex: /([^_]ERROR|Exception|Failed): (.*)/i,
  renderIdRegex: /renderId":"([\w-]+)"/
};

let lineNumbers = workerData.lineStart;
let prevTimestamp = workerData.prevTimestamp;
let results = {
  errorStatusCodes: [],
  exceptions: [],
  longTimeIntervals: [],
  renderIds: []
};
let currentException = null;

const lines = workerData.chunk.split('\n');
lines.forEach((line) => {
    console.log(line);
    console.log(lineNumbers);
  lineNumbers++;

  const timestampMatch = line.match(regexPatterns.timestampRegex);
  const statusCodeMatch = line.match(regexPatterns.statusCodeRegex);
  const exceptionMatch = line.match(regexPatterns.exceptionRegex);
  const renderIdMatch = line.match(regexPatterns.renderIdRegex);

  if (timestampMatch) {
    const currentTimestamp = new Date(timestampMatch[0]);

    if (prevTimestamp) {
      const timeDifference = (currentTimestamp.getTime() - prevTimestamp.getTime()) / 1000;
      if (timeDifference > 10) {
        results.longTimeIntervals.push({ line: `${lineNumbers}: ${line}`, interval: timeDifference });
      }
    }

    prevTimestamp = currentTimestamp;
  }

  if (statusCodeMatch) {
    const statusCode = parseInt(statusCodeMatch[2], 10);
    if (statusCode >= 400 && statusCode < 600) {
      results.errorStatusCodes.push({ line: `${lineNumbers}: ${line}`, code: statusCode });
    }
  }

  if (exceptionMatch) {
    const exception = exceptionMatch[2];
    currentException = { line: lineNumbers, exception, stackTrace: [] };
    results.exceptions.push(currentException);
  } else if (currentException && line.startsWith('    ')) {
    currentException.stackTrace.push(line);
  } else {
    currentException = null;
  }

  if (renderIdMatch) {
    const renderId = renderIdMatch[1];
    results.renderIds.push({ line: `${lineNumbers}: ${line}`, renderId });
  }
});

parentPort.postMessage({ results });