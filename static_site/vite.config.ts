import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

function getPackageName(id: string) {
  const nodeModulesPath = id.split("node_modules/").pop();

  if (!nodeModulesPath) {
    return;
  }

  const parts = nodeModulesPath.split("/");

  if (parts[0].startsWith("@")) {
    return `${parts[0]}/${parts[1]}`;
  }

  return parts[0];
}

function chunkName(id: string) {
  if (!id.includes("node_modules")) {
    return;
  }

  const packageName = getPackageName(id);

  if (!packageName) {
    return;
  }

  if (["react", "react-dom", "scheduler"].includes(packageName)) {
    return "vendor-react";
  }

  if (packageName === "@mui/icons-material") {
    return "vendor-mui-icons";
  }

  if (packageName === "@mui/x-charts") {
    return "vendor-mui-charts";
  }

  if (packageName === "@mui/x-date-pickers") {
    return "vendor-mui-date-pickers";
  }

  if (
    packageName.startsWith("@mui/") ||
    packageName.startsWith("@emotion/") ||
    packageName === "@popperjs/core"
  ) {
    return "vendor-mui";
  }

  if (packageName === "apexcharts" || packageName === "react-apexcharts") {
    return "vendor-apexcharts";
  }

  if (packageName === "ace-builds") {
    return "vendor-ace";
  }

  if (
    packageName === "jsoneditor" ||
    packageName === "jsoneditor-react" ||
    packageName === "ajv" ||
    packageName === "json-source-map"
  ) {
    return "vendor-jsoneditor";
  }

  if (
    packageName === "react-markdown" ||
    packageName.startsWith("remark-") ||
    packageName.startsWith("rehype-") ||
    packageName.startsWith("micromark") ||
    packageName === "unified" ||
    packageName.includes("mdast") ||
    packageName.includes("hast") ||
    packageName.includes("unist") ||
    packageName.startsWith("vfile")
  ) {
    return "vendor-markdown";
  }

  if (
    packageName.startsWith("@tanstack/") ||
    packageName.startsWith("react-router") ||
    packageName === "axios" ||
    packageName === "dayjs"
  ) {
    return "vendor-app";
  }
}

function toBase64Url(value: Uint8Array) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function encryptContact(value: string, key: string) {
  const input = new TextEncoder().encode(value);
  const keyBytes = new TextEncoder().encode(key || "faryne.dev");
  const encrypted = input.map((byte, index) => byte ^ keyBytes[index % keyBytes.length]);

  return `v1.${toBase64Url(encrypted)}`;
}

function parseStringLiteral(value: string) {
  return Function(`"use strict"; return (${value});`)() as string;
}

function contactEncoderPlugin(secretKey: string): Plugin {
  const callPattern =
    /\bce\(\s*(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)\s*\)/g;

  return {
    name: "contact-encoder",
    enforce: "pre",
    transform(code, id) {
      if (!id.includes("/src/") || !/\.[cm]?[jt]sx?$/.test(id)) {
        return null;
      }

      const transformed = code.replace(callPattern, (match) => {
        const literal = match.slice(match.indexOf("(") + 1, -1).trim();
        const value = parseStringLiteral(literal);

        if (value.startsWith("v1.")) {
          return match;
        }

        const encrypted = encryptContact(value, secretKey);

        return `ce(${JSON.stringify(encrypted)})`;
      });

      if (transformed === code) {
        return null;
      }

      return {
        code: transformed,
        map: null,
      };
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    server: {
      // 用 ngrok 之類的工具把本機 dev server 開給手機連進來測時，把 ngrok
      // 給的網域加進這個陣列（例如 "xxxx.ngrok-free.app"）。這個網址每次
      // 重開 ngrok 都會變，是個人本機測試用的設定，不要把實際網址 commit
      // 進來。
      allowedHosts: ["localhost"],
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: chunkName,
        },
      },
    },
    plugins: [
      contactEncoderPlugin(env.VITE_SECRET_KEY),
      react({
        babel: {
          plugins: [["babel-plugin-react-compiler"]],
        },
      }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
