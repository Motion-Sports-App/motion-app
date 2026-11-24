export default function DefaultAvatar({ className = 'h-full w-full' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <circle cx="50" cy="50" r="50" fill="#9E9E9E" />
      <circle cx="50" cy="39" r="18" fill="#F2F2F2" />
      <path
        d="M17.5 87.5C22.2 71.2 34.9 60 50 60C65.1 60 77.8 71.2 82.5 87.5C73.7 95.3 62.4 100 50 100C37.6 100 26.3 95.3 17.5 87.5Z"
        fill="#F2F2F2"
      />
    </svg>
  );
}