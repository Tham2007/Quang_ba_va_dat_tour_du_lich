/**
 * DELTA TRAVEL - GOOGLE MOTION & ANIMATION ENGINE (google-motion.js)
 * Inspired by Google Team USA Showcase (https://sports.withgoogle.com/teamusa/)
 * Buttery smooth scroll-triggered reveals, spring hover micro-interactions, fluid UI
 */

(function () {
  "use strict";

  // Google Standard Easing cubic-bezier(0.2, 0, 0, 1) & Spring Easing cubic-bezier(0.16, 1, 0.3, 1)
  function initGoogleScrollObserver() {
    const observerOptions = {
      root: null,
      rootMargin: "0px 0px -80px 0px",
      threshold: 0.12
    };

    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");
          // Once animated, keep it in view for smooth reading
          observer.unobserve(entry.target);
        }
      });
    }, observerOptions);

    // Apply reveal to sections, cards, and titles
    const elementsToReveal = document.querySelectorAll(
      ".section-header, .feature-card, .dest-card, .testimonial-card, .article-card, .faq-item, .tour-card, .search-box-card"
    );

    elementsToReveal.forEach((el, index) => {
      if (!el.classList.contains("google-fade-up")) {
        el.classList.add("google-fade-up");
        // Add subtle stagger to cards in the same row
        const delayClass = `delay-${(index % 4) + 1}`;
        el.classList.add(delayClass);
      }
      revealObserver.observe(el);
    });
  }

  // Observe dynamically rendered tour cards
  function observeTourCards() {
    const container = document.getElementById("toursContainer");
    if (!container) return;

    const cards = container.querySelectorAll(".tour-card");
    cards.forEach((card, i) => {
      card.classList.add("google-fade-up");
      card.classList.add(`delay-${(i % 4) + 1}`);
      setTimeout(() => {
        card.classList.add("in-view");
      }, 50 * i);
    });
  }

  // Hook into renderTourCards after DOM updates
  function hookTourCatalogMotion() {
    const originalRenderTourCards = window.renderTourCards;
    if (typeof originalRenderTourCards === "function") {
      window.renderTourCards = function () {
        originalRenderTourCards.apply(this, arguments);
        observeTourCards();
      };
    }
  }

  // Fluid button press tactile micro-interaction
  function initTactileInteractions() {
    document.addEventListener("mousedown", (e) => {
      const btn = e.target.closest("button, .btn, .btn-explore-liquid, .filter-pill, .quick-tag-chip, .lang-switch-btn");
      if (btn) {
        btn.style.transition = "transform 0.12s cubic-bezier(0.2, 0, 0, 1)";
        btn.style.transform = "scale(0.96)";
      }
    });

    document.addEventListener("mouseup", (e) => {
      const btn = e.target.closest("button, .btn, .btn-explore-liquid, .filter-pill, .quick-tag-chip, .lang-switch-btn");
      if (btn) {
        btn.style.transform = "";
      }
    });
  }

  // Initialize once DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      initGoogleScrollObserver();
      hookTourCatalogMotion();
      initTactileInteractions();
      setTimeout(observeTourCards, 300);
    });
  } else {
    initGoogleScrollObserver();
    hookTourCatalogMotion();
    initTactileInteractions();
    setTimeout(observeTourCards, 300);
  }
})();

