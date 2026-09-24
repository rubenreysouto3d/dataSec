const [url, userAgent = "dataSec-http/0.1", timeoutText = "120"] = process.argv.slice(2);

if (!url) {
  console.error("URL argument is required");
  process.exit(2);
}

const timeoutMs = Math.max(1, Number(timeoutText) || 120) * 1000;
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), timeoutMs);

try {
  const response = await fetch(url, {
    headers: { "User-Agent": userAgent },
    signal: controller.signal,
  });
  const body = Buffer.from(await response.arrayBuffer());

  if (!response.ok) {
    process.stderr.write(`HTTP ${response.status}: ${body.toString("utf8").slice(0, 1000)}\n`);
    process.exit(22);
  }

  process.stdout.write(body);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
} finally {
  clearTimeout(timer);
}
