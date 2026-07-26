(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);
  let savedAssets = JSON.parse(localStorage.getItem('zg-assets') || '[]');
  let currentAssetType = 'sprite';

  function setupAssetStudio() {
    const genBtn = $('#genAssetBtn');
    const promptInput = $('#assetPrompt');
    const assetGrid = $('#assetGrid');
    const typeButtons = document.querySelectorAll('#panel-assets .asset-type-btn');
    const shaderCanvas = $('#shaderCanvas');
    const shaderRunBtn = $('#shaderRunBtn');
    const shaderExportBtn = $('#shaderExportBtn');
    const shaderPreview = $('#shaderPreview');

    if (!genBtn) return;

    typeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        typeButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentAssetType = btn.dataset.atype;
        if (currentAssetType === 'shader') {
          shaderPreview.style.display = '';
          promptInput.placeholder = 'Describe your shader (for code gen)...';
        } else {
          shaderPreview.style.display = 'none';
          promptInput.placeholder = 'Describe your asset...';
        }
      });
    });

    genBtn.addEventListener('click', () => generateAsset());
    promptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); generateAsset(); }
    });

    if (shaderRunBtn) {
      shaderRunBtn.addEventListener('click', () => runShader());
    }
    if (shaderExportBtn) {
      shaderExportBtn.addEventListener('click', () => exportShader());
    }

    renderAssetGrid();
  }

  async function generateAsset() {
    const promptInput = $('#assetPrompt');
    const size = $('#assetSize').value;
    const style = $('#assetStyle').value;
    const prompt = promptInput.value.trim();
    if (!prompt) return;

    if (currentAssetType === 'shader') {
      // Ask Zegrate for shader code via chat
      toast('Switch to Chat and ask Zegrate to generate a shader: "Generate a fragment shader for: ' + prompt + '"');
      return;
    }

    const grid = $('#assetGrid');
    const placeholder = document.createElement('div');
    placeholder.className = 'asset-grid-item';
    placeholder.innerHTML = '<div style="width:100%;aspect-ratio:1;background:var(--glass-bg);display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:12px">Generating...</div>';
    grid.prepend(placeholder);

    try {
      // Use Pollinations.ai (free, no API key)
      const stylePrefix = style === 'pixel' ? 'pixel art, 16-bit, retro, ' : style === 'flat' ? 'flat design, minimal, ' : style === 'realistic' ? 'photorealistic, detailed, ' : 'abstract, artistic, ';
      const typePrefix = currentAssetType === 'icon' ? 'icon, simple, clean background, ' : currentAssetType === 'texture' ? 'seamless texture, tileable, ' : '';
      const fullPrompt = stylePrefix + typePrefix + prompt;
      const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?width=${size}&height=${size}&nologo=true`;

      const asset = {
        id: Date.now(),
        url: url,
        prompt: prompt,
        type: currentAssetType,
        style: style,
        size: size,
        created: new Date().toISOString()
      };
      savedAssets.unshift(asset);
      localStorage.setItem('zg-assets', JSON.stringify(savedAssets));
      renderAssetGrid();
      promptInput.value = '';
    } catch (e) {
      placeholder.remove();
      toast('Generation failed: ' + e.message);
    }
  }

  function renderAssetGrid() {
    const grid = $('#assetGrid');
    if (!grid) return;
    grid.innerHTML = '';
    if (!savedAssets.length) {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--text-muted);font-size:12px">No assets yet. Generate one above.</div>';
      return;
    }
    savedAssets.forEach(a => {
      const item = document.createElement('div');
      item.className = 'asset-grid-item';
      item.innerHTML = `<img src="${a.url}" alt="${a.prompt}" loading="lazy"><div class="asset-label">${a.prompt}</div><button class="asset-delete" title="Delete">&times;</button>`;
      item.querySelector('.asset-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        savedAssets = savedAssets.filter(x => x.id !== a.id);
        localStorage.setItem('zg-assets', JSON.stringify(savedAssets));
        renderAssetGrid();
      });
      item.querySelector('img').addEventListener('click', () => {
        window.open(a.url, '_blank');
      });
      grid.appendChild(item);
    });
  }

  function runShader() {
    const fragCode = $('#gameFragShader') ? $('#gameFragShader').value : '';
    const canvas = $('#shaderCanvas');
    if (!canvas || !fragCode.trim()) return;

    const gl = canvas.getContext('webgl');
    if (!gl) { toast('WebGL not supported'); return; }

    const vsSource = 'attribute vec2 a_position;\nvoid main() {\n  gl_Position = vec4(a_position, 0.0, 1.0);\n}';

    function compileShader(type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    }

    const vs = compileShader(gl.VERTEX_SHADER, vsSource);
    const fs = compileShader(gl.FRAGMENT_SHADER, fragCode);
    if (!vs || !fs) { toast('Shader compile error'); return; }

    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.useProgram(program);

    const posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    const posLoc = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const timeLoc = gl.getUniformLocation(program, 'u_time');
    const resLoc = gl.getUniformLocation(program, 'u_resolution');
    const mouseLoc = gl.getUniformLocation(program, 'u_mouse');

    canvas.width = 256;
    canvas.height = 256;
    gl.viewport(0, 0, 256, 256);

    let running = true;
    function renderLoop(t) {
      if (!running) return;
      gl.uniform1f(timeLoc, t / 1000);
      gl.uniform2f(resLoc, 256, 256);
      gl.uniform2f(mouseLoc, 128, 128);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      requestAnimationFrame(renderLoop);
    }
    requestAnimationFrame(renderLoop);

    // Stop after 10 seconds
    setTimeout(() => { running = false; }, 10000);
  }

  function exportShader() {
    const fragCode = $('#gameFragShader') ? $('#gameFragShader').value : '';
    if (!fragCode.trim()) { toast('No shader code to export'); return; }
    const blob = new Blob([fragCode], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'shader.glsl';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => {
      t.style.opacity = '0';
      t.style.transition = 'opacity 0.3s';
      setTimeout(() => t.remove(), 300);
    }, 3000);
  }

  document.addEventListener('DOMContentLoaded', setupAssetStudio);
})();
