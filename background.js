chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "ANALYZE_IMAGE") {
    // 画像の処理とTensorFlow.jsの実行をここで行う
    processImage(message.imageUrl).then((result) => {
      sendResponse({ isPreferred: result });
    });
    return true; // 非同期レスポンスのため
  }
});

async function processImage(url) {
  const img = new Image();
  img.src = url;
  await new Promise((resolve) => (img.onload = resolve));

  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);

  const tensor = tf.browser
    .fromPixels(canvas)
    .resizeNearestNeighbor([224, 224])
    .toFloat()
    .expandDims();

  const prediction = await model.predict(tensor).data();
  return prediction[0] > 0.7;
}
