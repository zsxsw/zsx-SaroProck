// src/pages/api/comments.ts
import type { APIContext } from 'astro';
import { initLeanCloud } from '@/lib/leancloud.server';
import { getAdminUser } from '@/lib/auth';
import AV from 'leancloud-storage';
import { JSDOM } from 'jsdom';
import DOMPurify from 'dompurify';
import { marked } from "marked";

// 初始化 LeanCloud (仅在服务器端)
initLeanCloud();

const window = new JSDOM('').window;
const dompurify = DOMPurify(window as any);

// GET: 获取评论
export async function GET({ request }: APIContext): Promise<Response> {
  const url = new URL(request.url);
  const identifier = url.searchParams.get('identifier');
  const commentType = url.searchParams.get('commentType') || 'blog';
  const deviceId = url.searchParams.get('deviceId'); // 新增：获取设备ID

  if (!identifier) {
    return new Response(JSON.stringify({ error: 'Missing identifier' }), { status: 400 });
  }

  try {
    const leanCloudClassName = commentType === 'telegram' ? 'TelegramComment' : 'Comment';
    const leanCloudLikeClassName = commentType === 'telegram' ? 'TelegramCommentLike' : 'CommentLike';
    
    // 1. 获取所有评论
    const query = new AV.Query(leanCloudClassName);
    query.equalTo(commentType === 'telegram' ? 'postId' : 'slug', identifier);
    query.addAscending("createdAt");
    query.include("parent");
    const results = await query.find();
    
    const commentIds = results.map(c => c.id!);
    if (commentIds.length === 0) {
        return new Response(JSON.stringify([]), { status: 200 });
    }

    // 2. 一次性获取所有相关点赞记录
    const likeQuery = new AV.Query(leanCloudLikeClassName);
    likeQuery.containedIn('commentId', commentIds);
    const likes = await likeQuery.find();

    // 3. 计算每条评论的点赞数
    const likeCounts = new Map<string, number>();
    likes.forEach(like => {
        const commentId = like.get('commentId');
        likeCounts.set(commentId, (likeCounts.get(commentId) || 0) + 1);
    });

    // 4. 确定当前设备点赞了哪些评论
    const userLikedSet = new Set<string>();
    if (deviceId) {
        likes.forEach(like => {
            if (like.get('deviceId') === deviceId) {
                userLikedSet.add(like.get('commentId'));
            }
        });
    }
    
    // 5. 组合最终数据
    const comments = results.map(c => {
        const commentId = c.id!;
        const commentJSON = c.toJSON();
        return {
            ...commentJSON,
            id: commentId, // 确保 id 字段存在
            likes: likeCounts.get(commentId) || 0,
            isLiked: userLikedSet.has(commentId),
        };
    });
    
    return new Response(JSON.stringify(comments), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error("Error fetching comments from backend:", error);
    return new Response(JSON.stringify({ error: 'Failed to fetch comments' }), { status: 500 });
  }
}


// POST: 提交新评论
export async function POST(context: APIContext): Promise<Response> {
  const { request } = context;
  try {
    const data = await request.json();
    const { identifier, commentType, content, parentId, userInfo } = data;
    
    if (!identifier || !content) {
        return new Response(JSON.stringify({ success: false, message: '缺少必要参数' }), { status: 400 });
    }

    const adminUser = getAdminUser(context);

    let finalUser;
    if (adminUser) {
        // 如果是管理员 (通过cookie验证)
        finalUser = {
            nickname: adminUser.nickname,
            email: adminUser.email,
            website: 'https://www.saroprock.com', // 您的网站
            avatar: 'https://www.saroprock.com/avatar.webp',
            isAdmin: true,
        };
    } else {
        // 如果是普通用户
        if (!userInfo || !userInfo.nickname || !userInfo.email) {
            return new Response(JSON.stringify({ success: false, message: '普通用户需要提供用户信息' }), { status: 400 });
        }
        finalUser = {
            nickname: userInfo.nickname,
            email: userInfo.email,
            website: userInfo.website || null,
            avatar: userInfo.avatar, // 前端应已生成好头像URL
            isAdmin: false,
        };
    }

    const leanCloudClassName = commentType === 'telegram' ? 'TelegramComment' : 'Comment';
    const Comment = AV.Object.extend(leanCloudClassName);
    const comment = new Comment();

    // 安全处理：清理 HTML
    const rawHtml = await marked(content);
    const cleanHtml = dompurify.sanitize(rawHtml);
    
    comment.set('nickname', finalUser.nickname);
    comment.set('email', finalUser.email);
    comment.set('website', finalUser.website);
    comment.set('avatar', finalUser.avatar);
    comment.set('content', cleanHtml);
    comment.set(commentType === 'telegram' ? 'postId' : 'slug', identifier);
    comment.set('isAdmin', finalUser.isAdmin); // 可以加一个字段来标识管理员评论

    if (parentId) {
      const parentPointer = AV.Object.createWithoutData(leanCloudClassName, parentId);
      comment.set('parent', parentPointer);
    }

    const savedComment = await comment.save();

    return new Response(JSON.stringify({ success: true, comment: savedComment.toJSON() }), { status: 201 });

  } catch (error) {
    console.error("Error submitting comment from backend:", error);
    return new Response(JSON.stringify({ success: false, message: '服务器内部错误' }), { status: 500 });
  }
}