// Shared site behavior: mobile nav, footer year, scroll reveals, contact form

document.addEventListener("DOMContentLoaded", () => {
  /* ---- Footer year ---- */
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---- Mobile navigation toggle ---- */
  const toggle = document.querySelector(".nav-toggle");
  const links = document.querySelector(".nav-links");

  if (toggle && links) {
    toggle.addEventListener("click", () => {
      const isOpen = links.classList.toggle("open");
      toggle.classList.toggle("open", isOpen);
      toggle.setAttribute("aria-expanded", String(isOpen));
    });

    // Close the menu after tapping a link
    links.addEventListener("click", (e) => {
      if (e.target.tagName === "A") {
        links.classList.remove("open");
        toggle.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* ---- Dark mode toggle ---- */
  const themeToggle = document.querySelector(".theme-toggle");
  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme");
      const next = current === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("theme", next);
    });
  }

  /* ---- Gentle reveal-on-scroll ---- */
  const revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    revealEls.forEach((el) => observer.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("visible"));
  }

  /* ---- Subtle parallax on hero orbs ---- */
  const orbs = document.querySelectorAll(".hero-orb");
  if (orbs.length && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    let ticking = false;
    window.addEventListener("scroll", () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const y = window.scrollY;
          if (y < 900) {
            orbs.forEach((orb, i) => {
              const speed = (i + 1) * 0.12;
              orb.style.translate = `0 ${y * speed * -1}px`;
            });
          }
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }

  /* ---- Contact form → Supabase ---- */
  const SUPABASE_URL = "https://ehhrzezlpsjdeeaepeyt.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_A8UTW3j495IIy0nrk7YNhg_LIw1Oa-i";

  const form = document.getElementById("contact-form");
  if (form) {
    const submitBtn = form.querySelector('button[type="submit"]');
    const success = document.getElementById("form-success");
    const errorBox = document.getElementById("form-error");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      // `form.name` resolves to the form's own name attribute, so look the inputs up by id
      const name = document.getElementById("name").value.trim();
      const email = document.getElementById("email").value.trim();
      const message = document.getElementById("message").value.trim();

      if (!name || !email || !message) {
        // Native-friendly nudge: let the browser mark required fields
        form.reportValidity();
        return;
      }

      if (success) success.classList.remove("show");
      if (errorBox) errorBox.classList.remove("show");

      const originalLabel = submitBtn ? submitBtn.textContent : "";
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Sending…";
      }

      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/contacts`, {
          method: "POST",
          headers: {
            apikey: SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
            "Content-Type": "application/json",
            Prefer: "return=representation"
          },
          body: JSON.stringify({ name, email, message })
        });

        if (!res.ok) throw new Error(`Supabase insert failed (${res.status})`);

        if (success) {
          success.classList.add("show");
          success.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        form.reset();
      } catch (err) {
        console.error(err);
        if (errorBox) {
          errorBox.classList.add("show");
          errorBox.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalLabel;
        }
      }
    });
  }
});
