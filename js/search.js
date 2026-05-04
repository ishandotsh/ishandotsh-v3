import Fuse from "./fuse.min.mjs";

(async function () {
  const form = document.querySelector("#search-form");
  const input = document.querySelector("#search-input");
  const results = document.querySelector("#search-results");
  if (!input || !results) return;

  const response = await fetch("/search-index.json");
  const index = await response.json();
  const fuse = new Fuse(index, {
    keys: [
      { name: "title", weight: 0.4 },
      { name: "excerpt", weight: 0.25 },
      { name: "tags", weight: 0.2 },
      { name: "body", weight: 0.15 },
    ],
    threshold: 0.35,
    ignoreLocation: true,
    includeScore: true,
  });

  function formatDate(value) {
    if (!value) return "";
    return new Intl.DateTimeFormat("en", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(value));
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function search(query) {
    return query ? fuse.search(query).slice(0, 20) : [];
  }

  function render(items, query) {
    if (!query) {
      results.innerHTML = "";
      return;
    }
    if (!items.length) {
      results.innerHTML = `<p class="muted">No results for “${escapeHtml(query)}”.</p>`;
      return;
    }
    results.innerHTML = items.map(({ item }) => `
      <article class="search-result">
        <div class="card-meta">
          <span>${item.type === "experiment" ? "⚡ Experiment" : "Post"}</span>
          <time>${formatDate(item.date)}</time>
        </div>
        <h2><a href="${item.url}">${item.title}</a></h2>
        ${item.excerpt ? `<p>${item.excerpt}</p>` : ""}
        <div class="tag-list">${(item.tags || []).map((tag) => `<a class="tag" href="/tags/${tag.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}/">${tag}</a>`).join("")}</div>
      </article>
    `).join("");
  }

  input.addEventListener("input", () => {
    const query = input.value.trim();
    render(search(query), query);
  });

  if (form) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const query = input.value.trim();
      render(search(query), query);
      const url = new URL(window.location.href);
      if (query) {
        url.searchParams.set("q", query);
      } else {
        url.searchParams.delete("q");
      }
      window.history.replaceState({}, "", url);
    });
  }

  const params = new URLSearchParams(window.location.search);
  const q = params.get("q");
  if (q) {
    input.value = q;
    render(search(q), q);
  } else {
    render([], "");
  }
})();
