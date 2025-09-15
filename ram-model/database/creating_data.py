import json
import random

class BasedDataCreator:
    def __init__(self, env, num_sessions=1000):
        self.env = env
        self.num_sessions = num_sessions

    def generate(self, save_path):
        env = self.env
        all_records = []
        num_sessions = self.num_sessions
        for s in range(num_sessions):
            _ = env.reset()
            done = False
            while not done:
                action = {
                    "recommended_items": random.sample(env.items, 3),
                    "insert_ad": random.choice([True, False]),
                    "ad_id": random.choice(env.ads),
                    "ad_position": random.choice(["cart_display", "shelf_sign"])
                }
                _, _, done, _ = env.step(action)
            all_records.extend(env.get_logs())
            print(f"Session {s+1}/{num_sessions} completed. Total records: {len(all_records)}", end="\r")

        with open(save_path, "w", encoding="utf-8") as f:
            json.dump(all_records, f, ensure_ascii=False, indent=2)

class GAUMDataCreator:
    def __init__(self, env, num_sessions=1000):
        self.env = env
        self.num_sessions = num_sessions

    def generate(self, save_path):
        env = self.env
        all_records = []
        for s in range(self.num_sessions):
            _ = env.reset()
            done = False
            while not done:
                action = {
                    "recommended_items": random.sample(self.env.item_catalog, 3),
                    "insert_ad": random.choice([True, False]),
                    "ad_id": random.choice(self.env.ads),
                    "ad_position": random.choice(["cart_display", "shelf_sign"])
                }
                _, _, done, _ = self.env.step(action)
            all_records.extend(self.env.get_logs())
            print(f"[GAUM] Session {s+1}/{self.num_sessions} completed. Records: {len(all_records)}", end="\r")

        with open(save_path, "w", encoding="utf-8") as f:
            json.dump(all_records, f, ensure_ascii=False, indent=2)


