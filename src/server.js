import * as tf from "@tensorflow/tfjs-node";
import express from "express";
import cors from "cors";
import axios from "axios";

class ImageAnalyzer {
  constructor() {
    this.model = null;
  }

  // モデルの初期化
  async initModel() {
    this.model = await tf.loadLayersModel("file://./model/model.json");
  }

  // 画像をテンソルに変換
  async preprocessImage(imageUrl) {
    // URLの処理
    if (imageUrl.startsWith("//")) {
      imageUrl = "https:" + imageUrl;
    } else if (imageUrl.startsWith("/")) {
      imageUrl = "https://with.is" + imageUrl;
    }

    // 画像をダウンロード
    const response = await axios.get(imageUrl, {
      responseType: "arraybuffer",
    });

    // 画像をテンソルに変換
    let tensor = tf.node.decodeImage(new Uint8Array(response.data), 3);

    // console.log("Initial tensor shape:", tensor.shape);

    // 最初のフレームだけを取り出す
    if (tensor.shape.length > 3) {
      tensor = tensor
        .slice([0], [1])
        .reshape([tensor.shape[1], tensor.shape[2], 3]);
    }

    // 必要な形状に変換
    tensor = tensor
      .resizeNearestNeighbor([224, 224])
      .toFloat()
      .div(255.0)
      .expandDims(0);

    // console.log("Final tensor shape:", tensor.shape);

    // 形状が正しくない場合は例外をスロー
    if (tensor.shape.length !== 4) {
      throw new Error(`Invalid tensor shape: ${tensor.shape}`);
    }

    return tensor;
  }

  // 画像を分析して好みかどうかを判定
  async analyzeImage(imageUrl) {
    try {
      const tensor = await this.preprocessImage(imageUrl);
      const prediction = await this.model.predict(tensor).data();
      tensor.dispose();

      // 予測値をログ出力
      console.log(`予測値: ${prediction[0]} for ${imageUrl}`);

      return prediction[0] > 0.7;
    } catch (error) {
      console.error("予測エラー:", error);
      throw error;
    }
  }
}

const app = express();
app.use(cors());
app.use(express.json());

const analyzer = new ImageAnalyzer();

// サーバー起動時にモデルを読み込む
analyzer.initModel().then(() => {
  console.log("モデルの読み込みが完了しました");
});

// 画像分析のエンドポイント
app.post("/analyze-images", async (req, res) => {
  try {
    const { images } = req.body; // { images: [{ id: string, url: string }] }
    const results = [];

    for (const image of images) {
      const isPreferred = await analyzer.analyzeImage(image.url);
      if (isPreferred) {
        results.push(image.id);
      }
    }

    console.log("解析が完了しました");

    res.json({ preferredIds: results });
  } catch (error) {
    console.error("分析エラー:", error);
    res.status(500).json({ error: "分析中にエラーが発生しました" });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`サーバーが起動しました: http://localhost:${PORT}`);
});
