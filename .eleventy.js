const syntaxHighlight = require("@11ty/eleventy-plugin-syntaxhighlight");
const pluginRss = require("@11ty/eleventy-plugin-rss");

const isProduction = process.env.NODE_ENV === "production";

function slugify(value = "") {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function stripHtml(value = "") {
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeAttribute(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function normalizeTweetUrl(value = "") {
  const rawValue = String(value).trim();
  const withProtocol = /^https?:\/\//i.test(rawValue) ? rawValue : `https://${rawValue}`;
  const parsed = new URL(withProtocol);
  const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();

  if (!new Set(["x.com", "twitter.com"]).has(host)) {
    throw new Error(`tweet shortcode only supports x.com or twitter.com URLs: ${rawValue}`);
  }

  const match = parsed.pathname.match(/^\/([^/]+)\/status(?:es)?\/(\d+)/i);
  if (!match) {
    throw new Error(`tweet shortcode expected a tweet status URL: ${rawValue}`);
  }

  return `https://twitter.com/${match[1]}/status/${match[2]}`;
}

function normalizeGithubRepoUrl(value = "") {
  const rawValue = String(value).trim();
  const withProtocol = /^https?:\/\//i.test(rawValue) ? rawValue : `https://${rawValue}`;
  const parsed = new URL(withProtocol);
  const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();

  if (host !== "github.com") {
    throw new Error(`github shortcode only supports github.com URLs: ${rawValue}`);
  }

  const match = parsed.pathname.match(/^\/([^/]+)\/([^/]+)/);
  if (!match) {
    throw new Error(`github shortcode expected a repository URL: ${rawValue}`);
  }

  const owner = match[1];
  const repo = match[2].replace(/\.git$/i, "");
  return {
    owner,
    repo,
    name: `${owner}/${repo}`,
    url: `https://github.com/${owner}/${repo}`,
  };
}

function isVisible(item) {
  return !isProduction || !item.data.draft;
}

function isExternalUrl(href = "", siteUrl = "") {
  try {
    const url = new URL(href);
    if (!new Set(["http:", "https:"]).has(url.protocol)) return false;
    if (!siteUrl) return true;

    const site = new URL(siteUrl);
    const normalizeHost = (host) => host.replace(/^www\./i, "").toLowerCase();
    return normalizeHost(url.hostname) !== normalizeHost(site.hostname);
  } catch {
    return false;
  }
}

function externalLinks(value = "", siteUrl = "") {
  return String(value).replace(/<a\b([^>]*)>/gi, (tag, attrs) => {
    const hrefMatch = attrs.match(/\shref\s*=\s*(["'])(.*?)\1/i) || attrs.match(/\shref\s*=\s*([^\s>]+)/i);
    if (!hrefMatch) return tag;

    const href = hrefMatch[2] || hrefMatch[1];
    if (!isExternalUrl(href, siteUrl)) return tag;

    let nextAttrs = attrs;
    if (/\starget\s*=/i.test(nextAttrs)) {
      nextAttrs = nextAttrs.replace(/\starget\s*=\s*(["'])(.*?)\1/i, ' target="_blank"');
    } else {
      nextAttrs += ' target="_blank"';
    }

    const relTokens = new Set(["noopener", "noreferrer"]);
    const relMatch = nextAttrs.match(/\srel\s*=\s*(["'])(.*?)\1/i);
    if (relMatch) {
      relMatch[2].split(/\s+/).filter(Boolean).forEach((token) => relTokens.add(token));
      nextAttrs = nextAttrs.replace(relMatch[0], ` rel="${[...relTokens].join(" ")}"`);
    } else {
      nextAttrs += ' rel="noopener noreferrer"';
    }

    return `<a${nextAttrs}>`;
  });
}

function byDateDesc(a, b) {
  return new Date(b.data.date || 0) - new Date(a.data.date || 0);
}

module.exports = function (eleventyConfig) {
  eleventyConfig.addPlugin(pluginRss);
  eleventyConfig.addPlugin(syntaxHighlight, {
    preAttributes: {
      tabindex: 0,
      "data-language": ({ language }) => language || "text",
    },
    errorOnInvalidLanguage: false,
  });

  eleventyConfig.addPassthroughCopy("css");
  eleventyConfig.addPassthroughCopy("js");
  eleventyConfig.addPassthroughCopy({ "node_modules/fuse.js/dist/fuse.min.mjs": "js/fuse.min.mjs" });
  eleventyConfig.addPassthroughCopy("assets");
  eleventyConfig.addPassthroughCopy("favicon.ico");
  eleventyConfig.addPassthroughCopy("favicon.svg");
  eleventyConfig.addPassthroughCopy({ "sessions/**/*.html": "sessions" });
  // Preserve old blog markdown image paths like ../assets/images/foo.png from /posts/:slug/.
  eleventyConfig.addPassthroughCopy({ "assets/images": "posts/assets/images" });
  eleventyConfig.addPassthroughCopy("CNAME");

  eleventyConfig.addFilter("slug", slugify);
  eleventyConfig.addFilter("stripHtml", stripHtml);
  eleventyConfig.addFilter("jsonify", (value) => JSON.stringify(value));
  eleventyConfig.addFilter("dateDisplay", (value) => {
    if (!value) return "";
    return new Intl.DateTimeFormat("en", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    }).format(new Date(value));
  });
  eleventyConfig.addFilter("dateIso", (value) => value ? new Date(value).toISOString() : "");
  eleventyConfig.addFilter("dateYmd", (value) => value ? new Date(value).toISOString().slice(0, 10) : "");
  eleventyConfig.addFilter("externalLinks", externalLinks);
  eleventyConfig.addShortcode("tweet", (url) => {
    const tweetUrl = escapeAttribute(normalizeTweetUrl(url));
    return `<div class="tweet-embed"><blockquote class="twitter-tweet" data-theme="dark" data-dnt="true"><a href="${tweetUrl}"></a></blockquote></div>`;
  });
  eleventyConfig.addShortcode("github", (url, description = "") => {
    const repo = normalizeGithubRepoUrl(url);
    const repoName = escapeHtml(repo.name);
    const repoUrl = escapeAttribute(repo.url);
    const repoDescription = description
      ? escapeHtml(description)
      : "View the repository on GitHub.";

    return `<a class="github-card" href="${repoUrl}">
  <span class="github-card-icon" aria-hidden="true">
    <svg viewBox="0 0 16 16" width="24" height="24" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82A7.65 7.65 0 0 1 8 3.87c.68 0 1.36.09 2 .26 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"></path></svg>
  </span>
  <span class="github-card-content">
    <span class="github-card-eyebrow">GitHub repository</span>
    <strong>${repoName}</strong>
    <span>${repoDescription}</span>
  </span>
</a>`;
  });
  eleventyConfig.addShortcode("video", (src, caption = "") => {
    const videoSrc = escapeAttribute(src);
    const videoCaption = caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : "";

    return `<figure class="video-embed">
  <video controls playsinline preload="metadata">
    <source src="${videoSrc}" type="video/mp4">
    <a href="${videoSrc}">Download video</a>
  </video>
  ${videoCaption}
</figure>`;
  });
  eleventyConfig.addTransform("loadTwitterWidgets", function (content) {
    if (
      this.page.outputPath &&
      this.page.outputPath.endsWith(".html") &&
      content.includes('class="twitter-tweet"') &&
      !content.includes("platform.twitter.com/widgets.js")
    ) {
      return content.replace(
        "</body>",
        '  <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>\n  </body>'
      );
    }
    return content;
  });
  eleventyConfig.addFilter("filterByTag", (items, tag) =>
    (items || []).filter((item) => (item.data.tags || []).includes(tag))
  );
  eleventyConfig.addFilter("seriesNeighbors", (posts, currentUrl) => {
    const current = (posts || []).find((post) => post.url === currentUrl);
    if (!current || !current.data.series) return null;
    const seriesPosts = posts
      .filter((post) => post.data.series === current.data.series)
      .sort((a, b) => {
        const order = (a.data.seriesOrder || 0) - (b.data.seriesOrder || 0);
        if (order !== 0) return order;
        return new Date(a.data.date || 0) - new Date(b.data.date || 0);
      });
    const index = seriesPosts.findIndex((post) => post.url === currentUrl);
    return {
      previous: index > 0 ? seriesPosts[index - 1] : null,
      next: index >= 0 && index < seriesPosts.length - 1 ? seriesPosts[index + 1] : null,
    };
  });


  eleventyConfig.addCollection("posts", (collectionApi) =>
    collectionApi.getFilteredByGlob("posts/**/*.md").filter(isVisible).sort(byDateDesc)
  );
  eleventyConfig.addCollection("experiments", (collectionApi) =>
    collectionApi.getFilteredByGlob("experiments/**/*.md").filter(isVisible).sort(byDateDesc)
  );
  eleventyConfig.addCollection("allContent", (collectionApi) => {
    const posts = collectionApi.getFilteredByGlob("posts/**/*.md");
    const experiments = collectionApi.getFilteredByGlob("experiments/**/*.md");
    return [...posts, ...experiments].filter(isVisible).sort(byDateDesc);
  });
  eleventyConfig.addCollection("allTags", (collectionApi) => {
    const tags = new Set();
    const posts = collectionApi.getFilteredByGlob("posts/**/*.md");
    const experiments = collectionApi.getFilteredByGlob("experiments/**/*.md");
    [...posts, ...experiments].filter(isVisible).forEach((item) => {
      (item.data.tags || []).forEach((tag) => tags.add(tag));
    });
    return [...tags].sort((a, b) => a.localeCompare(b));
  });

  return {
    dir: {
      input: ".",
      includes: "_includes",
      data: "_data",
      output: "_site",
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    templateFormats: ["md", "njk", "html"],
  };
};

module.exports.slugify = slugify;
module.exports.isProduction = isProduction;
