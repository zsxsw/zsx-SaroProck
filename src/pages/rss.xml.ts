import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import { marked } from "marked";

export async function GET(context: any) {
  const allPosts = await getCollection("blog");
  // Filter out draft posts in production mode
  const posts = import.meta.env.PROD ? allPosts.filter(post => !post.data.draft) : allPosts;
  const sortedPosts = posts.sort((a: any, b: any) => new Date(b.data.pubDate).getTime() - new Date(a.data.pubDate).getTime());

  function replacePath(content: string, siteUrl: string): string {
    return content.replace(/(src|img|r|l)="([^"]+)"/g, (match, attr, src) => {
      if (!src.startsWith("http") && !src.startsWith("//") && !src.startsWith("data:")) {
        return `${attr}="${new URL(src, siteUrl).toString()}"`;
      }
      return match;
    });
  }

  const items = await Promise.all(sortedPosts.map(async (blog: any) => {
    const { data: { title, description, pubDate }, body, slug } = blog;

    const content = body
      ? replacePath(await marked(body), context.site)
      : "No content available.";

    const postURL = new URL(`/blog/${slug}/`, context.site);

    return {
      title,
      description,
      link: postURL.toString(),
      guid: postURL.toString(),
      // 注意：这里的 content 字段会被 Astro 用于 <content:encoded> 标签
      // 而不是用于主要的 <description>。我们将 description 留作纯文本摘要。
      content,
      // pubDate 将被 Astro 自动处理，我们不需要在 customData 中重复
      pubDate: new Date(pubDate),
      customData: `<dc:creator><![CDATA[サン猫の時間漂流  ]]></dc:creator>`,
    };
  }));

  return rss({
    title: "サン猫の時間漂流",
    description: "一个孤独的地方，散落着一个人的人生碎片",
    site: context.site,
    items,
    // --- 新增代码在这里 ---
    // 添加 XSL 样式表链接。文件需要放在 /public 目录下。
    stylesheet: "/rss.xsl",
    // --- 新增代码结束 ---
    customData: `
      <language>zh-CN</language>
      <atom:link href="${new URL(context.url.pathname, context.site)}" rel="self" type="application/rss+xml" />
    `,
    xmlns: {
      dc: "http://purl.org/dc/elements/1.1/",
      content: "http://purl.org/rss/1.0/modules/content/",
      atom: "http://www.w3.org/2005/Atom",
    },
    // 注意：这里的 version: "2.0" 是不需要的，@astrojs/rss 默认就是 2.0
  });
}
