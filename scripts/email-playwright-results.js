const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const tls = require('node:tls');

const resultPath = process.env.PLAYWRIGHT_JSON_RESULTS || 'test-results/results.json';
const to = splitEmails(process.env.TEST_RESULTS_EMAIL_TO || 'lakmal@codezync.com');
const from = process.env.SMTP_FROM;
const host = process.env.SMTP_HOST;
const port = Number(process.env.SMTP_PORT || 587);
const username = process.env.SMTP_USERNAME;
const password = process.env.SMTP_PASSWORD;
const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  assertEmailConfig();

  const report = loadReport(resultPath);
  const rows = report.rows.length > 0
    ? report.rows
    : [{ testId: 'RUNNER', explain: report.error || 'No Playwright JSON result file was found.', project: 'ci', status: 'fail' }];

  const summary = summarize(rows);
  const subject = `[3PL Tests] ${summary.failed > 0 ? 'FAILED' : 'PASSED'} - ${summary.passed} pass, ${summary.failed} fail, ${summary.skipped} skipped`;
  const html = buildHtml(summary, rows);
  const text = buildText(summary, rows);

  await sendMail({
    host,
    port,
    secure,
    username,
    password,
    from,
    to,
    subject,
    html,
    text,
  });
}

function assertEmailConfig() {
  const missing = [];
  for (const [name, value] of Object.entries({ SMTP_HOST: host, SMTP_PORT: port, SMTP_USERNAME: username, SMTP_PASSWORD: password, SMTP_FROM: from })) {
    if (!value) {
      missing.push(name);
    }
  }

  if (to.length === 0) {
    missing.push('TEST_RESULTS_EMAIL_TO');
  }

  if (missing.length > 0) {
    throw new Error(`Missing email configuration: ${missing.join(', ')}`);
  }
}

function loadReport(filePath) {
  if (!fs.existsSync(filePath)) {
    return { rows: [], error: `Missing Playwright JSON results at ${filePath}` };
  }

  const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return { rows: collectRows(json.suites || []) };
}

function collectRows(suites, parents = []) {
  const rows = [];

  for (const suite of suites) {
    const nextParents = suite.title ? [...parents, suite.title] : parents;

    for (const spec of suite.specs || []) {
      const title = spec.title || nextParents.at(-1) || 'Untitled test';
      const testId = extractTestId(title);
      const explain = title.replace(/^\[[^\]]+\]\s*/, '').trim();

      for (const testCase of spec.tests || []) {
        rows.push({
          testId,
          explain,
          project: testCase.projectName || testCase.projectId || 'default',
          status: normalizeStatus(testCase),
        });
      }
    }

    rows.push(...collectRows(suite.suites || [], nextParents));
  }

  return rows;
}

function extractTestId(title) {
  const match = /^\[([^\]]+)\]/.exec(title);
  return match ? match[1] : 'N/A';
}

function normalizeStatus(testCase) {
  const resultStatuses = (testCase.results || []).map((result) => result.status).filter(Boolean);
  const status = resultStatuses.at(-1) || testCase.status || testCase.expectedStatus || 'unknown';

  if (status === 'passed') {
    return 'pass';
  }

  if (status === 'skipped') {
    return 'skipped';
  }

  return 'fail';
}

function summarize(rows) {
  return rows.reduce(
    (summary, row) => {
      summary.total += 1;
      if (row.status === 'pass') {
        summary.passed += 1;
      } else if (row.status === 'skipped') {
        summary.skipped += 1;
      } else {
        summary.failed += 1;
      }
      return summary;
    },
    { total: 0, passed: 0, failed: 0, skipped: 0 },
  );
}

function buildHtml(summary, rows) {
  const generatedAt = new Date().toISOString();
  const rowHtml = rows
    .map((row) => `
      <tr>
        <td>${escapeHtml(row.testId)}</td>
        <td>${escapeHtml(row.explain)}</td>
        <td>${escapeHtml(row.project)}</td>
        <td><strong>${escapeHtml(row.status)}</strong></td>
      </tr>`)
    .join('');

  return `<!doctype html>
<html>
  <body style="font-family: Arial, sans-serif; color: #111827;">
    <h2>3PL Playwright Test Results</h2>
    <p>Generated at ${escapeHtml(generatedAt)}</p>
    <p>Total: ${summary.total} | Pass: ${summary.passed} | Fail: ${summary.failed} | Skipped: ${summary.skipped}</p>
    <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%;">
      <thead>
        <tr style="background: #f3f4f6;">
          <th align="left">Test ID</th>
          <th align="left">Test Explain</th>
          <th align="left">Project</th>
          <th align="left">Status</th>
        </tr>
      </thead>
      <tbody>${rowHtml}</tbody>
    </table>
  </body>
</html>`;
}

function buildText(summary, rows) {
  const lines = [
    '3PL Playwright Test Results',
    `Total: ${summary.total} | Pass: ${summary.passed} | Fail: ${summary.failed} | Skipped: ${summary.skipped}`,
    '',
    'Test ID | Test Explain | Project | Status',
  ];

  for (const row of rows) {
    lines.push(`${row.testId} | ${row.explain} | ${row.project} | ${row.status}`);
  }

  return lines.join(os.EOL);
}

async function sendMail(message) {
  let socket = message.secure
    ? tls.connect({ host: message.host, port: message.port, servername: message.host })
    : net.connect({ host: message.host, port: message.port });

  await readResponse(socket);
  let ehlo = await send(socket, `EHLO ${os.hostname()}`);

  if (!message.secure && /STARTTLS/i.test(ehlo)) {
    await send(socket, 'STARTTLS');
    socket = tls.connect({ socket, servername: message.host });
    ehlo = await send(socket, `EHLO ${os.hostname()}`);
  }

  await send(socket, 'AUTH LOGIN');
  await send(socket, Buffer.from(message.username).toString('base64'));
  await send(socket, Buffer.from(message.password).toString('base64'));
  await send(socket, `MAIL FROM:<${extractEmail(message.from)}>`);

  for (const recipient of message.to) {
    await send(socket, `RCPT TO:<${recipient}>`);
  }

  await send(socket, 'DATA');
  socket.write(formatMessage(message));
  await readResponse(socket);
  await send(socket, 'QUIT').catch(() => undefined);
  socket.end();
}

async function send(socket, command) {
  socket.write(`${command}\r\n`);
  return readResponse(socket);
}

function readResponse(socket) {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Timed out waiting for SMTP response.'));
    }, 30_000);

    const onData = (chunk) => {
      buffer += chunk.toString('utf8');
      if (/\r?\n\d{3} /.test(`\n${buffer}`)) {
        cleanup();
        const code = Number(buffer.match(/\d{3}/)?.[0]);
        if (code >= 400) {
          reject(new Error(`SMTP command failed: ${buffer.trim()}`));
          return;
        }
        resolve(buffer);
      }
    };

    const onError = (error) => {
      cleanup();
      reject(error);
    };

    const cleanup = () => {
      clearTimeout(timeout);
      socket.off('data', onData);
      socket.off('error', onError);
    };

    socket.on('data', onData);
    socket.on('error', onError);
  });
}

function formatMessage(message) {
  const boundary = `boundary-${Date.now()}`;
  const headers = [
    `From: ${message.from}`,
    `To: ${message.to.join(', ')}`,
    `Subject: ${message.subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];

  return `${headers.join('\r\n')}\r\n\r\n` +
    `--${boundary}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${dotStuff(message.text)}\r\n` +
    `--${boundary}\r\nContent-Type: text/html; charset=utf-8\r\n\r\n${dotStuff(message.html)}\r\n` +
    `--${boundary}--\r\n.\r\n`;
}

function dotStuff(value) {
  return value.replace(/^\./gm, '..').replace(/\r?\n/g, '\r\n');
}

function splitEmails(value) {
  return value.split(',').map((email) => email.trim()).filter(Boolean);
}

function extractEmail(value) {
  const match = /<([^>]+)>/.exec(value);
  return match ? match[1] : value;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
