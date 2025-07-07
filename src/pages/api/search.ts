import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { remark } from "remark";
import strip from "strip-markdown";

interface SearchQuery {
  query: string;
  tags?: string[];
  categories?: string[];
}

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  tags: string[];
  categories: string[];
  matchScore: number; // 匹配分数，用于排序
  matchDetails: {
    title: boolean;
    categories: boolean;
    tags: boolean;
    content: boolean;
  };
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json() as SearchQuery;
    const { query, tags, categories } = body;

    if (!query || typeof query !== "string" || query.length < 2) {
      return new Response(
        JSON.stringify({
          error: "Invalid search query. Query must be at least 2 characters long.",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    // 拆分查询关键词（按空格分割）
    const keywords = query.trim().toLowerCase().split(/\s+/).filter((keyword) => keyword.length >= 2);

    if (keywords.length === 0) {
      return new Response(
        JSON.stringify({
          error: "No valid search keywords found. Each keyword must be at least 2 characters long.",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    // 获取所有非草稿文章
    const blogEntries = await getCollection("blog", ({ data }) => {
      return !data.draft;
    });

    // 处理 markdown 内容并提取纯文本
    const processor = remark().use(strip);

    // 过滤和处理文章
    const searchResults = await Promise.all(
      blogEntries
        // 先根据标签和分类过滤
        .filter((entry) => {
          // 如果没有指定标签或分类，则不过滤
          if (!tags?.length && !categories?.length)
            return true;

          // 检查标签匹配
          if (tags?.length) {
            const entryTags = entry.data.tags || [];
            if (!tags.some(tag => entryTags.includes(tag))) {
              return false;
            }
          }

          // 检查分类匹配
          if (categories?.length) {
            const entryCategories = entry.data.categories || [];
            if (!categories.some(category => entryCategories.includes(category))) {
              return false;
            }
          }

          return true;
        })
        // 然后处理每篇文章以提取内容并执行搜索
        .map(async (entry) => {
          const { title, description, tags = [], categories = [] } = entry.data;

          // 将 Markdown 转换为纯文本
          const { value: content } = await processor.process(entry.body);
          const contentText = String(content);

          const lowerCaseTitle = title.toLowerCase();
          const lowerCaseContent = contentText.toLowerCase();
          const lowerCaseTags = tags.map((tag) => tag.toLowerCase());
          const lowerCaseCategories = categories.map((category) => category.toLowerCase());

          // 初始化匹配得分和匹配详情
          let matchScore = 0;
          const matchDetails = {
            title: false,
            categories: false,
            tags: false,
            content: false,
          };

          // 设置各匹配位置的权重
          const TITLE_WEIGHT = 100;
          const CATEGORY_WEIGHT = 50;
          const TAG_WEIGHT = 30;
          const CONTENT_WEIGHT = 10;

          // 选择最佳的内容匹配位置及其上下文
          let bestContentMatchIndex = -1;
          let bestKeywordForContent = "";

          // 检查每个关键词的匹配情况
          for (const keyword of keywords) {
            // 检查标题匹配
            if (lowerCaseTitle.includes(keyword)) {
              matchScore += TITLE_WEIGHT;
              matchDetails.title = true;
            }

            // 检查分类匹配
            const categoryMatch = lowerCaseCategories.some((category) => category.includes(keyword));
            if (categoryMatch) {
              matchScore += CATEGORY_WEIGHT;
              matchDetails.categories = true;
            }

            // 检查标签匹配
            const tagMatch = lowerCaseTags.some((tag) => tag.includes(keyword));
            if (tagMatch) {
              matchScore += TAG_WEIGHT;
              matchDetails.tags = true;
            }

            // 检查内容匹配
            const contentMatchIndex = lowerCaseContent.indexOf(keyword);
            if (contentMatchIndex >= 0) {
              matchScore += CONTENT_WEIGHT;
              matchDetails.content = true;

              // 如果是第一次找到内容匹配，或者这个匹配比以前找到的更好（例如，它出现得更早）
              if (bestContentMatchIndex === -1 || contentMatchIndex < bestContentMatchIndex) {
                bestContentMatchIndex = contentMatchIndex;
                bestKeywordForContent = keyword;
              }
            }
          }

          // 如果没有匹配，返回 null
          if (matchScore === 0) {
            return null;
          }

          // 为匹配的内容创建摘要片段
          let snippet = "";

          if (matchDetails.content && bestContentMatchIndex >= 0) {
            // 使用最佳匹配位置的上下文
            const startIndex = Math.max(0, bestContentMatchIndex - 50);
            const endIndex = Math.min(contentText.length, bestContentMatchIndex + bestKeywordForContent.length + 50);

            snippet = contentText.substring(startIndex, endIndex);

            // 如果摘要不是从内容开头开始，添加省略号
            if (startIndex > 0) {
              snippet = `...${snippet}`;
            }

            // 如果摘要不是在内容末尾结束，添加省略号
            if (endIndex < contentText.length) {
              snippet = `${snippet}...`;
            }
          }
          else if (description) {
            snippet = description;
          }

          // 构建文章的 URL
          const url = `/blog/${entry.slug}`;

          return {
            title,
            url,
            snippet,
            tags,
            categories,
            matchScore,
            matchDetails,
          } as SearchResult;
        }),
    );

    // 过滤掉 null 结果并按匹配得分排序（从高到低）
    const filteredResults = searchResults
      .filter(Boolean)
      .sort((a, b) => {
        if (a && b) {
          return b.matchScore - a.matchScore || a.title.localeCompare(b.title);
        }
        return 0;
      });

    // 构建最终响应
    const formattedResults = filteredResults
      .filter((result): result is SearchResult => result !== null)
      .map((result) => ({
        title: result.title,
        url: result.url,
        snippet: result.snippet,
        tags: result.tags,
        categories: result.categories,
        matchDetails: result.matchDetails,
        keywords,
      }));

    return new Response(JSON.stringify(formattedResults), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
  catch (error) {
    console.error("Error performing search:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to perform search",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }
};
