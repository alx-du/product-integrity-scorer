// Fetches a YouTube video transcript via yt-dlp and returns cleaned text,
// in the same { url, title, text } shape fetchPage.js returns for webpages.
//
// Requires yt-dlp on PATH: pip3 install --user yt-dlp
//
// YouTube's caption API is session-gated, so plain HTTP fetch can't reach
// captions directly. The android player client sidesteps that requirement
// (at the cost of skipping video formats we don't need anyway, since we
// only want subtitles).
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const run = promisify(execFile);

const YOUTUBE_RE = /(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([\w-]{11})/;

export function isYouTubeUrl(url) {
  return YOUTUBE_RE.test(url);
}

// Auto-generated captions ship as a rolling window: each cue repeats the
// tail of the previous one plus a couple new words. Dropping any line that
// is a prefix of the next collapses that back into plain prose.
function vttToText(vtt) {
  const raw = [];
  for (const line of vtt.split("\n")) {
    if (
      !line.trim() ||
      line.startsWith("WEBVTT") ||
      line.startsWith("Kind:") ||
      line.startsWith("Language:") ||
      line.includes("-->")
    ) {
      continue;
    }
    const clean = line.replace(/<[^>]+>/g, "").trim();
    if (clean) raw.push(clean);
  }

  const dedup = [];
  for (let i = 0; i < raw.length; i++) {
    if (i + 1 < raw.length && raw[i + 1].startsWith(raw[i])) continue;
    dedup.push(raw[i]);
  }
  return dedup.join(" ").replace(/\s+/g, " ").trim();
}

export async function fetchTranscript(url) {
  const videoId = url.match(YOUTUBE_RE)?.[1];
  if (!videoId) throw new Error(`Not a recognizable YouTube video URL: ${url}`);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "clearcart-yt-"));
  const outTemplate = path.join(tmpDir, "%(id)s");

  let title;
  try {
    const { stdout } = await run("yt-dlp", [
      "--skip-download",
      "--no-simulate", // --print otherwise implies --simulate, which skips writing the subtitle file
      "--write-subs",
      "--write-auto-subs",
      "--sub-lang",
      "en",
      "--sub-format",
      "vtt",
      "--extractor-args",
      "youtube:player_client=android",
      "--print",
      "title",
      "-o",
      outTemplate,
      url,
    ]);
    title = stdout.trim().split("\n")[0];
  } catch (e) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    if (e.code === "ENOENT") {
      throw new Error("yt-dlp not found on PATH. Install it with: pip3 install --user yt-dlp");
    }
    throw new Error(`yt-dlp failed for ${url}: ${(e.stderr || e.message).toString().slice(0, 300)}`);
  }

  const vttFile = fs.readdirSync(tmpDir).find((f) => f.endsWith(".vtt"));
  if (!vttFile) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    throw new Error(`No English captions available for ${url}`);
  }

  const text = vttToText(fs.readFileSync(path.join(tmpDir, vttFile), "utf8"));
  fs.rmSync(tmpDir, { recursive: true, force: true });

  return { url, title, text: text.slice(0, 60000) };
}
