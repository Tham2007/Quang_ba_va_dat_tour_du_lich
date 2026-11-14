/**
 * Delta Travel 2.0 - 3D Scroll Canvas & Smooth Physics LERP Engine
 * Tải và hiển thị chuỗi 150 khung hình 3D xoay vòng mượt mà chuẩn 60fps/120fps.
 * Tích hợp thuật toán nội suy tuyến tính (LERP - Linear Interpolation) với quán tính vật lý (Momentum Damping):
 * - Khi cuộn nhẹ: Trái Đất xoay trôi êm ái, giảm tốc tự nhiên, không giật cục, không khựng lại đột ngột.
 * - Khi cuộn nhanh: Tăng tốc mượt mà, chuyển tiếp tuần tự từng khung hình (Stride = 1).
 * - Cơ chế Never-Blank: Luôn giữ khung hình gần nhất, không bao giờ nhấp nháy đen hay mất ảnh.
 */

(() => {
  "use strict";

  const TOTAL_FRAMES = 150;
  const FRAME_PREFIX = "ezgif-frame-";
  const FRAME_EXT = ".png";

  // Stride = 1 để chuyển động liên tục từng khung hình mượt mà nhất
  const FRAME_STRIDE = 1;
  const PREFETCH_AHEAD = 18;
  const PREFETCH_BEHIND = 8;
  const MAX_CACHED_FRAMES = 150; // Giữ toàn bộ 150 khung trong bộ nhớ sau khi nạp nền

  // Danh sách các đường dẫn dự phòng để tìm ảnh 3D
  const BASE_URLS = window.location.pathname.includes("/Frontend/")
    ? [
        "../3D%20Image%20data/",
        "/3D%20Image%20data/",
        "/3d-frames/",
        "3d-frames/",
        "3D%20Image%20data/",
        "/3D Image data/"
      ]
    : [
        "/3d-frames/",
        "3d-frames/",
        "/3D%20Image%20data/",
        "3D%20Image%20data/",
        "/3D Image data/",
        "../3D%20Image%20data/"
      ];

  let activeBaseUrl = BASE_URLS[0];
  const frameCache = new Map();
  const pendingFrames = new Set();
  let currentFrameIndex = 1;
  let lastDrawnIndex = 0;
  let lastSuccessfulAsset = null;
  let isCanvasReady = false;
  let renderWidth = 0;
  let renderHeight = 0;

  // Trạng thái LERP (Linear Interpolation) và quán tính vật lý
  let targetProgress = 0;
  let currentProgress = 0;
  let isRafRunning = false;
  let heroTop = 0;
  let heroScrollable = 0;

  const getFrameUrl = (index, base = activeBaseUrl) => {
    const clamped = Math.max(1, Math.min(TOTAL_FRAMES, index));
    const pad = String(clamped).padStart(3, "0");
    return `${base}${FRAME_PREFIX}${pad}${FRAME_EXT}`;
  };

  function init3DHero() {
    const section = document.getElementById("hero3DShowcase");
    const canvas = document.getElementById("hero3DCanvas");
    if (!section || !canvas) return;

    // Mobile/tablet dùng ảnh tĩnh nhẹ nhàng
    if (window.matchMedia("(max-width: 991.98px)").matches) {
      const onWiden = () => {
        if (window.innerWidth >= 992) {
          window.removeEventListener("resize", onWiden);
          init3DHero();
        }
      };
      window.addEventListener("resize", onWiden, { passive: true });
      return;
    }

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    renderWidth = window.innerWidth;
    renderHeight = window.innerHeight;

    const phase1 = document.getElementById("heroPhase1");
    const phase2 = document.getElementById("heroPhase2");
    const phase3 = document.getElementById("heroPhase3");
    const scrollIndicator = document.querySelector(".hero-scroll-indicator");

    function resizeCanvas() {
      renderWidth = window.innerWidth;
      renderHeight = window.innerHeight;

      canvas.width = renderWidth;
      canvas.height = renderHeight;
      canvas.style.width = renderWidth + "px";
      canvas.style.height = renderHeight + "px";

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      lastDrawnIndex = 0;
      renderFrame(currentFrameIndex, true);
    }

    // Vẽ hình ảnh phủ kín màn hình (cover) với khả năng giữ lại khung hình gần nhất
    function drawImageCover(asset) {
      if (!asset || !renderWidth || !renderHeight) return;

      const imgWidth = asset.width || asset.naturalWidth || 0;
      const imgHeight = asset.height || asset.naturalHeight || 0;
      if (!imgWidth || !imgHeight) return;

      const scale = Math.max(renderWidth / imgWidth, renderHeight / imgHeight);
      const drawWidth = imgWidth * scale;
      const drawHeight = imgHeight * scale;

      ctx.clearRect(0, 0, renderWidth, renderHeight);
      ctx.drawImage(
        asset,
        (renderWidth - drawWidth) / 2,
        (renderHeight - drawHeight) / 2,
        drawWidth,
        drawHeight
      );
      lastSuccessfulAsset = asset;
    }

    // Hệ thống tải ảnh với hàng đợi tối ưu
    const MAX_PARALLEL_DECODES = 4;
    const MAX_DECODE_QUEUE = 32;
    const decodeQueue = [];
    let activeDecodes = 0;

    function ensureFrame(index) {
      const frame = Math.max(1, Math.min(TOTAL_FRAMES, Math.round(index)));
      if (frameCache.has(frame) || pendingFrames.has(frame)) return;

      pendingFrames.add(frame);
      decodeQueue.push(frame);

      while (decodeQueue.length > MAX_DECODE_QUEUE) {
        pendingFrames.delete(decodeQueue.shift());
      }

      processDecodeQueue();
    }

    function processDecodeQueue() {
      while (activeDecodes < MAX_PARALLEL_DECODES && decodeQueue.length > 0) {
        startDecode(decodeQueue.shift());
      }
    }

    function startDecode(frame) {
      activeDecodes += 1;

      const done = (asset) => {
        activeDecodes -= 1;
        pendingFrames.delete(frame);

        if (asset) {
          frameCache.set(frame, asset);
          if (!isCanvasReady) {
            isCanvasReady = true;
            resizeCanvas();
          } else if (frame === currentFrameIndex) {
            renderFrame(frame, true);
          }
        }

        processDecodeQueue();
      };

      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        if (typeof createImageBitmap === "function") {
          createImageBitmap(img, { premultiplyAlpha: "none", imageOrientation: "none" })
            .then(done)
            .catch(() => done(img));
        } else {
          done(img);
        }
      };
      img.onerror = () => done(null);
      img.src = getFrameUrl(frame);
    }

    // Nạp trước các khung lân cận theo hướng cuộn
    function prefetchAround(index, direction) {
      const center = Math.max(1, Math.min(TOTAL_FRAMES, Math.round(index)));

      // Ưu tiên nạp theo hướng cuộn
      const stepDir = direction >= 0 ? 1 : -1;
      for (let i = 1; i <= PREFETCH_AHEAD; i++) {
        ensureFrame(center + i * stepDir);
      }
      for (let i = 1; i <= PREFETCH_BEHIND; i++) {
        ensureFrame(center - i * stepDir);
      }
    }

    // Tải ngầm tuần tự toàn bộ 150 khung hình trong lúc nhàn rỗi (Idle background preload)
    function startIdlePreloadAll() {
      let nextFrameToPreload = 2;
      function preloadNextBatch() {
        if (nextFrameToPreload > TOTAL_FRAMES) return;
        const batchEnd = Math.min(TOTAL_FRAMES, nextFrameToPreload + 4);
        for (let f = nextFrameToPreload; f <= batchEnd; f++) {
          ensureFrame(f);
        }
        nextFrameToPreload = batchEnd + 1;
        if (typeof window.requestIdleCallback === "function") {
          window.requestIdleCallback(preloadNextBatch, { timeout: 1200 });
        } else {
          setTimeout(preloadNextBatch, 80);
        }
      }
      setTimeout(preloadNextBatch, 300);
    }

    // Vẽ khung hình: nếu khung chưa kịp nạp, tự động dùng khung gần nhất có sẵn (Never-Blank)
    function renderFrame(index, force) {
      const frame = Math.max(1, Math.min(TOTAL_FRAMES, Math.round(index)));
      currentFrameIndex = frame;

      if (!force && frame === lastDrawnIndex) return;

      let asset = frameCache.get(frame);
      if (!asset) {
        // Tìm khung gần nhất trong cache để vẽ, không bao giờ để trống
        let bestDiff = Infinity;
        for (const [cachedIdx, cachedAsset] of frameCache.entries()) {
          const diff = Math.abs(cachedIdx - frame);
          if (diff < bestDiff) {
            bestDiff = diff;
            asset = cachedAsset;
          }
        }
      }

      if (asset) {
        drawImageCover(asset);
        lastDrawnIndex = frame;
      } else if (lastSuccessfulAsset) {
        drawImageCover(lastSuccessfulAsset);
      }
    }

    // Xác định URL hợp lệ
    function testNextBaseUrl(idx) {
      if (idx >= BASE_URLS.length) {
        const fallbackImg = new Image();
        fallbackImg.onload = () => drawImageCover(fallbackImg);
        fallbackImg.src = "assets/images/hero-bg.png";
        return;
      }
      const testImg = new Image();
      testImg.onload = () => {
        activeBaseUrl = BASE_URLS[idx];
        startPreloading();
      };
      testImg.onerror = () => {
        testNextBaseUrl(idx + 1);
      };
      testImg.src = getFrameUrl(1, BASE_URLS[idx]);
    }
    testNextBaseUrl(0);

    function startPreloading() {
      // Nạp ngay lập tức khung 1 và các khung đầu tiên
      ensureFrame(1);
      for (let f = 2; f <= 12; f++) ensureFrame(f);
      startIdlePreloadAll();
    }

    // Đo kích thước hero
    function measureHero() {
      const rect = section.getBoundingClientRect();
      heroTop = rect.top + window.scrollY;
      heroScrollable = section.offsetHeight - window.innerHeight;
    }

    // THUẬT TOÁN LERP & QUÁN TÍNH VẬT LÝ CHO CUỘN CHUỘT BUTTERY SMOOTH
    function startLerpLoop() {
      if (isRafRunning) return;
      isRafRunning = true;
      requestAnimationFrame(lerpTick);
    }

    function lerpTick() {
      if (window.matchMedia("(max-width: 991.98px)").matches) {
        isRafRunning = false;
        return;
      }

      // Hệ số nội suy LERP (0.082 tạo cảm giác quán tính đầm chắc, mượt mà như Apple / Google Pixel)
      const ease = 0.082;
      const delta = targetProgress - currentProgress;

      if (Math.abs(delta) < 0.00015) {
        currentProgress = targetProgress;
        isRafRunning = false;
      } else {
        currentProgress += delta * ease;
        requestAnimationFrame(lerpTick);
      }

      applyProgressExperience(currentProgress, delta >= 0 ? 1 : -1);
    }

    function applyProgressExperience(progress, direction) {
      // 1. Chuyển đổi khung hình 3D từ 1 đến 150 (Ánh xạ đến 86% tiến trình cuộn, 14% còn lại giữ nguyên khung hình cuối)
      const frameProgress = Math.min(1, Math.max(0, progress / 0.86));
      const floatFrame = 1 + frameProgress * (TOTAL_FRAMES - 1);
      const targetFrame = Math.max(1, Math.min(TOTAL_FRAMES, Math.round(floatFrame)));

      if (targetFrame !== currentFrameIndex) {
        renderFrame(targetFrame);
        prefetchAround(targetFrame, direction);
      }

      // 2. Tự động làm mờ nhẹ chuột cuộn indicator
      if (scrollIndicator) {
        scrollIndicator.style.opacity = progress > 0.82 ? Math.max(0, 1 - (progress - 0.82) / 0.12).toFixed(2) : "1";
      }

      // 3. Chuyển đổi mượt mà các tầng chữ nổi bật phía trước đồng bộ với Trái Đất
      if (phase1 && phase2 && phase3) {
        if (progress < 0.28) {
          // Giai đoạn 1: Vũ trụ & Địa cầu
          const p1Opacity = Math.max(0, 1 - (progress / 0.24));
          phase1.style.opacity = p1Opacity.toFixed(3);
          phase1.style.transform = `translateY(${(-progress * 45).toFixed(1)}px)`;
          phase1.style.pointerEvents = p1Opacity > 0.2 ? "auto" : "none";

          phase2.style.opacity = "0";
          phase2.style.pointerEvents = "none";
          phase3.style.opacity = "0";
          phase3.style.pointerEvents = "none";
        } else if (progress >= 0.28 && progress < 0.65) {
          // Giai đoạn 2: Vượt tầng mây
          const localProgress = (progress - 0.28) / 0.37;
          const p2Opacity = localProgress < 0.5
            ? localProgress * 2
            : (1 - localProgress) * 2;

          phase1.style.opacity = "0";
          phase1.style.pointerEvents = "none";

          phase2.style.opacity = Math.max(0, Math.min(1, p2Opacity)).toFixed(3);
          phase2.style.transform = `translateY(${((0.5 - localProgress) * 28).toFixed(1)}px)`;
          phase2.style.pointerEvents = p2Opacity > 0.2 ? "auto" : "none";

          phase3.style.opacity = "0";
          phase3.style.pointerEvents = "none";
        } else {
          // Giai đoạn 3: Vịnh Hạ Long thiên đường
          const localProgress = Math.min(1, (progress - 0.65) / 0.20);
          const p3Opacity = Math.min(1, localProgress);

          phase1.style.opacity = "0";
          phase1.style.pointerEvents = "none";
          phase2.style.opacity = "0";
          phase2.style.pointerEvents = "none";

          phase3.style.opacity = p3Opacity.toFixed(3);
          phase3.style.transform = `translateY(${((1 - localProgress) * 24).toFixed(1)}px)`;
          phase3.style.pointerEvents = p3Opacity > 0.2 ? "auto" : "none";
        }
      }
    }

    function onScroll() {
      if (heroScrollable <= 0) return;
      targetProgress = Math.max(0, Math.min(1, (window.scrollY - heroTop) / heroScrollable));
      startLerpLoop();
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", () => {
      measureHero();
      resizeCanvas();
      targetProgress = Math.max(0, Math.min(1, (window.scrollY - heroTop) / Math.max(1, heroScrollable)));
      currentProgress = targetProgress;
      applyProgressExperience(currentProgress, 1);
    }, { passive: true });
    window.addEventListener("load", measureHero, { once: true });

    // Khởi tạo ban đầu
    measureHero();
    resizeCanvas();
    targetProgress = Math.max(0, Math.min(1, (window.scrollY - heroTop) / Math.max(1, heroScrollable)));
    currentProgress = targetProgress;
    applyProgressExperience(currentProgress, 1);
  }

  // Khởi động khi tài liệu sẵn sàng
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init3DHero);
  } else {
    init3DHero();
  }
})();
