import rss from "@astrojs/rss";
import { marked } from "marked";
import { getAllPostsWithShortLinks } from "@/lib/blog";

export const prerender = true;

export async function GET(context: any) {
  if (!context.site) {
    throw new Error("A `site` property is required in your astro.config.mjs for this RSS feed to work.");
  }

  const posts = await getAllPostsWithShortLinks(context.site);

  function replacePath(content: string, siteUrl: string): string {
    return content.replace(/(src|href)="([^"]+)"/g, (match, attr, value) => {
      if (!/^https?:\/\/|^\/\//.test(value) && !value.startsWith("data:")) {
        try {
          return `${attr}="${new URL(value, siteUrl).toString()}"`;
        }
        catch {
          return match;
        }
      }
      return match;
    });
  }

  const items = await Promise.all(posts.map(async (post) => {
    const { data: { title, description, pubDate } } = post;

    const content = post.body
      ? replacePath(await marked.parse(post.body), context.site)
      : "No content available.";

    return {
      title,
      description,
      link: post.shortLink || post.longUrl,
      guid: post.longUrl,
      content,
      pubDate: new Date(pubDate),
      customData: `<dc:creator><![CDATA[ZSX的小站]]></dc:creator>`,
    };
  }));

  return rss({
    title: "ZSX的小站",
    description: "一个孤独的地方，散落着一个人的人生碎片",
    site: context.site.toString(),
    items,
    stylesheet: "/rss.xsl",
    customData: `
      <language>zh-CN</language>
      <atom:link href="${new URL(context.url.pathname, context.site)}" rel="self" type="application/rss+xml" />
      <image>
        <url>${new URL("https://img.314926.xyz/images/2025/09/20/zsx-avatar.webp", context.site).toString()}</url>
        <title>ZSX的小站</title>
        <link>${context.site}</link>
      </image>
    `,
    xmlns: {
      dc: "http://purl.org/dc/elements/1.1/",
      content: "http://purl.org/rss/1.0/modules/content/",
      atom: "http://www.w3.org/2005/Atom",
    },
  });
}
