const { slugify, isProduction } = require("../.eleventy.js");

module.exports = {
  layout: "article.njk",
  contentType: "experiment",
  eleventyComputed: {
    permalink: (data) => {
      if (isProduction && data.draft) return false;
      return `/experiments/${data.slug || slugify(data.title)}/`;
    },
  },
};
