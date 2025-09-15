import numpy as np
import random
import torch
import torch.nn as nn
import torch.optim as optim
from collections import deque
from data import processing_data as proc


class ReplayBuffer:
    def __init__(self, capacity=10000):
        self.buffer = deque(maxlen=capacity)

    def push(self, state, reward, next_state, done):
        self.buffer.append((state, reward, next_state, done))

    def sample(self, batch_size):
        batch = random.sample(self.buffer, batch_size)
        states, rewards, next_states, dones = zip(*batch)
        return (
            np.stack(states),
            np.array(rewards, dtype=np.float32),
            np.stack(next_states),
            np.array(dones, dtype=np.float32),
        )

    def __len__(self):
        return len(self.buffer)

def fill_replay_buffer_rs(data, buffer_rs):
    X_rs = data.get("rs_states", [])
    y_rs = data.get("rs_rewards", [])
    for x, y in zip(X_rs, y_rs):
        buffer_rs.push(x, float(y), x, True)


def estimate_ad_revenue(ad_id, ad_position):
    base = {"ad_sale": 1.0, "ad_new": 0.8, "ad_coupon": 0.5}
    pos_bonus = {"cart_display": 1.0, "shelf_sign": 0.6}
    return base.get(ad_id, 0.0) * pos_bonus.get(ad_position, 1.0)


def decide_ad_insertion(model_as, raw_as_state, recommended_items, env, mode="raml", alpha=0.5, top_n=3, threshold=0.1):
    device = next(model_as.parameters()).device
    candidates = []

    for ad_id in env.ads:
        for ad_pos in ["cart_display", "shelf_sign"]:
            action_vec = proc.process_action_AS({
                "insert_ad": True,
                "ad_id": ad_id,
                "ad_position": ad_pos,
                "recommended_items": recommended_items
            })
            full_vec = np.concatenate([raw_as_state, action_vec], axis=0)
            full_tensor = torch.tensor(full_vec, dtype=torch.float32).unsqueeze(0).to(device)

            with torch.no_grad():
                q_val = model_as(full_tensor).item()

            revenue = estimate_ad_revenue(ad_id, ad_pos)
            score_raml = q_val + alpha * revenue
            candidates.append((ad_id, ad_pos, q_val, revenue, score_raml))

    if not candidates:
        return ({"insert_ad": False, "ad_id": None, "ad_position": None},
                np.zeros(8, dtype=np.float32))

    if mode == "raml":
        best = max(candidates, key=lambda x: x[4])
    elif mode == "ramn":
        top_q = sorted(candidates, key=lambda x: x[2], reverse=True)[:top_n]
        best = max(top_q, key=lambda x: x[3])
    else:
        raise ValueError("mode must be 'raml' or 'ramn'")

    ad_id, ad_pos, qv, rev, _ = best
    if (qv + alpha * rev) >= threshold:
        action = {"insert_ad": True, "ad_id": ad_id, "ad_position": ad_pos}
        return (action,
                proc.process_action_AS({
                    "insert_ad": True,
                    "ad_id": ad_id,
                    "ad_position": ad_pos,
                    "recommended_items": recommended_items
                }))
    else:
        return ({"insert_ad": False, "ad_id": None, "ad_position": None},
                np.zeros(8, dtype=np.float32))

def get_recommendations(model_rs, env, state_vec_rs, top_k=3):
    device = next(model_rs.parameters()).device
    items = getattr(env, "item_catalog", getattr(env, "items", [])).copy()
    recommended = []

    for _ in range(top_k):
        best_item, best_score = None, -float("inf")
        for item in items:
            tensor = torch.tensor(state_vec_rs, dtype=torch.float32).unsqueeze(0).to(device)
            with torch.no_grad():
                qv = model_rs(tensor).item()
            if qv > best_score:
                best_score, best_item = qv, item
        if best_item is None:
            break
        recommended.append(best_item)
        items.remove(best_item)

    return recommended

def train_dqn_offpolicy(model, target_model, buffer, optimizer, batch_size=64, gamma=0.99, tau=0.005):
    device = next(model.parameters()).device
    if len(buffer) < batch_size:
        return
    states, rewards, next_states, dones = buffer.sample(batch_size)
    states = torch.tensor(states, dtype=torch.float32).to(device)
    next_states = torch.tensor(next_states, dtype=torch.float32).to(device)
    rewards = torch.tensor(rewards, dtype=torch.float32).to(device)
    dones = torch.tensor(dones, dtype=torch.float32).to(device)

    q_vals = model(states)
    with torch.no_grad():
        q_next = target_model(next_states)
        target_q = rewards + gamma * q_next * (1 - dones)

    loss = nn.SmoothL1Loss()(q_vals, target_q)
    optimizer.zero_grad()
    loss.backward()
    optimizer.step()

    for tp, p in zip(target_model.parameters(), model.parameters()):
        tp.data.copy_(tau * p.data + (1 - tau) * tp.data)

def ram_trainer(data, env, RSModel, ASModel, num_episodes=100, epsilon_start=1.0, epsilon_end=0.05, epsilon_decay=0.995,
                train_freq=1, batch_size=64, gamma=0.99, tau=0.005):
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    context = env.user_profile

    # Initialize RS
    q_rs = RSModel().to(device)
    target_rs = RSModel().to(device)
    target_rs.load_state_dict(q_rs.state_dict())
    optimizer_rs = optim.Adam(q_rs.parameters(), lr=1e-3)
    buffer_rs = ReplayBuffer()
    fill_replay_buffer_rs(data, buffer_rs)

    # Initialize AS (input_size=61)
    q_as = ASModel().to(device)
    target_as = ASModel().to(device)
    target_as.load_state_dict(q_as.state_dict())
    optimizer_as = optim.Adam(q_as.parameters(), lr=1e-3)
    buffer_as = ReplayBuffer()

    epsilon_rs = epsilon_start
    epsilon_as = epsilon_start

    for episode in range(num_episodes):
        state = env.reset()
        rec_hist, ad_hist = [], []
        done = False
        step = 0

        while not done:
            step += 1

            # RS step
            state_vec_rs = proc.process_state_RS(state, context, rec_hist, ad_hist)
            rec_items = get_recommendations(q_rs, env, state_vec_rs)
            action_rs = {"recommended_items": rec_items, "insert_ad": False}
            next_state, feedback_rs, done_rs, _ = env.step(action_rs)
            reward_rs = float(len(feedback_rs.get("purchased_items", [])))
            next_vec_rs = proc.process_state_RS(next_state, context, rec_hist, ad_hist)
            buffer_rs.push(state_vec_rs, reward_rs, next_vec_rs, done_rs)

            # AS step
            raw_as = proc.process_state_AS(state_vec_rs, rec_items)
            action_as, action_vec = decide_ad_insertion(q_as, raw_as, rec_items, env)
            action_as["recommended_items"] = rec_items
            next_state_as, feedback_as, done_as, _ = env.step(action_as)
            reward_as = float(feedback_as.get("ad_clicked", False))
            next_vec_rs2 = proc.process_state_RS(next_state_as, context, rec_hist, ad_hist)
            next_raw_as = proc.process_state_AS(next_vec_rs2, rec_items)
            state_vec_as = np.concatenate([raw_as, action_vec], axis=0)
            next_state_vec_as = np.concatenate([next_raw_as, action_vec], axis=0)
            buffer_as.push(state_vec_as, reward_as, next_state_vec_as, done_as)

            # Off-policy updates
            if step % train_freq == 0:
                train_dqn_offpolicy(q_rs, target_rs, buffer_rs, optimizer_rs, batch_size, gamma, tau)
                train_dqn_offpolicy(q_as, target_as, buffer_as, optimizer_as, batch_size, gamma, tau)

            # Update state and histories
            state = next_state_as
            rec_hist.append(rec_items)
            if feedback_as.get("ad_clicked", False):
                ad_hist.append(action_as.get("ad_id"))

            done = done_rs or done_as

        # Epsilon decay
        epsilon_rs = max(epsilon_end, epsilon_rs * epsilon_decay)
        epsilon_as = max(epsilon_end, epsilon_as * epsilon_decay)
        print(f"[Episode {episode+1}] RS ε:{epsilon_rs:.3f}, AS ε:{epsilon_as:.3f}")

    return q_rs, q_as, target_rs, target_as
