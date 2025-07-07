import React, { useState, useEffect, useCallback } from 'react';
import * as AV from "leancloud-storage";

// 1. 将初始化逻辑和 SDK 实例完全封装在组件文件内部
let sdkInitPromise: Promise<boolean> | null = null;

const initializeSDK = (): Promise<boolean> => {
 // 如果在非浏览器环境，直接返回失败
 if (typeof window === 'undefined') return Promise.resolve(false);
 
 // 如果已存在初始化任务，直接返回该任务，确保全局只执行一次
 if (sdkInitPromise) return sdkInitPromise;

 sdkInitPromise = new Promise<boolean>((resolve) => {
  try {
   // 如果已初始化（例如被其他组件如评论区抢先初始化），直接成功
   if (AV.applicationId) {
    resolve(true);
    return;
   }
   
   const { PUBLIC_LEANCLOUD_APP_ID, PUBLIC_LEANCLOUD_APP_KEY, PUBLIC_LEANCLOUD_SERVER_URL } = import.meta.env;
   if (PUBLIC_LEANCLOUD_APP_ID && PUBLIC_LEANCLOUD_APP_KEY && PUBLIC_LEANCLOUD_SERVER_URL) {
    AV.init({
     appId: PUBLIC_LEANCLOUD_APP_ID,
     appKey: PUBLIC_LEANCLOUD_APP_KEY,
     serverURL: PUBLIC_LEANCLOUD_SERVER_URL,
    });
    console.log("LeanCloud SDK Initialized by a component.");
    resolve(true);
   } else {
    console.error("LikeButton: LeanCloud credentials not set.");
    resolve(false);
   }
  } catch (error) {
   console.error("LikeButton: SDK Init Error:", error);
   resolve(false);
  }
 });
 return sdkInitPromise;
};

const getAnonymousId = (): string => {
 if (typeof window === 'undefined') return 'ssr-user';
 let anonId = localStorage.getItem('anonymous_id');
 if (!anonId) {
  anonId = `anon_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  localStorage.setItem('anonymous_id', anonId);
 }
 return anonId;
};


interface Props {
  postId: string;
}

const LikeButton: React.FC<Props> = ({ postId }) => {
  const [likeCount, setLikeCount] = useState<number>(0);
  const [hasLiked, setHasLiked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);

  const storageKey = `liked_posts`;

  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      const isReady = await initializeSDK();
      if (!isMounted) return;
      
      setSdkReady(isReady);
      if (!isReady) {
        setIsLoading(false);
        return;
      }

      // --- 关键改动 1: 修改数据获取逻辑 ---
      // 从查询多条记录的 count，变为查询单条记录的 likes 字段
      try {
        const query = new AV.Query("PostLikes"); // 查询新的 PostLikes Class
        query.equalTo("postId", postId);
        const postStats = await query.first(); // 获取该 postId 对应的唯一记录

        if (isMounted) {
          if (postStats) {
            setLikeCount(postStats.get('likes') || 0); // 设置点赞数为记录中的 likes 值
          } else {
            setLikeCount(0); // 如果记录不存在，点赞数为 0
          }
        }
      } catch (error) {
        console.error(`Failed to fetch likes for post ${postId}:`, error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    run();

    // 本地状态的读取逻辑保持不变
    const likedPosts = JSON.parse(localStorage.getItem(storageKey) || '[]');
    if (likedPosts.includes(postId)) {
      setHasLiked(true);
    }

    return () => { isMounted = false; }
  }, [postId]);

  const handleClick = async () => {
    if (isSubmitting || !sdkReady) return;
    setIsSubmitting(true);
    const newLikedState = !hasLiked;

    // 乐观更新 UI (保持不变)
    setHasLiked(newLikedState);
    setLikeCount(prevCount => (newLikedState ? prevCount + 1 : Math.max(0, prevCount - 1)));

    // 更新本地存储 (保持不变)
    const likedPosts = new Set<string>(JSON.parse(localStorage.getItem(storageKey) || '[]'));
    if (newLikedState) likedPosts.add(postId);
    else likedPosts.delete(postId);
    localStorage.setItem(storageKey, JSON.stringify(Array.from(likedPosts)));
    
    // --- 关键改动 2: 修改后台数据同步逻辑 ---
    // 从创建/删除记录，变为增加/减少计数值
    try {
      const query = new AV.Query("PostLikes");
      query.equalTo("postId", postId);
      let postStats = await query.first();

      // 如果记录不存在，并且是点赞操作，则创建新记录
      if (!postStats && newLikedState) {
        const PostLikes = AV.Object.extend("PostLikes");
        postStats = new PostLikes();
        postStats.set("postId", postId);
        postStats.set("likes", 0); // 初始点赞数为 0
      }

      if (postStats) {
        // 使用原子化操作 increment，安全地增加或减少
        // 点赞则 +1，取消点赞则 -1
        (postStats as AV.Object).increment("likes", newLikedState ? 1 : -1);
        await (postStats as AV.Object).save();
      }

    } catch (error) {
      console.error("Failed to submit like:", error);
      // 回滚 UI (保持不变)
      setHasLiked(!newLikedState);
      setLikeCount(prevCount => (newLikedState ? prevCount - 1 : prevCount + 1));
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- 按钮渲染部分保持不变 ---
  const buttonClasses = `btn btn-ghost btn-xs gap-1 text-base-content/60 ${hasLiked ? "text-primary" : ""}`;
  const isDisabled = isLoading || isSubmitting;

  if (isLoading) {
    return (
      <button className={buttonClasses}>
        <span className="loading loading-spinner loading-xs"></span>
      </button>
    )
  }

  return (
    <button className={buttonClasses} onClick={handleClick} disabled={isDisabled}>
      {isSubmitting ? (
        <span className="loading loading-spinner loading-xs"></span>
      ) : (
        <i className={`${hasLiked ? "ri-heart-fill" : "ri-heart-line"} text-lg`}></i>
      )}
      {likeCount > 0 && <span>{likeCount}</span>}
    </button>
  );
};

export default LikeButton;