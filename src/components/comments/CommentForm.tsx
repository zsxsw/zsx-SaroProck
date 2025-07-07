import React, { useState, useEffect } from 'react';
import * as AV from "leancloud-storage";
import { marked } from "marked";
import { useUser } from '@/hooks/useUser';

interface Props {
  identifier: string;
  commentType: "telegram" | "blog";
  onCommentAdded: () => void;
  sdkReady: boolean;
  parentId?: string;
  displayMode?: 'full' | 'compact';
  loading?: boolean;
  isReply?: boolean;
  onCancelReply?: () => void;
}

const CommentForm: React.FC<Props> = ({ identifier, commentType, parentId, onCommentAdded, sdkReady, displayMode = 'full', loading = false, isReply = false, onCancelReply }) => {
  const { user, isLoggedIn, logout } = useUser();
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [redirectHref, setRedirectHref] = useState('/login');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setRedirectHref(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoggedIn || !user || content.trim() === '') return;
    setSubmitting(true);
    
    try {
      const leanCloudClassName = commentType === 'telegram' ? 'TelegramComment' : 'Comment';
      const Comment = AV.Object.extend(leanCloudClassName);
      const comment = new Comment();

      comment.set('nickname', user.nickname);
      comment.set('email', user.email);
      comment.set('website', user.website || null);
      comment.set('avatar', user.avatar);
      comment.set('content', await marked(content));
      comment.set(commentType === 'telegram' ? 'postId' : 'slug', identifier);

      if (parentId) {
        const parentPointer = AV.Object.createWithoutData(leanCloudClassName, parentId);
        comment.set('parent', parentPointer);
      }
      
      await comment.save();

      onCommentAdded();
      setContent('');
    } catch (error) { 
      console.error("Error submitting comment:", error); 
    } finally { 
      setSubmitting(false); 
    }
  };

  if (isReply) {
    return (
      <form onSubmit={handleSubmit} className="reply-form space-y-3">
        <textarea 
          value={content} 
          onChange={(e) => setContent(e.target.value)} 
          className="textarea textarea-bordered rounded-lg h-20 w-full text-sm" 
          required 
          minLength={2} 
          placeholder="输入回复内容..."
          autoFocus
        ></textarea>
        <div className="flex justify-end items-center gap-2">
           <button type="button" onClick={onCancelReply} className="btn btn-ghost btn-sm rounded-md">取消</button>
           <button type="submit" className="btn btn-primary btn-sm rounded-md" disabled={submitting || !sdkReady}>
            {submitting ? <span className="loading loading-spinner loading-xs"></span> : '回复'}
          </button>
        </div>
      </form>
    );
  }

  if (displayMode === 'compact') {
    if (isLoggedIn && user) {
      return (
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input 
            type="text" 
            placeholder="留下你的想法..." 
            className="input input-sm w-full rounded-md text-xs"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
          />
          <button 
            type="submit" 
            className="btn btn-primary btn-sm btn-circle shrink-0" 
            disabled={submitting || !sdkReady || loading} 
            aria-label="发送评论"
          >
            {loading || submitting ? (
              <span className="loading loading-spinner loading-xs"></span>
            ) : (
              <i className="ri-send-plane-2-line"></i>
            )}
          </button>
          <div className="avatar w-8 h-8 shrink-0">
             <div className="rounded-full"><img src={user.avatar} alt={user.nickname} /></div>
          </div>
        </form>
      );
    }
    return (
      <a href={redirectHref} className="btn btn-primary btn-sm rounded-md w-full">
        <i className="ri-user-smile-line mr-1"></i>
        登录后评论
      </a>
    );
  }

  if (isLoggedIn && user) {
    return (
      <div className="loggedIn-form">
        <div className="flex items-center gap-3 mb-4">
          <div className="avatar w-10 h-10"><div className="rounded-full"><img src={user.avatar} alt={user.nickname} /></div></div>
          <div className="flex-grow"><p className="font-semibold">{user.nickname}</p><p className="text-xs text-base-content/60">{user.email}</p></div>
          <button onClick={logout} className="btn btn-ghost btn-sm rounded-md">登出</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <textarea value={content} onChange={(e) => setContent(e.target.value)} className="textarea textarea-bordered rounded-xl h-24 w-full" required minLength={2} placeholder="留下你的评论..."></textarea>
          <div className="flex justify-between items-center">
             <span className="text-xs text-base-content/60">支持 Markdown</span>
            <button type="submit" className="btn btn-primary btn-sm rounded-md" disabled={submitting || !sdkReady || loading}>
              {loading ? (
                <>
                  <span className="loading loading-spinner loading-xs"></span>
                  加载中...
                </>
              ) : submitting ? (
                <>
                  <span className="loading loading-spinner loading-xs"></span>
                  发送中...
                </>
              ) : (
                <>
                  <i className="ri-send-plane-2-line"></i>
                  发送
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    );
  }
  
  return (
    <div className="loggedOut-form flex flex-col items-center justify-center text-center p-8 bg-base-200/40 rounded-xl border border-base-content/10">
      <p className="mb-4 text-base-content/80">为了更好地交流，请先留下你的足迹。</p>
      <a href={redirectHref} className="btn btn-primary">
        <i className="ri-user-smile-line mr-1"></i>
        登录以发表评论
      </a>
    </div>
  );
};

export default CommentForm;