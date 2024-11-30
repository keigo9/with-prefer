async function initializeAnalyzer() {
  const analyzer = new FavoriteAnalyzer();
  await analyzer.initModel();
  const ids = await analyzer.analyze();
  console.log("好みのユーザーID:", ids);
}

class FavoriteAnalyzer {
  constructor() {
    if (!window.tf || !window.axios) {
      throw new Error("TensorFlow.jsとaxiosが読み込まれていません");
    }
    this.model = null;
    this.favoriteIds = [];
  }

  // モデルの初期化
  initModel() {
    return tf.loadLayersModel("http://localhost:8080/model/model.json");
  }

  // ユーザーカード要素から情報を抽出
  extractUserInfo(userCard) {
    return new Promise((resolve) => {
      const userId = userCard.getAttribute("data-user-id");
      const imgElement = userCard.querySelector(".user-card-small_main-photo");
      const age = userCard
        .querySelector(".user-card-small_profiles")
        .textContent.match(/\d+/)[0];

      imgElement.crossOrigin = "anonymous";
      const originalSrc = imgElement.src;
      imgElement.src = "";
      imgElement.src = originalSrc;

      imgElement.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = imgElement.width;
        canvas.height = imgElement.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(imgElement, 0, 0);
        resolve({ userId, canvas, age });
      };
    });
  }

  // 画像を分析して好みかどうかを判定
  analyzeImage(canvas) {
    const tensor = tf.browser
      .fromPixels(canvas)
      .resizeNearestNeighbor([224, 224])
      .toFloat()
      .expandDims();

    return this.model
      .predict(tensor)
      .data()
      .then((prediction) => {
        return prediction[0] > 0.7;
      });
  }

  // メイン処理
  async analyze() {
    const userCards = document.querySelectorAll(".user-card-small.is-group");
    const promises = Array.from(userCards).map(async (card) => {
      const userInfo = await this.extractUserInfo(card);
      const isPreferred = await this.analyzeImage(userInfo.canvas);

      if (isPreferred) {
        this.favoriteIds.push(userInfo.userId);
        // API呼び出しを行う場合
        // await this.addToFavorite(userInfo.userId);
      }
    });

    return Promise.all(promises).then(() => {
      return this.favoriteIds;
    });
  }
}

// DOMContentLoadedイベントで初期化
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const analyzer = new FavoriteAnalyzer();
    await analyzer.initModel();
    const ids = await analyzer.analyze();
    console.log("好みのユーザーID:", ids);
  } catch (error) {
    console.error("初期化エラー:", error);
  }
});
