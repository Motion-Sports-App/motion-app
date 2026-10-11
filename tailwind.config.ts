import type { Config } from 'tailwindcss';
const config: Config = { content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}'], theme: { extend: { colors: { ink: '#101310', lime: '#D8FF3E', paper: '#F7F8F4' }, boxShadow: { soft: '0 12px 40px rgba(16,19,16,.08)' } } }, plugins: [] };
export default config;
