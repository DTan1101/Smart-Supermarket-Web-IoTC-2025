# shared_weight.py
import json, time

def save_weight(weight_grams):
    with open("/mnt/d/8. IoTC-FPT/main-web/pi-model/api/latest_weight.txt", "w") as f:
        f.write(f"{weight_grams}\n")  

def load_weight():
    try:
        with open("/mnt/d/8. IoTC-FPT/main-web/pi-model/api/latest_weight.txt", "r") as f:
            weight_grams = float(f.read().strip())
            weight_kg = weight_grams / 1000
            return round(weight_kg, 3)  
    except:
        return 0.0
    
def save_last_barcode(barcode, sym):
    # luu ma barcode cuoi: giu du 0 dau, co timestamp
    doc = {"barcode": str(barcode), "sym": str(sym), "ts": time.time()}
    with open("/mnt/d/8. IoTC-FPT/main-web/pi-model/api/latest_barcode.json", "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False)

def load_last_barcode():
    try:
        with open("/mnt/d/8. IoTC-FPT/main-web/pi-model/api/latest_barcode.json", "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        return {"barcode": None, "sym": None, "ts": None}
