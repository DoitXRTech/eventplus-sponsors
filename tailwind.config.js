import colors from 'tailwindcss/colors';

// stone-500 un tono mas oscuro (#78716C daba 4.3:1 sobre el crema #F5F2EC; #6B645E da 5.2:1, AA).
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: { extend: { colors: { stone: { ...colors.stone, 500: '#6B645E' } } } },
  plugins: [],
};
