const postMessage = (message) => {
  window.top.postMessage(message, "http://localhost:3000");
};

const patchFetch = (reportHTTPError) => {
  const originalFetch = window.fetch;

  window.fetch = async function (...args) {
    try {
      const response = await originalFetch(...args);

      if (!response.ok) {
        const body = response?.text ? await response.text() : undefined;
        reportHTTPError("non_200_response", {
          ...response,
          status: response.status,
          url: args?.[0] || response.url,
          body,
          method: args?.[1]?.method || "GET",
          origin: window.location.origin,
        });
      }

      return response;
    } catch (error) {
      reportHTTPError("fetch_error", {
        message: error?.message,
        stack: error?.stack,
        url: args?.[0],
        method: args?.[1]?.method || "GET",
        origin: window.location.origin,
      });
      throw error;
    }
  };
};

export const loadReportErrorEventListener = (() => {
  let isInitialized = false;

  const extractError = ({ message, lineno, colno, filename, error }) => {
    return { message, lineno, colno, filename, stack: error?.stack };
  };

  return () => {
    if (isInitialized) return;

    const reportedErrors = new Set();

    const generateErrorId = (event) => {
      const { lineno, colno, filename, message } = event;
      return `${message}|${filename}|${lineno}|${colno}`;
    };

    const reportHTTPError = async (type, response) => {
      if (type === "non_200_response") {
        postMessage({
          type: "FETCH_ERROR",
          error: {
            message: `failed to call url ${response.url} with status ${response.status} and statusText ${response.statusText}`,
            status: response.status,
            statusText: response.statusText,
            url: response.url,
            body: response.body,
          },
        });
      } else if (type === "fetch_error") {
        postMessage({
          type: "FETCH_ERROR",
          error: response,
        });
      }
    };

    patchFetch(reportHTTPError);

    const isErrorAlreadyReported = (errorId) => {
      if (reportedErrors.has(errorId)) {
        return true;
      }
      reportedErrors.add(errorId);
      setTimeout(() => reportedErrors.delete(errorId), 5000);
      return false;
    };

    const reportError = (event) => {
      const errorId = generateErrorId(event);

      if (isErrorAlreadyReported(errorId)) {
        return;
      }

      const error = extractError(event);

      postMessage({ type: "RUNTIME_ERROR", error });
    };

    window.addEventListener("error", reportError);

    window.addEventListener("unhandledrejection", (event) => {
      if (!event.reason?.stack) {
        return;
      }

      const errorId =
        event.reason?.stack || event.reason?.message || String(event.reason);

      if (isErrorAlreadyReported(errorId)) {
        return;
      }

      const error = {
        message: event.reason?.message || "Unhandled promise rejection",
        stack: event.reason?.stack || String(event.reason),
      };

      postMessage({ type: "UNHANDLED_PROMISE_REJECTION", error });
    });

    isInitialized = true;
  };
})();
