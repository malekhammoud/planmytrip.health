/**
 * Pure, buffering SSE frame parser shared by the TinyFish client and the Step 6
 * browser hook.
 *
 * Inputs: text chunks in arrival order. Outputs: complete SseMessage values, plus a
 * final flush for a frame without a trailing blank line.
 * Invariants: no Node imports and no global state; CRLF split across chunks, bare LF,
 * multi-line data, comments, and unknown fields are handled without throwing.
 */

/** One decoded SSE message. Comment and unknown fields are not exposed. */
export interface SseMessage {
  data: string;
  event?: string;
  id?: string;
}

/** Incremental SSE parser. Feed text chunks; call flush at end of stream. */
export interface SseParser {
  push(chunk: string): SseMessage[];
  flush(): SseMessage[];
}

/**
 * Creates a pure SSE parser that tolerates split chunks, CRLF line endings,
 * multi-line data fields, comments, and a final frame without a trailing blank line.
 */
export function createSseParser(): SseParser {
  let buffer = "";
  let dataLines: string[] = [];
  let eventName: string | undefined;
  let lastId: string | undefined;
  let sawFirstChunk = false;

  function dispatch(out: SseMessage[]): void {
    if (dataLines.length === 0) {
      eventName = undefined;
      lastId = undefined;
      return;
    }
    const data = dataLines.join("\n");
    dataLines = [];
    if (data.length > 0) {
      const message: SseMessage = { data };
      if (eventName !== undefined) message.event = eventName;
      if (lastId !== undefined) message.id = lastId;
      out.push(message);
    }
    eventName = undefined;
    lastId = undefined;
  }

  function processLine(line: string, out: SseMessage[]): void {
    if (line === "") {
      dispatch(out);
      return;
    }
    if (line.startsWith(":")) return;
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "data") dataLines.push(value);
    else if (field === "event") eventName = value;
    else if (field === "id") lastId = value;
    // retry and unknown fields are ignored on purpose.
  }

  function drain(out: SseMessage[], final: boolean): void {
    let start = 0;
    for (let index = 0; index < buffer.length; index += 1) {
      const char = buffer[index];
      if (char === "\n") {
        processLine(buffer.slice(start, index), out);
        start = index + 1;
      } else if (char === "\r") {
        // A trailing CR may be the first half of a CRLF split across chunks.
        if (index === buffer.length - 1 && !final) break;
        processLine(buffer.slice(start, index), out);
        if (buffer[index + 1] === "\n") index += 1;
        start = index + 1;
      }
    }
    buffer = buffer.slice(start);
  }

  return {
    push(chunk: string): SseMessage[] {
      const out: SseMessage[] = [];
      if (!sawFirstChunk) {
        sawFirstChunk = true;
        buffer += chunk.startsWith("\uFEFF") ? chunk.slice(1) : chunk;
      } else {
        buffer += chunk;
      }
      drain(out, false);
      return out;
    },
    flush(): SseMessage[] {
      const out: SseMessage[] = [];
      drain(out, true);
      if (buffer.length > 0) {
        processLine(buffer, out);
        buffer = "";
      }
      dispatch(out);
      return out;
    },
  };
}
