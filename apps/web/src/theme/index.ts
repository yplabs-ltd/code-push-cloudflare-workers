import { createSystem, defaultConfig } from "@chakra-ui/react";

export const system = createSystem(defaultConfig, {
  theme: {
    tokens: {
      colors: {
        brand: {
          50: { value: "#e6f6ff" },
          100: { value: "#bae3ff" },
          200: { value: "#7cc4fa" },
          300: { value: "#47a3f3" },
          400: { value: "#2186eb" },
          500: { value: "#0967d2" },
          600: { value: "#0552b5" },
          700: { value: "#03449e" },
          800: { value: "#01337d" },
          900: { value: "#002159" },
          950: { value: "#001234" },
        },
      },
    },
    semanticTokens: {
      colors: {
        brand: {
          solid: { value: "{colors.brand.500}" },
          contrast: { value: "{colors.brand.100}" },
          fg: { value: "{colors.brand.700}" },
          muted: { value: "{colors.brand.100}" },
          subtle: { value: "{colors.brand.200}" },
          emphasized: { value: "{colors.brand.300}" },
          focusRing: { value: "{colors.brand.500}" },
        },
      },
    },
  },
});
