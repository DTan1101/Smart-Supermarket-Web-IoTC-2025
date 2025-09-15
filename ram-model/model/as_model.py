import torch.nn as nn

# === Dueling DQN model for AS === #
class DuelingDQN(nn.Module):
    def __init__(self, input_size, hidden_size=128):
        super(DuelingDQN, self).__init__()
        self.gru = nn.GRU(input_size=input_size, hidden_size=hidden_size, batch_first=True, num_layers=2, dropout=0.2)
        self.norm = nn.LayerNorm(hidden_size)

        self.adv = nn.Sequential(
            nn.Linear(hidden_size, 128),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(128, 1)
        )
        self.val = nn.Sequential(
            nn.Linear(hidden_size, 128),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(128, 1)
        )

    def forward(self, x):
        x = x.unsqueeze(1)
        out, _ = self.gru(x)
        h = self.norm(out[:, -1, :])
        adv = self.adv(h)
        val = self.val(h)
        return val + (adv - adv.mean(dim=-1, keepdim=True)).squeeze(-1)
    
    