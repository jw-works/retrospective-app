type LogLevel = "INFO" | "WARN" | "ERROR";

type LogContext = Record<string, unknown>;

function write(level: LogLevel, event: string, context: LogContext = {}) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    ...context
  };

  const line = JSON.stringify(payload);
  if (level === "ERROR") {
    console.error(line);
    return;
  }
  if (level === "WARN") {
    console.warn(line);
    return;
  }
  console.log(line);
}

export function logInfo(event: string, context: LogContext = {}) {
  write("INFO", event, context);
}

export function logWarn(event: string, context: LogContext = {}) {
  write("WARN", event, context);
}

export function logError(event: string, context: LogContext = {}) {
  write("ERROR", event, context);
}

export async function captureError(error: unknown, context: LogContext = {}) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  const stack = error instanceof Error ? error.stack : undefined;
  logError("error.captured", { message, stack, ...context });

  const webhook = process.env.ERROR_MONITORING_WEBHOOK_URL;
  if (!webhook) return;

  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        stack,
        context,
        ts: new Date().toISOString()
      })
    });
  } catch (reportError) {
    const reportMessage = reportError instanceof Error ? reportError.message : "Unknown report error";
    logWarn("error.report_failed", { reportMessage });
  }
}
