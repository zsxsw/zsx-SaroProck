import React, { useState, useEffect } from 'react';
import { useUser } from '@/hooks/useUser';

// 定义敏感用户列表（不区分大小写）
// 这个列表是公开的，只用于触发密码输入，所以放在前端是安全的
const SENSITIVE_USERS = ['evesunmaple', 'EveSunMaple', 'sunmaple', 'SunMaple', 'admin', '博主', 'evesunmaple@outlook.com'];

const LoginForm: React.FC = () => {
  const { saveUser } = useUser();
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [redirectUrl, setRedirectUrl] = useState('/');

  // --- 新增状态 ---
  // 用于存储需要输入的密码
  const [password, setPassword] = useState('');
  // 控制密码输入框是否显示
  const [isPasswordRequired, setIsPasswordRequired] = useState(false);
  // 用于显示错误信息
  const [error, setError] = useState('');
  // 用于防止重复提交
  const [isSubmitting, setIsSubmitting] = useState(false);


  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get('redirect');
    if (redirect) setRedirectUrl(redirect);
  }, []);

  // --- 新增逻辑：当昵称或邮箱输入变化时，检查是否为敏感词 ---
  useEffect(() => {
    const checkSensitive = () => {
      const lowerNickname = nickname.trim().toLowerCase();
      const lowerEmail = email.trim().toLowerCase();

      // 如果昵称或邮箱在敏感列表中，则要求输入密码
      if (SENSITIVE_USERS.includes(lowerNickname) || SENSITIVE_USERS.includes(lowerEmail)) {
        setIsPasswordRequired(true);
      } else {
        setIsPasswordRequired(false);
        setPassword(''); // 如果不再是敏感用户，清空密码
      }
    };
    checkSensitive();
  }, [nickname, email]);


  // --- 修改逻辑：处理表单提交 ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname || !email) return;

    // 清空之前的错误信息
    setError('');
    setIsSubmitting(true);

    // 如果需要密码验证
    if (isPasswordRequired) {
      if (!password) {
        setError('请输入管理员密码。');
        setIsSubmitting(false);
        return;
      }

      try {
        // 调用我们创建的后端 API
        const response = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          // 密码正确，保存用户信息并跳转
          saveUser({ nickname, email, website });
          window.location.href = redirectUrl;
        } else {
          // 密码错误，显示错误信息
          setError(data.message || '验证失败，请重试。');
        }
      } catch (err) {
        setError('网络错误，请稍后重试。');
      } finally {
        setIsSubmitting(false);
      }

    } else {
      // 如果不需要密码，直接保存并跳转
      saveUser({ nickname, email, website });
      window.location.href = redirectUrl;
    }
  };

  return (
    <div className="max-w-md mx-auto bg-base-100/80 border border-base-content/10 rounded-2xl shadow-lg backdrop-blur-md">
      <form className="p-6 md:p-8 space-y-6" onSubmit={handleSubmit}>
        <header className="space-y-1">
          <h2 className="text-2xl font-semibold flex items-center gap-2 text-primary">
            <i className="ri-user-smile-line text-xl" />
            留下你的足迹
          </h2>
          <p className="text-sm text-base-content/70">
            你的信息会保存在本地浏览器中，方便下次自动填入。
          </p>
        </header>

        <div className="space-y-4">
          <div className="form-control">
            <label className="label font-medium text-base-content mb-2">昵称<span className="text-error ml-0.5">*</span></label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="input input-bordered rounded-xl w-full"
              required
              minLength={2}
              maxLength={50}
              placeholder="你的昵称"
            />
          </div>

          <div className="form-control">
            <label className="label font-medium text-base-content mb-2">邮箱<span className="text-error ml-0.5">*</span></label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input input-bordered rounded-xl w-full"
              required
              placeholder="用于生成头像，不会公开"
            />
          </div>

          <div className="form-control">
            <label className="label font-medium text-base-content mb-2">网站 <span className="text-base-content/50">(可选)</span></label>
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="input input-bordered rounded-xl w-full"
              placeholder="https://your.site"
            />
          </div>
          
          {/* --- 新增元素：条件渲染密码输入框 --- */}
          {isPasswordRequired && (
            <div className="form-control transition-all duration-300 animate-fade-in">
              <label className="label font-medium text-base-content mb-2">管理员密码<span className="text-error ml-0.5">*</span></label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input input-bordered input-primary rounded-xl w-full"
                required
                placeholder="检测到管理员账户，请输入密码"
              />
            </div>
          )}
        </div>

        {/* --- 新增元素：显示错误信息 --- */}
        {error && (
          <div className="text-error text-sm text-center animate-shake">
            {error}
          </div>
        )}

        <div className="flex justify-end pt-4">
          <button type="submit" className={`btn btn-primary gap-1 ${isSubmitting ? 'loading' : ''}`} disabled={isSubmitting}>
            {isSubmitting ? '处理中...' : '保存并返回'}
            <i className="ri-arrow-right-line" />
          </button>
        </div>
      </form>
    </div>
  );
};

export default LoginForm;