import type { Config } from "tailwindcss";
import { fontFamily } from "tailwindcss/defaultTheme";

import baseConfig from "@nauta/tailwind-config/web";

export default {
  // Append the UI package path so its classes are included in the build.
  content: [...baseConfig.content, "../../packages/ui/src/**/*.{ts,tsx}"],
  presets: [baseConfig],
  theme: {
    extend: {
      fontFamily: {
        sans: [...fontFamily.sans],
        mono: [...fontFamily.mono],
      },
    },
  },
} satisfies Config;
