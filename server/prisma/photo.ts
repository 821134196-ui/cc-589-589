import { deflateSync } from 'zlib';

// 用代码生成一张纯色"封签照片"占位 PNG（本地存放，无需外部素材）。
// 米色底 + 红色封签条 + 深红边框 + 模拟文字黑线。
export function makeSealPng(seed = 0): Buffer {
  const W = 240;
  const H = 150;
  const bg = [0xf5, 0xef, 0xe2];
  const red = [0xc0, 0x3b, 0x3b];
  const dark = [0x52, 0x51, 0x4e];

  const px = (x: number, y: number): number[] => {
    if (x < 4 || x >= W - 4 || y < 4 || y >= H - 4) return [0x8e, 0x24, 0x24];
    if (y < 26) return red;
    // 模拟封签编号的黑色横线（随 seed 微移）
    const lineY = 46 + ((seed * 7) % 5);
    if (y >= lineY && y <= lineY + 6 && x >= 20 && x <= 150) return dark;
    if (y >= lineY + 18 && y <= lineY + 22 && x >= 20 && x <= 200) return [0x9a, 0x95, 0x88];
    if (y >= lineY + 34 && y <= lineY + 38 && x >= 20 && x <= 120) return [0x9a, 0x95, 0x88];
    return bg;
  };

  const raw: number[] = [];
  for (let y = 0; y < H; y++) {
    raw.push(0); // filter: none
    for (let x = 0; x < W; x++) {
      const [r, g, b] = px(x, y);
      raw.push(r, g, b);
    }
  }

  const idat = deflateSync(Buffer.from(raw));
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])) >>> 0, 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return c ^ 0xffffffff;
}
