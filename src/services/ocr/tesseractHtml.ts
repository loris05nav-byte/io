/**
 * Page chargée dans une WebView invisible : exécute Tesseract.js (WebAssembly).
 * Les fichiers du moteur et des langues sont téléchargés puis mis en cache au premier usage.
 */
export const TESSERACT_VERSION = '5.1.1';

export const tesseractHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body>
<script>
(function () {
  function send(message) {
    var data = JSON.stringify(message);
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(data);
    else if (window.parent && window.parent !== window) window.parent.postMessage(data, '*');
  }

  var loading = null;
  function loadEngine() {
    if (window.Tesseract) return Promise.resolve();
    if (loading) return loading;
    loading = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@${TESSERACT_VERSION}/dist/tesseract.min.js';
      script.onload = function () { resolve(); };
      script.onerror = function () { loading = null; reject(new Error('NETWORK')); };
      document.head.appendChild(script);
    });
    return loading;
  }

  window.OcrEngine = {
    recognize: function (id, image, lang) {
      loadEngine()
        .then(function () {
          return window.Tesseract.recognize(image, lang, {
            logger: function (m) {
              if (m && typeof m.progress === 'number') send({ type: 'progress', id: id, status: m.status, progress: m.progress });
            },
          });
        })
        .then(function (result) {
          send({ type: 'result', id: id, text: (result && result.data && result.data.text) || '' });
        })
        .catch(function (error) {
          send({ type: 'error', id: id, message: String((error && error.message) || error) });
        });
    },
  };

  send({ type: 'ready' });
})();
</script>
</body>
</html>`;
