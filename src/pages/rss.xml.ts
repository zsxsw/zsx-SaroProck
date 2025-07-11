import rss from "@astrojs/rss";
import { marked } from "marked";
import { getAllPostsWithShortLinks } from "@/lib/blog"; // 1. 引入新的数据源

export async function GET(context: any) {
  if (!context.site) {
    throw new Error('A `site` property is required in your astro.config.mjs for this RSS feed to work.');
  }

  // 2. 从中央模块获取所有文章及其短链接
  const posts = await getAllPostsWithShortLinks(context.site);

  // 3. 保留您原有的、用于修复图片路径的函数
  function replacePath(content: string, siteUrl: string): string {
    return content.replace(/(src|href)="([^"]+)"/g, (match, attr, value) => {
      // 只处理相对路径，不对 http, https, //, data: 等开头的链接做处理
      if (!/^(https?:)?\/\//.test(value) && !value.startsWith("data:")) {
        try {
          return `${attr}="${new URL(value, siteUrl).toString()}"`;
        } catch (e) {
          // 如果 URL 无效，则保持原样
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
      customData: `<dc:creator><![CDATA[サン猫の時間漂流]]></dc:creator>`,
    };
  }));

  return rss({
    title: "サン猫の時間漂流",
    description: "一个孤独的地方，散落着一个人的人生碎片",
    site: context.site.toString(),
    items,
    stylesheet: "/rss.xsl",
    customData: `
      <language>zh-CN</language>
      <atom:link href="${new URL(context.url.pathname, context.site)}" rel="self" type="application/rss+xml" />
      <image>
        <url>${new URL('/favicon.ico', context.site).toString()}</url>
        <title>サン猫の時間漂流</title>
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