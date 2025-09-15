import torch
import numpy as np
from model.gaum_models import RewardNet, UserPolicyNet
from data.processing_data import process_state_RS, ITEM_VOCAB

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# Load mô hình
REWARD_MODEL_PATH = r"D:/8. AIoT-Challenge/demo/model/model_trained/reward_model.pth"
USER_POLICY_PATH = r"D:/8. AIoT-Challenge/demo/model/model_trained/user_policy.pth"

reward_ckpt = torch.load(REWARD_MODEL_PATH, map_location=device)
policy_ckpt = torch.load(USER_POLICY_PATH, map_location=device)

STATE_DIM = reward_ckpt["state_dim"]
ITEM_DIM = reward_ckpt["item_dim"]

reward_net = RewardNet(STATE_DIM, ITEM_DIM).to(device)
policy_net = UserPolicyNet(STATE_DIM, ITEM_DIM).to(device)
reward_net.load_state_dict(reward_ckpt["state_dict"])
policy_net.load_state_dict(policy_ckpt["state_dict"])
reward_net.eval()
policy_net.eval()

def one_hot(idx, dim):
    vec = np.zeros(dim)
    if 0 <= idx < dim:
        vec[idx] = 1
    return vec

def embed_item(item_id):
    idx = ITEM_VOCAB.get(item_id, -1)
    return torch.tensor(one_hot(idx, ITEM_DIM), dtype=torch.float32)

class SmartCartEnvironment:
    def __init__(self, user_profiles, item_catalog):
        self.user_profiles = user_profiles
        self.item_catalog = item_catalog
        self.ads = list(set(item_catalog))  # giả sử ads là item đặc biệt
        self.max_steps = 10
        self.reset()

    def reset(self):
        self.session_id = int(np.random.randint(1e6))
        self.user_id = np.random.choice(list(self.user_profiles.keys()))
        self.user_profile = self.user_profiles[self.user_id]

        self.state = {
            "cart_contents": [],
            "location": "entrance"
        }
        self.step_count = 0
        self.recommended_history = []
        self.ad_history = []
        self.logs = []

        return self._get_state()

    def _get_state(self):
        return {
            "cart_contents": list(self.state["cart_contents"]),
            "location": self.state["location"],
            "step": self.step_count
        }

    def step(self, action):
        recommended_items = action.get("recommended_items", [])
        insert_ad = action.get("insert_ad", False)
        ad_id = action.get("ad_id", None)
        ad_position = action.get("ad_position", None)

        feedback = {
            "clicked_items": [],
            "purchased_items": [],
            "ad_clicked": False
        }

        # Tạo vector trạng thái
        state_vec = process_state_RS(
            self.state, self.user_profile,
            self.recommended_history, self.ad_history
        )
        state_tensor = torch.tensor(state_vec, dtype=torch.float32).unsqueeze(0).to(device)

        # Tạo tensor danh sách item
        item_vecs = [embed_item(item_id) for item_id in recommended_items]
        item_tensor = torch.stack(item_vecs).unsqueeze(0).to(device)

        with torch.no_grad():
            probs = policy_net(state_tensor, item_tensor)
            dist = torch.distributions.Categorical(probs.squeeze(0))
            sampled_index = dist.sample().item()

        clicked_item = recommended_items[sampled_index]
        feedback["clicked_items"].append(clicked_item)

        with torch.no_grad():
            clicked_item_vec = item_tensor[:, sampled_index, :]  # (1, ITEM_DIM)
            reward = reward_net(state_tensor, clicked_item_vec).item()

        if reward > 0.5:
            self.state["cart_contents"].append(clicked_item)
            feedback["purchased_items"].append(clicked_item)

        # Mô phỏng ad click đơn giản
        if insert_ad and ad_id:
            self.ad_history.append(ad_id)
            feedback["ad_clicked"] = np.random.rand() < 0.3

        # Ghi log
        record = {
            "session_id": self.session_id,
            "context": {
                "user_id": self.user_id,
                "user_profile": self.user_profile
            },
            "state": self._get_state(),
            "action": {
                "recommended_items": recommended_items,
                "insert_ad": insert_ad,
                "ad_id": ad_id,
                "ad_position": ad_position
            },
            "feedback": feedback,
            "reward": reward
        }
        self.logs.append(record)

        self.recommended_history.append(recommended_items)
        self.step_count += 1
        done = self.step_count >= self.max_steps
        return self._get_state(), feedback, done, {}

    def get_logs(self):
        return self.logs.copy()
    
    