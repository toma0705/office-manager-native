"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync } = require("child_process");

const token =
  process.env.EXPO_GIT_TOKEN ||
  process.env.GIT_TOKEN ||
  process.env.GITHUB_TOKEN;

function ensureNetrcCredentials(authToken) {
  if (!authToken) {
    console.log(
      "[preinstall] EXPO_GIT_TOKEN not found. Skipping credential helper setup."
    );
    return;
  }

  const netrcPath = path.join(os.homedir(), ".netrc");
  const netrcEntry = `machine github.com\n  login x-access-token\n  password ${authToken}\n`;

  try {
    let content = "";
    if (fs.existsSync(netrcPath)) {
      content = fs.readFileSync(netrcPath, "utf8");
      const withoutGithub = content
        .split(/\n?machine github\.com\n[\s\S]*?(?=\nmachine |$)/)
        .filter(Boolean);

      if (withoutGithub.length > 0) {
        // Preserve other machine entries by rebuilding the file without the old github block.
        const rebuilt = [];
        const regex = /(machine github\.com\n[\s\S]*?(?=\nmachine |$))/g;
        let lastIndex = 0;
        let match;
        while ((match = regex.exec(content)) !== null) {
          if (match.index > lastIndex) {
            rebuilt.push(content.slice(lastIndex, match.index));
          }
          lastIndex = regex.lastIndex;
        }
        if (lastIndex < content.length) {
          rebuilt.push(content.slice(lastIndex));
        }
        content = rebuilt.join("").trim();
      }
    }

    const finalContent = [content.trim(), netrcEntry.trim(), ""]
      .filter(Boolean)
      .join("\n");

    fs.writeFileSync(netrcPath, finalContent, { mode: 0o600 });
    console.log("[preinstall] Wrote GitHub credentials to ~/.netrc");
  } catch (error) {
    console.warn(`[preinstall] Failed to configure ~/.netrc: ${error.message}`);
  }
}

function ensureGitRewrite() {
  const rewrites = [
    ["https://github.com/", "ssh://git@github.com/"],
    ["https://github.com/", "git@github.com:"],
  ];

  rewrites.forEach(([httpsUrl, insteadOf]) => {
    try {
      execSync(
        `git config --global url."${httpsUrl}".insteadOf "${insteadOf}"`,
        {
          stdio: "ignore",
        }
      );
    } catch (error) {
      console.warn(
        `[preinstall] Failed to set git rewrite for ${insteadOf}: ${error.message}`
      );
    }
  });
}

ensureNetrcCredentials(token);
ensureGitRewrite();
