import sys, os, time, struct, serial
import numpy as np
import cv2
from pyzbar.pyzbar import decode, ZBarSymbol

# ==== BUZZER ====
import atexit
try:
    import RPi.GPIO as GPIO
    _GPIO_OK = True
except Exception as _e:
    print("[BUZZER] RPi.GPIO not available, beep disabled.", _e)
    _GPIO_OK = False

class Buzzer:
    def __init__(self, pin=18, active_high=True):
        # pin: BCM numbering (vd 18)
        # active_high: True neu GPIO HIGH thi coi keu (mach NPN low-side)
        self.pin = pin
        self.active_high = active_high
        self._ok = _GPIO_OK
        if not self._ok:
            return
        GPIO.setmode(GPIO.BCM)
        GPIO.setup(self.pin, GPIO.OUT, initial=(GPIO.LOW if self.active_high else GPIO.HIGH))

    def _on(self):
        if not self._ok: return
        GPIO.output(self.pin, GPIO.HIGH if self.active_high else GPIO.LOW)

    def _off(self):
        if not self._ok: return
        GPIO.output(self.pin, GPIO.LOW if self.active_high else GPIO.HIGH)

    def beep(self, n=1, duration=0.1, gap=0.08):
        # n: so lan bip; duration: s; gap: s
        if not self._ok: return
        import time
        for _ in range(n):
            self._on(); time.sleep(duration)
            self._off(); time.sleep(gap)

    def cleanup(self):
        if not self._ok: return
        try:
            GPIO.output(self.pin, GPIO.LOW if self.active_high else GPIO.HIGH)
            GPIO.cleanup(self.pin)
        except:
            pass

# tao 1 doi tuong buzzer toan cuc, cleanup tu dong khi thoat
_BZ = Buzzer(pin=18, active_high=True)
atexit.register(_BZ.cleanup)

# ==== API last barcode ====
import requests
SCAN_BARCODE_URL = os.getenv("SCAN_BARCODE_URL", "http://127.0.0.1:5000/scan-barcode")
DEDUP_TTL = float(os.getenv("BARCODE_DEDUP_TTL", "2.0"))
_sent_guard = {}

# ===== THAM SO CHINH =====
# UART
PORT = sys.argv[1] if len(sys.argv) > 1 else "/dev/serial0" 
BAUD = 230400
TIMEOUT = 0.2

# Hinh
W, H = 240, 240
BPP = 2
IMAGE_SIZE = W * H * BPP  # 115200 bytes RGB565

# Giao thuc tu kit (phai match voi app.c)
PREAMBLE = b"\x11\x22\x33\x44"
PAYLOAD_MAX = 1024

# YOLO
ONNX_PATH = sys.argv[2] if len(sys.argv) > 2 else "/home/pi/Desktop/best.onnx"
IMGSZ     = int(sys.argv[3]) if len(sys.argv) > 3 else 320
CONF_THRES, IOU_THRES = 0.22, 0.45

# Pyzbar tuning
MIN_DECODE_W = 420
QUIET_ZONE   = 24
UPSCALE_MAX  = 4.0
SYMS = [ZBarSymbol.EAN13, ZBarSymbol.EAN8, ZBarSymbol.UPCA, ZBarSymbol.UPCE,
        ZBarSymbol.CODE128, ZBarSymbol.CODE39, ZBarSymbol.QRCODE]

# Luu file
OUT_DIR = sys.argv[4] if len(sys.argv) > 4 else "./out"
SAVE_RAW = False          # luu raw anh RGB565
SAVE_CROPS = True         # luu crop ROI
os.makedirs(OUT_DIR, exist_ok=True)

# ===== CRC-16-CCITT (init 0xFFFF, poly 0x1021) =====
def crc16_ccitt(data: bytes, init=0xFFFF):
    crc = init
    for b in data:
        crc ^= (b << 8)
        for _ in range(8):
            crc = ((crc << 1) ^ 0x1021) & 0xFFFF if (crc & 0x8000) else ((crc << 1) & 0xFFFF)
    return crc

# ===== Doc 1 packet (chunk) tu stream =====
def read_exact(ser: serial.Serial, n):
    buf = bytearray()
    while len(buf) < n:
        chunk = ser.read(n - len(buf))
        if not chunk:
            break
        buf.extend(chunk)
    return bytes(buf)

def find_preamble(ser: serial.Serial):
    # tim chuoi 0x11 22 33 44 trong stream
    window = bytearray()
    while True:
        b = ser.read(1)
        if not b:
            return False
        window += b
        if len(window) > 4:
            window = window[-4:]
        if bytes(window) == PREAMBLE:
            return True

def read_packet(ser: serial.Serial):
    # tim preamble
    if not find_preamble(ser):
        return None

    # doc length (LE), seq (LE)
    hdr = read_exact(ser, 4)  # length(2) + seq(2)
    if len(hdr) < 4:
        return None
    length = hdr[0] | (hdr[1] << 8)
    seq    = hdr[2] | (hdr[3] << 8)

    # doc payload + CRC (2 bytes BE)
    payload = read_exact(ser, length)
    if len(payload) < length:
        return None
    crc_bytes = read_exact(ser, 2)
    if len(crc_bytes) < 2:
        return None
    crc_rx = (crc_bytes[0] << 8) | crc_bytes[1]

    # tinh CRC tren (length+seq+payload) giong app.c
    data_crc = hdr + payload
    crc_calc = crc16_ccitt(data_crc, 0xFFFF)

    if crc_calc != crc_rx:
        print(f"[WARN] CRC fail seq={seq} len={length} calc=0x{crc_calc:04X} rx=0x{crc_rx:04X}")
        return None

    return seq, payload

# ===== Nhan tron 1 frame day du =====
def recv_one_frame(ser: serial.Serial, verbose=False):
    buf = bytearray()
    expect_seq = 0
    t0 = time.time()

    while len(buf) < IMAGE_SIZE:
        pkt = read_packet(ser)
        if pkt is None:
            # khong co du lieu hoac CRC fail -> co the tiep tuc
            continue
        seq, payload = pkt
        if seq != expect_seq:
            # neu mat goi: co the bo qua/hoac reset
            if verbose:
                print(f"[WARN] mat goi? seq={seq} expect={expect_seq}")
            # tiep tuc lay, nhung de don gian ta chap nhan chen theo seq hien tai
            expect_seq = seq
        buf.extend(payload)
        expect_seq += 1

    if len(buf) > IMAGE_SIZE:
        buf = buf[:IMAGE_SIZE]

    dt = (time.time() - t0) * 1000.0
    if verbose:
        print(f"[INFO] frame {len(buf)} bytes in {dt:.1f} ms, packets ~{expect_seq}")

    return bytes(buf)

# ===== Chuyen RGB565 -> BGR888 (numpy)
def rgb565_to_bgr888(rgb565_bytes: bytes, w: int, h: int):
    arr = np.frombuffer(rgb565_bytes, dtype=np.uint8).reshape(h, w, 2)
    # little-endian: low, high
    lo = arr[:, :, 0].astype(np.uint16)
    hi = arr[:, :, 1].astype(np.uint16)
    val = (hi << 8) | lo

    r5 = (val >> 11) & 0x1F
    g6 = (val >> 5)  & 0x3F
    b5 = (val >> 0)  & 0x1F

    r8 = ((r5 << 3) | (r5 >> 2)).astype(np.uint8)
    g8 = ((g6 << 2) | (g6 >> 4)).astype(np.uint8)
    b8 = ((b5 << 3) | (b5 >> 2)).astype(np.uint8)

    bgr = np.dstack([b8, g8, r8])  # BGR order
    return bgr

# ===== YOLO helper =====
def letterbox(im, new_shape=640, color=(114,114,114)):
    h, w = im.shape[:2]
    if isinstance(new_shape, int):
        new_shape = (new_shape, new_shape)
    r = min(new_shape[0] / h, new_shape[1] / w)
    new_unpad = (int(round(w * r)), int(round(h * r)))
    dw, dh = new_shape[1] - new_unpad[0], new_shape[0] - new_unpad[1]
    dw /= 2; dh /= 2
    im_resized = cv2.resize(im, new_unpad, interpolation=cv2.INTER_LINEAR)
    top, bottom = int(round(dh - 0.1)), int(round(dh + 0.1))
    left, right = int(round(dw - 0.1)), int(round(dw + 0.1))
    im_padded = cv2.copyMakeBorder(im_resized, top, bottom, left, right, cv2.BORDER_CONSTANT, value=color)
    return im_padded, r, (dw, dh)

def add_quiet_zone(bgr, q=QUIET_ZONE):
    return cv2.copyMakeBorder(bgr, q, q, q, q, cv2.BORDER_CONSTANT, value=(255,255,255))

def unsharp(img):
    blur = cv2.GaussianBlur(img, (0,0), 1.0)
    return cv2.addWeighted(img, 1.5, blur, -0.5, 0)

def variants_for_decode(roi_bgr):
    out = []
    bgr = roi_bgr
    out.append(bgr)
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    out.append(gray)
    g2 = unsharp(gray)
    out.append(g2)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
    out.append(clahe.apply(gray))
    _, th  = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    _, thi = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    out += [th, thi]
    return out

def normalize_code(sym, txt):
    txt = (txt or "").strip()
    if sym == 'UPCA':
        txt = txt.zfill(12)
    elif sym == 'EAN13':
        txt = txt.zfill(13)
    elif sym == 'UPCE':
        txt = txt.zfill(8)
    elif sym == 'EAN8':
        txt = txt.zfill(8)
    return sym, txt

def try_decode(roi):
    roi = add_quiet_zone(roi, q=QUIET_ZONE)
    h, w = roi.shape[:2]
    if w < MIN_DECODE_W:
        scale = min(UPSCALE_MAX, max(2.0, MIN_DECODE_W / max(1, w)))
        roi = cv2.resize(roi, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)

    rotations = [
        roi,
        cv2.rotate(roi, cv2.ROTATE_90_CLOCKWISE),
        cv2.rotate(roi, cv2.ROTATE_180),
        cv2.rotate(roi, cv2.ROTATE_90_COUNTERCLOCKWISE),
    ]

    seen = []
    for img_rot in rotations:
        for var in variants_for_decode(img_rot):
            zs = decode(var, symbols=SYMS)
            for z in zs:
                raw = z.data.decode("utf-8", errors="ignore")
                sym = z.type
                sym, txt = normalize_code(sym, raw)
                key = (sym, txt)
                if key not in seen:
                    seen.append(key)
            if seen:
                return seen
    return seen

# ===== YOLO forward 1 anh + decode barcode =====
class YoloRunner:
    def __init__(self, onnx_path, imgsz):
        self.imgsz = imgsz
        self.net = cv2.dnn.readNetFromONNX(onnx_path)
        self.net.setPreferableBackend(cv2.dnn.DNN_BACKEND_OPENCV)
        self.net.setPreferableTarget(cv2.dnn.DNN_TARGET_CPU)

    def detect_and_decode(self, img_bgr, save_crops_dir=None):
        inp, r, (dw, dh) = letterbox(img_bgr, self.imgsz)
        blob = cv2.dnn.blobFromImage(inp, 1/255.0, (self.imgsz, self.imgsz), swapRB=True, crop=False)
        self.net.setInput(blob)
        t0 = time.time()
        pred = self.net.forward()
        infer_ms = (time.time() - t0) * 1000

        pred = np.squeeze(pred)
        if pred.ndim == 1:
            pred = np.expand_dims(pred, 0)
        if pred.shape[0] == 85:
            pred = pred.T

        boxes, scores = [], []
        for det in pred:
            obj = det[4]
            if obj < CONF_THRES:
                continue
            cls_id = int(np.argmax(det[5:]))
            cls_conf = det[5 + cls_id]
            score = float(obj * cls_conf)
            if score < CONF_THRES:
                continue
            cx, cy, w, h = det[:4]
            x = (cx - w/2 - dw) / r
            y = (cy - h/2 - dh) / r
            w, h = w / r, h / r
            x = max(0, min(x, img_bgr.shape[1] - 1))
            y = max(0, min(y, img_bgr.shape[0] - 1))
            w = max(1, min(w, img_bgr.shape[1] - x))
            h = max(1, min(h, img_bgr.shape[0] - y))
            boxes.append([int(x), int(y), int(w), int(h)])
            scores.append(score)

        idx = cv2.dnn.NMSBoxes(boxes, scores, CONF_THRES, IOU_THRES)
        decoded_all = []
        if save_crops_dir and not os.path.isdir(save_crops_dir):
            os.makedirs(save_crops_dir, exist_ok=True)

        crop_id = 0
        if len(idx) > 0:
            for i in idx.flatten():
                x, y, w, h = boxes[i]
                pad = max(int(0.15 * max(w, h)), 12)
                x0 = max(0, x - pad); y0 = max(0, y - pad)
                x1 = min(img_bgr.shape[1], x + w + pad); y1 = min(img_bgr.shape[0], y + h + pad)
                roi = img_bgr[y0:y1, x0:x1]

                if save_crops_dir:
                    cv2.imwrite(os.path.join(save_crops_dir, f"crop_{crop_id:03d}.png"), roi)
                    crop_id += 1

                results = try_decode(roi)
                if results:
                    for sym, txt in results:
                        decoded_all.append((sym, txt))
                        cv2.putText(img_bgr, f"{sym}:{txt}", (x, max(0, y - 6)),
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0,255,0), 2, cv2.LINE_AA)
                cv2.rectangle(img_bgr, (x, y), (x + w, y + h), (0,255,0), 2)

        if not decoded_all:
            full = img_bgr.copy()
            if full.shape[1] < MIN_DECODE_W:
                s = min(UPSCALE_MAX, max(2.0, MIN_DECODE_W / full.shape[1]))
                full = cv2.resize(full, None, fx=s, fy=s, interpolation=cv2.INTER_CUBIC)
            results = try_decode(full)
            for sym, txt in results:
                decoded_all.append((sym, txt))
                cv2.putText(img_bgr, f"{sym}:{txt}", (6, 18),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0,255,0), 2, cv2.LINE_AA)

        return decoded_all, img_bgr, infer_ms

def post_scan(sym, code):
    key = f"{sym}:{code}"
    now = time.time()
    if now - _sent_guard.get(key, 0.0) < DEDUP_TTL:
        return
    _sent_guard[key] = now
    try:
        payload = {"barcode": str(code), "sym": str(sym)}
        r = requests.post(SCAN_BARCODE_URL, json=payload, timeout=2.0)
        print("[API] POST /scan-barcode", r.status_code, str(r.text)[:120])

        # >>> BEEP sau khi API tra ve thanh cong (200-299) <<<
        if 200 <= r.status_code < 300:
            _BZ.beep(n=2, duration=0.08, gap=0.06)

    except Exception as e:
        print("ERR post_scan:", e)



# ===== MAIN LOOP =====
def main():
    print(f"[OPEN] {PORT} @ {BAUD}")
    try:
        ser = serial.Serial(PORT, BAUD, timeout=TIMEOUT)
    except Exception as e:
        print("ERR: cannot open serial:", e)
        sys.exit(1)

    yolo = YoloRunner(ONNX_PATH, IMGSZ)

    # doi READY tu kit (neu co)
    ser.flushInput()
    ser.flushOutput()
    t_ready = time.time()
    got_ready = False
    while time.time() - t_ready < 3.0:
        line = ser.readline()
        if line:
            try:
                s = line.decode("utf-8", errors="ignore").strip()
            except:
                s = ""
            if "READY" in s:
                got_ready = True
                print("[KIT] READY")
                break
    # gui frame dau tien
    ser.write(b"S")  # yeu cau 1 frame

    frame_idx = 0
    while True:
        # nhan 1 frame
        raw = recv_one_frame(ser, verbose=True)
        if SAVE_RAW:
            with open(os.path.join(OUT_DIR, f"frame_{frame_idx:04d}.rgb565"), "wb") as f:
                f.write(raw)

        bgr = rgb565_to_bgr888(raw, W, H)

        # detect + decode
        crops_dir = os.path.join(OUT_DIR, f"crops_{frame_idx:04d}") if SAVE_CROPS else None
        decoded, vis, infer_ms = yolo.detect_and_decode(bgr, save_crops_dir=crops_dir)

        # luu va log
        out_img = os.path.join(OUT_DIR, f"annot_{frame_idx:04d}.jpg")
        out_txt = os.path.join(OUT_DIR, f"barcodes_{frame_idx:04d}.txt")
        cv2.imwrite(out_img, vis)
        with open(out_txt, "w", encoding="utf-8") as f:
            for sym, txt in decoded:
                f.write(f"{sym}:{txt}\n")
                post_scan(sym, txt)
        print(f"[RESULT] frame={frame_idx} decoded={len(decoded)} infer={infer_ms:.1f} ms | saved: {out_img}, {out_txt}")

        # thong bao da nhan xong + xin frame moi (match firmware: N -> clear waiting, S -> set send_frame)
        ser.write(b"N")
        time.sleep(0.01)
        ser.write(b"S")

        frame_idx += 1

    ser.close()

if __name__ == "__main__":
    main()


