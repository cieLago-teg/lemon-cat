export type Locale = 'zh' | 'en';
export const LOCALE_COOKIE = 'lemon_locale';

// 服务端与客户端共用语言来源，避免首屏中文、加载后突然切英文。
export function resolveLocale(saved: string | undefined, acceptLanguage = ''): Locale {
  if (saved === 'zh' || saved === 'en') return saved;
  const preferences = acceptLanguage.split(',').map((part) => {
    const [tag, ...parameters] = part.trim().toLowerCase().split(';');
    const weight = parameters.map((value) => value.trim()).find((value) => value.startsWith('q='));
    const quality = weight === undefined ? 1 : Number(weight.slice(2));
    return { tag, quality };
  }).filter(({ quality }) => Number.isFinite(quality) && quality > 0 && quality <= 1)
    .sort((a, b) => b.quality - a.quality);
  for (const { tag } of preferences) {
    if (/^zh(?:-|$)/.test(tag)) return 'zh';
    if (/^en(?:-|$)/.test(tag)) return 'en';
  }
  return 'en';
}

export const messages = {
  title: ['数字宠物档案馆', 'Your Digital Pet Companion'],
  description: ['让你的宠物成为陪伴你的桌面小伙伴', 'Bring a little version of your pet to your desktop.'],
  create: ['开始创建', 'Create a pet'], pets: ['我的宠物', 'My pets'], tasks: ['生成任务', 'Tasks'],
  developer: ['开发后台', 'Developer'], language: ['界面语言', 'Interface language'],
  login: ['登录', 'Sign in'], logout: ['退出', 'Sign out'],
  logoutFailed: ['退出失败，请重试', 'Could not sign out. Please try again.'],
  welcome: ['欢迎回来', 'Welcome back'], join: ['加入柠檬树苗', 'Join Lemon Cat'],
  welcomeHint: ['你的宠物们还在等你哦', 'Your pets are waiting for you.'],
  joinHint: ['给毛孩子建一份数字档案', 'Make a digital home for your pet.'],
  email: ['邮箱', 'Email'], password: ['密码', 'Password'], passwordMin: ['至少 8 位', 'At least 8 characters'],
  passwordRange: ['密码需要 8—128 位', 'Use a password with 8–128 characters.'],
  invalidEmail: ['请输入有效邮箱', 'Enter a valid email address.'], strength: ['密码强度', 'Password strength'],
  low: ['低', 'Low'], medium: ['中', 'Medium'], high: ['高', 'High'],
  tooShort: ['至少 8 位后才能注册', 'Use at least 8 characters to register.'],
  strongHint: ['长度和组合都很好', 'Good length and character variety.'],
  mediumHint: ['再加长一些或混合更多字符会更稳妥', 'Try a longer password with more character types.'],
  weakHint: ['建议混合字母、数字或符号', 'Try a mix of letters, numbers and symbols.'],
  invite: ['内测邀请码', 'Early access invitation code'],
  inviteHint: ['请输入维护者提供的邀请码', 'Enter the code provided by the maintainer'],
  waiting: ['请稍等…', 'Please wait…'], createAccount: ['创建账号', 'Create account'],
  noAccount: ['还没有账号？', 'New here?'], hasAccount: ['已经有账号了？', 'Already have an account?'],
  register: ['去注册', 'Sign up'], goLogin: ['去登录', 'Sign in'],
  authFailed: ['登录或注册失败，请重试', 'Could not sign in or register. Please try again.'],
  credentialsFailed: ['邮箱或密码不正确', 'Incorrect email or password.'],
  inviteFailed: ['注册需要有效的内测邀请码', 'A valid early access invitation code is required.'],
  exists: ['该邮箱已注册，请登录', 'This email is already registered. Please sign in.'],
  rateLimited: ['操作过于频繁，请稍后再试', 'Too many attempts. Please try again later.'],
  localStarting: ['正在进入本地开发模式…', 'Opening local developer mode…'],
  localEntry: ['我是开发者：免注册进入本地测试', 'Developer: enter local test mode'],
  localOnly: ['仅 localhost / 127.0.0.1 可用，正式环境自动关闭', 'Localhost / 127.0.0.1 only. Disabled in production.'],
  localFailed: ['开发者入口启动失败', 'Could not open developer mode.'],
  networkFailed: ['网络连接失败，请检查网络后重试。', 'Connection failed. Check your network and try again.'],
  runtimeFailed: ['检测到运行错误，若界面异常请刷新重试。', 'An unexpected error occurred. Refresh if the page is not working.'],
  incomplete: ['有操作未完成，请稍后重试。', 'An action could not be completed. Please try again.'],
  crashTitle: ['页面开小差了', 'Something went wrong'],
  crashHint: ['界面遇到意外错误。请重试；未提交的内容可能需要重新填写。', 'The page encountered an error. Try again; you may need to re-enter unsaved changes.'],
  retry: ['重新加载界面', 'Try again'],
} as const;

export type MessageKey = keyof typeof messages;
export function translate(locale: Locale, key: MessageKey): string {
  return messages[key][locale === 'zh' ? 0 : 1];
}

// 旧接口尚未返回稳定错误码；只翻译已知错误，未知错误保留状态码并使用友好提示。
export function authError(locale: Locale, status: number, serverMessage?: string): string {
  const known: MessageKey[] = ['credentialsFailed', 'inviteFailed', 'exists', 'rateLimited', 'passwordRange'];
  const key = known.find((candidate) => messages[candidate][0] === serverMessage);
  return key ? translate(locale, key) : `${translate(locale, 'authFailed')} (${status})`;
}
