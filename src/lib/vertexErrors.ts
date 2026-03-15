/**
 * Typed errors for Vertex AI / Google Healthcare pipeline.
 * Replaces ambiguous fallback strings for debuggable failure handling.
 */

export class VertexError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "VertexError";
  }
}

export class VertexCredentialError extends VertexError {
  constructor(detail?: string) {
    super(
      detail || "Vertex AI credentials not found or invalid. Ensure credentials/google-key.json exists and the service account has Vertex AI User role.",
      "VERTEX_CREDENTIAL_ERROR"
    );
    this.name = "VertexCredentialError";
  }
}

export class VertexTimeoutError extends VertexError {
  constructor(timeoutMs?: number) {
    super(
      `Vertex AI request timed out after ${timeoutMs ?? 45000}ms.`,
      "VERTEX_TIMEOUT"
    );
    this.name = "VertexTimeoutError";
  }
}

export class VertexHttpError extends VertexError {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly body?: string
  ) {
    super(
      `Vertex AI HTTP ${status}: ${statusText}${body ? ` - ${body.slice(0, 200)}` : ""}`,
      "VERTEX_HTTP_ERROR"
    );
    this.name = "VertexHttpError";
  }
}

export class VertexParseError extends VertexError {
  constructor(
    message: string,
    public readonly rawPreview?: string
  ) {
    super(message, "VERTEX_PARSE_ERROR");
    this.name = "VertexParseError";
  }
}

export class VertexServiceError extends VertexError {
  constructor(message: string, public readonly cause?: unknown) {
    super(message, "VERTEX_SERVICE_ERROR");
    this.name = "VertexServiceError";
  }
}

export function isVertexError(e: unknown): e is VertexError {
  return e instanceof Error && e.name.startsWith("Vertex");
}
