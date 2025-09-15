import cv2, numpy as np, sys, time, os
from pyzbar.pyzbar import decode, ZBarSymbol

# ===== THAM SO MAC DINH =====
ONNX_PATH = sys.argv[1] if len(sys.argv) > 1 else "/home/pi/Desktop/best.onnx"
SRC_PATH  = sys.argv[2] if len(sys.argv) > 2 else "/home/pi/Desktop/frame14.png"
IMGSZ     = int(sys.argv[3]) if len(sys.argv) > 3 else 320

CONF_THRES, IOU_THRES = 0.22, 0.45

# Tuning cho pyzbar
MIN_DECODE_W = 420
QUIET_ZONE   = 24
UPSCALE_MAX  = 4.0

SYMS = [ZBarSymbol.EAN13, ZBarSymbol.EAN8, ZBarSymbol.UPCA, ZBarSymbol.UPCE,
        ZBarSymbol.CODE128, ZBarSymbol.CODE39, ZBarSymbol.QRCODE]

SAVE_CROPS = True  # LƯU ROI sau khi phát hiện để debug

# ===== HAM PHU =====
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
    im_padded = cv2.copyMakeBorder(im_resized, top, bottom, left, right,
                                   cv2.BORDER_CONSTANT, value=color)
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

# ==== CHUẨN HOÁ MÃ: GIỮ 0 ĐẦU & CHUYỂN EAN13->UPCA KHI CẦN ====
def normalize_code(sym, txt):
    # luôn là chuỗi
    txt = (txt or "").strip()

    if sym == 'UPCA':
        # UPC-A luôn 12 số; đôi khi pyzbar bỏ '0' đầu -> thêm lại
        txt = txt.zfill(12)

    elif sym == 'EAN13':
        # EAN-13 luôn 13 số
        txt = txt.zfill(13)


    elif sym == 'UPCE':
        # UPCE là 8 số; không mở rộng ra UPCA ở đây (tuỳ nhu cầu)
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
                sym, txt = normalize_code(sym, raw)  # <==== CHUẨN HOÁ Ở ĐÂY
                key = (sym, txt)
                if key not in seen:
                    seen.append(key)
            if seen:
                return seen
    return seen

# ===== MAIN =====
def main():
    img = cv2.imread(SRC_PATH)
    if img is None:
        print("ERR: cannot open image:", SRC_PATH); sys.exit(1)

    inp, r, (dw, dh) = letterbox(img, IMGSZ)
    blob = cv2.dnn.blobFromImage(inp, 1/255.0, (IMGSZ, IMGSZ), swapRB=True, crop=False)

    net = cv2.dnn.readNetFromONNX(ONNX_PATH)
    net.setPreferableBackend(cv2.dnn.DNN_BACKEND_OPENCV)
    net.setPreferableTarget(cv2.dnn.DNN_TARGET_CPU)
    net.setInput(blob)

    t0 = time.time()
    pred = net.forward()
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
        x = max(0, min(x, img.shape[1] - 1))
        y = max(0, min(y, img.shape[0] - 1))
        w = max(1, min(w, img.shape[1] - x))
        h = max(1, min(h, img.shape[0] - y))
        boxes.append([int(x), int(y), int(w), int(h)])
        scores.append(score)

    idx = cv2.dnn.NMSBoxes(boxes, scores, CONF_THRES, IOU_THRES)

    decoded_all = []
    crop_id = 0
    out_dir = os.path.dirname(SRC_PATH) or "."
    crops_dir = os.path.join(out_dir, "crops")
    if SAVE_CROPS and not os.path.isdir(crops_dir):
        os.makedirs(crops_dir, exist_ok=True)

    if len(idx) > 0:
        for i in idx.flatten():
            x, y, w, h = boxes[i]
            pad = max(int(0.15 * max(w, h)), 12)
            x0 = max(0, x - pad); y0 = max(0, y - pad)
            x1 = min(img.shape[1], x + w + pad); y1 = min(img.shape[0], y + h + pad)
            roi = img[y0:y1, x0:x1]

            if SAVE_CROPS:
                cv2.imwrite(os.path.join(crops_dir, f"crop_{crop_id:03d}.png"), roi)
                crop_id += 1

            results = try_decode(roi)
            if results:
                for sym, txt in results:
                    decoded_all.append((sym, txt))
                    cv2.putText(img, f"{sym}:{txt}", (x, max(0, y - 6)),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0,255,0), 2, cv2.LINE_AA)
            cv2.rectangle(img, (x, y), (x + w, y + h), (0,255,0), 2)

    if not decoded_all:
        full = img.copy()
        if full.shape[1] < MIN_DECODE_W:
            s = min(UPSCALE_MAX, max(2.0, MIN_DECODE_W / full.shape[1]))
            full = cv2.resize(full, None, fx=s, fy=s, interpolation=cv2.INTER_CUBIC)
        results = try_decode(full)
        for sym, txt in results:
            decoded_all.append((sym, txt))
            cv2.putText(img, f"{sym}:{txt}", (6, 18),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0,255,0), 2, cv2.LINE_AA)

    out_img = os.path.join(out_dir, "out14.jpg")
    out_txt = os.path.join(out_dir, "barcodes14.txt")
    cv2.imwrite(out_img, img)
    with open(out_txt, "w", encoding="utf-8") as f:
        for sym, txt in decoded_all:
            f.write(f"{sym}:{txt}\n")

    print(f"Boxes: {len(idx) if hasattr(idx,'__len__') else 0} | "
          f"Decoded: {len(decoded_all)} | {infer_ms:.1f} ms | "
          f"Saved: {out_img}, {out_txt} | Crops dir: {crops_dir if SAVE_CROPS else 'off'}")

if __name__ == "__main__":
    main()
