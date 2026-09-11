import { ToolDefinition } from "../types";

// General Tools
import { UrlToQrTool } from "../modules/general/UrlToQrTool";
import { TextToQrTool } from "../modules/general/TextToQrTool";
import { QrGeneratorTool } from "../modules/general/QrGeneratorTool";
import { PasswordGeneratorTool } from "../modules/general/PasswordGeneratorTool";
import { UuidGeneratorTool } from "../modules/general/UuidGeneratorTool";
import { TimestampConverterTool } from "../modules/general/TimestampConverterTool";
import { DateCalculatorTool } from "../modules/general/DateCalculatorTool";
import { UnitConverterTool } from "../modules/general/UnitConverterTool";

// Marketing Tools
import { UtmBuilderTool } from "../modules/marketing/UtmBuilderTool";
import { CharacterCounterTool } from "../modules/marketing/CharacterCounterTool";
import { SlugGeneratorTool } from "../modules/marketing/SlugGeneratorTool";
import { MetaTagGeneratorTool } from "../modules/marketing/MetaTagGeneratorTool";

// Photo & Design Tools
import { ImageCompressorTool } from "../modules/photo/ImageCompressorTool";
import { ImageResizerTool } from "../modules/photo/ImageResizerTool";
import { ImageConverterTool } from "../modules/photo/ImageConverterTool";
import { ImageDimensionsTool } from "../modules/photo/ImageDimensionsTool";
import { ColorConverterTool } from "../modules/photo/ColorConverterTool";
import { ColorPickerTool } from "../modules/photo/ColorPickerTool";

// Video Tools
import { AspectRatioCalculatorTool } from "../modules/video/AspectRatioCalculatorTool";
import { VideoResolutionPresetsTool } from "../modules/video/VideoResolutionPresetsTool";
import { TimecodeConverterTool } from "../modules/video/TimecodeConverterTool";

// Developer Tools
import { JsonFormatterTool } from "../modules/developer/JsonFormatterTool";
import { Base64Tool } from "../modules/developer/Base64Tool";
import { UrlEncoderDecoderTool } from "../modules/developer/UrlEncoderDecoderTool";
import { RegexTesterTool } from "../modules/developer/RegexTesterTool";
import { JwtDecoderTool } from "../modules/developer/JwtDecoderTool";
import { HashGeneratorTool } from "../modules/developer/HashGeneratorTool";

// Operations Tools
import { PercentageCalculatorTool } from "../modules/operations/PercentageCalculatorTool";
import { FileSizeConverterTool } from "../modules/operations/FileSizeConverterTool";
import { TextCleanupTool } from "../modules/operations/TextCleanupTool";
import { CsvViewerFormatterTool } from "../modules/operations/CsvViewerFormatterTool";

// Business & Accounting Tools
import { DiscountCalculatorTool } from "../modules/business/DiscountCalculatorTool";
import { ProfitMarginCalculatorTool } from "../modules/business/ProfitMarginCalculatorTool";
import { CommissionCalculatorTool } from "../modules/business/CommissionCalculatorTool";
import { GstTaxCalculatorTool } from "../modules/business/GstTaxCalculatorTool";
import { NumberToWordsTool } from "../modules/business/NumberToWordsTool";

export const toolsConfig: ToolDefinition[] = [
  // 1. Accounting & Finance
  {
    id: "gst-calculator",
    name: "GST & Tax Calculator",
    shortDescription: "Calculate inclusive reverse GST or exclusive tax with CGST, SGST, and IGST splits.",
    description: "Essential accounting utility to compute forward GST addition or reverse extract base amounts and calculate CGST/SGST/IGST tax splits.",
    category: "finance",
    departments: ["accounting", "business", "operations"],
    iconName: "Receipt",
    keywords: ["gst", "tax", "vat", "accounting", "cgst", "sgst", "igst", "invoice", "finance"],
    popular: true,
    component: GstTaxCalculatorTool,
  },
  {
    id: "number-to-words",
    name: "Number & Currency to Words",
    shortDescription: "Convert numeric amounts into English words for check writing and invoice vouchers.",
    description: "Generates standard bank slip and check wording in Indian format (Lakhs/Crores) or Western format (Millions/Billions).",
    category: "finance",
    departments: ["accounting", "business", "operations"],
    iconName: "ReceiptText",
    keywords: ["number to words", "cheque", "check", "voucher", "rupees", "words", "accounting", "invoice"],
    popular: true,
    component: NumberToWordsTool,
  },
  {
    id: "discount-calculator",
    name: "Discount & Net Price Calculator",
    shortDescription: "Calculate final payable price, discount percentage, savings, and optional tax additions.",
    description: "Determine net prices after percentage or fixed discounts, including tax adjustments and savings summaries.",
    category: "finance",
    departments: ["business", "accounting"],
    iconName: "Tag",
    keywords: ["discount", "price", "sale", "percentage off", "savings", "tax", "accounting"],
    popular: true,
    component: DiscountCalculatorTool,
  },
  {
    id: "profit-margin-calculator",
    name: "Profit Margin & Markup Calculator",
    shortDescription: "Compute gross profit, margin percentage, markup ratio, and target selling price.",
    description: "Analyze profitability by comparing cost price against selling price with an interactive target margin solver.",
    category: "finance",
    departments: ["business", "accounting"],
    iconName: "TrendingUp",
    keywords: ["margin", "profit", "markup", "cost", "revenue", "target price", "business"],
    popular: true,
    component: ProfitMarginCalculatorTool,
  },
  {
    id: "commission-calculator",
    name: "Sales Commission Calculator",
    shortDescription: "Calculate sales commission earnings and total payouts with optional base salary.",
    description: "Compute sales reps' commission splits, tiered payouts, and monthly earnings breakdown.",
    category: "finance",
    departments: ["business", "accounting", "operations"],
    iconName: "Coins",
    keywords: ["commission", "sales", "bonus", "earnings", "salary", "incentive"],
    component: CommissionCalculatorTool,
  },

  // 2. General Utilities
  {
    id: "url-to-qr",
    name: "URL → QR Code Generator",
    shortDescription: "Generate high-resolution PNG & SVG vector QR codes from any web link.",
    description: "Create customized, scannable QR codes for websites, landing pages, and campaign links with custom colors and size settings.",
    category: "generators",
    departments: ["general", "marketing", "operations", "business"],
    iconName: "QrCode",
    keywords: ["qr", "url", "barcode", "link", "vector", "svg", "png"],
    popular: true,
    component: UrlToQrTool,
  },
  {
    id: "text-to-qr",
    name: "Text → QR Generator",
    shortDescription: "Encode text snippets, memos, instructions, and notes into scannable QR codes.",
    description: "Convert any text, instructions, or notes into a shareable QR code for easy mobile transfer.",
    category: "generators",
    departments: ["general", "operations"],
    iconName: "FileText",
    keywords: ["qr", "text", "memo", "notes", "barcode"],
    component: TextToQrTool,
  },
  {
    id: "qr-generator",
    name: "Universal QR Suite",
    shortDescription: "Generate specialized QR codes for Wi-Fi credentials, vCards, phone calls & emails.",
    description: "Multi-type QR code generator supporting Wi-Fi login, vCard digital business cards, phone calls, and direct emails.",
    category: "generators",
    departments: ["general", "marketing", "operations"],
    iconName: "Wand2",
    keywords: ["qr", "wifi", "vcard", "contact", "phone", "email", "generator"],
    popular: true,
    component: QrGeneratorTool,
  },
  {
    id: "password-generator",
    name: "Cryptographic Password Generator",
    shortDescription: "Generate cryptographically secure passwords locally in your browser with strength meters.",
    description: "Generate robust, uncrackable passwords using browser-native Web Crypto APIs with custom character sets and entropy scores.",
    category: "generators",
    departments: ["general", "development", "operations"],
    iconName: "Key",
    keywords: ["password", "security", "passphrase", "crypto", "generator"],
    popular: true,
    component: PasswordGeneratorTool,
  },
  {
    id: "uuid-generator",
    name: "UUID v4 Generator",
    shortDescription: "Generate single or bulk RFC 4122 compliant UUID v4 identifiers with instant copy.",
    description: "Generate universally unique identifiers (UUIDs) locally for database keys, tracking tokens, and API records.",
    category: "generators",
    departments: ["general", "development"],
    iconName: "Fingerprint",
    keywords: ["uuid", "guid", "v4", "unique id", "generator", "random"],
    component: UuidGeneratorTool,
  },
  {
    id: "timestamp-converter",
    name: "Unix Timestamp Converter",
    shortDescription: "Convert epoch timestamps in seconds/milliseconds to human dates and vice-versa.",
    description: "Two-way Unix timestamp converter supporting UTC, local time, ISO 8601 formatting, and a real-time live clock.",
    category: "converters",
    departments: ["general", "development", "operations"],
    iconName: "Clock",
    keywords: ["timestamp", "epoch", "unix", "date", "time", "converter"],
    popular: true,
    component: TimestampConverterTool,
  },
  {
    id: "date-calculator",
    name: "Date & Business Days Calculator",
    shortDescription: "Calculate days between dates, working days (excluding weekends), and add/subtract days.",
    description: "Calculate exact day intervals, working business days for SLAs and deadlines, or project future target dates.",
    category: "calculators",
    departments: ["general", "operations", "accounting"],
    iconName: "Calendar",
    keywords: ["date", "days", "difference", "working days", "business days", "calendar"],
    component: DateCalculatorTool,
  },
  {
    id: "unit-converter",
    name: "Universal Unit Converter",
    shortDescription: "Convert Length, Weight, Temperature, Area, Volume, Time, and Data Storage units.",
    description: "Comprehensive multi-category unit converter for engineering, shipping, storage, and operations tasks.",
    category: "converters",
    departments: ["general", "operations"],
    iconName: "Ruler",
    keywords: ["unit", "convert", "length", "weight", "metric", "imperial", "data"],
    component: UnitConverterTool,
  },

  // 3. Digital Marketing
  {
    id: "utm-builder",
    name: "Campaign UTM URL Builder",
    shortDescription: "Create Google Analytics tracking links with source, medium, campaign, and content tags.",
    description: "Build clean, URL-encoded campaign tracking URLs with live validation, copy shortcuts, and parameter summaries.",
    category: "seo",
    departments: ["marketing", "business"],
    iconName: "Link",
    keywords: ["utm", "campaign", "google analytics", "source", "medium", "tracking", "url"],
    popular: true,
    component: UtmBuilderTool,
  },
  {
    id: "character-counter",
    name: "Copywriting & Character Counter",
    shortDescription: "Real-time character, word, sentence counters with social platform limits and reading time.",
    description: "Analyze marketing text and ad copy against limits for Twitter, LinkedIn, Instagram captions, and Google Meta descriptions.",
    category: "seo",
    departments: ["marketing", "operations"],
    iconName: "AlignLeft",
    keywords: ["character counter", "word count", "social media limits", "reading time", "copywriting"],
    popular: true,
    component: CharacterCounterTool,
  },
  {
    id: "slug-generator",
    name: "SEO URL Slug Generator",
    shortDescription: "Convert article titles into clean, lowercase, URL-friendly kebab-case slugs.",
    description: "Automatically strips accents, special characters, and optional stop words to produce optimized web slugs.",
    category: "seo",
    departments: ["marketing", "development"],
    iconName: "Share2",
    keywords: ["slug", "url", "seo", "kebab-case", "permalink", "clean url"],
    component: SlugGeneratorTool,
  },
  {
    id: "meta-tag-generator",
    name: "SEO & Social Meta Tag Generator",
    shortDescription: "Generate HTML meta tags, Open Graph cards, and Twitter cards with live preview.",
    description: "Create search engine and social media meta tags for better SEO visibility and social feed sharing previews.",
    category: "seo",
    departments: ["marketing", "development"],
    iconName: "Code2",
    keywords: ["meta tags", "seo", "open graph", "twitter card", "html", "social preview"],
    component: MetaTagGeneratorTool,
  },

  // 4. Photo & Design
  {
    id: "image-compressor",
    name: "Client-Side Image Compressor",
    shortDescription: "Compress JPEG, PNG, and WebP images directly in your browser with quality controls.",
    description: "Reduce image file sizes by up to 80% without uploading images to any remote server. Zero privacy leak.",
    category: "media",
    departments: ["design", "marketing", "general"],
    iconName: "Image",
    keywords: ["image compress", "compressor", "reduce image size", "jpeg", "png", "webp", "photo"],
    popular: true,
    component: ImageCompressorTool,
  },
  {
    id: "image-resizer",
    name: "Image Resizer & Scaler",
    shortDescription: "Resize images by exact width/height, percentage, or social media dimension presets.",
    description: "Quickly resize banners, avatars, and social graphics while preserving aspect ratio client-side.",
    category: "media",
    departments: ["design", "marketing"],
    iconName: "Crop",
    keywords: ["image resize", "scale", "dimensions", "avatar", "presets", "banner"],
    popular: true,
    component: ImageResizerTool,
  },
  {
    id: "image-converter",
    name: "Image Format Converter",
    shortDescription: "Convert between PNG, JPEG, and WebP formats with custom quality settings.",
    description: "Easily switch image formats for web optimization using native browser HTML5 Canvas encoders.",
    category: "media",
    departments: ["design", "development"],
    iconName: "ArrowLeftRight",
    keywords: ["image converter", "png to jpg", "jpg to png", "webp", "format"],
    component: ImageConverterTool,
  },
  {
    id: "image-dimensions",
    name: "Image Dimension & Inspector",
    shortDescription: "Inspect exact image width, height, aspect ratio, megapixels, and file metadata.",
    description: "Quickly verify whether an asset satisfies platform dimension requirements without opening desktop software.",
    category: "media",
    departments: ["design", "video"],
    iconName: "Maximize2",
    keywords: ["dimensions", "aspect ratio", "megapixels", "image info", "dpi", "size"],
    component: ImageDimensionsTool,
  },
  {
    id: "color-converter",
    name: "HEX / RGB / HSL / CMYK Converter",
    shortDescription: "Convert between HEX, RGB, HSL, and CMYK color codes with CSS copy shortcuts.",
    description: "Translate color formats for web development, UI design, and commercial print preparation.",
    category: "converters",
    departments: ["design", "development"],
    iconName: "Palette",
    keywords: ["color converter", "hex to rgb", "rgb to hex", "hsl", "cmyk", "css color"],
    popular: true,
    component: ColorConverterTool,
  },
  {
    id: "color-picker",
    name: "Color Picker & Eyedropper",
    shortDescription: "Sample screen colors using native EyeDropper API and maintain a color palette history.",
    description: "Pick any color on your display, copy HEX/RGB codes, and build quick harmonic color swatches.",
    category: "media",
    departments: ["design", "development"],
    iconName: "Pipette",
    keywords: ["color picker", "eyedropper", "sample color", "palette", "swatch"],
    component: ColorPickerTool,
  },

  // 5. Video Production
  {
    id: "aspect-ratio-calculator",
    name: "Aspect Ratio Calculator & Scaler",
    shortDescription: "Calculate simplified aspect ratios (16:9, 9:16, 4:5, 1:1) and proportional dimension scaling.",
    description: "Find the exact simplified ratio from pixel dimensions and scale videos or graphics without distortion.",
    category: "calculators",
    departments: ["video", "design"],
    iconName: "Maximize2",
    keywords: ["aspect ratio", "16:9", "9:16", "scaler", "resolution", "video"],
    popular: true,
    component: AspectRatioCalculatorTool,
  },
  {
    id: "video-presets",
    name: "Video Resolution Presets Directory",
    shortDescription: "Searchable reference guide for YouTube, Instagram Reels, TikTok, and LinkedIn specs.",
    description: "Comprehensive cheat-sheet for video editors with exact pixel resolutions, aspect ratios, recommended codecs, and file sizes.",
    category: "media",
    departments: ["video", "marketing"],
    iconName: "Video",
    keywords: ["video presets", "youtube resolution", "reels resolution", "tiktok dimensions", "specs"],
    popular: true,
    component: VideoResolutionPresetsTool,
  },
  {
    id: "timecode-converter",
    name: "SMPTE Timecode Converter",
    shortDescription: "Convert frames to HH:MM:SS:FF timecode and milliseconds across major FPS standards.",
    description: "Calculates precise video frame timing for 23.976, 24, 25, 29.97, 30, 50, and 60 FPS timelines.",
    category: "converters",
    departments: ["video"],
    iconName: "Timer",
    keywords: ["timecode", "frames", "fps", "smpte", "video editing", "milliseconds"],
    component: TimecodeConverterTool,
  },

  // 6. Web Development
  {
    id: "json-formatter",
    name: "JSON Formatter & Validator",
    shortDescription: "Format, validate, and minify JSON payloads with line-by-line syntax error detection.",
    description: "Beautify messy JSON responses, check syntax, inspect payload sizes, and minify payloads for production.",
    category: "formatters",
    departments: ["development", "operations"],
    iconName: "Braces",
    keywords: ["json", "formatter", "validator", "beautifier", "minify", "developer"],
    popular: true,
    component: JsonFormatterTool,
  },
  {
    id: "base64-tool",
    name: "Base64 Encoder & Decoder",
    shortDescription: "Encode and decode text to Base64 with full UTF-8 emoji and URL-safe support.",
    description: "Fast, client-side Base64 converter supporting standard and URL-safe variants without corrupting unicode characters.",
    category: "converters",
    departments: ["development"],
    iconName: "Binary",
    keywords: ["base64", "encode", "decode", "binary", "utf8", "developer"],
    popular: true,
    component: Base64Tool,
  },
  {
    id: "url-encoder-decoder",
    name: "URL Encoder & Decoder",
    shortDescription: "Encode and decode URLs and URI query components safely in real-time.",
    description: "Translates special characters, spaces, and query parameters to standard %-escaped URI components.",
    category: "converters",
    departments: ["development", "marketing"],
    iconName: "Link",
    keywords: ["url encode", "url decode", "uri", "percent encoding", "query string"],
    component: UrlEncoderDecoderTool,
  },
  {
    id: "regex-tester",
    name: "Regular Expression (Regex) Tester",
    shortDescription: "Test regular expressions with live match highlighting, flags, and match group tables.",
    description: "Interactive regex workspace supporting global, case-insensitive, multiline, and dotAll flags with syntax checking.",
    category: "formatters",
    departments: ["development"],
    iconName: "Search",
    keywords: ["regex", "regular expression", "test", "match", "pattern", "tester"],
    popular: true,
    component: RegexTesterTool,
  },
  {
    id: "jwt-decoder",
    name: "JWT Token Inspector",
    shortDescription: "Decode JSON Web Tokens into Header and Payload with human-readable timestamp dates.",
    description: "Inspect JWT claims, token issued-at and expiration dates, and algorithm headers client-side.",
    category: "formatters",
    departments: ["development"],
    iconName: "ShieldCheck",
    keywords: ["jwt", "json web token", "decode", "claims", "bearer", "token"],
    popular: true,
    component: JwtDecoderTool,
  },
  {
    id: "hash-generator",
    name: "Cryptographic Hash Generator",
    shortDescription: "Compute SHA-256, SHA-384, SHA-512, and SHA-1 hashes for text and files using Web Crypto.",
    description: "Generate cryptographic checksums and hashes for verifying data integrity and secure identifiers.",
    category: "generators",
    departments: ["development"],
    iconName: "Hash",
    keywords: ["hash", "sha256", "sha512", "sha1", "checksum", "crypto"],
    component: HashGeneratorTool,
  },

  // 7. Operations Tools
  {
    id: "percentage-calculator",
    name: "Percentage Calculator Suite",
    shortDescription: "Calculate direct percentages, proportional ratios, and percentage increases/decreases.",
    description: "Quick three-in-one percentage tool for budget variance, performance metrics, and KPI tracking.",
    category: "calculators",
    departments: ["operations", "accounting", "business"],
    iconName: "Percent",
    keywords: ["percentage", "percent increase", "percent decrease", "ratio", "calculator"],
    popular: true,
    component: PercentageCalculatorTool,
  },
  {
    id: "file-size-converter",
    name: "File Size Unit Converter",
    shortDescription: "Convert between Bytes, KB, MB, GB, and TB with both 1024-binary and 1000-decimal scales.",
    description: "Translate file and disk sizes between operating system binary values and storage hardware decimal specs.",
    category: "converters",
    departments: ["operations", "video", "development"],
    iconName: "HardDrive",
    keywords: ["file size", "bytes", "kb", "mb", "gb", "tb", "storage", "converter"],
    component: FileSizeConverterTool,
  },
  {
    id: "text-cleanup",
    name: "Text Cleanup & Line Utilities",
    shortDescription: "Trim spaces, delete blank lines, remove duplicates, sort lines, and convert letter cases.",
    description: "Bulk line processing tool for cleaning up raw data lists, spreadsheets, and messy text documents.",
    category: "productivity",
    departments: ["operations", "marketing", "accounting"],
    iconName: "AlignLeft",
    keywords: ["text cleanup", "remove empty lines", "trim", "dedup", "sort lines", "case change"],
    component: TextCleanupTool,
  },
  {
    id: "csv-viewer",
    name: "CSV Viewer & JSON Converter",
    shortDescription: "Upload or paste CSV files to view interactive tables, sort columns, filter, and export to JSON.",
    description: "Lightweight spreadsheet viewer with row filtering, column sorting, and instant CSV to JSON conversion.",
    category: "formatters",
    departments: ["operations", "accounting", "development"],
    iconName: "Table",
    keywords: ["csv", "table", "csv to json", "spreadsheet", "viewer", "filter"],
    popular: true,
    component: CsvViewerFormatterTool,
  },
];
