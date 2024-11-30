// コンソールで実行

class FavoriteAnalyzer {
  // ユーザーカード要素から情報を抽出
  extractUserInfo(userCard) {
    const userId = userCard.getAttribute("data-user-id");
    const imageUrl = userCard
      .querySelector(".user-card-small_main-photo")
      .getAttribute("src");
    const age = userCard
      .querySelector(".user-card-small_profiles")
      .textContent.match(/\d+/)[0];

    return { userId, imageUrl, age };
  }

  // お気に入り登録APIを呼び出す
  async addToFavorite(userId) {
    try {
      const response = await axios.post(
        `https://with.is/users/${userId}/favorite`,
        {},
        {
          headers: {
            "X-CSRF-Token": document.querySelector('meta[name="csrf-token"]')
              .content,
            "X-Requested-With": "XMLHttpRequest",
          },
        }
      );
      return response.status === 200;
    } catch (error) {
      console.error("お気に入り登録エラー:", error);
      return false;
    }
  }

  // メイン処理
  async analyze() {
    const userCards = document.querySelectorAll(".user-card-small.is-group");
    const images = [];

    for (const card of userCards) {
      const { userId, imageUrl, age } = this.extractUserInfo(card);
      images.push({ id: userId, url: imageUrl });
    }

    const response = await fetch("http://localhost:8080/analyze-images", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ images }),
    });

    const { preferredIds } = await response.json();

    return preferredIds;
  }
}

// 使用例
const analyzer = new FavoriteAnalyzer();
analyzer.analyze().then((ids) => {
  console.log("好みのユーザーID:", ids);
});
