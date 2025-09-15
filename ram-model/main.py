import numpy as np
import torch
import torch.optim as optim
import sys

sys.path.append(r"D:\8. AIoT-Challenge\demo")

from data import processing_data as proc
from data import creating_data as crd
from data import generate_gaum_dataset as ggd
from model import gaum_models as gaum
from model import rs_model, as_model
from ram import simulation as sim
from ram import ram_model as ram

from env import environment_based as envb

env_based = envb.RecommendationAdsEnv()
data_envb = crd.BasedDataCreator(env_based)

data_envb.generate(r"D:\8. AIoT-Challenge\demo\data\based_interactions.json")
proc.convert_json_to_npz(r"D:\8. AIoT-Challenge\demo\data\based_interactions.json")

ggd.run()

from model.gaum_models import GAUMTrainer

trainer = GAUMTrainer(
    dataset_path=r"D:\8. AIoT-Challenge\demo\data\gaum_dataset.pt",
    save_dir=r"D:\8. AIoT-Challenge\demo\model\model_trained",
    batch_size=64,
    num_epochs=10,
    learning_rate=1e-3
)
trainer.train()
trainer.save_models()

from env import environment_gaum as envg

user_profiles = proc.create_user_profiles_from_json(r"D:\8. AIoT-Challenge\demo\data\based_interactions.json")
print(user_profiles)
item_catalog = proc.create_item_catalog_from_json(r"D:\8. AIoT-Challenge\demo\data\based_interactions.json")
print(item_catalog)

# Create the environment and data creator for GAUM
env_gaum = envg.SmartCartEnvironment(user_profiles, item_catalog)
data_envg = crd.GAUMDataCreator(env_gaum)

data_envg.generate(r"D:\8. AIoT-Challenge\demo\data\gaum_interactions.json")

proc.convert_json_to_npz(r"D:\8. AIoT-Challenge\demo\data\gaum_interactions.json", 
                         r"D:\8. AIoT-Challenge\demo\data\ram_gaum_interactions.npz")

data = np.load(r"D:\8. AIoT-Challenge\demo\data\ram_gaum_interactions.npz", allow_pickle=True)
X_rs = data["rs_states"]
y_rs = data["rs_rewards"]
X_as = np.concatenate([data["as_states"], data["as_actions"]], axis=1)
y_as = data["as_rewards"]

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

rsmodel = rs_model.CascadingDQN(input_size=X_rs.shape[1]).to(device)
rs_target = rs_model.CascadingDQN(input_size=X_rs.shape[1]).to(device)
rs_target.load_state_dict(rsmodel.state_dict())

asmodel = as_model.DuelingDQN(input_size=X_as.shape[1]).to(device)
as_target = as_model.DuelingDQN(input_size=X_as.shape[1]).to(device)
as_target.load_state_dict(asmodel.state_dict())

ram.ram_trainer(
    data,
    env_gaum,
    lambda: rs_model.CascadingDQN(input_size=X_rs.shape[1]),
    lambda: as_model.DuelingDQN(input_size=X_as.shape[1]),
)

torch.save(rsmodel.state_dict(), r"D:\8. AIoT-Challenge\demo\model\model_trained\rs_model.pth")
torch.save(asmodel.state_dict(), r"D:\8. AIoT-Challenge\demo\model\model_trained\as_model.pth")

state = env_gaum.reset()
context = env_gaum.user_profile  
device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
print(f"Using device: {device}")

rsmodel = rsmodel.to(device)
asmodel = asmodel.to(device)

rec_hist = []
ad_hist = []

state_vec_rs = proc.process_state_RS(state, context, rec_hist, ad_hist)
recommended_items = ram.get_recommendations(rsmodel, env_gaum, state_vec_rs, top_k=3)
print("Recommendation:", recommended_items)

state_vec_as = proc.process_state_AS(state_vec_rs, recommended_items)
ad_decision = ram.decide_ad_insertion(asmodel, state_vec_as, recommended_items, env_gaum)
print("Advertising decision:", ad_decision[0])

