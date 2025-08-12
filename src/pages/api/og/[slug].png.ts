import type { APIContext } from "astro";
import fs from "node:fs";
import { getCollection } from "astro:content";
import satori from "satori";
import sharp from "sharp";

export async function GET({ params }: APIContext) {
  const posts = await getCollection("blog");
  const { slug } = params;
  if (!slug)
    return new Response("Slug is required", { status: 400 });

  const post = posts.find(p => p.slug === slug);
  if (!post)
    return new Response("Post not found", { status: 404 });

  // 加载字体和 favicon
  const fontRegular = fs.readFileSync("public/fonts/NotoSansSC-Regular.ttf");
  const fontBold = fs.readFileSync("public/fonts/NotoSansSC-Bold.ttf");
  const iconBuffer = fs.readFileSync("public/favicon-dark.svg");
  const iconBase64 = `data:image/svg+xml;base64,${iconBuffer.toString("base64")}`;

  const descText = post.data.description?.length > 120
    ? `${post.data.description.slice(0, 120)}…`
    : post.data.description || "";

  const categories: string[] = post.data.categories || [];
  const tags: string[] = post.data.tags || [];

  const template = {
    type: "div",
    props: {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "60px",
        background: "linear-gradient(135deg, #0f172a, #1e293b)",
        color: "#fff",
        fontFamily: "\"Noto Sans SC\"",
        position: "relative",
      },
      children: [
        // 顶部 Logo + 站点名
        {
          type: "div",
          props: {
            style: { display: "flex", alignItems: "center", gap: "20px" },
            children: [
              {
                type: "img",
                props: {
                  src: iconBase64,
                  width: 50,
                  height: 50,
                },
              },
              {
                type: "div",
                props: { style: { fontSize: "28px", fontWeight: 600 }, children: "サン猫の時間漂流" },
              },
            ],
          },
        },
        // 中间标题 + 描述
        {
          type: "div",
          props: {
            style: { display: "flex", flexDirection: "column", gap: "20px" },
            children: [
              {
                type: "div",
                props: {
                  style: { fontSize: "60px", fontWeight: 700, lineHeight: "1.2" },
                  children: post.data.title,
                },
              },
              descText && {
                type: "div",
                props: {
                  style: {
                    fontSize: "26px",
                    fontWeight: 400,
                    color: "rgba(255,255,255,0.8)",
                    maxWidth: "900px",
                  },
                  children: descText,
                },
              },
            ],
          },
        },
        // 底部 分类 & 标签
        {
          type: "div",
          props: {
            style: { display: "flex", gap: "12px", flexWrap: "wrap" },
            children: [
              ...categories.map(cat => ({
                type: "div",
                props: {
                  style: {
                    padding: "6px 16px",
                    background: "linear-gradient(135deg, #8b5cf6, #3b82f6)",
                    borderRadius: "999px",
                    fontSize: "20px",
                  },
                  children: cat,
                },
              })),
              ...tags.map(tag => ({
                type: "div",
                props: {
                  style: {
                    padding: "6px 16px",
                    background: "linear-gradient(135deg, #10b981, #06b6d4)",
                    borderRadius: "999px",
                    fontSize: "20px",
                  },
                  children: `${tag}`,
                },
              })),
            ],
          },
        },
        // SVG 装饰
        {
          type: "svg",
          props: {
            width: "1200",
            height: "630",
            style: { position: "absolute", top: 0, left: 0, zIndex: -1 },
            children: [
              {
                type: "rect",
                props: {
                  width: "100%",
                  height: "100%",
                  fill: "url(#grid)",
                },
              },
              {
                type: "defs",
                props: {
                  children: [
                    {
                      type: "pattern",
                      props: {
                        id: "grid",
                        width: 40,
                        height: 40,
                        patternUnits: "userSpaceOnUse",
                        children: [
                          { type: "path", props: { d: "M 40 0 L 0 0 0 40", fill: "none", stroke: "rgba(255,255,255,0.05)", strokeWidth: 1 } },
                        ],
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  };

  const svg = await satori(template, {
    width: 1200,
    height: 630,
    fonts: [
      { name: "Noto Sans SC", data: fontRegular, weight: 400, style: "normal" },
      { name: "Noto Sans SC", data: fontBold, weight: 700, style: "normal" },
    ],
  });

  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return new Response(png, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
