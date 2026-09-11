export interface VideoPreset {
  platform: string;
  category: string;
  name: string;
  width: number;
  height: number;
  aspectRatio: string;
  maxDuration?: string;
  maxFileSize?: string;
  recommendedFormat: string;
  recommendedFps: string;
  notes?: string;
}

export const videoPresetsConfig: VideoPreset[] = [
  // YouTube
  {
    platform: "YouTube",
    category: "Standard Video",
    name: "YouTube 4K UHD",
    width: 3840,
    height: 2160,
    aspectRatio: "16:9",
    maxDuration: "12 hours",
    maxFileSize: "256 GB",
    recommendedFormat: "MP4 (H.264 / AAC)",
    recommendedFps: "24, 30, 60 fps",
    notes: "Best quality for landscape desktop and TV viewing",
  },
  {
    platform: "YouTube",
    category: "Standard Video",
    name: "YouTube 1080p Full HD",
    width: 1920,
    height: 1080,
    aspectRatio: "16:9",
    maxDuration: "12 hours",
    maxFileSize: "256 GB",
    recommendedFormat: "MP4 (H.264 / AAC)",
    recommendedFps: "24, 30, 60 fps",
    notes: "Standard industry standard for web uploads",
  },
  {
    platform: "YouTube",
    category: "Shorts",
    name: "YouTube Shorts (Vertical)",
    width: 1080,
    height: 1920,
    aspectRatio: "9:16",
    maxDuration: "60 seconds",
    maxFileSize: "500 MB",
    recommendedFormat: "MP4 (H.264)",
    recommendedFps: "30, 60 fps",
    notes: "Vertical mobile feed format",
  },

  // Instagram
  {
    platform: "Instagram",
    category: "Reels",
    name: "Instagram Reels",
    width: 1080,
    height: 1920,
    aspectRatio: "9:16",
    maxDuration: "90 seconds",
    maxFileSize: "4 GB",
    recommendedFormat: "MP4 / MOV (H.264)",
    recommendedFps: "30 fps",
    notes: "Keep safe margin 220px top and 420px bottom for UI icons",
  },
  {
    platform: "Instagram",
    category: "Feed Post",
    name: "Instagram Square Post",
    width: 1080,
    height: 1080,
    aspectRatio: "1:1",
    maxDuration: "60 seconds",
    maxFileSize: "4 GB",
    recommendedFormat: "MP4 / MOV",
    recommendedFps: "30 fps",
    notes: "Classic feed square format",
  },
  {
    platform: "Instagram",
    category: "Feed Post",
    name: "Instagram Portrait Post",
    width: 1080,
    height: 1350,
    aspectRatio: "4:5",
    maxDuration: "60 seconds",
    maxFileSize: "4 GB",
    recommendedFormat: "MP4 / MOV",
    recommendedFps: "30 fps",
    notes: "Occupies maximum vertical feed screen space",
  },
  {
    platform: "Instagram",
    category: "Stories",
    name: "Instagram Story",
    width: 1080,
    height: 1920,
    aspectRatio: "9:16",
    maxDuration: "60 seconds",
    maxFileSize: "4 GB",
    recommendedFormat: "MP4 / MOV",
    recommendedFps: "30 fps",
    notes: "Leave 250px top/bottom for profile header and reply bar",
  },

  // TikTok
  {
    platform: "TikTok",
    category: "Feed",
    name: "TikTok Vertical Video",
    width: 1080,
    height: 1920,
    aspectRatio: "9:16",
    maxDuration: "10 minutes",
    maxFileSize: "287 MB (iOS) / 72 MB (Android)",
    recommendedFormat: "MP4 / MOV",
    recommendedFps: "30, 60 fps",
    notes: "Safe margins on right side (120px) for likes/comments UI",
  },

  // LinkedIn
  {
    platform: "LinkedIn",
    category: "Feed Video",
    name: "LinkedIn Landscape",
    width: 1920,
    height: 1080,
    aspectRatio: "16:9",
    maxDuration: "10 minutes",
    maxFileSize: "5 GB",
    recommendedFormat: "MP4 (H.264 / AAC)",
    recommendedFps: "30 fps",
    notes: "Recommended for professional product demos and thought leadership",
  },
  {
    platform: "LinkedIn",
    category: "Feed Video",
    name: "LinkedIn Square",
    width: 1080,
    height: 1080,
    aspectRatio: "1:1",
    maxDuration: "10 minutes",
    maxFileSize: "5 GB",
    recommendedFormat: "MP4 (H.264)",
    recommendedFps: "30 fps",
    notes: "Mobile-friendly feed post",
  },

  // Facebook
  {
    platform: "Facebook",
    category: "Reels",
    name: "Facebook Reels",
    width: 1080,
    height: 1920,
    aspectRatio: "9:16",
    maxDuration: "90 seconds",
    maxFileSize: "4 GB",
    recommendedFormat: "MP4 / MOV",
    recommendedFps: "30 fps",
    notes: "Synced with Instagram Reels ecosystem",
  },
  {
    platform: "Facebook",
    category: "Feed Video",
    name: "Facebook Feed Landscape",
    width: 1280,
    height: 720,
    aspectRatio: "16:9",
    maxDuration: "240 minutes",
    maxFileSize: "10 GB",
    recommendedFormat: "MP4 / MOV",
    recommendedFps: "30 fps",
    notes: "Standard Facebook video feed",
  },

  // X / Twitter
  {
    platform: "Twitter / X",
    category: "Feed Video",
    name: "X Feed Landscape",
    width: 1920,
    height: 1080,
    aspectRatio: "16:9",
    maxDuration: "140 seconds (standard) / 2 hours (Premium)",
    maxFileSize: "512 MB",
    recommendedFormat: "MP4 (H.264)",
    recommendedFps: "30, 60 fps",
    notes: "Autoplays muted in user timeline",
  },
];

export const aspectRatiosList = [
  { name: "16:9 (Landscape Video, TV, YouTube)", w: 16, h: 9 },
  { name: "9:16 (Vertical, Shorts, Reels, TikTok)", w: 9, h: 16 },
  { name: "1:1 (Square, Instagram, Product)", w: 1, h: 1 },
  { name: "4:5 (Instagram Portrait Feed)", w: 4, h: 5 },
  { name: "4:3 (Legacy Television & Presentation)", w: 4, h: 3 },
  { name: "21:9 (Cinematic Ultrawide)", w: 21, h: 9 },
  { name: "3:2 (Classic 35mm DSLR Photography)", w: 3, h: 2 },
];

export const timecodeFpsList = [
  { label: "23.976 fps (NTSC Film)", value: 23.976 },
  { label: "24.0 fps (Standard Cinema Film)", value: 24.0 },
  { label: "25.0 fps (PAL Broadcast Europe/Asia)", value: 25.0 },
  { label: "29.97 fps (NTSC Video Broadcast)", value: 29.97 },
  { label: "30.0 fps (Standard Web & Mobile)", value: 30.0 },
  { label: "50.0 fps (PAL High Frame Rate)", value: 50.0 },
  { label: "59.94 fps (NTSC High Frame Rate)", value: 59.94 },
  { label: "60.0 fps (Web High Frame Rate / Gaming)", value: 60.0 },
];
