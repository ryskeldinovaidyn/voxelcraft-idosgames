// Байтовый кодек сообщений мультиплеера. Частые сообщения (позы игроков и мобов, изменения блоков)
// — плотные двоичные записи: позы идут 10–20 раз в секунду на каждого, JSON там был бы в 4–6 раз
// толще. Редкие и сложные (снимок мира, сущности, контейнеры, чат) — JSON, крупный — сжатый.
//
// Формат любого сообщения: [тип u8][тело…]. У JSON-сообщений тело — [флаги u8][UTF-8 JSON],
// флаг 1 — тело сжато deflate-raw (снимок мира с тысячами изменённых блоков сжимается в 5–10 раз).

export class ByteWriter {
  private buf: Uint8Array;
  private view: DataView;
  private at = 0;

  constructor(initial = 256) {
    this.buf = new Uint8Array(initial);
    this.view = new DataView(this.buf.buffer);
  }

  private ensure(n: number): void {
    if (this.at + n <= this.buf.length) return;
    let size = this.buf.length * 2;
    while (size < this.at + n) size *= 2;
    const next = new Uint8Array(size);
    next.set(this.buf.subarray(0, this.at));
    this.buf = next;
    this.view = new DataView(next.buffer);
  }

  u8(v: number): this {
    this.ensure(1);
    this.view.setUint8(this.at, v);
    this.at += 1;
    return this;
  }
  u16(v: number): this {
    this.ensure(2);
    this.view.setUint16(this.at, v);
    this.at += 2;
    return this;
  }
  i16(v: number): this {
    this.ensure(2);
    this.view.setInt16(this.at, v);
    this.at += 2;
    return this;
  }
  u32(v: number): this {
    this.ensure(4);
    this.view.setUint32(this.at, v >>> 0);
    this.at += 4;
    return this;
  }
  i32(v: number): this {
    this.ensure(4);
    this.view.setInt32(this.at, v | 0);
    this.at += 4;
    return this;
  }
  f32(v: number): this {
    this.ensure(4);
    this.view.setFloat32(this.at, v);
    this.at += 4;
    return this;
  }
  bytes(b: Uint8Array): this {
    this.ensure(b.byteLength);
    this.buf.set(b, this.at);
    this.at += b.byteLength;
    return this;
  }
  /** Угол (радианы) в i16: шаг ~0.0001 рад — глазу неотличимо. */
  angle(rad: number): this {
    let a = rad % (Math.PI * 2);
    if (a > Math.PI) a -= Math.PI * 2;
    if (a < -Math.PI) a += Math.PI * 2;
    return this.i16(Math.round(a * 10_000));
  }

  get length(): number {
    return this.at;
  }

  finish(): Uint8Array {
    return this.buf.slice(0, this.at);
  }
}

export class ByteReader {
  private readonly view: DataView;
  private at = 0;

  constructor(private readonly buf: Uint8Array) {
    this.view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  }

  get left(): number {
    return this.buf.byteLength - this.at;
  }

  private need(n: number): void {
    if (this.at + n > this.buf.byteLength)
      throw new RangeError("Truncated message");
  }

  u8(): number {
    this.need(1);
    return this.view.getUint8(this.at++);
  }
  u16(): number {
    this.need(2);
    const v = this.view.getUint16(this.at);
    this.at += 2;
    return v;
  }
  i16(): number {
    this.need(2);
    const v = this.view.getInt16(this.at);
    this.at += 2;
    return v;
  }
  u32(): number {
    this.need(4);
    const v = this.view.getUint32(this.at);
    this.at += 4;
    return v;
  }
  i32(): number {
    this.need(4);
    const v = this.view.getInt32(this.at);
    this.at += 4;
    return v;
  }
  f32(): number {
    this.need(4);
    const v = this.view.getFloat32(this.at);
    this.at += 4;
    return v;
  }
  angle(): number {
    return this.i16() / 10_000;
  }
  rest(): Uint8Array {
    const out = this.buf.subarray(this.at);
    this.at = this.buf.byteLength;
    return out;
  }
}

const enc = new TextEncoder();
const dec = new TextDecoder();

/** Порог сжатия JSON-тела: мелкие сообщения (чат, поза контейнера) сжимать дороже, чем слать. */
const COMPRESS_OVER = 2048;

async function pipe(
  bytes: Uint8Array,
  stream: CompressionStream | DecompressionStream,
): Promise<Uint8Array> {
  const out = new Blob([bytes as Uint8Array<ArrayBuffer>])
    .stream()
    .pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

const canCompress = typeof CompressionStream !== "undefined";

/** JSON-сообщение: [тип][флаги][тело]. Большое тело сжимается, если среда умеет. */
export async function encodeJson(
  type: number,
  value: unknown,
): Promise<Uint8Array> {
  let body: Uint8Array = enc.encode(JSON.stringify(value));
  let flags = 0;
  if (canCompress && body.byteLength > COMPRESS_OVER) {
    body = await pipe(body, new CompressionStream("deflate-raw"));
    flags |= 1;
  }
  const out = new Uint8Array(body.byteLength + 2);
  out[0] = type;
  out[1] = flags;
  out.set(body, 2);
  return out;
}

/** То же без сжатия и синхронно — для мелких частых сообщений. */
export function encodeJsonSync(type: number, value: unknown): Uint8Array {
  const body = enc.encode(JSON.stringify(value));
  const out = new Uint8Array(body.byteLength + 2);
  out[0] = type;
  out[1] = 0;
  out.set(body, 2);
  return out;
}

/** Тело JSON-сообщения (без байта типа). null — битое. */
export async function decodeJson<T>(msg: Uint8Array): Promise<T | null> {
  try {
    const flags = msg[1] ?? 0;
    let body = msg.subarray(2);
    if (flags & 1)
      body = await pipe(body, new DecompressionStream("deflate-raw"));
    return JSON.parse(dec.decode(body)) as T;
  } catch {
    return null;
  }
}
