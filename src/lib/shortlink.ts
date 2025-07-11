// src/lib/shortlink.ts
import type { CollectionEntry } from "astro:content";

const cache = new Map<string, string>();

interface ShortLinkOptions {
  longUrl: string;
  slug?: CollectionEntry<'blog'>['slug'];
}

export async function getShortLink({ longUrl, slug }: ShortLinkOptions): Promise<string | null> {
  const cacheKey = slug || longUrl;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)!;
  }

  const apiEndpoint = import.meta.env.SINK_API_ENDPOINT;
  const apiKey = import.meta.env.SINK_API_KEY;

  if (!apiEndpoint || !apiKey) {
    console.warn("Sink 服务环境变量未完全设置，无法生成短链。");
    return null;
  }

  try {
    const bodyPayload: { url: string; slug?: string } = {
        url: longUrl,
    };

    const sinkSlugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i;
    
    if (slug && sinkSlugRegex.test(slug)) {
      bodyPayload.slug = `blog-${slug}`;
    }

    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(bodyPayload),
    });

    // 核心修改：现在我们接受所有 2xx 的成功状态码 (200 OK 或 201 Created)
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Sink API request failed: ${response.status} - ${errorBody}`);
    }

    const data = await response.json();
    
    const shortUrl = data?.shortLink;

    if (shortUrl) {
      cache.set(cacheKey, shortUrl);
      // console.log(`[Sink] Mapped ${longUrl} -> ${shortUrl}`);
      return shortUrl;
    }
    return null;

  } catch (error) {
    console.error(`Failed to get short link for ${longUrl}:`, error);
    return null;
  }
}