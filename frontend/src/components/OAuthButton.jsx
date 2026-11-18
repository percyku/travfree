import { PROVIDER_NAMES } from "../utils/oauth";

/** GitHub 的 mark（Octicons mark-github） */
const GitHubMark = () => (
  <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
  </svg>
);

const ICONS = { github: GitHubMark };

/**
 * 「使用 GitHub 登入」等按鈕，按下後由 onClick 導向平台的授權頁（utils/oauth.js 的 startOAuth）。
 * 外觀與 Google 的按鈕一致：白底、細框、全寬。
 */
const OAuthButton = ({ provider, label, onClick, disabled = false }) => {
  const Icon = ICONS[provider];
  return (
    <button
      type="button"
      className="btn btn-outline-dark bg-white text-neutral-100 w-100 d-flex align-items-center justify-content-center gap-2 py-2"
      onClick={onClick}
      disabled={disabled}
    >
      {Icon && <Icon />}
      {label ?? `使用 ${PROVIDER_NAMES[provider] ?? provider} 登入`}
    </button>
  );
};

export default OAuthButton;
