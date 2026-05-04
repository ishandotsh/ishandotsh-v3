const { slugify, isProduction } = require("../.eleventy.js");

module.exports = {
  layout: "article.njk",
  contentType: "post",
  eleventyComputed: {
    permalink: (data) => {
      if (isProduction && data.draft) return false;
      return `/posts/${data.slug || slugify(data.title)}/`;
    },
  },
};
