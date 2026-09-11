import { CategoryMeta } from "../types";

export const categoriesConfig: CategoryMeta[] = [
  {
    id: "finance",
    name: "Finance & Accounting",
    description: "Tax, GST, discounts, margins, and number-to-words currency tools",
    iconName: "Receipt",
  },
  {
    id: "generators",
    name: "Generators",
    description: "QR codes, cryptographic passwords, UUIDs, and slugs",
    iconName: "Wand2",
  },
  {
    id: "converters",
    name: "Converters",
    description: "Units, timestamps, file sizes, base64, colors, and timecodes",
    iconName: "ArrowLeftRight",
  },
  {
    id: "calculators",
    name: "Calculators",
    description: "Dates, percentages, aspect ratios, commissions, and margins",
    iconName: "Calculator",
  },
  {
    id: "formatters",
    name: "Formatters & Code",
    description: "JSON, CSV, URL encoder, regex tester, and JWT inspector",
    iconName: "Code2",
  },
  {
    id: "media",
    name: "Media & Design",
    description: "Image compressor, resizer, converter, color picker & video presets",
    iconName: "Image",
  },
  {
    id: "seo",
    name: "Marketing & SEO",
    description: "UTM campaign builder, meta tag generator, character counter",
    iconName: "Share2",
  },
  {
    id: "productivity",
    name: "Productivity & Text",
    description: "Text line cleanup, case changer, and working days calculator",
    iconName: "CheckSquare",
  },
];
