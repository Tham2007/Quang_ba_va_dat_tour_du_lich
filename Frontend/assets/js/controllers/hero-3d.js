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

  // Danh sách các đường dẫn dự phòng để tìm ảnh 3D
  const BASE_URLS = [
    "/3d-frames/",
    "/3D%20Image%20data/",
    "3D%20Image%20data/",
    "../3D%20Image%20data/"
  ];

  let activeBaseUrl = BASE_URLS[0];
  const images = [];
  const loadedFlags = new Array(TOTAL_FRAMES + 1).fill(false);
  let currentFrameIndex = 1;
  let isCanvasReady = false;

  const getFrameUrl = (index, base = activeBaseUrl) => {
    const pad = String(index).padStart(3, "0");
    return `${base}${FRAME_PREFIX}${pad}${FRAME_EXT}`;
  };

  function init3DHero() {
    const section = document.getElementById("hero3DShowcase");
    const canvas = document.getElementById("hero3DCanvas");
    if (!section || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const phase1 = document.getElementById("heroPhase1");
    const phase2 = document.getElementById("heroPhase2");
    const phase3 = document.getElementById("heroPhase3");

    // Điều chỉnh kích thước canvas theo độ phân giải màn hình (High DPI Retina)
    function resizeCanvas() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = window.innerWidth;
      const height = window.innerHeight;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";

      ctx.scale(dpr, dpr);
      renderFrame(currentFrameIndex);
    }

    // Vẽ khung hình lên canvas theo tỷ lệ cover
    function drawImageCover(img) {
      if (!img || !img.complete || img.naturalWidth === 0) return;

      const width = window.innerWidth;
      const height = window.innerHeight;
      const imgWidth = img.naturalWidth;
      const imgHeight = img.naturalHeight;

      const scale = Math.max(width / imgWidth, height / imgHeight);
      const drawWidth = imgWidth * scale;
      const drawHeight = imgHeight * scale;
      const drawX = (width - drawWidth) / 2;
      const drawY = (height - drawHeight) / 2;

      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
    }

    // Tìm khung hình gần nhất đã tải xong nếu khung hình hiện tại chưa xong
    function renderFrame(index) {
      currentFrameIndex = index;
      let img = images[index];

      if (!img || !img.complete || img.naturalWidth === 0) {
        // Tìm ảnh gần nhất đã nạp
        for (let offset = 1; offset < 20; offset++) {
          const prev = images[Math.max(1, index - offset)];
          if (prev && prev.complete && prev.naturalWidth > 0) {
            img = prev;
            break;
          }
          const next = images[Math.min(TOTAL_FRAMES, index + offset)];
          if (next && next.complete && next.naturalWidth > 0) {
            img = next;
            break;
          }
        }
      }

      if (img && img.complete) {
        drawImageCover(img);
      }
    }

    // Kiểm tra và xác định URL cơ sở nào đang hoạt động
    const probe = new Image();
    probe.onload = () => {
      startPreloading();
    };
    probe.onerror = () => {
      // Thử URL tiếp theo nếu URL đầu thất bại
      for (let i = 1; i < BASE_URLS.length; i++) {
        const nextProbe = new Image();
        nextProbe.onload = () => {
          activeBaseUrl = BASE_URLS[i];
          startPreloading();
        };
        nextProbe.src = getFrameUrl(1, BASE_URLS[i]);
      }
    };
    probe.src = getFrameUrl(1);

    function startPreloading() {
      // Tải khung hình đầu tiên để vẽ ngay
      const firstImg = new Image();
      firstImg.onload = () => {
        images[1] = firstImg;
        loadedFlags[1] = true;
        isCanvasReady = true;
        resizeCanvas();
        renderFrame(1);
      };
      firstImg.src = getFrameUrl(1);

      // Tải tuần tự các khung hình còn lại trong nền
      const batchSize = 6;
      let currentIndex = 2;

      function loadNextBatch() {
        if (currentIndex > TOTAL_FRAMES) return;
        const end = Math.min(TOTAL_FRAMES, currentIndex + batchSize);
        for (let i = currentIndex; i <= end; i++) {
          const img = new Image();
          const frameNum = i;
          img.onload = () => {
            images[frameNum] = img;
            loadedFlags[frameNum] = true;
          };
          img.src = getFrameUrl(frameNum);
        }
        currentIndex = end + 1;
        setTimeout(loadNextBatch, 25);
      }

      setTimeout(loadNextBatch, 50);
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

    function updateScrollExperience() {
      const rect = section.getBoundingClientRect();
      const totalScrollable = section.offsetHeight - window.innerHeight;

      if (totalScrollable <= 0) return;

      // Tính progress từ 0 đến 1
      const currentScroll = -rect.top;
      const progress = Math.max(0, Math.min(1, currentScroll / totalScrollable));

      // 1. Chuyển đổi khung hình 3D từ 1 đến 150 (Ánh xạ đến 85% tiến trình cuộn, 15% còn lại giữ nguyên khung hình 150 tuyệt đẹp)
      const frameProgress = Math.min(1, progress / 0.85);
      const targetFrame = Math.min(TOTAL_FRAMES, Math.max(1, Math.round(frameProgress * (TOTAL_FRAMES - 1)) + 1));
      if (targetFrame !== currentFrameIndex) {
        renderFrame(targetFrame);
      }

      // 2. Tự động mờ dần chuột cuộn khi cuộn về gần cuối để không chèn lên phần tìm kiếm tiếp theo
      const scrollIndicator = document.querySelector(".hero-scroll-indicator");
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
      resizeCanvas();
      updateScrollExperience();
    }, { passive: true });

    // Khởi tạo kích thước ban đầu
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

