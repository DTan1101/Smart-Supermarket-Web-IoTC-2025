import json
import numpy as np
from collections import defaultdict

ITEM_VOCAB = {item: idx for idx, item in enumerate(
    ["apple", "banana", "chips", "milk", "bread", "cereal", "chocolate", "soda", "tissues", "detergent"])}
AD_VOCAB = {"ad_sale": 0, "ad_new": 1, "ad_coupon": 2, None: -1}
AGE_GROUP_VOCAB = {"18-25": 0, "26-35": 1, "36-50": 2, "51+": 3}
GESTURE_VOCAB = {"none": 0, "pointing": 1}
AD_POS_VOCAB = {"cart_display": 0, "shelf_sign": 1, None: -1}
LOCATION_VOCAB = {
    "entrance": 0, "aisle_1": 1, "aisle_2": 2,
    "aisle_3": 3, "fridge": 4, "checkout": 5
}

def one_hot(index, size):
    vec = np.zeros(size)
    if 0 <= index < size:
        vec[index] = 1
    return vec

def embed_cart(cart):
    indices = [ITEM_VOCAB[i] for i in cart if i in ITEM_VOCAB]
    return np.mean([one_hot(i, len(ITEM_VOCAB)) for i in indices], axis=0) if indices else np.zeros(len(ITEM_VOCAB))

def embed_seq(history):
    flat = [ITEM_VOCAB[i] for sub in history for i in sub if i in ITEM_VOCAB]
    return np.mean([one_hot(i, len(ITEM_VOCAB)) for i in flat], axis=0) if flat else np.zeros(len(ITEM_VOCAB))

def process_state_RS(state, context, rec_history, ad_history):
    p_rec = embed_seq(rec_history)
    p_ad = embed_seq([[ad] for ad in ad_history if ad])
    age = one_hot(AGE_GROUP_VOCAB.get(context["age_group"], -1), len(AGE_GROUP_VOCAB))
    loc_idx = LOCATION_VOCAB.get(state.get("location", ""), -1)
    location = one_hot(loc_idx, len(LOCATION_VOCAB))

    gesture = one_hot(GESTURE_VOCAB.get(state.get("gesture", ""), -1), len(GESTURE_VOCAB))
    time_at_shelf = np.clip(state.get("time_at_shelf", 0.0) / 20.0, 0.0, 1.0)
    cart_emb = embed_cart(state["cart_contents"])

    return np.concatenate([p_rec, p_ad, age, location, [time_at_shelf], gesture, cart_emb])

def process_state_AS(rs_vec, rec_items):
    rec_vec = embed_cart(rec_items)
    return np.concatenate([rs_vec, rec_vec])

def process_action_AS(action):
    ad = one_hot(AD_VOCAB.get(action["ad_id"], -1), len(AD_VOCAB))
    pos = one_hot(AD_POS_VOCAB.get(action["ad_position"], -1), len(AD_POS_VOCAB))
    insert = [1.0 if action["insert_ad"] else 0.0]
    return np.concatenate([ad, pos, insert])

def convert_json_to_npz(json_path, out_path=r"D:/8. AIoT-Challenge/demo/data/ram_features.npz"):
    with open(json_path, "r", encoding="utf-8") as f:
        records = json.load(f)
    sessions = defaultdict(list)
    for r in records:
        sessions[r["session_id"]].append(r)

    rs_states, rs_rewards, as_states, as_actions, as_rewards = [], [], [], [], []
    for sess in sessions.values():
        rec_hist, ad_hist = [], []
        for i, r in enumerate(sess):
            state, ctx, act, fb = r["state"], r["context"]["user_profile"], r["action"], r["feedback"]
            rs_vec = process_state_RS(state, ctx, rec_hist, ad_hist)
            as_vec = process_state_AS(rs_vec, act["recommended_items"])
            act_vec = process_action_AS(act)
            rs_states.append(rs_vec)
            rs_rewards.append(float(len(fb["clicked_items"]) > 0) + 0.5 * float(len(fb["purchased_items"]) > 0))
            as_states.append(as_vec)
            as_actions.append(act_vec)
            as_rewards.append(1.0 if fb["ad_clicked"] else 0.0)
            rec_hist.append(act["recommended_items"])
            if act["insert_ad"] and act["ad_id"]: ad_hist.append(act["ad_id"])

    np.savez_compressed(out_path,
        rs_states=np.array(rs_states),
        rs_rewards=np.array(rs_rewards),
        as_states=np.array(as_states),
        as_actions=np.array(as_actions),
        as_rewards=np.array(as_rewards))
    print(f"Saved processed data to {out_path}")

def create_user_profiles_from_json(json_path):
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    user_profiles = {}
    for entry in data:
        user_profile = entry["context"]["user_profile"]
        uid = user_profile["user_id"]
        user_profiles[uid] = {
            "age_group": user_profile.get("age_group"),
            "preferred_items": user_profile.get("preferred_items", [])
        }
    return user_profiles

def create_item_catalog_from_json(json_path):
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    items = set()
    for entry in data:
        items.update(entry["action"].get("recommended_items", []))
        items.update(entry["state"].get("cart_contents", []))
        items.update(entry["context"]["user_profile"].get("preferred_items", []))
    return sorted(list(items))