/** Official Chrome logo from google.com/chrome/static/images/chrome-logo.svg */
export function ChromeIcon({ className }: { className?: string }) {
  return (
    <img
      src="/icons/chrome-logo.svg"
      alt=""
      className={className}
      aria-hidden="true"
      draggable={false}
    />
  );
}
