import random
import uuid

class RecommendationAdsEnv:
    def __init__(self):
        # Danh sách mặt hàng và quảng cáo mẫu
        self.items = ["apple", "banana", "chips", "milk", "bread", 
                      "cereal", "chocolate", "soda", "tissues", "detergent"]
        self.ads = ["ad_sale", "ad_new", "ad_coupon"]
        # Các thuộc tính trạng thái ban đầu
        self.step_count = 0
        self.session_id = None
        self.user_profile = None
        self.cart = []
        self.location = None
        self.time_at_shelf = 0
        self.log = []
        self.current_recommendations = []

    def reset(self):
        """Khởi tạo phiên mới, tạo session_id, hồ sơ người dùng và trạng thái ban đầu."""
        self.session_id = str(uuid.uuid4())  # Mã phiên duy nhất
        self.user_profile = {
            "user_id": str(uuid.uuid4()),
            "age_group": random.choice(["18-25","26-35","36-50","51+"]),
            "preferred_items": random.sample(self.items, 3)  # 3 mặt hàng ưa thích
        }
        self.cart = []
        self.location = random.randint(1, 10)  # Vị trí bắt đầu (ví dụ: số lối đi)
        self.time_at_shelf = 0
        self.step_count = 0
        self.log = []
        self.current_recommendations = []
        return self._get_state()

    def _get_state(self):
        """
        Tạo trạng thái hiện tại bao gồm giỏ hàng, vị trí, 
        thời gian tại kệ và tín hiệu cảm biến (ánh mắt, cử chỉ).
        """
        gesture = random.choice(["none", "pointing"])
        # Giả sử nếu người dùng "pointing", họ đang chỉ vào mặt hàng đề xuất đầu tiên
        gaze_item = self.current_recommendations[0] if (self.current_recommendations and gesture=="pointing") else None
        state = {
            "cart_contents": list(self.cart), 
            "location": self.location,
            "time_at_shelf": self.time_at_shelf,
            "gaze": gaze_item,
            "gesture": gesture
        }
        return state

    def step(self, action):
        """
        Thực hiện một bước với hành động đầu vào:
        - action["recommended_items"]: danh sách mặt hàng được RS đề xuất.
        - action["insert_ad"]: True/False nếu chèn quảng cáo.
        - action["ad_id"]: ID quảng cáo (nếu insert_ad=True).
        - action["ad_position"]: vị trí hiển thị quảng cáo (ví dụ: "cart_display", "shelf_sign").
        Trả về (trạng thái mới, feedback, done, info).
        """
        recs = action.get("recommended_items", [])
        insert_ad = action.get("insert_ad", False)
        ad_id = action.get("ad_id", None)
        ad_position = action.get("ad_position", None)
        # Lưu danh sách đề xuất để mô phỏng tín hiệu cảm biến
        self.current_recommendations = recs

        # Mô phỏng phản hồi người dùng
        clicked_items = []
        purchased_items = []
        # Nếu có mặt hàng đề xuất trong sở thích, giả sử người dùng chọn và mua
        for item in recs:
            if item in self.user_profile["preferred_items"]:
                clicked_items.append(item)
                purchased_items.append(item)
                self.cart.append(item)
                break  # Giả sử chỉ mua 1 mặt hàng
        # Mô phỏng nhấp vào quảng cáo với xác suất ngẫu nhiên
        ad_clicked = False
        if insert_ad and ad_id:
            ad_clicked = random.random() < 0.3  # 30% cơ hội nhấp quảng cáo

        # Tăng thời gian dừng tại kệ
        self.time_at_shelf = random.randint(5, 15)

        feedback = {
            "clicked_items": clicked_items,
            "purchased_items": purchased_items,
            "ad_clicked": ad_clicked
        }
        # Ghi log bản ghi JSON cho bước này
        record = {
            "session_id": self.session_id,
            "context": {
                "user_profile": self.user_profile  # Hồ sơ người dùng (không thay đổi trong session)
            },
            "state": {
                "cart_contents": list(self.cart),
                "location": self.location,
                "gaze": self._get_state()["gaze"],
                "gesture": self._get_state()["gesture"],
                "time_at_shelf": self.time_at_shelf
            },
            "action": {
                "recommended_items": recs,
                "insert_ad": insert_ad,
                "ad_id": ad_id,
                "ad_position": ad_position
            },
            "feedback": feedback
        }
        self.log.append(record)

        # Cập nhật môi trường cho bước kế tiếp
        self.step_count += 1
        self.location += 1  # Di chuyển sang lối tiếp theo (giả sử tuần tự)
        done = self.step_count >= 10  # Kết thúc sau 10 bước
        return self._get_state(), feedback, done, {}

    def get_logs(self):
        return self.log

