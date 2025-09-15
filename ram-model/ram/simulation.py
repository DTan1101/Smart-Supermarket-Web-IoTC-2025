import json
import torch
import sys
from typing import List, Dict

# Thêm đường dẫn chứa module của dự án để có thể import đúng
sys.path.append(r"D:\8. AIoT-Challenge\demo")

from data import processing_data as proc
from ram import ram_model as ram

def simulate_session(
    model_rs: torch.nn.Module,
    model_as: torch.nn.Module,
    env,
    session_id: str = "sim_session_001",
    save_path: str = r"D:\8. AIoT-Challenge\demo\data\simulated_session.json",
    mode: str = "raml"
) -> List[Dict]:
    """
    Mô phỏng một phiên với RSModel (model_rs) và ASModel (model_as) trong môi trường env.
    Trả về danh sách record log của phiên và ghi ra save_path.
    """
    print(f"\nSimulating session: {session_id} with mode: {mode}")
    device_rs = next(model_rs.parameters()).device
    device_as = next(model_as.parameters()).device

    # Khởi tạo phiên bằng reset() → nhận state ban đầu
    state = env.reset()
    rec_hist, ad_hist = [], []
    done = False

    while not done:
        # 1. Tính vector trạng thái cho RS
        context = env.user_profile
        state_vec_rs = proc.process_state_RS(state, context, rec_hist, ad_hist)
        state_tensor_rs = torch.tensor(state_vec_rs, dtype=torch.float32).unsqueeze(0).to(device_rs)

        # 2. Forward qua RSModel (tùy chọn, chỉ để “warm up” hoặc kiểm tra)
        with torch.no_grad():
            _ = model_rs(state_tensor_rs).item()

        # 3. Lấy top-3 item đề xuất từ RSModel
        recommended_items = ram.get_recommendations(model_rs, env, state_vec_rs, top_k=3)
        rec_hist.append(recommended_items)

        # 4. Tính vector trạng thái AS dựa trên state_RS và recommended_items
        state_vec_as = proc.process_state_AS(state_vec_rs, recommended_items)

        # 5. Gọi hàm decide_ad_insertion và unpack tuple trả về (action_as, action_vec)
        action_as, action_vec = ram.decide_ad_insertion(
            model_as,
            state_vec_as,
            recommended_items,
            env,
            mode=mode
        )

        # 6. Nếu chèn ad, lưu ID quảng cáo vào lịch sử
        if action_as["insert_ad"]:
            ad_hist.append(action_as["ad_id"])

        # 7. Xây dựng action dict để pass vào env.step()
        action = {
            "recommended_items": recommended_items,
            "insert_ad": action_as["insert_ad"],
            "ad_id": action_as["ad_id"],
            "ad_position": action_as["ad_position"]
        }

        # 8. Bước môi trường và nhận feedback
        state, feedback, done, _ = env.step(action)

    # 9. Kết thúc phiên, lấy log và ghi ra JSON
    log = env.get_logs()
    with open(save_path, "w", encoding="utf-8") as f:
        json.dump(log, f, ensure_ascii=False, indent=2)

    print(f"\nSession simulation complete. Log saved to: {save_path}")
    print("Sample log entry:")
    print(json.dumps(log[0], indent=2))
    return log

def evaluate_policy(
    model_rs: torch.nn.Module,
    model_as: torch.nn.Module,
    env,
    num_sessions: int = 1000
) -> Dict[str, float]:
    """
    Đánh giá hiệu quả của cặp RSModel (model_rs) và ASModel (model_as)
    thông qua num_sessions phiên được mô phỏng.
    Trả về các chỉ số tổng hợp: CTR, Purchase Rate, Ad Revenue, và Avg Reward.
    """
    total_clicks = 0
    total_impressions = 0
    total_purchases = 0
    total_reward = 0.0
    total_ad_revenue = 0.0

    for i in range(num_sessions):
        # Simulate one session, lưu log vào file riêng nếu cần
        log = simulate_session(
            model_rs,
            model_as,
            env,
            session_id=f"eval_{i}",
            save_path=f"D:\\8. AIoT-Challenge\\demo\\data\\simulated_session_{i}.json"
        )

        # Tính toán các chỉ số từ log của phiên đó
        for record in log:
            # Nếu có chèn ad, đó là một impression
            if record["action"]["insert_ad"]:
                total_impressions += 1
                # Nếu ad được click, tăng total_clicks và tính doanh thu từ ad
                if record["feedback"].get("ad_clicked", False):
                    total_clicks += 1
                    total_ad_revenue += ram.estimate_ad_revenue(
                        record["action"]["ad_id"],
                        record["action"]["ad_position"]
                    )

            # Tổng số món được mua trong phiên
            total_purchases += len(record["feedback"].get("purchased_items", []))
            # Tổng reward cộng dồn (nếu trường "reward" có trong record)
            total_reward += record.get("reward", 0.0)

    CTR = total_clicks / total_impressions if total_impressions > 0 else 0.0
    purchase_rate = total_purchases / num_sessions
    avg_reward = total_reward / num_sessions

    return {
        "CTR": CTR,
        "PurchaseRate": purchase_rate,
        "AdRevenue": total_ad_revenue,
        "AvgReward": avg_reward
    }
