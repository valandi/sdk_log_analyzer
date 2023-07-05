const fs = require('fs');
const readline = require('readline');

// Get the filename from command line arguments
const filename = process.argv[2];

if (!filename) {
  console.error('Please provide a filename as a command line argument.');
  process.exit(1);
}

// Initialize result storage
const results = {
  errorStatusCodes: [],
  exceptions: [],
  longTimeIntervals: [],
  renderIds: []
};

// Define regex patterns for log analysis
const regexPatterns = {
  timestampRegex: /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/,
  statusCodeRegex:/(.*)status code (4\d{2}|5\d{2})(.*)/,
  exceptionRegex: /([^_]ERROR|Exception): (.*)([\s\S]*)/i,
  renderIdRegex: /renderId":"([\w-]+)"/
};

// Analyze log content and store results
async function analyzeLogs() {
  const rl = readline.createInterface({
    input: fs.createReadStream(filename),
    crlfDelay: Infinity
  });

  let lineCount = 0;
  let prevTimestamp = null;

  for await (const line of rl) {
    lineCount++;
    const timestampMatch = line.match(regexPatterns.timestampRegex);
    const statusCodeMatch = line.match(regexPatterns.statusCodeRegex);
    const exceptionMatch = line.match(regexPatterns.exceptionRegex);
    const renderIdMatch = line.match(regexPatterns.renderIdRegex);

    // Handle timestamp matches
    if (timestampMatch) {
      const currentTimestamp = new Date(timestampMatch[0]);

      if (prevTimestamp) {
        const timeDifference = (currentTimestamp.getTime() - prevTimestamp.getTime()) / 1000;
        if (timeDifference > 10) {
          results.longTimeIntervals.push({ line: `${lineCount}: ${line}`, interval: timeDifference });
        }
      }

      prevTimestamp = currentTimestamp;
    }

    // Handle status code matches
    if (statusCodeMatch) {
      const statusCode = parseInt(statusCodeMatch[2], 10);
      if (statusCode >= 400 && statusCode < 600) {
        results.errorStatusCodes.push({ line: `${lineCount}: ${line}`, code: statusCode });
      }
    }

    // Handle exception matches
    if (exceptionMatch) {
      const exception = exceptionMatch[2];
      results.exceptions.push({ line: `${lineCount}: ${line}`, exception });
    }

    // Handle render ID matches
    if (renderIdMatch) {
      const renderId = renderIdMatch[1];
      results.renderIds.push({ line: `${lineCount}: ${line}`, renderId });
    }

    // Generate Splunk Queries
  }

  saveHtmlReport();
}





  // Generate and save HTML report
function saveHtmlReport() {
  const html = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Log Analysis Report</title>
    <style>
      body { font-family: Arial, sans-serif; }
      .tab { display: none; }
      .tab-button { background-color: #f1f1f1; border: none; cursor: pointer; padding: 8px 16px; transition: 0.3s; }
      .tab-button:hover { background-color: #ddd; }
      .active { background-color: #ccc; }
    </style>
  </head>
  <body>
    <h1>Log Analysis Report</h1>
  
    <div>
      <button class="tab-button active" onclick="openTab('errorStatusCodes')">Status codes in the 400s and 500s</button>
      <button class="tab-button" onclick="openTab('exceptions')">Exceptions and errors</button>
      <button class="tab-button" onclick="openTab('longTimeIntervals')">Time intervals longer than 30 seconds</button>
      <button class="tab-button" onclick="openTab('renderIds')">Render ids in logs</button>
    </div>
  
    <div id="errorStatusCodes" class="tab" style="display: block;">
      ${results.errorStatusCodes.map(({ line, code }) => `<pre>Line ${line}: ${code}</pre>`).join('')}
    </div>
  
    <div id="exceptions" class="tab">
    ${results.exceptions.map(({ line, exception }) => `
      <pre>Line ${line}: ${exception}</pre>
    `).join('')}
  </div>
  
    <div id="longTimeIntervals" class="tab">
      ${results.longTimeIntervals.map(({ line, interval }) => `
        <pre>Line ${line}</pre>
        <pre>${interval.toFixed(2)} seconds</pre>
      `).join('')}
    </div>
  
    <div id="renderIds" class="tab">
      ${results.renderIds.map(({ line, renderId }) => `<pre>${renderId}</pre>`).join('')}
    </div>
  
    <script>
      function openTab(tabId) {
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabs = document.querySelectorAll('.tab');
  
        for (const tab of tabs) {
          tab.style.display = 'none';
        }
  
        for (const button of tabButtons) {
          button.classList.remove('active');
        }
  
        document.getElementById(tabId).style.display = 'block';
        event.currentTarget.classList.add('active');
      }
    </script>
  </body>
  </html>
  `;

  fs.writeFile('log_analysis_report.html', html, (err) => {
    if (err) {
      console.error('Error saving HTML report:', err);
    } else {
      console.log('HTML report saved as log_analysis_report.html');
    }
  });
}



analyzeLogs();