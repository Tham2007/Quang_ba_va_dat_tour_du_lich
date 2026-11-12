/**
 * Delta Travel 2.0 - 3D Scroll Canvas & Moving Background Typography
 * Tải và hiển thị chuỗi 150 khung hình 3D xoay vòng mượt mà theo thao tác cuộn trang
 * Kết hợp chữ nghệ thuật mờ khổng lồ chuyển động parallax phía sau
 */

(() => {
  "use strict";

  const TOTAL_FRAMES = 150;
  const FRAME_PREFIX = "ezgif-frame-";
  const FRAME_EXT = ".png";

  // Mỗi khung PNG gốc rất nặng (~500KB), nạp đủ 150 khung sẽ ngốn >1GB RAM.
  // 1) Chỉ dùng mỗi 2 khung (75 khung) vẫn đủ mượt khi cuộn.
  // 2) Chỉ giữ một "cửa sổ" khung quanh vị trí đang xem để cuộn mượt.
  const FRAME_STRIDE = 2;
  const LAST_FRAME_INDEX = Math.floor((TOTAL_FRAMES - 1) / FRAME_STRIDE) * FRAME_STRIDE + 1;
  const MAX_CACHED_FRAMES = 20;
  const PREFETCH_AHEAD = 6;
  const PREFETCH_BEHIND = 3;

  const snapFrame = (index) => {
    const clamped = Math.max(1, Math.min(TOTAL_FRAMES, index));
    const snapped = Math.round((clamped - 1) / FRAME_STRIDE) * FRAME_STRIDE + 1;
    return Math.max(1, Math.min(LAST_FRAME_INDEX, snapped));
  };

  // Danh sách các đường dẫn dự phòng để tìm ảnh 3D
  const BASE_URLS = [
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
  let isCanvasReady = false;
  let renderWidth = 0;
  let renderHeight = 0;

  const getFrameUrl = (index, base = activeBaseUrl) => {
    const pad = String(index).padStart(3, "0");
    return `${base}${FRAME_PREFIX}${pad}${FRAME_EXT}`;
  };

  function init3DHero() {
    const section = document.getElementById("hero3DShowcase");
    const canvas = document.getElementById("hero3DCanvas");
    if (!section || !canvas) return;
    // Chỉ tải bộ khung hình 3D tùy chọn khi môi trường bật cờ data-enable3d-frames="true"
    // để tránh phát sinh hàng trăm request 404 khi thư mục 3d-frames không đi kèm trong repo.
    if (document.documentElement.dataset.enable3dFrames !== "true") return;

    // Hiệu ứng Trái Đất 3D chỉ dành cho Desktop; mobile/tablet dùng ảnh tĩnh cho nhẹ
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

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    renderWidth = window.innerWidth;
    renderHeight = window.innerHeight;

    const phase1 = document.getElementById("heroPhase1");
    const phase2 = document.getElementById("heroPhase2");
    const phase3 = document.getElementById("heroPhase3");
    const scrollIndicator = document.querySelector(".hero-scroll-indicator");

    // Canvas vẽ ở đúng kích thước CSS (1x) để giảm mạnh số điểm ảnh phải xử lý
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

    // Vẽ khung hình lên canvas theo tỷ lệ cover (nhận ImageBitmap hoặc Image)
    function drawImageCover(asset) {
      if (!asset || !renderWidth || !renderHeight) return;

      const imgWidth = asset.width || asset.naturalWidth || 0;
      const imgHeight = asset.height || asset.naturalHeight || 0;
      if (!imgWidth || !imgHeight) return;

      const scale = Math.max(renderWidth / imgWidth, renderHeight / imgHeight);
      const drawWidth = imgWidth * scale;
      const drawHeight = imgHeight * scale;

      ctx.clearRect(0, 0, renderWidth, renderHeight);
      ctx.drawImage(asset, (renderWidth - drawWidth) / 2, (renderHeight - drawHeight) / 2, drawWidth, drawHeight);
    }

    // Nạp 1 khung: giải mã bằng createImageBitmap (off main-thread) để không giật khi cuộn
    // Giới hạn số khung giải mã song song để main-thread luôn rảnh khi cuộn nhanh
    const MAX_PARALLEL_DECODES = 3;
    const MAX_DECODE_QUEUE = 16;
    const decodeQueue = [];
    let activeDecodes = 0;

    function ensureFrame(index) {
      const frame = snapFrame(index);
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
          trimFrameCache(currentFrameIndex);
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

    // Chỉ giữ các khung gần vị trí hiện tại, giải phóng bộ nhớ các khung ở xa
    function trimFrameCache(center) {
      if (frameCache.size <= MAX_CACHED_FRAMES) return;

      const low = center - (PREFETCH_AHEAD + 2) * FRAME_STRIDE;
      const high = center + (PREFETCH_AHEAD + 2) * FRAME_STRIDE;
      frameCache.forEach((asset, index) => {
        if (index < low || index > high) {
          if (asset && typeof asset.close === "function") asset.close();
          frameCache.delete(index);
        }
      });
    }

    // Ưu tiên nạp các khung sắp xuất hiện theo hướng cuộn
    function prefetchAround(index, direction) {
      const center = snapFrame(index);

      // Bỏ các khung đã xếp hàng nhưng đã quá xa vị trí hiện tại (cuộn nhanh)
      for (let i = decodeQueue.length - 1; i >= 0; i--) {
        if (Math.abs(decodeQueue[i] - center) > (PREFETCH_AHEAD + 2) * FRAME_STRIDE) {
          pendingFrames.delete(decodeQueue[i]);
          decodeQueue.splice(i, 1);
        }
      }

      for (let i = 0; i <= PREFETCH_AHEAD; i++) ensureFrame(center + i * FRAME_STRIDE * direction);
      for (let i = 1; i <= PREFETCH_BEHIND; i++) ensureFrame(center - i * FRAME_STRIDE * direction);
    }

    // Vẽ khung hình; nếu khung chưa sẵn sàng thì dùng khung gần nhất đã có
    function renderFrame(index, force) {
      const frame = snapFrame(index);
      currentFrameIndex = frame;

      if (!force && frame === lastDrawnIndex) return;

      let asset = frameCache.get(frame);
      if (!asset) {
        for (let step = 1; step <= 20 && !asset; step++) {
          asset = frameCache.get(snapFrame(frame - step * FRAME_STRIDE))
            || frameCache.get(snapFrame(frame + step * FRAME_STRIDE))
            || null;
        }
      }

      if (asset) {
        drawImageCover(asset);
        lastDrawnIndex = frame;
      }
    }

    // Kiểm tra tuần tự và xác định URL cơ sở nào đang hoạt động chính xác
    function testNextBaseUrl(idx) {
      if (idx >= BASE_URLS.length) {
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
      // Khung đầu tiên được ưu tiên tuyệt đối để hero hiện ngay
      ensureFrame(1);
      prefetchAround(1, 1);
    }

    // Tính toán tiến trình cuộn trang qua Hero section
    let ticking = false;

    function onScroll() {
      if (!ticking) {
        requestAnimationFrame(() => {
          updateScrollExperience();
          ticking = false;
        });
        ticking = true;
      }
    }

    // Đo kích thước hero một lần khi resize để tránh forced layout ở mỗi khung hình cuộn
    let heroTop = 0;
    let heroScrollable = 0;

    function measureHero() {
      const rect = section.getBoundingClientRect();
      heroTop = rect.top + window.scrollY;
      heroScrollable = section.offsetHeight - window.innerHeight;
    }

    function updateScrollExperience() {
      // Mobile/tablet: hiệu ứng 3D bị lược bỏ, trả lại trạng thái tĩnh cho nội dung
      if (window.matchMedia("(max-width: 991.98px)").matches) {
        [phase1, phase2, phase3].forEach((phase) => {
          if (!phase) return;
          phase.style.opacity = "";
          phase.style.transform = "";
          phase.style.pointerEvents = "";
        });
        return;
      }

      const rect = section.getBoundingClientRect();
      if (heroScrollable <= 0) return;

      // Tính progress từ 0 đến 1
      const progress = Math.max(0, Math.min(1, (window.scrollY - heroTop) / heroScrollable));

      // 1. Chuyển đổi khung hình 3D từ 1 đến 150 (Ánh xạ đến 85% tiến trình cuộn, 15% còn lại giữ nguyên khung hình cuối)
      const frameProgress = Math.min(1, progress / 0.85);
      const targetFrame = snapFrame(Math.round(frameProgress * (TOTAL_FRAMES - 1)) + 1);
      if (targetFrame !== currentFrameIndex) {
        const direction = targetFrame > currentFrameIndex ? 1 : -1;
        renderFrame(targetFrame);
        prefetchAround(targetFrame, direction);
      }

      // 2. Tự động mờ dần chuột cuộn khi cuộn về gần cuối để không chèn lên phần tìm kiếm tiếp theo
      if (scrollIndicator) {
        scrollIndicator.style.opacity = progress > 0.82 ? Math.max(0, 1 - (progress - 0.82) / 0.12).toFixed(2) : "1";
      }

      // 4. Chuyển đổi các giai đoạn chữ nổi bật phía trước
      if (phase1 && phase2 && phase3) {
        if (progress < 0.28) {
          // Giai đoạn 1: Vũ trụ & Địa cầu
          const p1Opacity = Math.max(0, 1 - (progress / 0.24));
          phase1.style.opacity = p1Opacity;
          phase1.style.transform = `translateY(${(-progress * 40).toFixed(1)}px)`;
          phase1.style.pointerEvents = p1Opacity > 0.2 ? "auto" : "none";

          phase2.style.opacity = 0;
          phase2.style.pointerEvents = "none";
          phase3.style.opacity = 0;
          phase3.style.pointerEvents = "none";
        } else if (progress >= 0.28 && progress < 0.65) {
          // Giai đoạn 2: Vượt tầng mây
          const localProgress = (progress - 0.28) / 0.37;
          const p2Opacity = localProgress < 0.5
            ? localProgress * 2
            : (1 - localProgress) * 2;

          phase1.style.opacity = 0;
          phase1.style.pointerEvents = "none";

          phase2.style.opacity = Math.max(0, Math.min(1, p2Opacity));
          phase2.style.transform = `translateY(${((0.5 - localProgress) * 25).toFixed(1)}px)`;
          phase2.style.pointerEvents = p2Opacity > 0.2 ? "auto" : "none";

          phase3.style.opacity = 0;
          phase3.style.pointerEvents = "none";
        } else {
          // Giai đoạn 3: Vịnh Hạ Long thiên đường (hiển thị trọn vẹn, giữ vững khung hình)
          const localProgress = Math.min(1, (progress - 0.65) / 0.20);
          const p3Opacity = Math.min(1, localProgress);

          phase1.style.opacity = 0;
          phase1.style.pointerEvents = "none";
          phase2.style.opacity = 0;
          phase2.style.pointerEvents = "none";

          phase3.style.opacity = p3Opacity;
          phase3.style.transform = `translateY(${((1 - localProgress) * 20).toFixed(1)}px)`;
          phase3.style.pointerEvents = p3Opacity > 0.2 ? "auto" : "none";
        }
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", () => {
      measureHero();
      resizeCanvas();
      updateScrollExperience();
    }, { passive: true });
    window.addEventListener("load", measureHero, { once: true });

    // Khởi tạo kích thước ban đầu
    measureHero();
    resizeCanvas();
    updateScrollExperience();
  }

  // Khởi động khi tài liệu sẵn sàng
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init3DHero);
  } else {
    init3DHero();
  }
})();

