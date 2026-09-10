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
  uploadStep: ['上传照片', 'Upload photo'], profileStep: ['完善档案', 'Pet profile'],
  styleStep: ['选择形象', 'Choose a style'], desktopStep: ['召唤到桌面', 'Bring to desktop'],
  heroLead: ['让它，', 'A little version of them,'], heroEnd: ['陪在你身边', 'right by your side'],
  heroHint: ['上传一张照片，为它建立数字档案，让它陪在你的桌面上。', 'Upload a photo to create a digital pet that keeps you company on your desktop.'],
  choosePhoto: ['选择一张照片', 'Choose a photo'], changePhoto: ['重新选择照片', 'Choose another photo'],
  selectedPhoto: ['已选', 'Selected'], photoTips: ['如何选择一张好的宠物照片？', 'What makes a good pet photo?'],
  tipLight: ['自然光线下拍摄，避免闪光灯惊吓宠物', 'Use natural light and avoid startling your pet with a flash.'],
  tipRelax: ['让宠物保持舒适放松的状态，清晰展示五官轮廓', 'Keep your pet comfortable, with their face clearly visible.'],
  tipFace: ['正脸或微侧脸最佳，能清晰看到眼睛和耳朵特征', 'A front or slight side view works best. Keep eyes and ears visible.'],
  tipBackground: ['背景简洁，突出宠物主体，避免杂物干扰', 'Choose a simple background without distracting clutter.'],
  invalidPhoto: ['请选择 20MB 以内的 PNG/JPEG/WebP 照片', 'Choose a PNG, JPEG or WebP photo no larger than 20 MB.'],
  photoTitle: ['先确认照片里的主角', 'First, choose the star of the photo'],
  photoCropHint: ['拖动框选一只宠物，留出耳朵、爪子和尾巴。单只且完整的照片可以直接使用整图。', 'Drag to crop around one pet, keeping ears, paws and tail in view. Use the full photo if it already shows one complete pet.'],
  photoCropAlt: ['拖动框选目标宠物', 'Drag to crop around your pet'],
  photoRotate: ['旋转 90°', 'Rotate 90°'], photoFull: ['使用整图', 'Use full photo'],
  photoExposure: ['亮度微调（会影响毛色，默认不调整）', 'Brightness (may affect coat color; unchanged by default)'],
  photoActual: ['实际用于识别和生成的照片', 'Photo used for recognition and generation'],
  photoPreparedAlt: ['处理后的宠物照片', 'Prepared pet photo'],
  photoLimit: ['方向和尺寸会自动规范化。无法从被遮挡的位置恢复真实花纹；多宠物请手动框选。这里的检查不会判断宠物身份。', 'Orientation and size are normalized automatically. Hidden markings cannot be recovered. Crop manually if there are several pets. These checks do not identify your pet.'],
  photoWarning: ['提示', 'Note'],
  photoConfirmCheck: ['我已确认只有目标宠物，关键部位清楚可见', 'Only my chosen pet is in the crop, with key features clearly visible.'],
  photoConfirm: ['确认照片，开始识别', 'Confirm photo and continue'],
  photoReadFailed: ['图片读取失败', 'The photo could not be read. Try another image.'],
  photoCompressFailed: ['图片压缩失败', 'The photo could not be processed. Try another image.'],
  photoBrowserFailed: ['浏览器无法处理照片', 'This browser could not process the photo.'],
  photoCropSmall: ['框选区域太小，请扩大到完整宠物', 'The crop is too small. Include the whole pet.'],
  photoLowRes: ['分辨率偏低，建议选择更清晰的原图', 'Low resolution. A sharper original photo is recommended.'],
  photoDark: ['画面整体较暗，请确认毛色与眼睛细节可见（黑色宠物可能误触发）', 'The photo looks dark. Check coat and eye detail; dark-coated pets may trigger this warning unnecessarily.'],
  photoBright: ['画面偏亮或主体较小，请确认白色毛发细节没有丢失', 'The photo looks bright or the pet looks small. Check that white fur details are visible.'],
  photoBlur: ['画面细节较少，可能模糊或主体过小，请肉眼确认', 'Few details were detected. Check for blur or a very small subject.'],
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

// 只在照片处理提示处调用，不用于宠物名字、标签或其他用户内容。
export function photoMessage(locale: Locale, message: string): string {
  const keys: MessageKey[] = ['invalidPhoto', 'photoReadFailed', 'photoCompressFailed', 'photoBrowserFailed', 'photoCropSmall', 'photoLowRes', 'photoDark', 'photoBright', 'photoBlur'];
  const key = keys.find((candidate) => messages[candidate][0] === message);
  if (message === '浏览器无法读取照片') return translate(locale, 'photoBrowserFailed');
  return key ? translate(locale, key) : message;
}
