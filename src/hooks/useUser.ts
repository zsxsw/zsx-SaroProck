import { useState, useEffect, useCallback } from 'react';
import gravatar from 'gravatar';

// 定义用户信息的数据结构
export interface User {
  nickname: string;
  email: string;
  website?: string;
  avatar: string;
}

const USER_STORAGE_KEY = 'comment_user_info';

export const useUser = () => {
  const [user, setUser] = useState<User | null>(null);

  // 在组件加载时，从 localStorage 读取用户信息
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem(USER_STORAGE_KEY);
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error("Failed to parse user info from localStorage", error);
      localStorage.removeItem(USER_STORAGE_KEY);
    }
  }, []);

  // 保存用户信息到 state 和 localStorage
  const saveUser = useCallback((userInfo: Omit<User, 'avatar'>) => {
    // 使用 cravatar.cn 作为主机名进行加速
    const avatar = gravatar.url(userInfo.email, { 
      s: "100", // size
      d: "mp",  // default image (Mystery Person)
      hostname: "cravatar.cn" // 指定国内镜像源
    }, true);
    
    const fullUserInfo = { ...userInfo, avatar };
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(fullUserInfo));
    setUser(fullUserInfo);
  }, []);

  // 登出
  const logout = useCallback(() => {
    localStorage.removeItem(USER_STORAGE_KEY);
    setUser(null);
  }, []);

  return {
    user,
    isLoggedIn: !!user,
    saveUser,
    logout,
  };
};