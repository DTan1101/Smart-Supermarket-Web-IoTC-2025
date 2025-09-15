from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from sharewei import load_weight
from sharewei import save_last_barcode, load_last_barcode
from pymongo import MongoClient
from bson.objectid import ObjectId

app = Flask(__name__)
CORS(app)

client = MongoClient('mongodb+srv://duytan:DuyTan1101%23@supermarket.njatyjl.mongodb.net/supermarket?retryWrites=true&w=majority&appName=supermarket')
db = client.supermarket
plu_collection = db['plus']

@app.route('/start-weigh', methods=['POST'])
def start_weigh():
    data = request.get_json()
    plu = data.get('plu')
    print(f"Received PLU: {plu}") 
    print(list(plu_collection.find().limit(1)))

    # Truy vấn PLU từ MongoDB
    plu_data = plu_collection.find_one({'pluCode': str(plu)})
    print(f"Received PLU: {plu_data}") 

    if not plu_data:
        return jsonify({'error': 'PLU not found'}), 404

    weight = load_weight()  # Đọc từ file
    total_price = int(weight * plu_data['pricePerKg'])

    return jsonify({
        'name': plu_data['name'],
        'price_per_kg': plu_data['pricePerKg'],
        'weight': weight,
        'total_price': total_price
    })

@app.route('/scan-barcode', methods=['POST'])
def scan_barcode():
    """
    Pi POST vao day:
      {"barcode": "012345678905", "sym": "EAN13"}
    Luu 'last' qua sharewei va tra ve JSON xac nhan.
    """
    data = request.get_json(force=True)
    barcode = str(data.get('barcode', '')).strip()
    sym = str(data.get('sym', '')).strip()

    if not barcode:
        return jsonify({"ok": False, "error": "barcode required"}), 400

    # GIU NGUYEN SO 0 DAU -> KHONG convert int
    save_last_barcode(barcode, sym)

    # Tra lai ban ghi vua luu (doc lai cho chac)
    doc = load_last_barcode()
    # Optional: them ts neu sharewei khong them
    if 'ts' not in doc:
        doc['ts'] = time.time()
    return jsonify({"ok": True, **doc})


@app.route('/last-barcode', methods=['GET'])
def last_barcode():
    """
    Web front-end goi de lay barcode moi nhat
    """
    doc = load_last_barcode()
    if 'ts' not in doc:
        doc['ts'] = None
    return jsonify(doc)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)