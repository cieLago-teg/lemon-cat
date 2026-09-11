export const BRAND = { name: 'Pawnear', zh: '爪伴', title: 'Pawnear · 爪伴' } as const;
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
  title: [BRAND.title, `${BRAND.name} · Your pet, nearby`],
  description: ['让你的宠物成为陪伴你的桌面小伙伴', 'Bring a little version of your pet to your desktop.'],
  create: ['开始创建', 'Create a pet'], pets: ['我的宠物', 'My pets'], tasks: ['生成任务', 'Tasks'],
  developer: ['开发后台', 'Developer'], language: ['界面语言', 'Interface language'],
  login: ['登录', 'Sign in'], logout: ['退出', 'Sign out'],
  logoutFailed: ['退出失败，请重试', 'Could not sign out. Please try again.'],
  welcome: ['欢迎回来', 'Welcome back'], join: ['加入 Pawnear · 爪伴', 'Join Pawnear'],
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
  verifyFirst: ['请先验证邮箱', 'Please verify your email first.'],
  publicJoin: ['创建 Pawnear 账户', 'Create your Pawnear account'],
  publicJoinHint: ['先验证邮箱，再设置密码。每天最多 3 次创建，受全站预算限制。', 'Verify your email, then set a password. Up to 3 creations per day, subject to the shared budget.'],
  mailSent: ['如果该邮箱可用于此操作，我们已发送链接。请检查收件箱和垃圾邮件；30 分钟内有效。', 'If this email is eligible, we have sent a link. Check your inbox and spam folder; it expires in 30 minutes.'],
  sendLink: ['发送验证链接', 'Send verification link'],
  forgotPassword: ['忘记密码 / 重新发送验证', 'Forgot password / resend verification'],
  sendReset: ['发送密码重置链接', 'Send password reset link'],
  confirmAccount: ['验证邮箱 / 设置密码', 'Verify email / set password'],
  confirmAccountHint: ['请通过邮件里的链接打开此页，设置仅属于你的密码。', 'Open this page from your email link and choose your own password.'],
  confirmPassword: ['保存新密码', 'Save new password'],
  passwordSaved: ['密码已设置，旧登录会话已失效。请重新登录。', 'Password saved. Previous sessions have been signed out. Please sign in again.'],
  invalidLink: ['验证链接无效或已过期，请重新申请。', 'This link is invalid or expired. Request a new one.'],
  authOptionsFailed: ['无法读取注册状态，请刷新重试。', 'Could not load registration options. Refresh and try again.'],
  tasksHint: ['刷新、关页不会取消已提交的任务。显示“待核对”时请勿重新生成，向维护者提供任务编号。', 'Submitted tasks continue if you close or refresh the page. If review is needed, do not generate again; give the task ID to support.'],
  recoveryName: ['恢复生图结果时的宠物名字', 'Name for the recovered pet'],
  petNameRequired: ['请先填写宠物名字', 'Enter a pet name first.'],
  noTasks: ['暂时没有任务。', 'No tasks yet.'],
  extracting: ['照片识别', 'Photo recognition'], generating: ['形象生成', 'Image generation'], animating: ['动态生成', 'Animation'],
  saving: ['正在保存…', 'Saving…'], saveFailed: ['保存失败，请重试。', 'Could not save. Please try again.'],
  recoverPet: ['恢复并保存宠物档案', 'Recover and save pet'],
  queued: ['已排队，等待处理', 'Queued for processing'],
  submitting: ['正在提交，请勿重复生成', 'Submitting; do not generate again'],
  polling: ['模型生成处理中', 'The model is processing your request'],
  materializing: ['正在保存和处理成品', 'Saving and processing the result'],
  success: ['生成完成', 'Complete'], failed: ['生成失败，详情请联系维护者核对', 'Generation failed. Contact support with the task ID.'],
  needs_review: ['提交结果待核对，请勿重复生成', 'Submission needs review. Do not generate again.'],
  feedbackTitle: ['这张画得怎么样？（可选反馈）', 'How does this look? (Optional feedback)'],
  feedbackHint: ['评分不会拦截生成，也不代表授权用你的照片训练模型。1 分不满意，5 分很满意。', 'Feedback does not block generation or grant permission to train on your photos. Rate from 1 (poor) to 5 (great).'],
  feedbackSaved: ['反馈已保存，谢谢你帮它变得更好。', 'Feedback saved. Thanks for helping us improve.'],
  feedbackFailed: ['反馈未保存，请稍后重试。', 'Feedback was not saved. Please try again.'],
  feedbackReady: ['这张达到我愿意使用的质量', 'I would use this image as my pet'],
  saveFeedback: ['保存反馈', 'Save feedback'], chooseRating: ['请选择', 'Choose'],
  rateIdentity: ['像不像它', 'Resemblance'], rateStyle: ['画风满意度', 'Style'],
  rateAnatomy: ['身体完整度', 'Anatomy'], rateDesktop: ['桌宠形象满意度', 'Desktop appearance'],
  failIdentity: ['不像我的宠物', 'Does not resemble my pet'], failStyle: ['画风不对', 'Wrong style'],
  failAnatomy: ['多头 / 多只 / 肢体异常', 'Extra heads, pets or limbs'], failMarkings: ['毛色花纹不对', 'Wrong colors or markings'],
  failCrop: ['耳爪尾被裁切', 'Ears, paws or tail cropped'], failBackground: ['背景或白边问题', 'Background or white edges'], failDetail: ['模糊 / 细节不好', 'Blurred or poor detail'],
} as const;

export type MessageKey = keyof typeof messages;
export function translate(locale: Locale, key: MessageKey): string {
  return messages[key][locale === 'zh' ? 0 : 1];
}

// 旧接口尚未返回稳定错误码；只翻译已知错误，未知错误保留状态码并使用友好提示。
export function authError(locale: Locale, status: number, serverMessage?: string): string {
  const known: MessageKey[] = ['credentialsFailed', 'inviteFailed', 'exists', 'rateLimited', 'passwordRange', 'verifyFirst'];
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
