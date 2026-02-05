(function(){
  const errorBox = document.getElementById("errorBox");
  const errorText = document.getElementById("errorText");
  function showError(msg){
    errorBox.classList.remove("hidden");
    errorText.textContent = msg;
    console.error(msg);
  }

  function loadScriptWithFallback(name, urls){
    return new Promise((resolve, reject)=>{
      let i = 0;
      const tried = [];
      const next = ()=>{
        if (i >= urls.length) {
          reject(new Error(name + " не загрузился. Пробовали:\n" + tried.join("\n")));
          return;
        }
        const url = urls[i++];
        tried.push(" - " + url);
        const s = document.createElement("script");
        s.src = url;
        s.async = false; // keep order
        s.onload = () => resolve(url);
        s.onerror = () => {
          s.remove();
          next();
        };
        document.head.appendChild(s);
      };
      next();
    });
  }

  async function boot(){
    try{
      // 1) THREE core
      await loadScriptWithFallback("Three.js", [
        "https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.0/three.min.js",
        "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js",
        "https://unpkg.com/three@0.160.0/build/three.min.js"
      ]);

      // 2) Addons (non-module examples/js)
      await loadScriptWithFallback("OrbitControls", [
        "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/js/controls/OrbitControls.js",
        "https://unpkg.com/three@0.160.0/examples/js/controls/OrbitControls.js"
      ]);

      await loadScriptWithFallback("TransformControls", [
        "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/js/controls/TransformControls.js",
        "https://unpkg.com/three@0.160.0/examples/js/controls/TransformControls.js"
      ]);

      await loadScriptWithFallback("STLExporter", [
        "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/js/exporters/STLExporter.js",
        "https://unpkg.com/three@0.160.0/examples/js/exporters/STLExporter.js"
      ]);

      // 3) App
      await loadScriptWithFallback("Приложение", ["app.js"]);
    } catch (e){
      showError(String(e && e.message ? e.message : e));
    }
  }

  boot();
})();