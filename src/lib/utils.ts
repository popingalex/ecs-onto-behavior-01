import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * shadcn/ui 使用的 className 合并。
 * 项目在 index.css 里自定义了字号（text-caption…）、圆角（rounded-ui）与阴影（shadow-card/pop）；
 * 必须登记到 tailwind-merge，否则 `text-caption` 会被当作文字颜色，无法替换组件自带的 `text-sm`。
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ['caption', 'label', 'body', 'body-lg', 'title', 'display'],
      radius: ['ui'],
      shadow: ['card', 'pop'],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
