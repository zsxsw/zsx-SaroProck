import type { APIContext, GetStaticPaths } from "astro";
import fs from "node:fs";
import { type CollectionEntry, getCollection } from "astro:content";
import satori from "satori";
import sharp from "sharp";

export const prerender = true;

export const getStaticPaths: GetStaticPaths = async () => {
  const posts = await getCollection("blog");
  return posts.map((post) => ({
    params: { slug: post.slug },
    props: { post }, // Pass entire post data to GET function
  }));
};

export async function GET({ props }: APIContext<{ post: CollectionEntry<"blog"> }>) {
  const { post } = props;
  const fontRegular = fs.readFileSync("public/fonts/NotoSansSC-Regular.ttf");
  const fontBold = fs.readFileSync("public/fonts/NotoSansSC-Bold.ttf");
  const iconBuffer = fs.readFileSync("public/avatar.png");
  const iconBase64 = `data:image/png;base64,${iconBuffer.toString("base64")}`; // Changed from svg+xml to png

  const descText = post.data.description && post.data.description.length > 120
    ? `${post.data.description.slice(0, 120)}…`
    : post.data.description || "";

  const svg = await satori(
    {
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
          fontFamily: "Noto Sans SC",
          position: "relative",
        },
        children: [
          // Top Logo + Site Name
          {
            type: "div",
            props: {
              style: { display: "flex", alignItems: "center", gap: "20px" },
              children: [
                {
                  type: "img",
                  props: {
                    src: iconBase64,
                    width: "50",
                    height: "50",
                  },
                },
                {
                  type: "div",
                  props: {
                    style: { fontSize: "28px", fontWeight: 600 },
                    children: "ZSX的小站",
                  },
                },
              ],
            },
          },
          // Middle Title + Description
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
              ].filter(Boolean), // Filter out falsy values (like false from conditional)
            },
          },
          // Bottom Categories & Tags
          {
            type: "div",
            props: {
              style: { display: "flex", gap: "12px", flexWrap: "wrap" },
              children: [
                ...(post.data.categories || []).map(cat => ({
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
                ...(post.data.tags || []).map(tag => ({
                  type: "div",
                  props: {
                    style: {
                      padding: "6px 16px",
                      background: "linear-gradient(135deg, #10b981, #06b6d4)",
                      borderRadius: "999px",
                      fontSize: "20px",
                    },
                    children: tag,
                  },
                })),
              ],
            },
          },
          // SVG Decoration
          {
            type: "svg",
            props: {
              width: "1200",
              height: "630",
              style: { position: "absolute", top: 0, left: 0, zIndex: -1 },
              children: [
                {
                  type: "defs",
                  props: {
                    children: [
                      {
                        type: "pattern",
                        props: {
                          id: "grid",
                          width: "40",
                          height: "40",
                          patternUnits: "userSpaceOnUse",
                          children: [
                            {
                              type: "path",
                              props: {
                                d: "M 40 0 L 0 0 0 40",
                                fill: "none",
                                stroke: "rgba(255,255,255,0.05)",
                                strokeWidth: "1",
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
                {
                  type: "rect",
                  props: {
                    width: "100%",
                    height: "100%",
                    fill: "url(#grid)",
                  },
                },
              ],
            },
          },
        ].filter(Boolean), // Filter out falsy values
      },
    },
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: "Noto Sans SC", data: fontRegular, weight: 400, style: "normal" },
        { name: "Noto Sans SC", data: fontBold, weight: 700, style: "normal" },
      ],
    },
  );

  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return new Response(png, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
