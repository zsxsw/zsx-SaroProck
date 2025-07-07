import React, { useState, useEffect, useRef } from 'react';
import * as AV from "leancloud-storage";
import confetti from 'canvas-confetti';

// SDK 初始化逻辑与之前完全相同，无需修改
let sdkInitPromise: Promise<boolean> | null = null;
const initializeSDK = (): Promise<boolean> => {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (sdkInitPromise) return sdkInitPromise;
  sdkInitPromise = new Promise<boolean>((resolve) => {
    try {
      if (AV.applicationId) { resolve(true); return; }
      const { PUBLIC_LEANCLOUD_APP_ID, PUBLIC_LEANCLOUD_APP_KEY, PUBLIC_LEANCLOUD_SERVER_URL } = import.meta.env;
      if (PUBLIC_LEANCLOUD_APP_ID && PUBLIC_LEANCLOUD_APP_KEY && PUBLIC_LEANCLOUD_SERVER_URL) {
        AV.init({
          appId: PUBLIC_LEANCLOUD_APP_ID,
          appKey: PUBLIC_LEANCLOUD_APP_KEY,
          serverURL: PUBLIC_LEANCLOUD_SERVER_URL,
        });
        resolve(true);
      } else { resolve(false); }
    } catch (error) { resolve(false); }
  });
  return sdkInitPromise;
};

interface Props {
  postId: string;
}

const BlogLikeButton: React.FC<Props> = ({ postId }) => {
  const [likeCount, setLikeCount] = useState<number>(0);
  const [hasLiked, setHasLiked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  
  const [isClicked, setIsClicked] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const storageKey = `liked_posts`;

  useEffect(() => {
    let isMounted = true;
    const run = async () => {
      const isReady = await initializeSDK();
      if (!isMounted) return;
      setSdkReady(isReady);
      if (!isReady) { setIsLoading(false); return; }

      try {
        const query = new AV.Query("PostLikes");
        query.equalTo("postId", postId);
        const postStats = await query.first();
        if (isMounted) {
          setLikeCount(postStats?.get('likes') || 0);
        }
      } catch (error) {
        console.error(`Failed to fetch likes for post ${postId}:`, error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    run();

    const likedPosts = JSON.parse(localStorage.getItem(storageKey) || '[]');
    if (likedPosts.includes(postId)) {
      setHasLiked(true);
    }

    return () => { isMounted = false; }
  }, [postId]);

  const handleClick = async () => {
    if (isSubmitting || !sdkReady || isLoading) return;
    
    setIsSubmitting(true);
    const newLikedState = !hasLiked;

    // 乐观更新 UI
    setHasLiked(newLikedState);
    setLikeCount(prevCount => (newLikedState ? prevCount + 1 : Math.max(0, prevCount - 1)));
    
    if (newLikedState) {
      setIsClicked(true);
      setTimeout(() => setIsClicked(false), 400); // 动画持续时间

      // 从按钮中心发射粒子
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        const x = (rect.left + rect.right) / 2 / window.innerWidth;
        const y = (rect.top + rect.bottom) / 2 / window.innerHeight;
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { x, y },
          colors: ['#fb7185', '#fda4af', '#ffedd5']
        });
      }
    }
    
    // 更新本地存储
    const likedPosts = new Set<string>(JSON.parse(localStorage.getItem(storageKey) || '[]'));
    if (newLikedState) likedPosts.add(postId);
    else likedPosts.delete(postId);
    localStorage.setItem(storageKey, JSON.stringify(Array.from(likedPosts)));
    
    // 后台同步逻辑与之前相同
    try {
      const query = new AV.Query("PostLikes");
      query.equalTo("postId", postId);
      let postStats = await query.first();

      if (!postStats && newLikedState) {
        const PostLikes = AV.Object.extend("PostLikes");
        postStats = new PostLikes();
        postStats.set("postId", postId);
        postStats.set("likes", 0);
      }

      if (postStats) {
        (postStats as AV.Object).increment("likes", newLikedState ? 1 : -1);
        await (postStats as AV.Object).save();
      }
    } catch (error) {
      console.error("Failed to submit like:", error);
      // 回滚 UI
      setHasLiked(!newLikedState);
      setLikeCount(prevCount => (newLikedState ? prevCount - 1 : prevCount + 1));
    } finally {
      setIsSubmitting(false);
    }
  };

  const buttonStateClasses = hasLiked
    ? 'btn-primary text-primary-content ring-primary/40' // 已点赞样式
    : 'btn-outline border-base-content/20'; // 未点赞样式

  if (isLoading) {
    return <div className="skeleton w-32 h-16 rounded-full"></div>
  }

  return (
    <button
      ref={buttonRef}
      className={`btn btn-lg rounded-full shadow-lg transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-xl focus:outline-none focus:ring-4 ${buttonStateClasses} ${isClicked ? 'animate-like-pulse' : ''}`}
      onClick={handleClick}
      disabled={isSubmitting}
      aria-label="点赞文章"
    >
      <div className="flex items-center justify-center gap-3">
        <i className={`${hasLiked ? "ri-heart-fill" : "ri-heart-line"} text-3xl transition-transform duration-200`}></i>
        {likeCount > 0 && <span className="text-xl font-bold">{likeCount}</span>}
      </div>
    </button>
  );
};

export default BlogLikeButton;