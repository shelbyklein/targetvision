import type { File } from "@google-cloud/storage";

const MAGIC_BYTES_TO_READ = 12;

const IMAGE_SIGNATURES: Array<{
  mimeType: string;
  check: (buf: Buffer) => boolean;
}> = [
  {
    mimeType: "image/jpeg",
    check: (buf) => buf[0] === 0xff && buf[1] === 0xd8,
  },
  {
    mimeType: "image/png",
    check: (buf) =>
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47,
  },
  {
    mimeType: "image/gif",
    check: (buf) =>
      buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46,
  },
  {
    mimeType: "image/webp",
    check: (buf) =>
      buf.length >= 12 &&
      buf[0] === 0x52 &&
      buf[1] === 0x49 &&
      buf[2] === 0x46 &&
      buf[3] === 0x46 &&
      buf[8] === 0x57 &&
      buf[9] === 0x45 &&
      buf[10] === 0x42 &&
      buf[11] === 0x50,
  },
];

export async function readMagicBytes(file: File): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const stream = file.createReadStream({ start: 0, end: MAGIC_BYTES_TO_READ - 1 });
    stream.on("data", (chunk: Buffer) => { chunks.push(chunk); });
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", (err) => reject(err));
  });
}

export function detectImageMimeType(buf: Buffer): string | null {
  if (buf.length < 2) return null;
  for (const sig of IMAGE_SIGNATURES) {
    if (sig.check(buf)) {
      return sig.mimeType;
    }
  }
  return null;
}
