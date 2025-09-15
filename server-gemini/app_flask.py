# app_flask.py - Fixed CORS configuration
import os
import json
import time
from flask import Flask, request, Response, jsonify, render_template
from flask_cors import CORS

# --- Google GenAI (Gemini) SDK ---
try:
    from google import genai
except Exception as e:
    genai = None

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash-exp")  # Updated model

app = Flask(__name__, static_folder='static', template_folder='templates')

# More specific CORS configuration
CORS(app, origins="*", methods=["GET", "POST", "OPTIONS"], 
     allow_headers=["Content-Type", "Authorization"])

genai_client = None
if GEMINI_API_KEY:
    if genai is None:
        print("[init] google.genai SDK not available. Install google-genai.")
    else:
        try:
            # Create client for Gemini (Google GenAI)
            genai_client = genai.Client(api_key=GEMINI_API_KEY)
            print("[init] Gemini client created, model:", GEMINI_MODEL)
        except Exception as e:
            genai_client = None
            print("[init] Failed to initialize Gemini client:", e)

@app.route('/')
def index():
    return render_template('index.html')

def extract_text_from_chunk(chunk):
    """
    Try several patterns for text in chunk (SDK may return objects or dicts).
    Returns None if no text found.
    """
    try:
        # If chunk is an object with attribute 'text'
        text = getattr(chunk, "text", None)
        if text:
            return text

        # If chunk is dict-like
        if isinstance(chunk, dict):
            # direct field
            if "text" in chunk and chunk["text"]:
                return chunk["text"]
            # nested candidate/content pattern
            cand = chunk.get("candidates") or chunk.get("candidate") or []
            if cand:
                try:
                    c0 = cand[0]
                    # sometimes c0 has 'content' list with parts
                    content = c0.get("content") if isinstance(c0, dict) else None
                    if content and isinstance(content, list) and len(content) > 0:
                        part = content[0]
                        if isinstance(part, dict) and "text" in part:
                            return part["text"]
                        if isinstance(part, str):
                            return part
                except Exception:
                    pass
        # Fallback: stringify
        return None
    except Exception:
        return None

@app.route('/api/chat', methods=['POST', 'OPTIONS'])
def chat():
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        response = Response()
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'POST')
        return response
    
    if not genai_client:
        return jsonify({
            "error": "Gemini client not configured. Set GEMINI_API_KEY environment variable."
        }), 500

    data = request.get_json() or {}
    user_message = data.get('message') or data.get('prompt') or ""
    if not user_message:
        return jsonify({"error": "empty message"}), 400

    def event_stream():
        """
        Stream Gemini output as SSE `data: {...}\n\n`.
        Each yielded event is a JSON with {'text': <chunk>} or {'error':...} or {'done': true}.
        """
        try:
            # Add system prompt for Vietnamese supermarket context
            system_prompt = """Bạn là BIBI, trợ lý ảo thông minh của siêu thị. Hãy trả lời bằng tiếng Việt một cách thân thiện, hữu ích và chuyên nghiệp. 
            Bạn có thể giúp khách hàng về:
            - Thông tin sản phẩm và giá cả
            - Hướng dẫn mua sắm
            - Chính sách siêu thị
            - Giải đáp thắc mắc chung
            
            Câu hỏi của khách hàng: """
            
            full_prompt = system_prompt + user_message
            
            # Use SDK streaming API
            stream_iter = genai_client.models.generate_content_stream(
                model=GEMINI_MODEL,
                contents=full_prompt
            )

            for chunk in stream_iter:
                text = extract_text_from_chunk(chunk)
                if text:
                    # send incremental text
                    yield f"data: {json.dumps({'text': text}, ensure_ascii=False)}\n\n"
                else:
                    # sdk may send other metadata; try stringify small piece
                    try:
                        small = str(chunk)[:1000]
                        yield f"data: {json.dumps({'meta': small}, ensure_ascii=False)}\n\n"
                    except Exception:
                        pass

            # finished
            yield f"data: {json.dumps({'done': True})}\n\n"
        except Exception as e:
            # stream error -> send error then end
            err = str(e)
            print(f"[ERROR] Streaming error: {err}")
            yield f"data: {json.dumps({'error': err}, ensure_ascii=False)}\n\n"

    # Return SSE response with proper headers
    response = Response(event_stream(), mimetype='text/event-stream')
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
    response.headers.add('Cache-Control', 'no-cache')
    response.headers.add('Connection', 'keep-alive')
    return response

@app.route('/api/test-model', methods=['GET'])
def test_model():
    if not genai_client:
        return jsonify({"status": "error", "message": "GEMINI not configured (GEMINI_API_KEY)"}), 500
    try:
        resp = genai_client.models.generate_content(
            model=GEMINI_MODEL,
            contents="Xin chào! Bạn có thể trả lời bằng tiếng Việt không?"
        )
        # many SDK responses expose .text
        txt = getattr(resp, "text", None) or str(resp)
        return jsonify({"status": "ok", "backend": "gemini", "model": GEMINI_MODEL, "response": txt})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == '__main__':
    if not GEMINI_API_KEY:
        print("ERROR: GEMINI_API_KEY not set. Set this env var to use Gemini (Google GenAI).")
    else:
        if genai_client:
            print("Gemini client ready. Model:", GEMINI_MODEL)
        else:
            print("Gemini client failed to initialize. Check google-genai SDK and API key.")

    debug_mode = os.environ.get("FLASK_DEBUG", "False").lower() in ("1", "true")
    app.run(host='0.0.0.0', port=int(os.environ.get("PORT", 5000)), debug=debug_mode)