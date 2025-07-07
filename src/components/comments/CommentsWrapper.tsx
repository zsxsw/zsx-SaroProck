import React, { useState, useEffect, useCallback } from "react";
import * as AV from "leancloud-storage";
import CommentList from "./CommentList";
import CommentForm from "./CommentForm";

// 正确的、仅在客户端执行一次的初始化逻辑
let isLeanCloudInitialized = false;
const initSDK = () => {
  if (isLeanCloudInitialized || typeof window === 'undefined') return;
  try {
    const { PUBLIC_LEANCLOUD_APP_ID, PUBLIC_LEANCLOUD_APP_KEY, PUBLIC_LEANCLOUD_SERVER_URL } = import.meta.env;
    if (PUBLIC_LEANCLOUD_APP_ID && PUBLIC_LEANCLOUD_APP_KEY && PUBLIC_LEANCLOUD_SERVER_URL) {
      AV.init({
        appId: PUBLIC_LEANCLOUD_APP_ID,
        appKey: PUBLIC_LEANCLOUD_APP_KEY,
        serverURL: PUBLIC_LEANCLOUD_SERVER_URL,
      });
      isLeanCloudInitialized = true;
      console.log("LeanCloud SDK Initialized successfully inside useEffect.");
    } else {
      console.error("LeanCloud credentials are not set in environment variables.");
    }
  } catch (error) {
    console.error("Error initializing LeanCloud SDK:", error);
  }
};

// CommentData 接口定义
export interface CommentData {
  id: string;
  nickname: string;
  email: string;
  website?: string;
  content: string;
  createdAt: Date;
  avatar: string;
  likes: number;
  isLiked: boolean;
  parentId?: string;
  level: number;
  commentType: 'blog' | 'telegram';
  identifier: string;
}

interface Props {
  identifier: string;
  commentType: "telegram" | "blog";
  displayMode?: 'full' | 'compact';
}

const CommentsWrapper: React.FC<Props> = ({ identifier, commentType, displayMode = 'full' }) => {
  const [comments, setComments] = useState<CommentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [sdkReady, setSdkReady] = useState(isLeanCloudInitialized);

  const leanCloudClassName = commentType === 'telegram' ? 'TelegramComment' : 'Comment';
  const leanCloudLikeClassName = commentType === 'telegram' ? 'TelegramCommentLike' : 'CommentLike';

  useEffect(() => {
    if (!sdkReady) {
      initSDK();
      setSdkReady(isLeanCloudInitialized);
    }
  }, []);

  const fetchComments = useCallback(async () => {
    if (!sdkReady) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const query = new AV.Query(leanCloudClassName);
      query.equalTo(commentType === 'telegram' ? 'postId' : 'slug', identifier);
      query.addAscending("createdAt");
      query.include("parent");
      const results = await query.find();

      const storedLikes = localStorage.getItem(`comment_likes_${identifier}`);
      const userLikes = storedLikes ? new Set<string>(JSON.parse(storedLikes)) : new Set<string>();
      
      const likeQuery = new AV.Query(leanCloudLikeClassName);
      likeQuery.containedIn('commentId', results.map(c => c.id!));
      const likes = await likeQuery.find();
      const likeCounts = likes.reduce((acc, like) => {
        const commentId = like.get('commentId');
        if(commentId) acc[commentId] = (acc[commentId] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const commentMap = new Map<string, CommentData & { children: CommentData[] }>();
      
      results.forEach(c => {
        if (!c.id) return;
        commentMap.set(c.id, {
          id: c.id, nickname: c.get('nickname'), email: c.get('email'),
          website: c.get('website'), content: c.get('content'),
          createdAt: c.createdAt!, avatar: c.get('avatar'),
          likes: likeCounts[c.id] || 0, isLiked: userLikes.has(c.id),
          parentId: c.get('parent')?.id, level: 0, children: [],
          commentType: commentType, identifier: identifier,
        });
      });
      
      const rootComments: (CommentData & { children: CommentData[] })[] = [];
      commentMap.forEach(comment => {
        if (comment.parentId && commentMap.has(comment.parentId)) {
          const parent = commentMap.get(comment.parentId)!;
          comment.level = parent.level + 1;
          parent.children.push(comment);
        } else {
          rootComments.push(comment);
        }
      });

      const flattenedComments: CommentData[] = [];
      function flatten(comment: CommentData & { children: CommentData[] }) {
        const { children, ...rest } = comment;
        flattenedComments.push(rest);
        children.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        children.forEach(flatten);
      }
      rootComments.forEach(flatten);

      setComments(flattenedComments);
    } catch (error) {
      console.error("Error fetching comments:", error);
    } finally {
      setLoading(false);
    }
  }, [sdkReady, identifier, commentType, leanCloudClassName]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleCommentAdded = useCallback(() => {
    setTimeout(() => { fetchComments(); }, 500);
  }, [fetchComments]);

  const handleLike = useCallback(async (commentId: string) => {
    if (!sdkReady) return;
    
    const user = AV.User.current(); // 假设有用户登录，或用其他方式识别用户
    const storedLikes = localStorage.getItem(`comment_likes_${identifier}`) || '[]';
    const userLikes = new Set<string>(JSON.parse(storedLikes));
    
    const Like = AV.Object.extend(leanCloudLikeClassName);
    const query = new AV.Query(leanCloudLikeClassName);
    query.equalTo('commentId', commentId);
    // query.equalTo('owner', user); // 精确查找该用户的点赞记录

    const existingLike = await query.first();

    try {
      if (existingLike) {
        await existingLike.destroy();
        userLikes.delete(commentId);
      } else {
        const newLike = new Like();
        newLike.set('commentId', commentId);
        // newLike.set('owner', user);
        newLike.set(commentType === 'telegram' ? 'postId' : 'slug', identifier);
        await newLike.save();
        userLikes.add(commentId);
      }
      
      localStorage.setItem(`comment_likes_${identifier}`, JSON.stringify(Array.from(userLikes)));
      // 操作成功后，刷新评论列表以同步点赞数
      fetchComments();

    } catch (error) {
      console.error("Like operation failed:", error);
      // 失败时也刷新一次，以回滚到真实状态
      fetchComments();
    }
  }, [sdkReady, identifier, commentType, leanCloudLikeClassName, fetchComments]);

    return (
    <div className="not-prose">
      {displayMode === 'full' && (
        <>
          <h2 className="text-2xl font-bold mb-8 flex items-center gap-2"><i className="ri-chat-3-line"></i>评论区</h2>
          <div className="divider -mt-2 mb-6"></div>
        </>
      )}
      <CommentForm
        identifier={identifier}
        commentType={commentType}
        onCommentAdded={handleCommentAdded}
        sdkReady={sdkReady}
        displayMode={displayMode}
        loading={loading}
      />
      <CommentList 
        comments={comments} 
        onLike={handleLike}
        onCommentAdded={handleCommentAdded}
        displayMode={displayMode}
        isLoading={loading}
      />
      
      {displayMode === 'full' && (
       <div className="mt-6 text-sm text-right">
        本评论区由 <a href="https://github.com/EveSunMaple" className="text-primary"> EveSunMaple </a> 自主开发
      </div>
      )}
    </div>
  );
};

export default CommentsWrapper;
