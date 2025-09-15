import json
import torch
import numpy as np
from tqdm import tqdm
from collections import defaultdict
from data.processing_data import process_state_RS, ITEM_VOCAB

# === Các tham số ===
json_path = r"D:\8. AIoT-Challenge\demo\data\based_interactions.json"
out_path = r"D:\8. AIoT-Challenge\demo\data\gaum_dataset.pt"
item_list = list(ITEM_VOCAB.keys())
item_dim = len(ITEM_VOCAB)

def one_hot(idx, dim):
    vec = np.zeros(dim)
    if 0 <= idx < dim:
        vec[idx] = 1
    return vec

def embed_item(item):
    idx = ITEM_VOCAB.get(item, -1)
    return one_hot(idx, item_dim)

def run():
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    sessions = defaultdict(list)
    for entry in data:
        sessions[entry["session_id"]].append(entry)

    dataset = {
        "states": [],
        "item_sets": [],
        "clicked_indices": [],
        "rewards": []
    }

    for sess in tqdm(sessions.values()):
        rec_hist, ad_hist = [], []
        for step in sess:
            state = step["state"]
            context = step["context"]["user_profile"]
            action = step["action"]
            feedback = step["feedback"]

            recommended_items = action["recommended_items"]
            clicked_items = feedback["clicked_items"]

            # Chỉ dùng bước có click (để huấn luyện)
            if not clicked_items or clicked_items[0] not in recommended_items:
                continue

            # Lấy index của item được click trong danh sách A_t
            click_item = clicked_items[0]
            click_index = recommended_items.index(click_item)

            # Chuẩn hóa
            s_vec = process_state_RS(state, context, rec_hist, ad_hist)
            A_vec = np.stack([embed_item(i) for i in recommended_items])  # (k, d)

            reward = float(len(clicked_items) > 0) + 0.5 * float(len(feedback["purchased_items"]) > 0)

            dataset["states"].append(s_vec)
            dataset["item_sets"].append(A_vec)
            dataset["clicked_indices"].append(click_index)
            dataset["rewards"].append(reward)

            # Cập nhật lịch sử
            rec_hist.append(recommended_items)
            if action["insert_ad"]:
                ad_hist.append(action["ad_id"])

    # Ghi ra file .pt
    for k in dataset:
        dataset[k] = torch.tensor(np.array(dataset[k]), dtype=torch.float32 if k != "clicked_indices" else torch.long)

    torch.save(dataset, out_path)
    print(f"\n Dataset saved to: {out_path}")
    print(f"Tổng số mẫu: {len(dataset['states'])}")
