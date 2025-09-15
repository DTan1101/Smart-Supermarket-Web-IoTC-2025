import torch
import torch.nn as nn
import torch.nn.functional as F
import torch.optim as optim
from torch.utils.data import TensorDataset, DataLoader

class RewardNet(nn.Module):
    def __init__(self, state_dim, item_dim, hidden_dim=128):
        super().__init__()
        self.state_fc = nn.Linear(state_dim, hidden_dim)
        self.lstm = nn.LSTM(item_dim, hidden_dim, batch_first=True)
        self.out = nn.Linear(hidden_dim, 1)

    def forward(self, state, item):
        # Biến embedding trạng thái sang ẩn ban đầu
        h0 = torch.tanh(self.state_fc(state)).unsqueeze(0)  # (1,B,hidden_dim)
        c0 = torch.zeros_like(h0)
        item_vec = item.unsqueeze(1)  # (B,1,item_dim) giả sử một sản phẩm
        out, (hn, cn) = self.lstm(item_vec, (h0, c0))
        return self.out(out[:, -1, :]).squeeze(-1)  # Q-value
    
class UserPolicyNet(nn.Module):
    def __init__(self, state_dim, item_dim, hidden_dim=128):
        super().__init__()
        self.state_fc = nn.Linear(state_dim, hidden_dim)
        self.lstm = nn.LSTM(item_dim, hidden_dim, batch_first=True)
        self.out = nn.Linear(hidden_dim, 1)
        
    def forward(self, state, item_set):
        B, k, d = item_set.size()
        # Khởi tạo trạng thái ẩn với state embedding
        h0 = torch.tanh(self.state_fc(state)).unsqueeze(0)  # (1,B,hidden_dim)
        c0 = torch.zeros_like(h0)
        # Chạy LSTM qua từng item
        out, (hn, cn) = self.lstm(item_set, (h0, c0))
        logits = self.out(out).squeeze(-1)  # (B, k) logits cho mỗi item
        return F.softmax(logits, dim=-1)

# === Huấn luyện GAUM ===
class GAUMTrainer:
    def __init__(self, dataset_path, save_dir, batch_size=64, num_epochs=10, learning_rate=1e-3, hidden_dim=128):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.dataset_path = dataset_path
        self.save_dir = save_dir
        self.batch_size = batch_size
        self.num_epochs = num_epochs
        self.learning_rate = learning_rate
        self.hidden_dim = hidden_dim
        self._prepare_data()

    def _prepare_data(self):
        dataset = torch.load(self.dataset_path)
        self.states = dataset["states"]
        self.item_sets = dataset["item_sets"]
        self.clicked_indices = dataset["clicked_indices"]
        self.rewards = dataset["rewards"]

        self.state_dim = self.states.shape[1] 
        self.item_dim = self.item_sets.shape[2]
        self.k = self.item_sets.shape[1]

        data = TensorDataset(self.states, self.item_sets, self.clicked_indices, self.rewards)
        self.loader = DataLoader(data, batch_size=self.batch_size, shuffle=True)

        self.reward_net = RewardNet(self.state_dim, self.item_dim, self.hidden_dim).to(self.device)
        self.policy_net = UserPolicyNet(self.state_dim, self.item_dim, self.hidden_dim).to(self.device)

        self.optimizer = optim.Adam(
            list(self.reward_net.parameters()) + list(self.policy_net.parameters()),
            lr=self.learning_rate
        )

    def train(self):
        for epoch in range(self.num_epochs):
            total_loss = 0
            for s, A, a_idx, r in self.loader:
                s, A, a_idx, r = s.to(self.device), A.to(self.device), a_idx.to(self.device), r.to(self.device)

                B, k, _ = A.shape
                s_expanded = s.unsqueeze(1).expand(-1, k, -1)   # (B, k, state_dim)
                s_flat = s_expanded.reshape(-1, self.state_dim)  # (B*k, s)
                A_flat = A.reshape(-1, self.item_dim)            # (B*k, d)

                all_rewards = self.reward_net(s_flat, A_flat).reshape(B, k)
                r_true = all_rewards.gather(1, a_idx.unsqueeze(1)).squeeze(1)
                probs = self.policy_net(s, A)
                log_prob = torch.log(probs.gather(1, a_idx.unsqueeze(1)).clamp(min=1e-8)).squeeze(1)
                expected_r = torch.sum(probs * all_rewards, dim=1)

                loss = - (log_prob + r_true).mean()

                self.optimizer.zero_grad()
                loss.backward()
                self.optimizer.step()

                total_loss += loss.item()

            print(f"[Epoch {epoch+1}/{self.num_epochs}] Loss: {total_loss:.4f}")

    def save_models(self):
        torch.save({
            "state_dim": self.state_dim,
            "item_dim": self.item_dim,
            "state_dict": self.reward_net.state_dict()
        }, f"{self.save_dir}/reward_model.pth")

        torch.save({
            "state_dim": self.state_dim,
            "item_dim": self.item_dim,
            "state_dict": self.policy_net.state_dict()
        }, f"{self.save_dir}/user_policy.pth")

        print(" Mô hình đã được lưu với metadata.")
