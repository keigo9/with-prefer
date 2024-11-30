import * as tf from "@tensorflow/tfjs-node";
import * as fs from "fs";
import * as path from "path";
import sharp from "sharp";

class DirectoryModelTrainer {
  constructor() {
    this.model = null;
    this.trainingData = {
      preferred: [], // 好みの顔画像データ
      others: [], // その他の顔画像データ
    };
  }

  // モデルのアーキテクチャを構築
  buildModel() {
    this.model = tf.sequential();

    // 畳み込みニューラルネットワークの構築
    this.model.add(
      tf.layers.conv2d({
        inputShape: [224, 224, 3],
        filters: 32,
        kernelSize: 3,
        activation: "relu",
      })
    );
    this.model.add(tf.layers.maxPooling2d({ poolSize: 2 }));
    this.model.add(
      tf.layers.conv2d({
        filters: 64,
        kernelSize: 3,
        activation: "relu",
      })
    );
    this.model.add(tf.layers.maxPooling2d({ poolSize: 2 }));
    this.model.add(tf.layers.flatten());
    this.model.add(tf.layers.dense({ units: 128, activation: "relu" }));
    this.model.add(tf.layers.dropout({ rate: 0.5 }));
    this.model.add(tf.layers.dense({ units: 1, activation: "sigmoid" }));

    this.model.compile({
      optimizer: tf.train.adam(0.0001),
      loss: "binaryCrossentropy",
      metrics: ["accuracy"],
    });
  }

  // 画像をテンソルに変換
  async imageToTensor(imagePath) {
    try {
      // sharpを使用して画像を読み込み、リサイズ
      const image = await sharp(imagePath)
        .resize(224, 224, { fit: "cover" })
        .raw()
        .toBuffer();

      // 画像データをテンソルに変換
      const tensor = tf
        .tensor3d(new Uint8Array(image), [224, 224, 3])
        .toFloat()
        .div(255.0);

      return tensor;
    } catch (error) {
      console.error(`画像の変換エラー (${imagePath}):`, error);
      throw error;
    }
  }

  // ディレクトリから画像を読み込む
  async loadImagesFromDirectory(directory) {
    const images = [];
    const files = fs.readdirSync(directory);

    for (const file of files) {
      if (file.match(/\.(jpg|jpeg|png)$/i)) {
        try {
          const imagePath = path.join(directory, file);
          const tensor = await this.imageToTensor(imagePath);
          // バッチ次元を追加
          const expandedTensor = tensor.expandDims(0);
          images.push(expandedTensor);
        } catch (error) {
          console.error(`画像のロードエラー (${file}):`, error);
          // エラーが発生した画像はスキップ
          continue;
        }
      }
    }

    if (images.length === 0) {
      return [];
    }

    // すべての画像テンソルを結合
    return images.length === 1 ? images[0] : tf.concat(images, 0);
  }

  // トレーニングデータの準備
  async prepareTrainingData(preferredDir, othersDir) {
    console.log("好みの画像を読み込み中...");
    const preferredImages = await this.loadImagesFromDirectory(preferredDir);
    console.log(`${preferredImages.shape[0]}枚の好みの画像を読み込みました`);

    let xs = preferredImages;
    let labels = Array(preferredImages.shape[0]).fill(1);

    // その他の画像ディレクトリが指定されている場合
    if (othersDir) {
      console.log("その他の画像を読み込み中...");
      const otherImages = await this.loadImagesFromDirectory(othersDir);
      console.log(
        `${
          otherImages.shape ? otherImages.shape[0] : 0
        }枚のその他の画像を読み込みました`
      );

      if (otherImages.shape) {
        xs = tf.concat([xs, otherImages], 0);
        labels = labels.concat(Array(otherImages.shape[0]).fill(0));
      }
    }

    // 少なくとも1つのカテゴリに画像が必要
    if (!xs.shape || xs.shape[0] === 0) {
      throw new Error(
        "トレーニングデータが見つかりません。少なくとも1つのカテゴリに画像を追加してください。"
      );
    }

    // データをシャッフル
    const numSamples = xs.shape[0];
    const indices = tf.util.createShuffledIndices(numSamples);

    // シャッフルされたインデックスをテンソルに変換
    const shuffledXs = tf.tidy(() => {
      const indicesTensor = tf.tensor1d(Array.from(indices), "int32");
      return tf.gather(xs, indicesTensor);
    });

    const shuffledLabels = Array.from(indices).map((i) => labels[i]);

    // ラベルを2次元テンソルに変換 [batch, 1]
    const ys = tf.tensor2d(shuffledLabels, [shuffledLabels.length, 1]);

    return { xs: shuffledXs, ys };
  }

  // モデルのトレーニング
  async trainModel(preferredDir, othersDir) {
    console.log("トレーニングデータを準備中...");
    const { xs, ys } = await this.prepareTrainingData(preferredDir, othersDir);

    console.log("トレーニングを開始...");
    await this.model.fit(xs, ys, {
      epochs: 50,
      batchSize: 32,
      validationSplit: 0.2,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          const metrics = [];
          if (logs.loss !== undefined) {
            metrics.push(`loss = ${Number(logs.loss).toFixed(4)}`);
          }
          if (logs.acc !== undefined) {
            metrics.push(`accuracy = ${Number(logs.acc).toFixed(4)}`);
          }
          if (logs.val_loss !== undefined) {
            metrics.push(`val_loss = ${Number(logs.val_loss).toFixed(4)}`);
          }
          if (logs.val_acc !== undefined) {
            metrics.push(`val_accuracy = ${Number(logs.val_acc).toFixed(4)}`);
          }
          console.log(`Epoch ${epoch + 1}: ${metrics.join(", ")}`);
        },
      },
    });

    // トレーニング完了後にメモリを解放
    xs.dispose();
    ys.dispose();
  }

  // モデルの保存
  async saveModel(savePath) {
    await this.model.save(`file://${savePath}`);
    console.log(`モデルを保存しました: ${savePath}`);
  }
}

// 使用例
async function main() {
  try {
    const trainer = new DirectoryModelTrainer();
    trainer.buildModel();

    const preferredDir = "./images/preferred";
    const othersDir = fs.existsSync("./images/others")
      ? "./images/others"
      : null;
    const modelSavePath = "./model";

    await trainer.trainModel(preferredDir, othersDir);
    await trainer.saveModel(modelSavePath);
    console.log("トレーニングが完了しました！");
  } catch (error) {
    console.error("エラーが発生しました:");
    console.error(error.stack || error);
  } finally {
    // メモリの解放を確実に行う
    tf.dispose();
  }
}

main();
