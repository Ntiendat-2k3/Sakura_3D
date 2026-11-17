/**
 * Texture vẽ bằng canvas cho 月華楼 Gekkarō (sàn gỗ xương cá, giấy dán tường hoa văn trăng, đá hầm, nỉ bàn, kính màu, bình phong).
 * Vẽ một lần mỗi phiên rồi cache theo tên: không thêm file ảnh vào repo và không tải mạng. Chỉ gọi phía client.
 */
import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from 'three';

type Draw = (ctx: CanvasRenderingContext2D, size: number) => void;
const cache = new Map<string, CanvasTexture>();

/** Bộ sinh số giả ngẫu nhiên cố định để mỗi lần vẽ ra cùng một hoa văn (không nhấp nháy giữa các lần mở phòng). */
function seeded(seed: number) {
  let value = seed;
  return () => { value = (value * 16807) % 2147483647; return value / 2147483647; };
}

function make(key: string, size: number, draw: Draw, repeat: [number, number] = [1, 1]): Texture {
  const cached = cache.get(key);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  draw(canvas.getContext('2d')!, size);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.repeat.set(...repeat);
  texture.anisotropy = 4;
  cache.set(key, texture);
  return texture;
}

/** Sàn gỗ xương cá óc chó, mỗi thanh một sắc độ. */
export function parquetTexture() {
  return make('parquet', 512, (ctx, size) => {
    const random = seeded(7);
    ctx.fillStyle = '#2a170d'; ctx.fillRect(0, 0, size, size);
    const plankL = size / 4, plankW = size / 16;
    for (let row = -2; row < 18; row++) {
      for (let col = -1; col < 5; col++) {
        for (const flip of [0, 1]) {
          const tone = 70 + random() * 40;
          ctx.save();
          ctx.translate(col * plankL + (flip ? plankL / 2 : 0), row * plankW * 2 + (flip ? plankW : 0));
          ctx.rotate(flip ? -Math.PI / 4 : Math.PI / 4);
          ctx.fillStyle = `rgb(${tone + 30}, ${tone - 5}, ${tone - 35})`;
          ctx.fillRect(0, 0, plankL * 0.7, plankW * 0.92);
          ctx.strokeStyle = 'rgba(20,10,4,0.55)'; ctx.lineWidth = 1.5;
          ctx.strokeRect(0, 0, plankL * 0.7, plankW * 0.92);
          ctx.strokeStyle = 'rgba(255,220,170,0.06)';
          for (let g = 0; g < 3; g++) { ctx.beginPath(); ctx.moveTo(0, plankW * (0.2 + g * 0.25)); ctx.lineTo(plankL * 0.7, plankW * (0.25 + g * 0.22)); ctx.stroke(); }
          ctx.restore();
        }
      }
    }
  }, [5, 5]);
}

/** Giấy dán tường đỏ rượu vang, hoa văn trăng tròn và hoa cúc vàng nhạt kiểu Taishō. */
export function damaskTexture() {
  return make('damask', 512, (ctx, size) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, size);
    gradient.addColorStop(0, '#4a0f18'); gradient.addColorStop(1, '#3a0a13');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = 'rgba(214,170,92,0.42)'; ctx.fillStyle = 'rgba(214,170,92,0.18)'; ctx.lineWidth = 3;
    const cell = size / 2;
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) {
      const cx = x * cell + (y % 2 ? cell / 2 : 0), cy = y * cell;
      ctx.beginPath(); ctx.arc(cx, cy, cell * 0.28, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx + cell * 0.07, cy - cell * 0.04, cell * 0.24, 0, Math.PI * 2); ctx.fill();
      for (let petal = 0; petal < 12; petal++) {
        const angle = petal * Math.PI / 6;
        ctx.beginPath();
        ctx.ellipse(cx + Math.cos(angle) * cell * 0.4, cy + Math.sin(angle) * cell * 0.4, cell * 0.07, cell * 0.025, angle, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.strokeStyle = 'rgba(214,170,92,0.16)'; ctx.lineWidth = 1;
    for (let x = 0; x <= size; x += cell / 2) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size); ctx.stroke(); }
  }, [3, 1.2]);
}

/** Ván ốp chân tường gỗ óc chó có ô pano khung chỉ vàng. */
export function wainscotTexture() {
  return make('wainscot', 256, (ctx, size) => {
    ctx.fillStyle = '#2b170e'; ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = '#b08a3c'; ctx.lineWidth = 3; ctx.strokeRect(size * 0.12, size * 0.15, size * 0.76, size * 0.7);
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 6; ctx.strokeRect(size * 0.08, size * 0.1, size * 0.84, size * 0.8);
    ctx.fillStyle = 'rgba(255,220,170,0.05)'; ctx.fillRect(size * 0.12, size * 0.15, size * 0.76, size * 0.2);
  }, [8, 1]);
}

/** Nỉ xanh bàn poker: vạch elip vàng chỗ đặt cược và chữ 月華楼 giữa bàn. */
export function feltTexture() {
  return make('felt', 1024, (ctx, size) => {
    const random = seeded(11);
    const gradient = ctx.createRadialGradient(size / 2, size / 2, size * 0.05, size / 2, size / 2, size * 0.55);
    gradient.addColorStop(0, '#1d6a4a'); gradient.addColorStop(1, '#0d3a28');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 9000; i++) { ctx.fillStyle = `rgba(0,0,0,${random() * 0.08})`; ctx.fillRect(random() * size, random() * size, 2, 2); }
    ctx.strokeStyle = 'rgba(231,196,107,0.7)'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.ellipse(size / 2, size / 2, size * 0.36, size * 0.36, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(size / 2, size / 2, size * 0.33, size * 0.33, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(231,196,107,0.55)'; ctx.font = `bold ${size * 0.075}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('月華楼', size / 2, size / 2 + size * 0.17);
    ctx.font = `${size * 0.028}px serif`; ctx.fillText('GEKKARŌ · TEXAS HOLD’EM', size / 2, size / 2 + size * 0.23);
  });
}

/** Đá hầm: khối đá xếp lệch, vữa sẫm, loang ẩm. */
export function stoneWallTexture() {
  return make('stone-wall', 512, (ctx, size) => {
    const random = seeded(23);
    ctx.fillStyle = '#1b1612'; ctx.fillRect(0, 0, size, size);
    const rowH = size / 8;
    for (let row = 0; row < 8; row++) {
      let x = row % 2 ? -size / 10 : 0;
      while (x < size) {
        const w = size / 6 + random() * size / 6, tone = 52 + random() * 30;
        ctx.fillStyle = `rgb(${tone + 8}, ${tone}, ${tone - 8})`;
        ctx.fillRect(x + 3, row * rowH + 3, w - 6, rowH - 6);
        ctx.fillStyle = `rgba(0,0,0,${0.1 + random() * 0.2})`;
        ctx.fillRect(x + 3, row * rowH + rowH * 0.6, w - 6, rowH * 0.4 - 3);
        x += w;
      }
    }
    for (let i = 0; i < 6; i++) {
      const x = random() * size, gradient = ctx.createLinearGradient(x, 0, x, size);
      gradient.addColorStop(0, 'rgba(10,14,10,0.5)'); gradient.addColorStop(1, 'rgba(10,14,10,0)');
      ctx.fillStyle = gradient; ctx.fillRect(x, 0, 10 + random() * 30, size * (0.4 + random() * 0.6));
    }
  }, [5, 1]);
}

/** Sàn đá phiến hầm có vệt máu khô. */
export function flagstoneTexture() {
  return make('flagstone', 512, (ctx, size) => {
    const random = seeded(31);
    ctx.fillStyle = '#100d0b'; ctx.fillRect(0, 0, size, size);
    const cell = size / 4;
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const tone = 38 + random() * 22;
      ctx.fillStyle = `rgb(${tone + 4}, ${tone}, ${tone - 4})`;
      ctx.fillRect(x * cell + 4 + random() * 4, y * cell + 4 + random() * 4, cell - 10, cell - 10);
    }
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = 'rgba(70,6,8,0.45)';
      ctx.beginPath(); ctx.ellipse(random() * size, random() * size, 20 + random() * 40, 10 + random() * 25, random() * 3, 0, Math.PI * 2); ctx.fill();
    }
  }, [4, 3]);
}

/** Cửa sổ trăng tròn kính màu: trăng vàng, mây xanh, cành hoa — phát sáng nhẹ như có trăng thật bên ngoài. */
export function moonWindowTexture() {
  return make('moon-window', 512, (ctx, size) => {
    const c = size / 2;
    const sky = ctx.createRadialGradient(c, c, 0, c, c, c);
    sky.addColorStop(0, '#2f4f86'); sky.addColorStop(1, '#0f1a38');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#ffe7a6'; ctx.beginPath(); ctx.arc(c * 1.18, c * 0.82, c * 0.34, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(160,190,230,0.55)';
    for (const [x, y, r] of [[0.6, 1.1, 0.22], [0.85, 1.15, 0.18], [1.3, 1.25, 0.2], [1.55, 1.2, 0.15]]) { ctx.beginPath(); ctx.arc(c * x, c * y, c * r, Math.PI, 0); ctx.fill(); }
    ctx.strokeStyle = '#3a2216'; ctx.lineWidth = 9; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(c * 0.2, c * 1.6); ctx.quadraticCurveTo(c * 0.7, c * 1.0, c * 1.1, c * 0.45); ctx.stroke();
    ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(c * 0.55, c * 1.2); ctx.quadraticCurveTo(c * 0.4, c * 0.8, c * 0.5, c * 0.45); ctx.stroke();
    ctx.fillStyle = '#f2a7c0';
    const random = seeded(5);
    for (let i = 0; i < 22; i++) { ctx.beginPath(); ctx.arc(c * (0.3 + random() * 0.9), c * (0.45 + random() * 1.0), 7 + random() * 6, 0, Math.PI * 2); ctx.fill(); }
    // Khung chì chia ô kính.
    ctx.strokeStyle = 'rgba(30,20,10,0.85)'; ctx.lineWidth = 4;
    for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo((size / 6) * i, 0); ctx.lineTo((size / 6) * i, size); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(0, c); ctx.lineTo(size, c); ctx.stroke();
  });
}

/** Bình phong gấp lá vàng vẽ cành mận và trăng khuyết. */
export function byobuTexture() {
  return make('byobu', 512, (ctx, size) => {
    const random = seeded(17);
    const gold = ctx.createLinearGradient(0, 0, size, size);
    gold.addColorStop(0, '#c9a24c'); gold.addColorStop(0.5, '#e8c873'); gold.addColorStop(1, '#b58b38');
    ctx.fillStyle = gold; ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = 'rgba(120,90,30,0.25)';
    for (let x = 0; x < size; x += size / 8) for (let y = 0; y < size; y += size / 8) ctx.strokeRect(x + random() * 2, y + random() * 2, size / 8, size / 8);
    ctx.fillStyle = '#f5f0e0'; ctx.beginPath(); ctx.arc(size * 0.75, size * 0.25, size * 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = gold; ctx.beginPath(); ctx.arc(size * 0.79, size * 0.23, size * 0.09, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#2b1a10'; ctx.lineWidth = 12; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, size * 0.85); ctx.bezierCurveTo(size * 0.3, size * 0.7, size * 0.35, size * 0.4, size * 0.62, size * 0.3); ctx.stroke();
    ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(size * 0.3, size * 0.6); ctx.quadraticCurveTo(size * 0.45, size * 0.6, size * 0.55, size * 0.75); ctx.stroke();
    ctx.fillStyle = '#d23a4f';
    for (let i = 0; i < 28; i++) { ctx.beginPath(); ctx.arc(size * (0.1 + random() * 0.55), size * (0.3 + random() * 0.5), 6 + random() * 5, 0, Math.PI * 2); ctx.fill(); }
  });
}

/** Thảm Ba Tư đỏ đậm viền vàng dưới bàn. */
export function rugTexture() {
  return make('rug', 512, (ctx, size) => {
    ctx.fillStyle = '#4c0b14'; ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = '#c9a24c'; ctx.lineWidth = 10; ctx.strokeRect(20, 20, size - 40, size - 40);
    ctx.strokeStyle = '#1e2a4a'; ctx.lineWidth = 18; ctx.strokeRect(44, 44, size - 88, size - 88);
    ctx.strokeStyle = 'rgba(201,162,76,0.6)'; ctx.lineWidth = 3;
    const c = size / 2;
    for (let r = 40; r < c - 60; r += 26) { ctx.beginPath(); ctx.moveTo(c, c - r); ctx.lineTo(c + r, c); ctx.lineTo(c, c + r); ctx.lineTo(c - r, c); ctx.closePath(); ctx.stroke(); }
  });
}

/** Mọi texture gốc của sòng: màn hình tải vẽ canvas và đẩy lên GPU trước, vào sòng không phải vẽ lại. */
export function allGekkaTextures(): Texture[] {
  return [parquetTexture(), damaskTexture(), wainscotTexture(), feltTexture(), stoneWallTexture(), flagstoneTexture(), moonWindowTexture(), byobuTexture(), rugTexture()];
}

const tiles = new WeakMap<Texture, Map<string, Texture>>();
/** Bản sao dùng chung ảnh nhưng lặp theo kích thước bề mặt (m) để hoa văn giữ đúng tỉ lệ trên mọi mảng tường/sàn. */
export function tiled(base: Texture, repeatX: number, repeatY: number): Texture {
  const key = `${repeatX.toFixed(2)}x${repeatY.toFixed(2)}`;
  let byKey = tiles.get(base);
  if (!byKey) { byKey = new Map(); tiles.set(base, byKey); }
  let texture = byKey.get(key);
  if (!texture) {
    texture = base.clone();
    texture.repeat.set(repeatX, repeatY);
    texture.needsUpdate = true;
    byKey.set(key, texture);
  }
  return texture;
}
